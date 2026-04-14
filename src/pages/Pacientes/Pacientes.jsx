import { useEffect, useState } from "react";
import { pacienteService } from "../../services/pacienteService";
import { supabase } from "../../lib/supabaseClient";

function Pacientes() {
  const [formulario, setFormulario] = useState({
    id: null,
    nombre: "",
    apellido: "",
    cedula: "",
    telefono: "",
    email: "",
    fecha_nacimiento: "",
    direccion: "",
    genero: "",
    seguro: ""
  });

  const [pacientes, setPacientes] = useState([]);
  const [modoEdicion, setModoEdicion] = useState(false);

  const [imagenCedula, setImagenCedula] = useState(null);
  const [previewCedula, setPreviewCedula] = useState(null);

  useEffect(() => {
    cargarPacientes();
  }, []);

  const cargarPacientes = async () => {
    const { data, error } = await pacienteService.obtenerPacientes();
    if (!error) setPacientes(data);
  };

  const manejarCambio = (e) => {
    setFormulario({
      ...formulario,
      [e.target.name]: e.target.value
    });
  };

  const manejarArchivo = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImagenCedula(file);
      setPreviewCedula(URL.createObjectURL(file));
    }
  };

  const subirImagen = async (pacienteId) => {
    if (!imagenCedula) return null;

    const nombre = `cedula-${pacienteId}-${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("pacientes-documentos")
      .upload(nombre, imagenCedula, { upsert: true });

    if (error) {
      alert("Error subiendo imagen");
      return null;
    }

    const { data } = supabase.storage
      .from("pacientes-documentos")
      .getPublicUrl(nombre);

    return data.publicUrl;
  };

  const guardarPaciente = async (e) => {
    e.preventDefault();

    let resultado;

    if (modoEdicion) {
      resultado = await pacienteService.actualizarPaciente(formulario.id, formulario);
    } else {
      resultado = await pacienteService.crearPaciente(formulario);
    }

    if (resultado?.error) {
      alert("Error");
      return;
    }

    const pacienteId = modoEdicion ? formulario.id : resultado.data?.id;

    // Subir imagen si existe
    const urlImagen = await subirImagen(pacienteId);

    if (urlImagen) {
      await supabase.from("pacientes_documentos").insert([
        {
          paciente_id: pacienteId,
          tipo: "cedula",
          url: urlImagen
        }
      ]);
    }

    alert("Guardado correctamente");

    setFormulario({
      id: null,
      nombre: "",
      apellido: "",
      cedula: "",
      telefono: "",
      email: "",
      fecha_nacimiento: "",
      direccion: "",
      genero: "",
      seguro: ""
    });

    setPreviewCedula(null);
    setImagenCedula(null);
    setModoEdicion(false);

    cargarPacientes();
  };

  const editarPaciente = async (paciente) => {
    setFormulario(paciente);
    setModoEdicion(true);

    // Buscar documento
    const { data } = await supabase
      .from("pacientes_documentos")
      .select("*")
      .eq("paciente_id", paciente.id)
      .eq("tipo", "cedula")
      .maybeSingle();

    if (data) {
      setPreviewCedula(data.url);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const eliminarPaciente = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este paciente?")) {
      const { error } = await pacienteService.eliminarPaciente(id);
      if (!error) {
        alert("Eliminado");
        cargarPacientes();
      }
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "20px auto", fontFamily: "Arial" }}>

      <h1 style={{ textAlign: "center", color: "#4A90E2" }}>
        Gestión de Pacientes
      </h1>

      {/* CONTENEDOR PRINCIPAL */}
      <div style={{ display: "flex", gap: "20px" }}>

        {/* FORMULARIO */}
        <form
          onSubmit={guardarPaciente}
          style={{
            flex: 2,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
            background: "#f7f9fc",
            padding: "20px",
            borderRadius: "10px"
          }}
        >
          <input name="nombre" placeholder="Nombre" value={formulario.nombre} onChange={manejarCambio} required />
          <input name="apellido" placeholder="Apellido" value={formulario.apellido} onChange={manejarCambio} required />
          <input name="cedula" placeholder="Cédula (o padre si menor)" value={formulario.cedula} onChange={manejarCambio} required />
          <input name="telefono" placeholder="Teléfono" value={formulario.telefono} onChange={manejarCambio} />
          <input name="email" placeholder="Email" value={formulario.email} onChange={manejarCambio} />
          <input type="date" name="fecha_nacimiento" value={formulario.fecha_nacimiento} onChange={manejarCambio} />
          <input name="direccion" placeholder="Dirección" value={formulario.direccion} onChange={manejarCambio} />

          <select name="genero" value={formulario.genero} onChange={manejarCambio}>
            <option value="">Género</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
          </select>

          <input name="seguro" placeholder="Seguro (opcional)" value={formulario.seguro} onChange={manejarCambio} />

          <button type="submit" style={{ gridColumn: "1 / -1", background: "#4A90E2", color: "#fff", padding: "10px", border: "none" }}>
            {modoEdicion ? "Actualizar" : "Guardar"}
          </button>
        </form>

        {/* PANEL DERECHO */}
        <div style={{ flex: 1, background: "#fff", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <h3>Documento</h3>

          <input type="file" accept="image/*" onChange={manejarArchivo} />

          {previewCedula && (
            <img
              src={previewCedula}
              alt="Cedula"
              style={{ width: "100%", marginTop: "10px", borderRadius: "8px" }}
            />
          )}

          <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
            <button type="button" onClick={() => setPreviewCedula(null)}>Eliminar</button>
          </div>
        </div>

      </div>

      {/* LISTA ABAJO */}
      <table style={{ width: "100%", marginTop: "30px", borderCollapse: "collapse" }}>
        <thead style={{ background: "#4A90E2", color: "#fff" }}>
          <tr>
            <th>Nombre</th>
            <th>Apellido</th>
            <th>Cédula</th>
            <th>Teléfono</th>
            <th>Seguro</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {pacientes.map((p) => (
            <tr key={p.id}>
              <td>{p.nombre}</td>
              <td>{p.apellido}</td>
              <td>{p.cedula}</td>
              <td>{p.telefono}</td>
              <td>{p.seguro}</td>
              <td>
                <button onClick={() => editarPaciente(p)}>✏️</button>
                <button onClick={() => eliminarPaciente(p.id)}>🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}

export default Pacientes;