import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  agregarInsumoNotaEnfermeria,
  actualizarCantidadInsumoNotaEnfermeria,
  guardarNotaEnfermeriaInternamiento,
  listarAdministracionMedicacion,
  listarAnaliticasInternamiento,
  listarInsumosNotaEnfermeria,
  listarInternamientos,
  listarMedicacionInternamiento,
  listarNotasEnfermeriaInternamiento,
  listarOrdenesMedicas,
  listarProductosInternamiento,
  marcarAnaliticaInternamiento,
  registrarAplicacionMedicacion,
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

const modeloMaterial = {
  producto_id: "",
  cantidad: "",
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

function formatearFechaHora(fecha) {
  if (!fecha) return "-";
  return new Date(fecha).toLocaleString();
}

function normalizarFrecuenciaAHoras(texto) {
  const valor = String(texto || "").toLowerCase();

  if (!valor) return 8;

  const matchNumero = valor.match(/(\d+)/);
  if (matchNumero) return Number(matchNumero[1]) || 8;

  if (valor.includes("cada turno")) return 8;
  if (valor.includes("diario") || valor.includes("cada 24")) return 24;
  if (valor.includes("bid")) return 12;
  if (valor.includes("tid")) return 8;
  if (valor.includes("qid")) return 6;

  return 8;
}

function calcularProximaHora(item) {
  const base =
    item?.created_at ||
    item?.ordenes_medicas?.fecha ||
    item?.fecha ||
    new Date().toISOString();

  const fecha = new Date(base);
  const horas = normalizarFrecuenciaAHoras(item?.frecuencia);
  fecha.setHours(fecha.getHours() + horas);
  return fecha;
}

const EnfermeriaInternamiento = ({ darkMode = false }) => {
  const { usuario } = useAuth();
  const colores = getUiColors(darkMode);

  const [internamientos, setInternamientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);

  const [ordenes, setOrdenes] = useState([]);
  const [medicaciones, setMedicaciones] = useState([]);
  const [historialMedicacion, setHistorialMedicacion] = useState([]);
  const [analiticas, setAnaliticas] = useState([]);
  const [notasEnfermeria, setNotasEnfermeria] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardandoAplicacion, setGuardandoAplicacion] = useState(false);
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [guardandoAnalitica, setGuardandoAnalitica] = useState(false);

  const [notaTexto, setNotaTexto] = useState("");
  const [medicacionNotaSeleccionada, setMedicacionNotaSeleccionada] =
    useState(null);

  const [materialForm, setMaterialForm] = useState(modeloMaterial);
  const [materialesDraft, setMaterialesDraft] = useState([]);

  const [notaHistorialSeleccionada, setNotaHistorialSeleccionada] =
    useState(null);
  const [materialesNotaHistorial, setMaterialesNotaHistorial] = useState([]);
  const [editandoCantidades, setEditandoCantidades] = useState({});

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const rol = String(usuario?.rol || usuario?.role || "").toLowerCase();
  const esAdmin = rol === "admin";
  const esBioanalista = rol === "bioanalista";

  const internamientosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return internamientos;

    return internamientos.filter((item) => {
      const nombre = nombreCompletoPersona(item?.pacientes).toLowerCase();
      const record = String(item?.pacientes?.record || "").toLowerCase();
      const cedula = String(item?.pacientes?.cedula || "").toLowerCase();
      const habitacion = String(
        item?.habitacion?.numero || item?.camas?.habitaciones?.numero || "",
      ).toLowerCase();
      const diagnostico = String(item?.diagnostico_ingreso || "").toLowerCase();

      return (
        nombre.includes(texto) ||
        record.includes(texto) ||
        cedula.includes(texto) ||
        habitacion.includes(texto) ||
        diagnostico.includes(texto)
      );
    });
  }, [internamientos, busqueda]);

  const dashboardMedicaciones = useMemo(() => {
    const lista = [];

    internamientos.forEach((internamiento) => {
      const meds = internamiento?.medicaciones_cache || [];
      meds.forEach((med) => {
        lista.push({
          ...med,
          internamiento_id: internamiento.id,
          paciente: internamiento.pacientes,
          habitacion:
            internamiento.habitacion ||
            internamiento.camas?.habitaciones ||
            null,
          proximaHora: calcularProximaHora(med),
        });
      });
    });

    return lista.sort(
      (a, b) => new Date(a.proximaHora) - new Date(b.proximaHora),
    );
  }, [internamientos]);

  const pacientesPendientes = useMemo(
    () => dashboardMedicaciones.slice(0, 6),
    [dashboardMedicaciones],
  );

  useEffect(() => {
    cargarInicial();
  }, []);

  async function cargarInicial() {
    setCargando(true);
    setError("");

    try {
      const [listaInternamientos, listaProductos] = await Promise.all([
        listarInternamientos({ estado: "activo" }),
        listarProductosInternamiento(),
      ]);

      const enriquecidos = await Promise.all(
        (listaInternamientos || []).map(async (item) => {
          try {
            const meds = await listarMedicacionInternamiento(item.id);
            return { ...item, medicaciones_cache: meds || [] };
          } catch {
            return { ...item, medicaciones_cache: [] };
          }
        }),
      );

      setInternamientos(enriquecidos || []);
      setProductos(listaProductos || []);

      if (seleccionado?.id) {
        const actualizado = enriquecidos.find((i) => i.id === seleccionado.id);
        if (actualizado) {
          await seleccionarInternamiento(actualizado, false);
        }
      }
    } catch (err) {
      setError(err.message || "No se pudo cargar enfermería.");
    } finally {
      setCargando(false);
    }
  }

  async function seleccionarInternamiento(item, limpiarMensajes = true) {
    if (limpiarMensajes) {
      setError("");
      setMensaje("");
    }

    setSeleccionado(item);
    setMedicacionNotaSeleccionada(null);
    setNotaTexto("");
    setMaterialForm(modeloMaterial);
    setMaterialesDraft([]);
    setNotaHistorialSeleccionada(null);
    setMaterialesNotaHistorial([]);
    setEditandoCantidades({});

    const resultados = await Promise.allSettled([
      listarOrdenesMedicas(item.id),
      listarMedicacionInternamiento(item.id),
      listarAdministracionMedicacion(item.id),
      listarAnaliticasInternamiento(item.id),
      listarNotasEnfermeriaInternamiento(item.id),
    ]);

    const [resOrdenes, resMedicacion, resHistorial, resAnaliticas, resNotas] =
      resultados;

    if (resOrdenes.status === "fulfilled") {
      setOrdenes(resOrdenes.value || []);
    } else {
      console.error("Error cargando órdenes médicas:", resOrdenes.reason);
      setOrdenes([]);
    }

    if (resMedicacion.status === "fulfilled") {
      setMedicaciones(resMedicacion.value || []);
    } else {
      console.error("Error cargando medicación:", resMedicacion.reason);
      setMedicaciones([]);
    }

    if (resHistorial.status === "fulfilled") {
      setHistorialMedicacion(resHistorial.value || []);
    } else {
      console.error(
        "Error cargando historial de medicación:",
        resHistorial.reason,
      );
      setHistorialMedicacion([]);
    }

    if (resAnaliticas.status === "fulfilled") {
      setAnaliticas(resAnaliticas.value || []);
    } else {
      console.error("Error cargando analíticas:", resAnaliticas.reason);
      setAnaliticas([]);
    }

    if (resNotas.status === "fulfilled") {
      setNotasEnfermeria(resNotas.value || []);
    } else {
      console.error("Error cargando notas de enfermería:", resNotas.reason);
      setNotasEnfermeria([]);
      setError(
        resNotas.reason?.message ||
          "No se pudieron cargar las notas de enfermería, pero el resto del detalle sí fue cargado.",
      );
    }
  }

  async function aplicarMedicacion(medicacionId, estado = "aplicada") {
    if (!seleccionado?.id) return;

    setGuardandoAplicacion(true);
    setError("");
    setMensaje("");

    try {
      await registrarAplicacionMedicacion({
        medicacion_id: medicacionId,
        internamiento_id: seleccionado.id,
        aplicado_por: usuario?.id || null,
        estado,
        nota: null,
      });

      const historial = await listarAdministracionMedicacion(seleccionado.id);
      setHistorialMedicacion(historial || []);
      setMensaje(
        estado === "aplicada"
          ? "Medicamento aplicado correctamente."
          : "Medicamento marcado como omitido.",
      );
      await cargarInicial();
    } catch (err) {
      setError(err.message || "No se pudo registrar la aplicación.");
    } finally {
      setGuardandoAplicacion(false);
    }
  }

  function abrirNotaEnfermeria(medicacion) {
    setMedicacionNotaSeleccionada(medicacion);
    setNotaTexto("");
    setMaterialForm(modeloMaterial);
    setMaterialesDraft([]);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function agregarMaterialDraft(e) {
    e.preventDefault();
    setError("");
    setMensaje("");

    const cantidad = Number(materialForm.cantidad || 0);

    if (!materialForm.producto_id) {
      setError("Debe seleccionar un material.");
      return;
    }

    if (!cantidad || cantidad <= 0) {
      setError("La cantidad del material debe ser mayor que cero.");
      return;
    }

    const producto = productos.find((p) => p.id === materialForm.producto_id);

    setMaterialesDraft((prev) => [
      ...prev,
      {
        producto_id: materialForm.producto_id,
        cantidad,
        productos: producto || null,
      },
    ]);

    setMaterialForm(modeloMaterial);
  }

  function quitarMaterialDraft(index) {
    setMaterialesDraft((prev) => prev.filter((_, i) => i !== index));
  }

  async function guardarNotaCompleta() {
    if (!seleccionado?.id) {
      setError("Debe seleccionar un interno.");
      return;
    }

    if (!notaTexto.trim()) {
      setError("Debe escribir la nota de enfermería.");
      return;
    }

    setGuardandoNota(true);
    setError("");
    setMensaje("");

    try {
      const nombrePaciente = nombreCompletoPersona(seleccionado?.pacientes);
      const habitacion =
        seleccionado?.habitacion?.numero ||
        seleccionado?.camas?.habitaciones?.numero ||
        "-";
      const medicamento = medicacionNotaSeleccionada?.productos?.nombre || "";

      const notaGuardada = await guardarNotaEnfermeriaInternamiento({
        internamiento_id: seleccionado.id,
        medicacion_id: medicacionNotaSeleccionada?.id || null,
        usuario_id: usuario?.id || null,
        paciente_resumen: nombrePaciente,
        habitacion_resumen: String(habitacion),
        medicamento_resumen: medicamento,
        nota: notaTexto,
      });

      for (const material of materialesDraft) {
        await agregarInsumoNotaEnfermeria({
          internamiento_id: seleccionado.id,
          nota_enfermeria_id: notaGuardada.id,
          producto_id: material.producto_id,
          cantidad: material.cantidad,
          creado_por: usuario?.id || null,
        });
      }

      const [listaNotas, materialesNota] = await Promise.all([
        listarNotasEnfermeriaInternamiento(seleccionado.id),
        listarInsumosNotaEnfermeria(notaGuardada.id),
      ]);

      setNotasEnfermeria(listaNotas || []);
      setNotaHistorialSeleccionada(notaGuardada);
      setMaterialesNotaHistorial(materialesNota || []);
      setMedicacionNotaSeleccionada(null);
      setNotaTexto("");
      setMaterialForm(modeloMaterial);
      setMaterialesDraft([]);
      setMensaje("Nota de enfermería y materiales guardados correctamente.");
    } catch (err) {
      setError(err.message || "No se pudo guardar la nota de enfermería.");
    } finally {
      setGuardandoNota(false);
    }
  }

  async function verMaterialesDeNota(nota) {
    setNotaHistorialSeleccionada(nota);
    setEditandoCantidades({});

    try {
      const lista = await listarInsumosNotaEnfermeria(nota.id);
      setMaterialesNotaHistorial(lista || []);
    } catch (err) {
      setError(
        err.message || "No se pudieron cargar los materiales de la nota.",
      );
    }
  }

  async function guardarNuevaCantidadMaterial(id) {
    try {
      const cantidad = editandoCantidades[id];
      await actualizarCantidadInsumoNotaEnfermeria(id, cantidad);

      if (notaHistorialSeleccionada?.id) {
        const lista = await listarInsumosNotaEnfermeria(
          notaHistorialSeleccionada.id,
        );
        setMaterialesNotaHistorial(lista || []);
      }

      setMensaje("Cantidad actualizada correctamente.");
    } catch (err) {
      setError(err.message || "No se pudo actualizar la cantidad.");
    }
  }

  async function cambiarEstadoAnalitica(id, estado) {
    if (!esBioanalista) {
      setError("Solo el bioanalista puede marcar analíticas.");
      return;
    }

    setGuardandoAnalitica(true);
    setError("");
    setMensaje("");

    try {
      await marcarAnaliticaInternamiento(id, estado, usuario?.id || null, "");
      const lista = await listarAnaliticasInternamiento(seleccionado.id);
      setAnaliticas(lista || []);
      setMensaje("Analítica actualizada correctamente.");
    } catch (err) {
      setError(err.message || "No se pudo actualizar la analítica.");
    } finally {
      setGuardandoAnalitica(false);
    }
  }

  async function abrirPacienteDesdePendiente(item) {
    const encontrado = internamientos.find(
      (i) => i.id === item.internamiento_id,
    );
    if (encontrado) {
      await seleccionarInternamiento(encontrado);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const totalActivos = internamientos.length;
  const totalMedicaciones = dashboardMedicaciones.length;
  const totalPacientesConMedicacion = internamientos.filter(
    (i) => (i?.medicaciones_cache || []).length > 0,
  ).length;
  const seguroSeleccionado = obtenerSeguroPaciente(seleccionado?.pacientes);

  function claseEstadoInternamiento() {
    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 11px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 800,
      textTransform: "capitalize",
      background: darkMode ? "rgba(234,88,12,0.14)" : "#fff7ed",
      color: darkMode ? "#fdba74" : "#c2410c",
      border: darkMode ? "1px solid rgba(234,88,12,0.22)" : "1px solid #fed7aa",
    };
  }

  function claseEstado(estado) {
    const valor = String(estado || "").toLowerCase();

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

    if (valor === "aplicada" || valor === "realizada") {
      return {
        ...base,
        background: darkMode ? "rgba(5,150,105,0.16)" : "#ecfdf5",
        color: darkMode ? "#6ee7b7" : "#047857",
        borderColor: darkMode ? "rgba(5,150,105,0.24)" : "#bbf7d0",
      };
    }

    if (valor === "omitida" || valor === "cancelada") {
      return {
        ...base,
        background: darkMode ? "rgba(220,38,38,0.14)" : "#fef2f2",
        color: darkMode ? "#fca5a5" : "#dc2626",
        borderColor: darkMode ? "rgba(220,38,38,0.24)" : "#fecaca",
      };
    }

    return {
      ...base,
      background: darkMode ? "rgba(37,99,235,0.14)" : "#eff6ff",
      color: darkMode ? "#93c5fd" : "#1d4ed8",
      borderColor: darkMode ? "rgba(37,99,235,0.24)" : "#bfdbfe",
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
    actionBtns: {
      display: "flex",
      gap: "10px",
      flexWrap: "wrap",
      alignItems: "stretch",
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
    disabledBtn: { opacity: 0.65, cursor: "not-allowed" },
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
    metricSub: { marginTop: "6px", fontSize: "12px", color: colores.subtitulo },
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
    searchWrap: { display: "grid", gridTemplateColumns: "1fr", gap: "12px" },
    mainGrid: {
      display: "grid",
      gridTemplateColumns: "340px 1fr",
      gap: "18px",
      alignItems: "start",
    },
    patientList: { display: "grid", gap: "12px", marginTop: "14px" },
    patientCard: {
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
      borderRadius: "18px",
      padding: "15px",
    },
    patientCardActive: {
      border: darkMode
        ? "1px solid rgba(96,165,250,0.45)"
        : "1px solid #60a5fa",
      background: darkMode
        ? "linear-gradient(180deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,1) 100%)"
        : "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
      borderRadius: "18px",
      padding: "15px",
    },
    patientName: {
      fontWeight: 800,
      color: colores.texto,
      marginBottom: "7px",
      fontSize: "15px",
    },
    patientMeta: {
      fontSize: "13px",
      color: colores.subtitulo,
      lineHeight: 1.6,
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
      minWidth: "1050px",
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
    infoGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: "12px",
    },
    infoItem: {
      background: colores.cardSoft,
      border: `1px solid ${colores.borde}`,
      borderRadius: "14px",
      padding: "12px",
    },
    infoLabel: {
      fontSize: "12px",
      color: colores.subtitulo,
      marginBottom: "4px",
      fontWeight: 700,
    },
    infoValue: {
      fontSize: "14px",
      color: colores.texto,
      fontWeight: 800,
      lineHeight: 1.4,
    },
    formGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "14px",
    },
    full: { gridColumn: "1 / -1" },
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
    emptyState: {
      padding: "20px",
      textAlign: "center",
      color: colores.subtitulo,
      fontWeight: 600,
    },
    pendingList: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: "12px",
    },
    pendingCard: {
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
      borderRadius: "18px",
      padding: "14px",
      cursor: "pointer",
    },
    pendingTitle: {
      fontWeight: 800,
      color: colores.texto,
      marginBottom: "6px",
    },
    noteBox: {
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
      borderRadius: "18px",
      padding: "16px",
    },
    smallMuted: { fontSize: "12px", color: colores.subtitulo },
  };

  return (
    <div style={pageWrapperStyle(darkMode)}>
      <div style={styles.topBar}>
        <div style={styles.titleBlock}>
          <div style={styles.titleGlow} />
          <div style={styles.titleInner}>
            <div style={styles.titleChip}>👩‍⚕️ Gestión de enfermería</div>
            <h1 style={styles.title}>Enfermería Internamiento</h1>
            <p style={styles.subtitle}>
              Vista clínica del paciente interno, medicación, analíticas, notas
              y materiales.
            </p>
          </div>
        </div>

        <div style={styles.actionBtns}>
          <button
            type="button"
            style={styles.primaryBtn}
            onClick={cargarInicial}
          >
            Recargar
          </button>
        </div>
      </div>

      <div style={styles.cardsRow}>
        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>🏥</div>
          <div style={styles.metricIcon}>🏥</div>
          <div style={styles.metricTop}>Pacientes activos</div>
          <div style={styles.metricValue}>{totalActivos}</div>
          <div style={styles.metricSub}>Internamientos activos cargados</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>💊</div>
          <div style={styles.metricIcon}>💊</div>
          <div style={styles.metricTop}>Medicaciones programadas</div>
          <div style={styles.metricValue}>{totalMedicaciones}</div>
          <div style={styles.metricSub}>
            Medicaciones detectadas en dashboard
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>🧪</div>
          <div style={styles.metricIcon}>🧪</div>
          <div style={styles.metricTop}>Pacientes con medicación</div>
          <div style={styles.metricValue}>{totalPacientesConMedicacion}</div>
          <div style={styles.metricSub}>Con indicaciones activas</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>📝</div>
          <div style={styles.metricIcon}>📝</div>
          <div style={styles.metricTop}>Notas registradas</div>
          <div style={styles.metricValue}>{notasEnfermeria.length}</div>
          <div style={styles.metricSub}>Del paciente seleccionado</div>
        </div>
      </div>

      <div style={styles.stack}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.sectionTitle}>Dashboard de medicación próxima</h3>
            <div style={styles.sectionSubtitle}>
              Pacientes con medicación priorizada por próxima hora estimada.
            </div>
          </div>

          <div style={styles.cardBody}>
            <div style={styles.pendingList}>
              {pacientesPendientes.length === 0 ? (
                <div style={styles.emptyState}>
                  No hay medicaciones pendientes por mostrar.
                </div>
              ) : (
                pacientesPendientes.map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    style={styles.pendingCard}
                    onClick={() => abrirPacienteDesdePendiente(item)}
                  >
                    <div style={styles.pendingTitle}>
                      {nombreCompletoPersona(item.paciente)}
                    </div>
                    <div style={styles.smallMuted}>
                      <div>
                        <strong>Habitación:</strong>{" "}
                        {item?.habitacion?.numero || "-"}
                      </div>
                      <div>
                        <strong>Medicamento:</strong>{" "}
                        {item?.productos?.nombre || "-"}
                      </div>
                      <div>
                        <strong>Frecuencia:</strong> {item?.frecuencia || "-"}
                      </div>
                      <div>
                        <strong>Próxima hora:</strong>{" "}
                        {item?.proximaHora
                          ? new Date(item.proximaHora).toLocaleString()
                          : "-"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.sectionTitle}>Pacientes internos</h3>
            <div style={styles.sectionSubtitle}>
              Busca por nombre, récord, cédula, habitación o diagnóstico.
            </div>
          </div>

          <div style={styles.cardBody}>
            <div style={styles.searchWrap}>
              <input
                style={inputStyle(darkMode)}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar interno..."
              />
            </div>

            <div style={styles.mainGrid}>
              <div>
                <div style={styles.patientList}>
                  {internamientosFiltrados.length === 0 ? (
                    <div style={styles.emptyState}>
                      No hay internos para mostrar.
                    </div>
                  ) : (
                    internamientosFiltrados.map((item) => {
                      const activo = seleccionado?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          style={
                            activo
                              ? styles.patientCardActive
                              : styles.patientCard
                          }
                        >
                          <div style={styles.patientName}>
                            {nombreCompletoPersona(item?.pacientes)}
                          </div>
                          <div style={styles.patientMeta}>
                            <div>
                              <strong>Récord:</strong>{" "}
                              {item?.pacientes?.record || "-"}
                            </div>
                            <div>
                              <strong>Cédula:</strong>{" "}
                              {item?.pacientes?.cedula || "-"}
                            </div>
                            <div>
                              <strong>Habitación:</strong>{" "}
                              {item?.habitacion?.numero ||
                                item?.camas?.habitaciones?.numero ||
                                "-"}
                            </div>
                            <div>
                              <strong>Estado:</strong> {item?.estado || "-"}
                            </div>
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => seleccionarInternamiento(item)}
                            >
                              Ver
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                {!seleccionado ? (
                  <div style={styles.emptyState}>
                    Selecciona un paciente interno para ver el detalle de
                    enfermería.
                  </div>
                ) : (
                  <>
                    <div style={styles.infoGrid}>
                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Paciente</div>
                        <div style={styles.infoValue}>
                          {nombreCompletoPersona(seleccionado?.pacientes)}
                        </div>
                      </div>

                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Habitación</div>
                        <div style={styles.infoValue}>
                          {seleccionado?.habitacion?.numero ||
                            seleccionado?.camas?.habitaciones?.numero ||
                            "-"}
                        </div>
                      </div>

                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Seguro</div>
                        <div style={styles.infoValue}>
                          {seguroSeleccionado || "-"}
                        </div>
                      </div>

                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Estado</div>
                        <div style={styles.infoValue}>
                          <span style={claseEstadoInternamiento()}>
                            {seleccionado?.estado || "-"}
                          </span>
                        </div>
                      </div>

                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Récord</div>
                        <div style={styles.infoValue}>
                          {seleccionado?.pacientes?.record || "-"}
                        </div>
                      </div>

                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Cédula</div>
                        <div style={styles.infoValue}>
                          {seleccionado?.pacientes?.cedula || "-"}
                        </div>
                      </div>

                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Teléfono</div>
                        <div style={styles.infoValue}>
                          {obtenerTelefonoPaciente(seleccionado?.pacientes) ||
                            "-"}
                        </div>
                      </div>

                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Edad</div>
                        <div style={styles.infoValue}>
                          {calcularEdad(
                            seleccionado?.pacientes?.fecha_nacimiento,
                          ) || "-"}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "18px" }}>
                      <div style={styles.noteBox}>
                        <h4 style={{ marginTop: 0, color: colores.texto }}>
                          Ingreso clínico
                        </h4>
                        <div style={styles.infoGrid}>
                          <div style={styles.infoItem}>
                            <div style={styles.infoLabel}>
                              Diagnóstico de ingreso
                            </div>
                            <div style={styles.infoValue}>
                              {seleccionado?.diagnostico_ingreso || "-"}
                            </div>
                          </div>
                          <div style={styles.infoItem}>
                            <div style={styles.infoLabel}>Origen</div>
                            <div style={styles.infoValue}>
                              {seleccionado?.origen_ingreso || "-"}
                            </div>
                          </div>
                          <div style={styles.infoItem}>
                            <div style={styles.infoLabel}>Autorización</div>
                            <div style={styles.infoValue}>
                              {seleccionado?.autorizacion_numero || "-"}
                            </div>
                          </div>
                          <div style={styles.infoItem}>
                            <div style={styles.infoLabel}>Fecha ingreso</div>
                            <div style={styles.infoValue}>
                              {formatearFechaHora(seleccionado?.fecha_ingreso)}
                            </div>
                          </div>
                          <div
                            style={{ ...styles.infoItem, gridColumn: "1 / -1" }}
                          >
                            <div style={styles.infoLabel}>Nota de ingreso</div>
                            <div style={styles.infoValue}>
                              {seleccionado?.nota_ingreso || "-"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "18px" }}>
                      <div style={styles.noteBox}>
                        <h4 style={{ marginTop: 0, color: colores.texto }}>
                          Órdenes médicas
                        </h4>
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
                                  <td style={styles.td} colSpan={3}>
                                    <div style={styles.emptyState}>
                                      No hay órdenes médicas registradas.
                                    </div>
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
                                    <td style={styles.td}>
                                      {o.indicacion || "-"}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "18px" }}>
                      <div style={styles.noteBox}>
                        <h4 style={{ marginTop: 0, color: colores.texto }}>
                          Medicación activa
                        </h4>

                        <div style={styles.tableWrap}>
                          <table style={styles.table}>
                            <thead>
                              <tr>
                                <th style={styles.th}>Medicamento</th>
                                <th style={styles.th}>Dosis</th>
                                <th style={styles.th}>Frecuencia</th>
                                <th style={styles.th}>Vía</th>
                                <th style={styles.th}>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {medicaciones.length === 0 ? (
                                <tr>
                                  <td style={styles.td} colSpan={5}>
                                    <div style={styles.emptyState}>
                                      No hay medicación registrada.
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                medicaciones.map((m) => (
                                  <tr key={m.id}>
                                    <td style={styles.td}>
                                      {m?.productos?.nombre || "-"}
                                    </td>
                                    <td style={styles.td}>{m?.dosis || "-"}</td>
                                    <td style={styles.td}>
                                      {m?.frecuencia || "-"}
                                    </td>
                                    <td style={styles.td}>{m?.via || "-"}</td>
                                    <td style={styles.td}>
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: "8px",
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        <button
                                          type="button"
                                          style={{
                                            ...styles.primaryBtn,
                                            height: "38px",
                                            padding: "0 12px",
                                            borderRadius: "12px",
                                            ...(guardandoAplicacion
                                              ? styles.disabledBtn
                                              : {}),
                                          }}
                                          disabled={guardandoAplicacion}
                                          onClick={() =>
                                            aplicarMedicacion(m.id, "aplicada")
                                          }
                                        >
                                          Aplicar
                                        </button>

                                        <button
                                          type="button"
                                          style={styles.warnBtn}
                                          disabled={guardandoAplicacion}
                                          onClick={() =>
                                            aplicarMedicacion(m.id, "omitida")
                                          }
                                        >
                                          Omitir
                                        </button>

                                        <button
                                          type="button"
                                          style={styles.softBtn}
                                          onClick={() => abrirNotaEnfermeria(m)}
                                        >
                                          Nota
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "18px" }}>
                      <div style={styles.noteBox}>
                        <h4 style={{ marginTop: 0, color: colores.texto }}>
                          Analíticas
                        </h4>

                        <div style={styles.tableWrap}>
                          <table style={styles.table}>
                            <thead>
                              <tr>
                                <th style={styles.th}>Código</th>
                                <th style={styles.th}>Analítica</th>
                                <th style={styles.th}>Estado</th>
                                <th style={styles.th}>Observación</th>
                                <th style={styles.th}>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analiticas.length === 0 ? (
                                <tr>
                                  <td style={styles.td} colSpan={5}>
                                    <div style={styles.emptyState}>
                                      No hay analíticas registradas.
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                analiticas.map((a) => (
                                  <tr key={a.id}>
                                    <td style={styles.td}>
                                      {a?.analiticas?.codigo || "-"}
                                    </td>
                                    <td style={styles.td}>
                                      {a?.analiticas?.nombre || "-"}
                                    </td>
                                    <td style={styles.td}>
                                      <span style={claseEstado(a?.estado)}>
                                        {a?.estado || "-"}
                                      </span>
                                    </td>
                                    <td style={styles.td}>
                                      {a?.observacion || "-"}
                                    </td>
                                    <td style={styles.td}>
                                      {esBioanalista ? (
                                        <div
                                          style={{
                                            display: "flex",
                                            gap: 8,
                                            flexWrap: "wrap",
                                          }}
                                        >
                                          <button
                                            type="button"
                                            style={styles.primaryBtn}
                                            disabled={guardandoAnalitica}
                                            onClick={() =>
                                              cambiarEstadoAnalitica(
                                                a.id,
                                                "realizada",
                                              )
                                            }
                                          >
                                            Hecha
                                          </button>
                                          <button
                                            type="button"
                                            style={styles.warnBtn}
                                            disabled={guardandoAnalitica}
                                            onClick={() =>
                                              cambiarEstadoAnalitica(
                                                a.id,
                                                "pendiente",
                                              )
                                            }
                                          >
                                            Pendiente
                                          </button>
                                        </div>
                                      ) : (
                                        <span style={styles.smallMuted}>
                                          Solo bioanalista puede marcar
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {medicacionNotaSeleccionada ? (
                      <div style={{ marginTop: "18px" }}>
                        <div style={styles.noteBox}>
                          <h4 style={{ marginTop: 0, color: colores.texto }}>
                            Nota de enfermería para:{" "}
                            {medicacionNotaSeleccionada?.productos?.nombre ||
                              "-"}
                          </h4>

                          <div style={styles.formGrid}>
                            <div style={styles.full}>
                              <label style={labelStyle(darkMode)}>
                                Nota de enfermería
                              </label>
                              <textarea
                                style={{
                                  ...textareaStyle(darkMode),
                                  minHeight: "110px",
                                }}
                                value={notaTexto}
                                onChange={(e) => setNotaTexto(e.target.value)}
                                placeholder="Escriba cómo recibió al paciente, evolución, observación, etc."
                              />
                            </div>

                            <div>
                              <label style={labelStyle(darkMode)}>
                                Material
                              </label>
                              <select
                                style={selectStyle(darkMode)}
                                value={materialForm.producto_id}
                                onChange={(e) =>
                                  setMaterialForm((prev) => ({
                                    ...prev,
                                    producto_id: e.target.value,
                                  }))
                                }
                              >
                                <option value="">Seleccione un material</option>
                                {productos.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.codigo ? `${p.codigo} - ` : ""}
                                    {p.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label style={labelStyle(darkMode)}>
                                Cantidad
                              </label>
                              <input
                                style={inputStyle(darkMode)}
                                type="number"
                                min="1"
                                value={materialForm.cantidad}
                                onChange={(e) =>
                                  setMaterialForm((prev) => ({
                                    ...prev,
                                    cantidad: e.target.value,
                                  }))
                                }
                              />
                            </div>

                            <div style={{ display: "flex", alignItems: "end" }}>
                              <button
                                type="button"
                                style={styles.softBtn}
                                onClick={agregarMaterialDraft}
                              >
                                Agregar material
                              </button>
                            </div>

                            <div style={styles.full}>
                              <div style={styles.tableWrap}>
                                <table style={styles.table}>
                                  <thead>
                                    <tr>
                                      <th style={styles.th}>Material</th>
                                      <th style={styles.th}>Cantidad</th>
                                      <th style={styles.th}>Acción</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {materialesDraft.length === 0 ? (
                                      <tr>
                                        <td style={styles.td} colSpan={3}>
                                          <div style={styles.emptyState}>
                                            No hay materiales agregados.
                                          </div>
                                        </td>
                                      </tr>
                                    ) : (
                                      materialesDraft.map((m, index) => (
                                        <tr key={`${m.producto_id}-${index}`}>
                                          <td style={styles.td}>
                                            {m?.productos?.nombre || "-"}
                                          </td>
                                          <td style={styles.td}>
                                            {m?.cantidad || 0}
                                          </td>
                                          <td style={styles.td}>
                                            <button
                                              type="button"
                                              style={styles.warnBtn}
                                              onClick={() =>
                                                quitarMaterialDraft(index)
                                              }
                                            >
                                              Quitar
                                            </button>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              marginTop: "14px",
                            }}
                          >
                            <button
                              type="button"
                              style={{
                                ...styles.primaryBtn,
                                ...(guardandoNota ? styles.disabledBtn : {}),
                              }}
                              disabled={guardandoNota}
                              onClick={guardarNotaCompleta}
                            >
                              {guardandoNota
                                ? "Guardando..."
                                : "Guardar cambios de enfermería"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div style={{ marginTop: "18px" }}>
                      <div style={styles.noteBox}>
                        <h4 style={{ marginTop: 0, color: colores.texto }}>
                          Historial de administración de medicación
                        </h4>

                        <div style={styles.tableWrap}>
                          <table style={styles.table}>
                            <thead>
                              <tr>
                                <th style={styles.th}>Medicamento</th>
                                <th style={styles.th}>Estado</th>
                                <th style={styles.th}>Fecha</th>
                                <th style={styles.th}>Aplicado por</th>
                                <th style={styles.th}>Nota</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historialMedicacion.length === 0 ? (
                                <tr>
                                  <td style={styles.td} colSpan={5}>
                                    <div style={styles.emptyState}>
                                      No hay historial de administración.
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                historialMedicacion.map((h) => (
                                  <tr key={h.id}>
                                    <td style={styles.td}>
                                      {h?.medicacion_internamiento?.productos
                                        ?.nombre || "-"}
                                    </td>
                                    <td style={styles.td}>
                                      <span style={claseEstado(h?.estado)}>
                                        {h?.estado || "-"}
                                      </span>
                                    </td>
                                    <td style={styles.td}>
                                      {h?.fecha_aplicacion
                                        ? new Date(
                                            h.fecha_aplicacion,
                                          ).toLocaleString()
                                        : h?.created_at
                                          ? new Date(
                                              h.created_at,
                                            ).toLocaleString()
                                          : "-"}
                                    </td>
                                    <td style={styles.td}>
                                      {nombreCompletoPersona(h?.usuarios) ||
                                        h?.usuarios?.username ||
                                        "-"}
                                    </td>
                                    <td style={styles.td}>{h?.nota || "-"}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "18px" }}>
                      <div style={styles.noteBox}>
                        <h4 style={{ marginTop: 0, color: colores.texto }}>
                          Notas de enfermería
                        </h4>

                        <div style={styles.tableWrap}>
                          <table style={styles.table}>
                            <thead>
                              <tr>
                                <th style={styles.th}>Fecha</th>
                                <th style={styles.th}>Medicamento</th>
                                <th style={styles.th}>Nota</th>
                                <th style={styles.th}>Usuario</th>
                                <th style={styles.th}>Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {notasEnfermeria.length === 0 ? (
                                <tr>
                                  <td style={styles.td} colSpan={5}>
                                    <div style={styles.emptyState}>
                                      No hay notas de enfermería registradas.
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                notasEnfermeria.map((n) => (
                                  <tr key={n.id}>
                                    <td style={styles.td}>
                                      {n?.fecha
                                        ? new Date(n.fecha).toLocaleString()
                                        : "-"}
                                    </td>
                                    <td style={styles.td}>
                                      {n?.medicamento_resumen || "-"}
                                    </td>
                                    <td style={styles.td}>{n?.nota || "-"}</td>
                                    <td style={styles.td}>
                                      {nombreCompletoPersona(n?.usuarios) ||
                                        n?.usuarios?.username ||
                                        "-"}
                                    </td>
                                    <td style={styles.td}>
                                      <button
                                        type="button"
                                        style={styles.softBtn}
                                        onClick={() => verMaterialesDeNota(n)}
                                      >
                                        Ver materiales
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {notaHistorialSeleccionada ? (
                          <div style={{ marginTop: "18px" }}>
                            <div style={styles.noteBox}>
                              <h4
                                style={{ marginTop: 0, color: colores.texto }}
                              >
                                Materiales de la nota seleccionada
                              </h4>

                              <div style={styles.tableWrap}>
                                <table style={styles.table}>
                                  <thead>
                                    <tr>
                                      <th style={styles.th}>Material</th>
                                      <th style={styles.th}>Cantidad</th>
                                      <th style={styles.th}>Fecha</th>
                                      <th style={styles.th}>Acción</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {materialesNotaHistorial.length === 0 ? (
                                      <tr>
                                        <td style={styles.td} colSpan={4}>
                                          <div style={styles.emptyState}>
                                            No hay materiales para esta nota.
                                          </div>
                                        </td>
                                      </tr>
                                    ) : (
                                      materialesNotaHistorial.map((i) => (
                                        <tr key={i.id}>
                                          <td style={styles.td}>
                                            {i?.productos?.nombre || "-"}
                                          </td>
                                          <td style={styles.td}>
                                            {esAdmin ? (
                                              <input
                                                style={{
                                                  ...inputStyle(darkMode),
                                                  minWidth: "90px",
                                                }}
                                                type="number"
                                                min="1"
                                                step="1"
                                                value={
                                                  editandoCantidades[i.id] ??
                                                  i.cantidad
                                                }
                                                onChange={(e) =>
                                                  setEditandoCantidades(
                                                    (prev) => ({
                                                      ...prev,
                                                      [i.id]: e.target.value,
                                                    }),
                                                  )
                                                }
                                              />
                                            ) : (
                                              i?.cantidad || "-"
                                            )}
                                          </td>
                                          <td style={styles.td}>
                                            {i?.fecha
                                              ? new Date(
                                                  i.fecha,
                                                ).toLocaleString()
                                              : "-"}
                                          </td>
                                          <td style={styles.td}>
                                            {esAdmin ? (
                                              <button
                                                type="button"
                                                style={styles.primaryBtn}
                                                onClick={() =>
                                                  guardarNuevaCantidadMaterial(
                                                    i.id,
                                                  )
                                                }
                                              >
                                                Guardar cantidad
                                              </button>
                                            ) : (
                                              <span style={styles.smallMuted}>
                                                Solo admin
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}
            {error ? <div style={styles.dangerText}>{error}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnfermeriaInternamiento;