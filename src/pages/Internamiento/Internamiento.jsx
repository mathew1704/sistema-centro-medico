import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  actualizarInternamiento,
  actualizarMedicacionInternamiento,
  agregarMedicacionInternamiento,
  buscarPacientesInternamiento,
  crearInternamiento,
  darAltaInternamiento,
  eliminarInternamiento,
  eliminarMedicacionInternamiento,
  generarPrefacturaInternamiento,
  listarHabitacionesDisponibles,
  listarInternamientos,
  listarMedicosInternamiento,
  listarMedicacionInternamiento,
  listarOrdenesMedicas,
  listarProductosInternamiento,
  obtenerInternamientoPorId,
  obtenerResumenImpresionInternamiento,
  registrarOrdenMedica,
  listarDiagnosticos,
  listarMotivosConsulta,
} from "../../services/internamientoService";
import {
  buttonPrimaryStyle,
  buttonSoftStyle,
  cardStyle,
  getUiColors,
  inputStyle,
  labelStyle,
  pageWrapperStyle,
  selectStyle,
  statCardStyle,
  textareaStyle,
} from "../../styles/uiTheme";

const modeloFormulario = {
  id: null,
  paciente_id: "",
  medico_id: "",
  habitacion_id: "",
  origen_ingreso: "ingreso",
  emergencia_origen_id: "",
  diagnostico_ingreso_id: "",
  diagnostico_ingreso_nota: "",
  motivo_ingreso_id: "",
  motivo_ingreso_nota: "",
  nota_ingreso: "",
  autorizacion_numero: "",
  estado: "activo",
};

const modeloOrden = {
  indicacion: "",
};

const modeloMedicacion = {
  id: null,
  orden_id: "",
  producto_id: "",
  filtro_producto: "",
  dosis: "",
  frecuencia: "",
  via: "",
};

function nombreCompletoPersona(persona) {
  return `${persona?.nombre || ""} ${persona?.apellido || ""}`.trim();
}

function obtenerTelefonoPaciente(paciente) {
  return (
    paciente?.telefono_principal ||
    paciente?.telefono ||
    paciente?.pacientes_telefonos?.[0]?.telefono ||
    ""
  );
}

function obtenerSeguroPaciente(paciente) {
  return (
    paciente?.nombre_aseguradora ||
    paciente?.seguro_activo?.ars?.nombre ||
    paciente?.ars_nombre ||
    ""
  );
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "";
  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();

  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  let meses = hoy.getMonth() - nacimiento.getMonth();
  let dias = hoy.getDate() - nacimiento.getDate();

  if (dias < 0) {
    meses -= 1;
    const ultimoDiaMesAnterior = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      0,
    ).getDate();
    dias += ultimoDiaMesAnterior;
  }

  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  return `${anios}A ${meses}M ${dias}D`;
}

function obtenerEspecialidadMedico(medico) {
  if (!medico?.especialidades) return "";
  if (Array.isArray(medico.especialidades)) {
    return medico.especialidades
      .map((e) => e?.nombre)
      .filter(Boolean)
      .join(", ");
  }
  return medico.especialidades?.nombre || "";
}

function etiquetaHabitacion(habitacion) {
  if (!habitacion) return "";
  const numero = habitacion?.numero
    ? `Hab. ${habitacion.numero}`
    : "Habitación";
  const tipo = habitacion?.tipo ? ` | ${habitacion.tipo}` : "";
  const piso = habitacion?.piso ? ` | Piso ${habitacion.piso}` : "";
  const camas = ` | Camas disponibles: ${habitacion?.camas_disponibles || 0}`;
  return `${numero}${tipo}${piso}${camas}`;
}

function etiquetaPaciente(paciente) {
  return [
    paciente?.record ? `Rec: ${paciente.record}` : null,
    nombreCompletoPersona(paciente),
    paciente?.cedula ? `Céd: ${paciente.cedula}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatearFechaHora(fecha) {
  if (!fecha) return "-";
  return new Date(fecha).toLocaleString();
}

function construirHtmlImpresionInternamiento(resumen) {
  const internamiento = resumen?.internamiento || {};
  const paciente = internamiento?.pacientes || {};
  const medico = internamiento?.medicos || {};
  const habitacion =
    internamiento?.habitacion || internamiento?.camas?.habitaciones || null;

  const ordenes = resumen?.ordenes || [];
  const medicacion = resumen?.medicacion || [];
  const historialMedicacion = resumen?.historialMedicacion || [];
  const notas = resumen?.notas || [];
  const insumos = resumen?.insumos || [];
  const analiticas = resumen?.analiticas || [];

  const seguro = paciente?.seguro_activo || {};
  const telefono = obtenerTelefonoPaciente(paciente);
  const seguroNombre = obtenerSeguroPaciente(paciente);
  const afiliado = paciente?.numero_afiliado || seguro?.numero_afiliado || "";

  const filasOrdenes = ordenes.length
    ? ordenes
        .map(
          (o) => `
          <tr>
            <td>${escapeHtml(formatearFechaHora(o.fecha))}</td>
            <td>${escapeHtml(nombreCompletoPersona(o.medicos))}</td>
            <td>${escapeHtml(o.indicacion || "")}</td>
          </tr>
        `,
        )
        .join("")
    : `<tr><td colspan="3">Sin órdenes médicas registradas.</td></tr>`;

  const filasMedicacion = medicacion.length
    ? medicacion
        .map(
          (m) => `
          <tr>
            <td>${escapeHtml(m.productos?.codigo || "")}</td>
            <td>${escapeHtml(m.productos?.nombre || "")}</td>
            <td>${escapeHtml(m.dosis || "")}</td>
            <td>${escapeHtml(m.frecuencia || "")}</td>
            <td>${escapeHtml(m.via || "")}</td>
          </tr>
        `,
        )
        .join("")
    : `<tr><td colspan="5">Sin medicación registrada.</td></tr>`;

  const filasHistorialMedicacion = historialMedicacion.length
    ? historialMedicacion
        .map(
          (h) => `
          <tr>
            <td>${escapeHtml(h.medicacion_internamiento?.productos?.nombre || "")}</td>
            <td>${escapeHtml(h.estado || "")}</td>
            <td>${escapeHtml(formatearFechaHora(h.fecha_aplicacion || h.created_at))}</td>
            <td>${escapeHtml(nombreCompletoPersona(h.usuarios) || h.usuarios?.username || "")}</td>
            <td>${escapeHtml(h.nota || "")}</td>
          </tr>
        `,
        )
        .join("")
    : `<tr><td colspan="5">Sin historial de administración.</td></tr>`;

  const filasNotas = notas.length
    ? notas
        .map(
          (n) => `
          <tr>
            <td>${escapeHtml(formatearFechaHora(n.fecha))}</td>
            <td>${escapeHtml(n.medicamento_resumen || "")}</td>
            <td>${escapeHtml(n.nota || "")}</td>
            <td>${escapeHtml(nombreCompletoPersona(n.usuarios) || n.usuarios?.username || "")}</td>
          </tr>
        `,
        )
        .join("")
    : `<tr><td colspan="4">Sin notas de enfermería.</td></tr>`;

  const filasInsumos = insumos.length
    ? insumos
        .map(
          (i) => `
          <tr>
            <td>${escapeHtml(i.productos?.codigo || "")}</td>
            <td>${escapeHtml(i.productos?.nombre || "")}</td>
            <td>${escapeHtml(i.cantidad || "")}</td>
            <td>${escapeHtml(i.precio_unitario || "")}</td>
            <td>${escapeHtml(i.subtotal || "")}</td>
          </tr>
        `,
        )
        .join("")
    : `<tr><td colspan="5">Sin insumos registrados.</td></tr>`;

  const filasAnaliticas = analiticas.length
    ? analiticas
        .map(
          (a) => `
          <tr>
            <td>${escapeHtml(a.analiticas?.codigo || "")}</td>
            <td>${escapeHtml(a.analiticas?.nombre || "")}</td>
            <td>${escapeHtml(a.estado || "")}</td>
            <td>${escapeHtml(a.observacion || "")}</td>
          </tr>
        `,
        )
        .join("")
    : `<tr><td colspan="4">Sin analíticas registradas.</td></tr>`;

  const textoMotivo = [internamiento?.motivos_consulta?.nombre, internamiento?.motivo_ingreso_nota].filter(Boolean).join(' - ');
  const textoDiagnostico = [
    internamiento?.diagnosticos?.codigo ? `[${internamiento.diagnosticos.codigo}]` : null,
    internamiento?.diagnosticos?.nombre,
    internamiento?.diagnostico_ingreso_nota
  ].filter(Boolean).join(' ');

  return `
    <html>
      <head>
        <title>Resumen de Internamiento</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; }
          .page { width: 100%; }
          .header {
            display:flex; justify-content:space-between; align-items:flex-start; gap:20px;
            border-bottom:1px solid #000; padding-bottom:8px; margin-bottom:12px;
          }
          .title { font-size:28px; font-weight:700; text-align:center; flex:1; }
          .logo { font-size:20px; font-weight:700; }
          .meta { font-size:12px; line-height:1.6; text-align:right; }
          .row { display:flex; gap:14px; flex-wrap:wrap; margin-bottom:8px; }
          .field { flex:1; min-width:180px; font-size:13px; }
          .label { font-weight:700; }
          .box {
            border:1px solid #000; min-height:52px; padding:8px; white-space:pre-wrap;
            font-size:12px; line-height:1.5;
          }
          .section-title { font-size:14px; font-weight:700; margin:16px 0 6px; }
          table { width:100%; border-collapse:collapse; margin-top:6px; font-size:12px; }
          th, td { border:1px solid #000; padding:6px; vertical-align:top; }
          th { background:#efefef; text-align:left; }
          .barcode {
            margin-top:12px; font-size:22px; font-weight:700; text-align:right; letter-spacing:2px;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="logo">CENTRO MEDICO</div>
            <div class="title">Resumen de Internamiento</div>
            <div class="meta">
              <div><span class="label">Fecha ingreso:</span> ${escapeHtml(formatearFechaHora(internamiento.fecha_ingreso))}</div>
              <div><span class="label">Estado:</span> ${escapeHtml(internamiento.estado || "")}</div>
              <div><span class="label">Prefactura:</span> ${escapeHtml(internamiento.prefactura_numero || "")}</div>
            </div>
          </div>

          <div class="row">
            <div class="field"><span class="label">Nombre:</span> ${escapeHtml(nombreCompletoPersona(paciente))}</div>
            <div class="field"><span class="label">Récord:</span> ${escapeHtml(paciente.record || "")}</div>
            <div class="field"><span class="label">Cédula:</span> ${escapeHtml(paciente.cedula || "")}</div>
            <div class="field"><span class="label">Edad:</span> ${escapeHtml(calcularEdad(paciente.fecha_nacimiento))}</div>
          </div>

          <div class="row">
            <div class="field"><span class="label">Habitación:</span> ${escapeHtml(habitacion?.numero || "")}</div>
            <div class="field"><span class="label">Teléfono:</span> ${escapeHtml(telefono || "")}</div>
            <div class="field"><span class="label">Seguro:</span> ${escapeHtml(seguroNombre || "")}</div>
            <div class="field"><span class="label">Afiliado:</span> ${escapeHtml(afiliado || "")}</div>
          </div>

          <div class="row">
            <div class="field"><span class="label">Médico responsable:</span> ${escapeHtml(nombreCompletoPersona(medico))}</div>
            <div class="field"><span class="label">Exequátur:</span> ${escapeHtml(medico.exequatur || "")}</div>
            <div class="field"><span class="label">Autorización:</span> ${escapeHtml(internamiento.autorizacion_numero || "")}</div>
            <div class="field"><span class="label">Origen ingreso:</span> ${escapeHtml(internamiento.origen_ingreso || "")}</div>
          </div>

          <div class="section-title">Motivo de ingreso</div>
          <div class="box">${escapeHtml(textoMotivo)}</div>

          <div class="section-title">Diagnóstico de ingreso</div>
          <div class="box">${escapeHtml(textoDiagnostico)}</div>

          <div class="section-title">Nota de ingreso / Tratamiento inicial</div>
          <div class="box">${escapeHtml(internamiento.nota_ingreso || "")}</div>

          <div class="section-title">Órdenes médicas</div>
          <table>
            <thead>
              <tr><th>Fecha</th><th>Médico</th><th>Indicacion</th></tr>
            </thead>
            <tbody>${filasOrdenes}</tbody>
          </table>

          <div class="section-title">Medicación</div>
          <table>
            <thead>
              <tr><th>Código</th><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Vía</th></tr>
            </thead>
            <tbody>${filasMedicacion}</tbody>
          </table>

          <div class="section-title">Historial de administración de medicación</div>
          <table>
            <thead>
              <tr><th>Medicamento</th><th>Estado</th><th>Fecha</th><th>Usuario</th><th>Nota</th></tr>
            </thead>
            <tbody>${filasHistorialMedicacion}</tbody>
          </table>

          <div class="section-title">Analíticas</div>
          <table>
            <thead>
              <tr><th>Código</th><th>Analítica</th><th>Estado</th><th>Observación</th></tr>
            </thead>
            <tbody>${filasAnaliticas}</tbody>
          </table>

          <div class="section-title">Notas de enfermería</div>
          <table>
            <thead>
              <tr><th>Fecha</th><th>Medicamento</th><th>Nota</th><th>Usuario</th></tr>
            </thead>
            <tbody>${filasNotas}</tbody>
          </table>

          <div class="section-title">Insumos / materiales</div>
          <table>
            <thead>
              <tr><th>Código</th><th>Descripción</th><th>Cantidad</th><th>Precio Unitario</th><th>Subtotal</th></tr>
            </thead>
            <tbody>${filasInsumos}</tbody>
          </table>

          <div class="barcode">${escapeHtml(internamiento.prefactura_numero || "")}</div>
        </div>
      </body>
    </html>
  `;
}

function construirHtmlPrefactura(prefactura) {
  const internamiento = prefactura?.internamiento || {};
  const paciente = prefactura?.paciente || {};
  const habitacion = prefactura?.habitacion || {};
  const items = prefactura?.items || [];

  const filas = items.length
    ? items
        .map(
          (i) => `
        <tr>
          <td>${escapeHtml(i.tipo_item || "")}</td>
          <td>${escapeHtml(i.descripcion || "")}</td>
          <td>${escapeHtml(i.cantidad || "")}</td>
          <td>${escapeHtml(i.precio_unitario || "")}</td>
          <td>${escapeHtml((Number(i.cantidad || 0) * Number(i.precio_unitario || 0)).toFixed(2))}</td>
        </tr>
      `,
        )
        .join("")
    : `<tr><td colspan="5">Sin cargos generados.</td></tr>`;

  return `
    <html>
      <head>
        <title>Pre-factura de Internamiento</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: Arial, Helvetica, sans-serif; color:#111; }
          .header { display:flex; justify-content:space-between; border-bottom:1px solid #000; padding-bottom:8px; }
          .title { font-size:26px; font-weight:700; text-align:center; flex:1; }
          .logo { font-size:20px; font-weight:700; }
          .meta { text-align:right; font-size:12px; line-height:1.6; }
          .row { display:flex; gap:12px; flex-wrap:wrap; margin-top:10px; }
          .field { flex:1; min-width:180px; font-size:13px; }
          .label { font-weight:700; }
          table { width:100%; border-collapse:collapse; margin-top:12px; font-size:12px; }
          th, td { border:1px solid #000; padding:6px; }
          th { background:#efefef; text-align:left; }
          .totals { margin-top:14px; width:320px; margin-left:auto; font-size:13px; }
          .barcode { margin-top:14px; font-size:26px; font-weight:700; text-align:center; letter-spacing:2px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">CENTRO MEDICO</div>
          <div class="title">Pre-factura de Internamiento</div>
          <div class="meta">
            <div><span class="label">Prefactura:</span> ${escapeHtml(internamiento.prefactura_numero || "")}</div>
            <div><span class="label">Fecha:</span> ${escapeHtml(formatearFechaHora(new Date().toISOString()))}</div>
          </div>
        </div>

        <div class="row">
          <div class="field"><span class="label">Paciente:</span> ${escapeHtml(nombreCompletoPersona(paciente))}</div>
          <div class="field"><span class="label">Récord:</span> ${escapeHtml(paciente.record || "")}</div>
          <div class="field"><span class="label">Cédula:</span> ${escapeHtml(paciente.cedula || "")}</div>
        </div>

        <div class="row">
          <div class="field"><span class="label">Habitación:</span> ${escapeHtml(habitacion.numero || "")}</div>
          <div class="field"><span class="label">Estado:</span> ${escapeHtml(internamiento.estado_facturacion || "")}</div>
          <div class="field"><span class="label">Código de barra:</span> ${escapeHtml(prefactura.barcode || "")}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th>Precio Unitario</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>

        <div class="totals">
          <div><strong>Total bruto:</strong> ${Number(prefactura.total_bruto || 0).toFixed(2)}</div>
          <div><strong>Total neto:</strong> ${Number(prefactura.total_neto || 0).toFixed(2)}</div>
          <div><strong>Diferencia paciente:</strong> ${Number(prefactura.monto_diferencia || 0).toFixed(2)}</div>
        </div>

        <div class="barcode">${escapeHtml(prefactura.barcode || "")}</div>
      </body>
    </html>
  `;
}

const Internamiento = ({ darkMode = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();
  const colores = getUiColors(darkMode);
  const ordenesRef = useRef(null);
  const medicacionRef = useRef(null);

  const [internamientos, setInternamientos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [resultadosPacientes, setResultadosPacientes] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [habitaciones, setHabitaciones] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [medicacion, setMedicacion] = useState([]);

  // Catálogos
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [motivosConsulta, setMotivosConsulta] = useState([]);

  // ========================================================
  // NUEVOS ESTADOS PARA AUTOCOMPLETADO DE DIAGNÓSTICOS
  // ========================================================
  const [busquedaMotivo, setBusquedaMotivo] = useState("");
  const [mostrarMotivos, setMostrarMotivos] = useState(false);
  const [busquedaDiagnostico, setBusquedaDiagnostico] = useState("");
  const [mostrarDiagnosticos, setMostrarDiagnosticos] = useState(false);

  const motivosFiltrados = useMemo(() => {
    if (!busquedaMotivo) return motivosConsulta.slice(0, 50);
    const lower = busquedaMotivo.toLowerCase();
    return motivosConsulta.filter(m => String(m.nombre).toLowerCase().includes(lower)).slice(0, 50);
  }, [busquedaMotivo, motivosConsulta]);

  const diagnosticosFiltrados = useMemo(() => {
    if (!busquedaDiagnostico) return diagnosticos.slice(0, 50);
    const lower = busquedaDiagnostico.toLowerCase();
    return diagnosticos.filter(d => 
      String(d.nombre).toLowerCase().includes(lower) || 
      String(d.codigo).toLowerCase().includes(lower)
    ).slice(0, 50);
  }, [busquedaDiagnostico, diagnosticos]);
  // ========================================================

  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [pacienteHistorialId, setPacienteHistorialId] = useState("");

  const [formulario, setFormulario] = useState(modeloFormulario);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [ordenForm, setOrdenForm] = useState(modeloOrden);
  const [medicacionForm, setMedicacionForm] = useState(modeloMedicacion);
  const [editandoMedicacion, setEditandoMedicacion] = useState(false);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const [guardandoMedicacion, setGuardandoMedicacion] = useState(false);
  const [buscandoPacientes, setBuscandoPacientes] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const rol = String(usuario?.rol || usuario?.role || "").toLowerCase();
  const esAdmin = rol === "admin";
  const esMedico = rol === "medico" || rol === "médico";
  const puedeDarAlta = esAdmin || esMedico;
  const puedeEliminar = esAdmin;

  const totalActivos = useMemo(
    () =>
      internamientos.filter(
        (i) => String(i.estado || "").toLowerCase() === "activo",
      ).length,
    [internamientos],
  );

  const totalAlta = useMemo(
    () =>
      internamientos.filter(
        (i) => String(i.estado || "").toLowerCase() === "alta",
      ).length,
    [internamientos],
  );

  const habitacionesDisponibles = useMemo(() => {
    if (formulario.id && formulario.habitacion_id) {
      return habitaciones.filter(
        (h) => h.disponible || h.id === formulario.habitacion_id,
      );
    }
    return habitaciones.filter((h) => h.disponible);
  }, [habitaciones, formulario.id, formulario.habitacion_id]);

  const productosFiltrados = useMemo(() => {
    const texto = String(medicacionForm.filtro_producto || "")
      .trim()
      .toLowerCase();
    if (!texto) return productos.slice(0, 50);

    return productos.filter((p) => {
      const nombre = String(p.nombre || "").toLowerCase();
      const codigo = String(p.codigo || "").toLowerCase();
      return nombre.includes(texto) || codigo.includes(texto);
    });
  }, [productos, medicacionForm.filtro_producto]);

  useEffect(() => {
    cargarInicial();
  }, []);

  useEffect(() => {
    if (!formulario.paciente_id) {
      setPacienteSeleccionado(null);
      return;
    }

    const paciente =
      pacientes.find((p) => p.id === formulario.paciente_id) || null;
    setPacienteSeleccionado(paciente);
  }, [formulario.paciente_id, pacientes]);

  useEffect(() => {
    const state = location.state;
    if (!state?.desdeEmergencia) return;

    setFormulario((prev) => ({
      ...prev,
      paciente_id: state.paciente_id || "",
      medico_id: state.medico_id || "",
      origen_ingreso: "emergencia",
      emergencia_origen_id: state.emergencia_id || "",
      diagnostico_ingreso_id: state.diagnostico_ingreso_id || "",
      diagnostico_ingreso_nota: state.diagnostico_ingreso_nota || "",
      motivo_ingreso_id: state.motivo_ingreso_id || "",
      motivo_ingreso_nota: state.motivo_ingreso_nota || "",
      nota_ingreso: state.tratamiento_inicial || "",
      estado: "activo",
    }));

    if (state?.paciente) {
      setPacienteSeleccionado(state.paciente);
      setBusquedaPaciente(nombreCompletoPersona(state.paciente));
    }

    setMensaje("Paciente cargado automáticamente desde emergencia.");
    window.history.replaceState({}, document.title);
  }, [location.state]);

  async function cargarInicial() {
    setCargando(true);
    setError("");

    try {
      const [
        listaInternamientos,
        listaPacientes,
        listaMedicos,
        listaHabitaciones,
        listaProductos,
        catDiagnosticos,
        catMotivos,
      ] = await Promise.all([
        listarInternamientos(),
        buscarPacientesInternamiento(),
        listarMedicosInternamiento(),
        listarHabitacionesDisponibles(),
        listarProductosInternamiento(),
        listarDiagnosticos(),
        listarMotivosConsulta()
      ]);

      setInternamientos(listaInternamientos || []);
      setPacientes(listaPacientes || []);
      setResultadosPacientes([]);
      setMedicos(listaMedicos || []);
      setHabitaciones(listaHabitaciones || []);
      setProductos(listaProductos || []);
      
      setDiagnosticos(catDiagnosticos || []);
      setMotivosConsulta(catMotivos || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar el módulo de internamiento.");
    } finally {
      setCargando(false);
    }
  }

  async function buscarPacientesManual() {
    setBuscandoPacientes(true);
    setError("");
    setMensaje("");

    try {
      const lista = await buscarPacientesInternamiento(busquedaPaciente);
      setResultadosPacientes(lista || []);
    } catch (err) {
      setError(err.message || "No se pudieron buscar los pacientes.");
    } finally {
      setBuscandoPacientes(false);
    }
  }

  function cambiarCampo(campo, valor) {
    if (campo === "origen_ingreso") return;
    setFormulario((prev) => ({ ...prev, [campo]: valor }));
  }

  function seleccionarPaciente(paciente) {
    setPacienteSeleccionado(paciente);
    setFormulario((prev) => ({
      ...prev,
      paciente_id: paciente.id,
    }));
    setResultadosPacientes([]);
    setMensaje("Paciente seleccionado correctamente.");
  }

  function limpiarFormulario() {
    setFormulario(modeloFormulario);
    setPacienteSeleccionado(null);
    setOrdenForm(modeloOrden);
    setMedicacionForm(modeloMedicacion);
    setEditandoMedicacion(false);
    setOrdenes([]);
    setMedicacion([]);
    setBusquedaPaciente("");
    setResultadosPacientes([]);
    setBusquedaMotivo("");
    setBusquedaDiagnostico("");
    setError("");
    setMensaje("");
  }

  async function guardarInternamiento(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      if (!formulario.paciente_id)
        throw new Error("Debe seleccionar un paciente.");
      if (!formulario.habitacion_id)
        throw new Error("Debe seleccionar una habitación.");
      if (!formulario.medico_id)
        throw new Error("Debe seleccionar un médico responsable.");
      if (!formulario.diagnostico_ingreso_id && !formulario.diagnostico_ingreso_nota?.trim()) {
        throw new Error("Debe indicar el diagnóstico de ingreso (Catálogo o nota).");
      }

      const payload = {
        ...formulario,
        origen_ingreso: formulario.emergencia_origen_id
          ? "emergencia"
          : "ingreso",
        estado: formulario.id ? formulario.estado : "activo",
      };

      let internamientoGuardadoId = formulario.id;

      if (!formulario.id) {
        const creado = await crearInternamiento(payload);
        internamientoGuardadoId = creado?.id || null;
        setMensaje("Paciente ingresado correctamente.");
      } else {
        const actual = await obtenerInternamientoPorId(formulario.id);
        const actualizado = await actualizarInternamiento(
          formulario.id,
          payload,
          actual,
        );
        internamientoGuardadoId = actualizado?.id || formulario.id;
        setMensaje("Internamiento actualizado correctamente.");
      }

      await cargarInicial();

      if (internamientoGuardadoId) {
        const detalle = await obtenerInternamientoPorId(
          internamientoGuardadoId,
        );
        const [listaOrdenes, listaMedicacion] = await Promise.all([
          listarOrdenesMedicas(internamientoGuardadoId),
          listarMedicacionInternamiento(internamientoGuardadoId),
        ]);

        setFormulario({
          id: detalle.id,
          paciente_id: detalle.paciente_id || "",
          medico_id: detalle.medico_id || "",
          habitacion_id:
            detalle?.habitacion?.id || detalle?.camas?.habitaciones?.id || "",
          origen_ingreso: detalle.origen_ingreso || "ingreso",
          emergencia_origen_id: detalle.emergencia_origen_id || "",
          diagnostico_ingreso_id: detalle.diagnostico_ingreso_id || "",
          diagnostico_ingreso_nota: detalle.diagnostico_ingreso_nota || "",
          motivo_ingreso_id: detalle.motivo_ingreso_id || "",
          motivo_ingreso_nota: detalle.motivo_ingreso_nota || "",
          nota_ingreso: detalle.nota_ingreso || "",
          autorizacion_numero: detalle.autorizacion_numero || "",
          estado: detalle?.estado || "activo",
        });
        
        setBusquedaMotivo(detalle.motivos_consulta?.nombre || "");
        setBusquedaDiagnostico(detalle.diagnosticos ? `[${detalle.diagnosticos.codigo}] ${detalle.diagnosticos.nombre}` : "");

        setPacienteSeleccionado(detalle.pacientes || null);
        setOrdenes(listaOrdenes || []);
        setMedicacion(listaMedicacion || []);

        setTimeout(() => {
          ordenesRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 250);
      }
    } catch (err) {
      setError(err.message || "No se pudo guardar el internamiento.");
    } finally {
      setGuardando(false);
    }
  }

  async function editarInternamiento(id) {
    setError("");
    setMensaje("");

    try {
      const data = await obtenerInternamientoPorId(id);
      const [listaOrdenes, listaMedicacion] = await Promise.all([
        listarOrdenesMedicas(id),
        listarMedicacionInternamiento(id),
      ]);

      setFormulario({
        id: data.id,
        paciente_id: data.paciente_id || "",
        medico_id: data.medico_id || "",
        habitacion_id:
          data?.habitacion?.id || data?.camas?.habitaciones?.id || "",
        origen_ingreso: data.origen_ingreso || "ingreso",
        emergencia_origen_id: data.emergencia_origen_id || "",
        diagnostico_ingreso_id: data.diagnostico_ingreso_id || "",
        diagnostico_ingreso_nota: data.diagnostico_ingreso_nota || "",
        motivo_ingreso_id: data.motivo_ingreso_id || "",
        motivo_ingreso_nota: data.motivo_ingreso_nota || "",
        nota_ingreso: data.nota_ingreso || "",
        autorizacion_numero: data.autorizacion_numero || "",
        estado: data.estado || "activo",
      });

      setBusquedaMotivo(data.motivos_consulta?.nombre || "");
      setBusquedaDiagnostico(data.diagnosticos ? `[${data.diagnosticos.codigo}] ${data.diagnosticos.nombre}` : "");

      setPacienteSeleccionado(data.pacientes || null);
      setBusquedaPaciente(nombreCompletoPersona(data.pacientes));
      setResultadosPacientes([]);
      setOrdenes(listaOrdenes || []);
      setMedicacion(listaMedicacion || []);
      setEditandoMedicacion(false);
      setMedicacionForm(modeloMedicacion);

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "No se pudo cargar el internamiento.");
    }
  }

  async function borrarInternamiento(id, camaId) {
    if (!puedeEliminar) {
      setError("Solo el administrador puede eliminar internamientos.");
      return;
    }

    const ok = window.confirm(
      "¿Seguro que deseas eliminar este internamiento?",
    );
    if (!ok) return;

    setError("");
    setMensaje("");

    try {
      await eliminarInternamiento(id, camaId);
      await cargarInicial();

      if (formulario.id === id) limpiarFormulario();

      setMensaje("Internamiento eliminado correctamente.");
    } catch (err) {
      setError(err.message || "No se pudo eliminar el internamiento.");
    }
  }

  async function altaInternamiento(id) {
    if (!puedeDarAlta) {
      setError("Solo el médico o el administrador pueden dar de alta.");
      return;
    }

    const ok = window.confirm("¿Deseas dar de alta este internamiento?");
    if (!ok) return;

    setError("");
    setMensaje("");

    try {
      await darAltaInternamiento(id);
      await cargarInicial();

      if (formulario.id === id) limpiarFormulario();

      setMensaje("Paciente dado de alta correctamente.");
    } catch (err) {
      setError(err.message || "No se pudo dar de alta el internamiento.");
    }
  }

  async function guardarOrden(e) {
    e.preventDefault();

    if (!formulario.id) {
      setError("Primero debes guardar el internamiento.");
      return;
    }

    if (!ordenForm.indicacion?.trim()) {
      setError("Debe escribir la orden médica.");
      return;
    }

    setGuardandoOrden(true);
    setError("");
    setMensaje("");

    try {
      await registrarOrdenMedica({
        internamiento_id: formulario.id,
        medico_id: formulario.medico_id || null,
        indicacion: ordenForm.indicacion,
      });

      const lista = await listarOrdenesMedicas(formulario.id);
      setOrdenes(lista || []);
      setOrdenForm(modeloOrden);
      setMensaje("Orden médica registrada.");

      setTimeout(() => {
        medicacionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 250);
    } catch (err) {
      setError(err.message || "No se pudo registrar la orden médica.");
    } finally {
      setGuardandoOrden(false);
    }
  }

  function seleccionarProductoMedicacion(producto) {
    setMedicacionForm((prev) => ({
      ...prev,
      producto_id: producto.id,
      filtro_producto:
        `${producto.codigo || ""} - ${producto.nombre || ""}`.trim(),
    }));
  }

  function prepararEdicionMedicacion(item) {
    setEditandoMedicacion(true);
    setMedicacionForm({
      id: item.id,
      orden_id: item.orden_id || "",
      producto_id: item.producto_id || "",
      filtro_producto:
        `${item?.productos?.codigo || ""} - ${item?.productos?.nombre || ""}`.trim(),
      dosis: item.dosis || "",
      frecuencia: item.frecuencia || "",
      via: item.via || "",
    });

    medicacionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function cancelarEdicionMedicacion() {
    setEditandoMedicacion(false);
    setMedicacionForm(modeloMedicacion);
  }

  async function guardarMedicacion(e) {
    e.preventDefault();

    if (!formulario.id) {
      setError("Primero debes guardar el internamiento.");
      return;
    }

    if (!medicacionForm.orden_id) {
      setError("Debe seleccionar una orden médica.");
      return;
    }

    if (!medicacionForm.producto_id) {
      setError("Debe seleccionar un medicamento.");
      return;
    }

    setGuardandoMedicacion(true);
    setError("");
    setMensaje("");

    try {
      if (editandoMedicacion && medicacionForm.id) {
        await actualizarMedicacionInternamiento(
          medicacionForm.id,
          medicacionForm,
        );
        setMensaje("Medicación actualizada correctamente.");
      } else {
        await agregarMedicacionInternamiento(medicacionForm);
        setMensaje("Medicación agregada correctamente.");
      }

      const lista = await listarMedicacionInternamiento(formulario.id);
      setMedicacion(lista || []);
      setMedicacionForm(modeloMedicacion);
      setEditandoMedicacion(false);
    } catch (err) {
      setError(err.message || "No se pudo guardar la medicación.");
    } finally {
      setGuardandoMedicacion(false);
    }
  }

  async function borrarMedicacion(id) {
    const ok = window.confirm("¿Deseas eliminar esta medicación?");
    if (!ok) return;

    try {
      await eliminarMedicacionInternamiento(id);
      const lista = await listarMedicacionInternamiento(formulario.id);
      setMedicacion(lista || []);
      setMensaje("Medicación eliminada correctamente.");
    } catch (err) {
      setError(err.message || "No se pudo eliminar la medicación.");
    }
  }

  async function buscarHistorial() {
    setCargando(true);
    setError("");

    try {
      const lista = await listarInternamientos({
        pacienteId: pacienteHistorialId,
        estado: filtroEstado,
        filtro: busquedaHistorial,
      });

      setInternamientos(lista || []);
    } catch (err) {
      setError(err.message || "No se pudo buscar el historial.");
    } finally {
      setCargando(false);
    }
  }

  async function imprimirInternamiento(id) {
    try {
      const resumen = await obtenerResumenImpresionInternamiento(id);
      const html = construirHtmlImpresionInternamiento(resumen);

      const win = window.open("", "_blank", "width=1100,height=900");
      if (!win)
        throw new Error("El navegador bloqueó la ventana de impresión.");

      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } catch (err) {
      setError(err.message || "No se pudo imprimir el internamiento.");
    }
  }

  async function prefacturarInternamiento(id) {
    try {
      const prefactura = await generarPrefacturaInternamiento(id);
      const html = construirHtmlPrefactura(prefactura);

      const win = window.open("", "_blank", "width=1100,height=900");
      if (!win)
        throw new Error("El navegador bloqueó la ventana de prefactura.");

      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();

      setMensaje("Pre-factura generada correctamente.");
      await cargarInicial();
    } catch (err) {
      setError(err.message || "No se pudo generar la pre-factura.");
    }
  }

  function estiloEstado(nombre) {
    const estado = String(nombre || "").toLowerCase();
    const base = {
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 11px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 800,
      textTransform: "capitalize",
      border: "1px solid transparent",
    };

    if (estado === "alta") {
      return {
        ...base,
        background: darkMode ? "rgba(5,150,105,0.16)" : "#ecfdf5",
        color: darkMode ? "#6ee7b7" : "#047857",
        borderColor: darkMode ? "rgba(5,150,105,0.24)" : "#bbf7d0",
      };
    }

    if (estado === "prefacturado") {
      return {
        ...base,
        background: darkMode ? "rgba(37,99,235,0.14)" : "#eff6ff",
        color: darkMode ? "#93c5fd" : "#1d4ed8",
        borderColor: darkMode ? "rgba(37,99,235,0.24)" : "#bfdbfe",
      };
    }

    return {
      ...base,
      background: darkMode ? "rgba(234,88,12,0.14)" : "#fff7ed",
      color: darkMode ? "#fdba74" : "#c2410c",
      borderColor: darkMode ? "rgba(234,88,12,0.22)" : "#fed7aa",
    };
  }

  const styles = {
    topBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: "18px",
      marginBottom: "22px",
      flexWrap: "wrap",
    },
    titleBlock: {
      ...cardStyle(darkMode),
      background: colores.gradienteHeader,
      color: "#ffffff",
      padding: "24px",
      flex: "1 1 700px",
      minWidth: 0,
      position: "relative",
      overflow: "hidden",
    },
    titleGlow: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: `
        radial-gradient(circle at 15% 20%, rgba(255,255,255,0.14) 0%, transparent 20%),
        radial-gradient(circle at 86% 18%, rgba(255,255,255,0.10) 0%, transparent 16%),
        radial-gradient(circle at 70% 82%, rgba(255,255,255,0.08) 0%, transparent 18%)
      `,
    },
    titleInner: { position: "relative", zIndex: 1 },
    titleChip: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 12px",
      borderRadius: "999px",
      background: "rgba(255,255,255,0.14)",
      fontSize: "12px",
      fontWeight: 800,
      marginBottom: "14px",
    },
    title: { margin: 0, fontSize: "32px", fontWeight: 900, lineHeight: 1.15 },
    subtitle: {
      marginTop: "10px",
      marginBottom: 0,
      color: "rgba(255,255,255,0.90)",
      fontSize: "15px",
      lineHeight: 1.6,
      maxWidth: "760px",
    },
    actionGroup: {
      display: "flex",
      gap: "10px",
      flexWrap: "wrap",
      alignItems: "stretch",
    },
    cardsRow: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: "18px",
      marginBottom: "22px",
    },
    metricCard: {
      ...statCardStyle(darkMode),
      minWidth: 0,
      position: "relative",
      overflow: "hidden",
    },
    metricIcon: {
      width: "46px",
      height: "46px",
      borderRadius: "16px",
      display: "grid",
      placeItems: "center",
      background: darkMode ? "#0b1220" : "#f4f8fc",
      border: `1px solid ${colores.borde}`,
      fontSize: "20px",
      marginBottom: "14px",
    },
    metricGhost: {
      position: "absolute",
      top: "-14px",
      right: "-8px",
      fontSize: "58px",
      opacity: 0.08,
      pointerEvents: "none",
    },
    metricTop: { fontSize: "13px", color: colores.subtitulo, fontWeight: 700 },
    metricValue: {
      marginTop: "10px",
      fontSize: "30px",
      fontWeight: 900,
      color: colores.texto,
      lineHeight: 1,
    },
    stack: { display: "flex", flexDirection: "column", gap: "20px" },
    card: { ...cardStyle(darkMode), padding: 0, overflow: "hidden" },
    cardHeader: { padding: "18px 20px 0" },
    cardBody: { padding: "20px", minWidth: 0 },
    sectionTitle: {
      margin: 0,
      fontSize: "20px",
      fontWeight: 800,
      color: colores.texto,
    },
    sectionSubtitle: {
      marginTop: "5px",
      fontSize: "13px",
      color: colores.subtitulo,
    },
    formGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "14px",
      minWidth: 0,
    },
    full: { gridColumn: "1 / -1", minWidth: 0 },
    saveWrap: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "10px",
      marginTop: "18px",
      flexWrap: "wrap",
    },
    primaryBtn: {
      ...buttonPrimaryStyle,
      height: "46px",
      borderRadius: "14px",
      boxShadow: "0 10px 22px rgba(37,99,235,0.18)",
    },
    softBtn: {
      ...buttonSoftStyle(darkMode),
      height: "46px",
      padding: "0 14px",
      borderRadius: "12px",
      fontSize: "13px",
    },
    warnBtn: {
      height: "38px",
      padding: "0 12px",
      borderRadius: "12px",
      border: darkMode ? "1px solid rgba(234,88,12,0.25)" : "1px solid #fed7aa",
      background: darkMode ? "rgba(234,88,12,0.12)" : "#fff7ed",
      color: darkMode ? "#fdba74" : "#c2410c",
      cursor: "pointer",
      fontWeight: 800,
      fontSize: "13px",
    },
    dangerBtn: {
      height: "38px",
      padding: "0 12px",
      borderRadius: "12px",
      border: darkMode ? "1px solid rgba(220,38,38,0.25)" : "1px solid #fecaca",
      background: darkMode ? "rgba(220,38,38,0.12)" : "#fef2f2",
      color: darkMode ? "#fca5a5" : "#dc2626",
      cursor: "pointer",
      fontWeight: 800,
      fontSize: "13px",
    },
    okText: {
      color: darkMode ? "#6ee7b7" : "#059669",
      fontWeight: 700,
      marginTop: "14px",
      fontSize: "13px",
      background: darkMode ? "rgba(5,150,105,0.12)" : "#ecfdf5",
      border: darkMode ? "1px solid rgba(5,150,105,0.25)" : "1px solid #a7f3d0",
      padding: "10px 12px",
      borderRadius: "12px",
    },
    dangerText: {
      color: darkMode ? "#fca5a5" : "#dc2626",
      fontWeight: 700,
      marginTop: "14px",
      fontSize: "13px",
      background: darkMode ? "rgba(220,38,38,0.12)" : "#fef2f2",
      border: darkMode ? "1px solid rgba(220,38,38,0.25)" : "1px solid #fecaca",
      padding: "10px 12px",
      borderRadius: "12px",
    },
    selectedPatientBox: {
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
      borderRadius: "16px",
      padding: "14px",
    },
    selectedPatientName: {
      fontWeight: 800,
      color: colores.texto,
      fontSize: "15px",
      marginBottom: "4px",
    },
    selectedPatientMeta: {
      fontSize: "13px",
      color: colores.subtitulo,
      lineHeight: 1.6,
    },
    searchTopWrap: {
      display: "grid",
      gridTemplateColumns: "1fr auto auto",
      gap: "10px",
      alignItems: "center",
    },
    estadoBox: {
      padding: "12px 14px",
      borderRadius: "14px",
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
      minHeight: "48px",
      display: "flex",
      alignItems: "center",
      color: colores.texto,
      fontWeight: 800,
      textTransform: "capitalize",
    },
    listSimple: { display: "grid", gap: "10px", marginTop: "10px" },
    listItem: {
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
      borderRadius: "16px",
      padding: "13px 14px",
    },
    listItemTitle: {
      fontWeight: 800,
      color: colores.texto,
      marginBottom: "4px",
      fontSize: "14px",
    },
    listItemMeta: {
      fontSize: "13px",
      color: colores.subtitulo,
      lineHeight: 1.6,
    },
    searchHistoryWrap: {
      display: "grid",
      gridTemplateColumns: "1.2fr 1fr 1fr auto",
      gap: "10px",
      marginBottom: "16px",
      minWidth: 0,
      alignItems: "stretch",
    },
    tableWrap: {
      width: "100%",
      overflowX: "auto",
      borderRadius: "18px",
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
      marginTop: "14px",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      minWidth: "1100px",
    },
    th: {
      textAlign: "left",
      padding: "13px 12px",
      fontSize: "13px",
      color: colores.subtitulo,
      borderBottom: `1px solid ${colores.borde}`,
      background: darkMode ? "#0b1220" : "#f8fbff",
      whiteSpace: "nowrap",
      fontWeight: 800,
    },
    td: {
      padding: "13px 12px",
      fontSize: "14px",
      borderBottom: `1px solid ${colores.borde}`,
      verticalAlign: "top",
      color: colores.texto,
    },
    rowActions: {
      display: "flex",
      gap: "8px",
      flexWrap: "wrap",
    },
    mainText: { fontWeight: 800, color: colores.texto },
    subText: {
      fontSize: "12px",
      color: colores.subtitulo,
      marginTop: "4px",
      lineHeight: 1.5,
    },
    productPickerWrap: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "10px",
    },
    productResults: {
      border: `1px solid ${colores.borde}`,
      borderRadius: "14px",
      background: colores.cardSoft,
      maxHeight: "220px",
      overflowY: "auto",
    },
    productOption: {
      padding: "10px 12px",
      cursor: "pointer",
      borderBottom: `1px solid ${colores.borde}`,
      fontSize: "13px",
      color: colores.texto,
    },
    autocompleteDropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      background: colores.cardSoft,
      border: `1px solid ${colores.borde}`,
      borderRadius: '8px',
      zIndex: 50,
      maxHeight: '220px',
      overflowY: 'auto',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      marginTop: '4px'
    },
    autocompleteOption: {
      padding: '10px 12px',
      cursor: 'pointer',
      borderBottom: `1px solid ${colores.borde}`,
      fontSize: '13px',
      color: colores.texto
    }
  };

  return (
    <div style={pageWrapperStyle(darkMode)}>
      <div style={styles.topBar}>
        <div style={styles.titleBlock}>
          <div style={styles.titleGlow} />
          <div style={styles.titleInner}>
            <div style={styles.titleChip}>
              🏥 Gestión clínica de internamiento
            </div>
            <h1 style={styles.title}>Internamiento</h1>
            <p style={styles.subtitle}>
              Ingreso de pacientes, órdenes médicas, medicación, impresión
              clínica y pre-factura.
            </p>
          </div>
        </div>

        <div style={styles.actionGroup}>
          <button
            type="button"
            style={styles.primaryBtn}
            onClick={limpiarFormulario}
          >
            + Nuevo internamiento
          </button>
        </div>
      </div>

      <div style={styles.cardsRow}>
        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>🛏️</div>
          <div style={styles.metricIcon}>🛏️</div>
          <div style={styles.metricTop}>Internamientos activos</div>
          <div style={styles.metricValue}>{totalActivos}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>✅</div>
          <div style={styles.metricIcon}>✅</div>
          <div style={styles.metricTop}>Altas registradas</div>
          <div style={styles.metricValue}>{totalAlta}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>🚪</div>
          <div style={styles.metricIcon}>🚪</div>
          <div style={styles.metricTop}>Habitaciones disponibles</div>
          <div style={styles.metricValue}>{habitacionesDisponibles.length}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>💊</div>
          <div style={styles.metricIcon}>💊</div>
          <div style={styles.metricTop}>Medicaciones registradas</div>
          <div style={styles.metricValue}>{medicacion.length}</div>
        </div>
      </div>

      <div style={styles.stack}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.sectionTitle}>
              {formulario.id
                ? "Editar internamiento"
                : "Registro de internamiento"}
            </h3>
            <div style={styles.sectionSubtitle}>
              Busca el paciente, define origen, habitación, médico y datos de
              ingreso.
            </div>
          </div>

          <div style={styles.cardBody}>
            <form onSubmit={guardarInternamiento}>
              <div style={styles.formGrid}>
                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Buscar paciente</label>
                  <div style={styles.searchTopWrap}>
                    <input
                      style={inputStyle(darkMode)}
                      value={busquedaPaciente}
                      onChange={(e) => setBusquedaPaciente(e.target.value)}
                      placeholder="Buscar por récord, nombre, apellido o cédula"
                    />
                    <button
                      type="button"
                      style={styles.primaryBtn}
                      onClick={buscarPacientesManual}
                      disabled={buscandoPacientes}
                    >
                      {buscandoPacientes ? "Buscando..." : "Buscar"}
                    </button>
                    <button
                      type="button"
                      style={styles.softBtn}
                      onClick={() => navigate("/pacientes")}
                    >
                      Registrar paciente
                    </button>
                  </div>

                  {resultadosPacientes.length > 0 ? (
                    <div style={styles.listSimple}>
                      {resultadosPacientes.map((p) => (
                        <div key={p.id} style={styles.listItem}>
                          <div style={styles.listItemTitle}>
                            {nombreCompletoPersona(p)}
                          </div>
                          <div style={styles.listItemMeta}>
                            <div>
                              <strong>Récord:</strong> {p.record || "-"}
                            </div>
                            <div>
                              <strong>Cédula:</strong> {p.cedula || "-"}
                            </div>
                            <div>
                              <strong>Seguro:</strong>{" "}
                              {obtenerSeguroPaciente(p) || "-"}
                            </div>
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => seleccionarPaciente(p)}
                            >
                              Seleccionar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>
                    Paciente seleccionado
                  </label>
                  <div style={styles.selectedPatientBox}>
                    {pacienteSeleccionado ? (
                      <>
                        <div style={styles.selectedPatientName}>
                          {nombreCompletoPersona(pacienteSeleccionado)}
                        </div>
                        <div style={styles.selectedPatientMeta}>
                          <div>
                            <strong>Récord:</strong>{" "}
                            {pacienteSeleccionado.record || "-"}
                          </div>
                          <div>
                            <strong>Cédula:</strong>{" "}
                            {pacienteSeleccionado.cedula || "-"}
                          </div>
                          <div>
                            <strong>Teléfono:</strong>{" "}
                            {obtenerTelefonoPaciente(pacienteSeleccionado) ||
                              "-"}
                          </div>
                          <div>
                            <strong>Seguro:</strong>{" "}
                            {obtenerSeguroPaciente(pacienteSeleccionado) || "-"}
                          </div>
                          <div>
                            <strong>Afiliado:</strong>{" "}
                            {pacienteSeleccionado.numero_afiliado || "-"}
                          </div>
                          <div>
                            <strong>Edad:</strong>{" "}
                            {calcularEdad(
                              pacienteSeleccionado.fecha_nacimiento,
                            ) || "-"}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={styles.selectedPatientMeta}>
                        Aún no has seleccionado un paciente.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Origen de ingreso</label>
                  <div style={styles.estadoBox}>
                    {formulario.emergencia_origen_id ? "emergencia" : "ingreso"}
                  </div>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Habitación</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formulario.habitacion_id}
                    onChange={(e) =>
                      cambiarCampo("habitacion_id", e.target.value)
                    }
                  >
                    <option value="">Seleccione una habitación</option>
                    {habitacionesDisponibles.map((h) => (
                      <option key={h.id} value={h.id}>
                        {etiquetaHabitacion(h)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Médico responsable</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formulario.medico_id}
                    onChange={(e) => cambiarCampo("medico_id", e.target.value)}
                  >
                    <option value="">Seleccione un médico</option>
                    {medicos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {`${m.codigo || ""} - ${nombreCompletoPersona(m)}${obtenerEspecialidadMedico(m) ? ` | ${obtenerEspecialidadMedico(m)}` : ""}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Estado</label>
                  <div style={styles.estadoBox}>
                    {formulario.estado || "activo"}
                  </div>
                </div>

                {/* ========================================================
                    NUEVO AUTOCOMPLETADO: MOTIVO DE INGRESO
                ======================================================== */}
                <div style={{ ...styles.full, position: 'relative' }}>
                  <label style={labelStyle(darkMode)}>Motivo de ingreso (Catálogo)</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={busquedaMotivo}
                    onChange={(e) => {
                      setBusquedaMotivo(e.target.value);
                      setMostrarMotivos(true);
                      if(e.target.value === "") cambiarCampo("motivo_ingreso_id", "");
                    }}
                    onFocus={() => setMostrarMotivos(true)}
                    onBlur={() => setTimeout(() => setMostrarMotivos(false), 200)}
                    placeholder="Buscar motivo de ingreso..."
                  />
                  {mostrarMotivos && (
                    <div style={styles.autocompleteDropdown}>
                      {motivosFiltrados.length === 0 ? <div style={{ padding: '10px' }}>No hay resultados</div> :
                        motivosFiltrados.map(m => (
                          <div 
                            key={m.id} 
                            style={styles.autocompleteOption}
                            onMouseDown={() => {
                              cambiarCampo("motivo_ingreso_id", m.id);
                              setBusquedaMotivo(m.nombre);
                              setMostrarMotivos(false);
                            }}
                          >
                            {m.nombre}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Motivo de ingreso (Observaciones / Texto libre)</label>
                  <textarea
                    style={textareaStyle(darkMode)}
                    value={formulario.motivo_ingreso_nota}
                    onChange={(e) => cambiarCampo("motivo_ingreso_nota", e.target.value)}
                  />
                </div>

                {/* ========================================================
                    NUEVO AUTOCOMPLETADO: DIAGNÓSTICO PRINCIPAL
                ======================================================== */}
                <div style={{ ...styles.full, position: 'relative' }}>
                  <label style={labelStyle(darkMode)}>Diagnóstico Principal (Catálogo)</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={busquedaDiagnostico}
                    onChange={(e) => {
                      setBusquedaDiagnostico(e.target.value);
                      setMostrarDiagnosticos(true);
                      if(e.target.value === "") cambiarCampo("diagnostico_ingreso_id", "");
                    }}
                    onFocus={() => setMostrarDiagnosticos(true)}
                    onBlur={() => setTimeout(() => setMostrarDiagnosticos(false), 200)}
                    placeholder="Buscar diagnóstico por nombre o código..."
                  />
                  {mostrarDiagnosticos && (
                    <div style={styles.autocompleteDropdown}>
                      {diagnosticosFiltrados.length === 0 ? <div style={{ padding: '10px' }}>No hay resultados</div> :
                        diagnosticosFiltrados.map(d => (
                          <div 
                            key={d.id} 
                            style={styles.autocompleteOption}
                            onMouseDown={() => {
                              cambiarCampo("diagnostico_ingreso_id", d.id);
                              setBusquedaDiagnostico(`[${d.codigo}] ${d.nombre}`);
                              setMostrarDiagnosticos(false);
                            }}
                          >
                            <strong>[{d.codigo}]</strong> - {d.nombre}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Diagnóstico (Comentario o diagnóstico secundario)</label>
                  <textarea
                    style={textareaStyle(darkMode)}
                    value={formulario.diagnostico_ingreso_nota}
                    onChange={(e) => cambiarCampo("diagnostico_ingreso_nota", e.target.value)}
                  />
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Nota de ingreso / Tratamiento inicial</label>
                  <textarea
                    style={{ ...textareaStyle(darkMode), minHeight: 110 }}
                    value={formulario.nota_ingreso}
                    onChange={(e) =>
                      cambiarCampo("nota_ingreso", e.target.value)
                    }
                  />
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>
                    Número de autorización
                  </label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formulario.autorizacion_numero}
                    onChange={(e) =>
                      cambiarCampo("autorizacion_numero", e.target.value)
                    }
                    placeholder="Autorización / seguro"
                  />
                </div>
              </div>

              <div style={styles.saveWrap}>
                {formulario.id && puedeDarAlta ? (
                  <button
                    type="button"
                    style={styles.warnBtn}
                    onClick={() => altaInternamiento(formulario.id)}
                  >
                    Dar de alta
                  </button>
                ) : null}

                {formulario.id && puedeEliminar ? (
                  <button
                    type="button"
                    style={styles.dangerBtn}
                    onClick={() =>
                      borrarInternamiento(
                        formulario.id,
                        internamientos.find((i) => i.id === formulario.id)
                          ?.cama_id || null,
                      )
                    }
                  >
                    Eliminar
                  </button>
                ) : null}

                <button
                  type="submit"
                  style={styles.primaryBtn}
                  disabled={guardando}
                >
                  {guardando
                    ? "Guardando..."
                    : formulario.id
                      ? "Actualizar internamiento"
                      : "Ingresar paciente"}
                </button>
              </div>

              {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}
              {error ? <div style={styles.dangerText}>{error}</div> : null}
            </form>
          </div>
        </div>

        {formulario.id ? (
          <div ref={ordenesRef} style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.sectionTitle}>Órdenes médicas</h3>
              <div style={styles.sectionSubtitle}>
                Registra la orden médica y luego pasa a medicación.
              </div>
            </div>

            <div style={styles.cardBody}>
              <form onSubmit={guardarOrden}>
                <label style={labelStyle(darkMode)}>Nueva orden médica</label>
                <textarea
                  style={{ ...textareaStyle(darkMode), minHeight: 100 }}
                  value={ordenForm.indicacion}
                  onChange={(e) =>
                    setOrdenForm((prev) => ({
                      ...prev,
                      indicacion: e.target.value,
                    }))
                  }
                />
                <div style={styles.saveWrap}>
                  <button
                    type="submit"
                    style={styles.primaryBtn}
                    disabled={guardandoOrden}
                  >
                    {guardandoOrden
                      ? "Guardando orden..."
                      : "Guardar orden médica"}
                  </button>
                </div>
              </form>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Fecha</th>
                      <th style={styles.th}>Médico</th>
                      <th style={styles.th}>Indicacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenes.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={styles.td}>
                          No hay órdenes médicas registradas.
                        </td>
                      </tr>
                    ) : (
                      ordenes.map((o) => (
                        <tr key={o.id}>
                          <td style={styles.td}>
                            {formatearFechaHora(o.fecha)}
                          </td>
                          <td style={styles.td}>
                            {nombreCompletoPersona(o.medicos) || "-"}
                          </td>
                          <td style={styles.td}>{o.indicacion || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {formulario.id ? (
          <div ref={medicacionRef} style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.sectionTitle}>Medicación del internamiento</h3>
              <div style={styles.sectionSubtitle}>
                Selecciona una orden, busca el medicamento por código o nombre y
                registra dosis, frecuencia y vía.
              </div>
            </div>

            <div style={styles.cardBody}>
              <form onSubmit={guardarMedicacion}>
                <div style={styles.formGrid}>
                  <div>
                    <label style={labelStyle(darkMode)}>Orden médica</label>
                    <select
                      style={selectStyle(darkMode)}
                      value={medicacionForm.orden_id}
                      onChange={(e) =>
                        setMedicacionForm((prev) => ({
                          ...prev,
                          orden_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">Seleccione una orden</option>
                      {ordenes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {(o.indicacion || "").slice(0, 120)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>
                      Buscar medicamento
                    </label>
                    <div style={styles.productPickerWrap}>
                      <input
                        style={inputStyle(darkMode)}
                        value={medicacionForm.filtro_producto}
                        onChange={(e) =>
                          setMedicacionForm((prev) => ({
                            ...prev,
                            filtro_producto: e.target.value,
                            producto_id: "",
                          }))
                        }
                        placeholder="Escriba nombre o código"
                      />
                      <div style={styles.productResults}>
                        {productosFiltrados.length === 0 ? (
                          <div style={styles.productOption}>
                            No hay coincidencias.
                          </div>
                        ) : (
                          productosFiltrados.slice(0, 20).map((p) => (
                            <div
                              key={p.id}
                              style={styles.productOption}
                              onClick={() => seleccionarProductoMedicacion(p)}
                            >
                              {`${p.codigo || ""} - ${p.nombre || ""}`}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Dosis</label>
                    <input
                      style={inputStyle(darkMode)}
                      value={medicacionForm.dosis}
                      onChange={(e) =>
                        setMedicacionForm((prev) => ({
                          ...prev,
                          dosis: e.target.value,
                        }))
                      }
                      placeholder="Ej: 500 mg"
                    />
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Frecuencia</label>
                    <input
                      style={inputStyle(darkMode)}
                      value={medicacionForm.frecuencia}
                      onChange={(e) =>
                        setMedicacionForm((prev) => ({
                          ...prev,
                          frecuencia: e.target.value,
                        }))
                      }
                      placeholder="Ej: Cada 8 horas"
                    />
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Vía</label>
                    <input
                      style={inputStyle(darkMode)}
                      value={medicacionForm.via}
                      onChange={(e) =>
                        setMedicacionForm((prev) => ({
                          ...prev,
                          via: e.target.value,
                        }))
                      }
                      placeholder="Ej: IV / VO / IM"
                    />
                  </div>
                </div>

                <div style={styles.saveWrap}>
                  {editandoMedicacion ? (
                    <button
                      type="button"
                      style={styles.softBtn}
                      onClick={cancelarEdicionMedicacion}
                    >
                      Cancelar edición
                    </button>
                  ) : null}

                  <button
                    type="submit"
                    style={styles.primaryBtn}
                    disabled={guardandoMedicacion}
                  >
                    {guardandoMedicacion
                      ? "Guardando medicación..."
                      : editandoMedicacion
                        ? "Modificar medicación"
                        : "Agregar medicación"}
                  </button>
                </div>
              </form>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Medicamento</th>
                      <th style={styles.th}>Dosis</th>
                      <th style={styles.th}>Frecuencia</th>
                      <th style={styles.th}>Vía</th>
                      <th style={styles.th}>Orden</th>
                      <th style={styles.th}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicacion.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={styles.td}>
                          No hay medicación registrada.
                        </td>
                      </tr>
                    ) : (
                      medicacion.map((m) => (
                        <tr key={m.id}>
                          <td style={styles.td}>
                            {`${m?.productos?.codigo || ""} ${m?.productos?.nombre ? `- ${m.productos.nombre}` : ""}`}
                          </td>
                          <td style={styles.td}>{m.dosis || "-"}</td>
                          <td style={styles.td}>{m.frecuencia || "-"}</td>
                          <td style={styles.td}>{m.via || "-"}</td>
                          <td style={styles.td}>
                            {m.ordenes_medicas?.indicacion || "-"}
                          </td>
                          <td style={styles.td}>
                            <div style={styles.rowActions}>
                              <button
                                type="button"
                                style={styles.softBtn}
                                onClick={() => prepararEdicionMedicacion(m)}
                              >
                                Modificar
                              </button>
                              <button
                                type="button"
                                style={styles.dangerBtn}
                                onClick={() => borrarMedicacion(m.id)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}
              {error ? <div style={styles.dangerText}>{error}</div> : null}
            </div>
          </div>
        ) : null}

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.sectionTitle}>Historial de internamientos</h3>
            <div style={styles.sectionSubtitle}>
              Busca internamientos por paciente, estado o texto clínico.
            </div>
          </div>

          <div style={styles.cardBody}>
            <div style={styles.searchHistoryWrap}>
              <select
                style={selectStyle(darkMode)}
                value={pacienteHistorialId}
                onChange={(e) => setPacienteHistorialId(e.target.value)}
              >
                <option value="">Todos los pacientes</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {etiquetaPaciente(p)}
                  </option>
                ))}
              </select>

              <select
                style={selectStyle(darkMode)}
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="alta">Altas</option>
              </select>

              <input
                style={inputStyle(darkMode)}
                value={busquedaHistorial}
                onChange={(e) => setBusquedaHistorial(e.target.value)}
                placeholder="Diagnóstico, nota, autorización..."
              />

              <button
                type="button"
                style={styles.primaryBtn}
                onClick={buscarHistorial}
              >
                {cargando ? "Buscando..." : "Buscar"}
              </button>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Paciente</th>
                    <th style={styles.th}>Habitación</th>
                    <th style={styles.th}>Médico</th>
                    <th style={styles.th}>Motivo / Diagnóstico</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Fecha ingreso</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {internamientos.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={styles.td}>
                        No hay internamientos registrados.
                      </td>
                    </tr>
                  ) : (
                    internamientos.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          <div style={styles.mainText}>
                            {nombreCompletoPersona(item.pacientes)}
                          </div>
                          <div style={styles.subText}>
                            Récord: {item.pacientes?.record || "-"} · Cédula:{" "}
                            {item.pacientes?.cedula || "-"}
                          </div>
                        </td>

                        <td style={styles.td}>
                          {item?.habitacion?.numero
                            ? `Hab. ${item.habitacion.numero}`
                            : item?.camas?.habitaciones?.numero
                              ? `Hab. ${item.camas.habitaciones.numero}`
                              : "-"}
                        </td>

                        <td style={styles.td}>
                          {nombreCompletoPersona(item.medicos) || "-"}
                        </td>

                        <td style={styles.td}>
                          <div style={styles.mainText}>
                            {item.motivos_consulta?.nombre || item.motivo_ingreso_nota || "-"}
                          </div>
                          <div style={styles.subText}>
                            {item.diagnosticos?.nombre || item.diagnostico_ingreso_nota || "-"}
                            {item.autorizacion_numero
                              ? ` (Autorización: ${item.autorizacion_numero})`
                              : ""}
                          </div>
                        </td>

                        <td style={styles.td}>
                          <div style={{ display: "grid", gap: 6 }}>
                            <span style={estiloEstado(item.estado)}>
                              {item.estado || "-"}
                            </span>
                            <span
                              style={estiloEstado(
                                item.estado_facturacion || "pendiente",
                              )}
                            >
                              {item.estado_facturacion || "pendiente"}
                            </span>
                          </div>
                        </td>

                        <td style={styles.td}>
                          {formatearFechaHora(item.fecha_ingreso)}
                        </td>

                        <td style={styles.td}>
                          <div style={styles.rowActions}>
                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => editarInternamiento(item.id)}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => imprimirInternamiento(item.id)}
                            >
                              Imprimir
                            </button>

                            <button
                              type="button"
                              style={styles.warnBtn}
                              onClick={() => prefacturarInternamiento(item.id)}
                            >
                              Pre-factura
                            </button>

                            {puedeDarAlta &&
                            String(item.estado || "").toLowerCase() ===
                              "activo" ? (
                              <button
                                type="button"
                                style={styles.warnBtn}
                                onClick={() => altaInternamiento(item.id)}
                              >
                                Alta
                              </button>
                            ) : null}

                            {puedeEliminar ? (
                              <button
                                type="button"
                                style={styles.dangerBtn}
                                onClick={() =>
                                  borrarInternamiento(item.id, item.cama_id)
                                }
                              >
                                Eliminar
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}
            {error ? <div style={styles.dangerText}>{error}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Internamiento;