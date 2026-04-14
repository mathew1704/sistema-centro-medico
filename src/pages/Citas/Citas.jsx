import { useEffect, useMemo, useState } from 'react';
import {
  actualizarCita,
  buscarPacientesCitas,
  cambiarEstadoCita,
  construirLinkWhatsApp,
  construirMailtoCita,
  construirMensajeRecordatorio,
  crearCita,
  eliminarCita,
  listarCitas,
  listarConsultorios,
  listarEstadosCitas,
  listarMedicos,
  listarMotivosConsulta,
  obtenerCitaPorId,
  obtenerDetalleAgendaCita,
  registrarNotificacionCita,
} from '../../services/citaService';
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
} from '../../styles/uiTheme';

const modelo = {
  id: null,
  paciente_id: '',
  medico_id: '',
  consultorio_id: '',
  motivo_id: '',
  fecha: '',
  hora: '',
  telefono_contacto: '',
  correo_contacto: '',
  observacion: '',
};

function etiquetaPaciente(p) {
  const partes = [
    p.record ? `Rec: ${p.record}` : null,
    `${p.nombre || ''} ${p.apellido || ''}`.trim(),
    p.cedula ? `Céd: ${p.cedula}` : null,
    p.numero_afiliado ? `Afiliado: ${p.numero_afiliado}` : null,
  ].filter(Boolean);

  return partes.join(' | ');
}

function etiquetaMedico(m) {
  return `${m.codigo || ''} - ${m.nombre || ''} ${m.apellido || ''}`.trim();
}

function formatearFecha(fecha) {
  if (!fecha) return '';
  try {
    return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-DO');
  } catch {
    return fecha;
  }
}

const Citas = ({ darkMode = false }) => {
  const colores = getUiColors(darkMode);

  const [citas, setCitas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [consultorios, setConsultorios] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [estados, setEstados] = useState([]);
  const [busquedaPaciente, setBusquedaPaciente] = useState('');
  const [filtro, setFiltro] = useState('');
  const [filtroMedico, setFiltroMedico] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [formulario, setFormulario] = useState(modelo);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [citaNotificacion, setCitaNotificacion] = useState(null);
  const [mensajePreview, setMensajePreview] = useState('');

  const totalHoy = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    return citas.filter((c) => c.fecha === hoy).length;
  }, [citas]);

  const totalConfirmadas = useMemo(() => {
    return citas.filter((c) => (c.estado_nombre || '').toLowerCase() === 'confirmada').length;
  }, [citas]);

  useEffect(() => {
    cargarInicial();
  }, []);

  useEffect(() => {
    cargarPacientesParaFormulario(busquedaPaciente);
  }, [busquedaPaciente]);

  async function cargarInicial() {
    setCargando(true);
    setError('');

    try {
      const [
        listaCitas,
        listaPacientes,
        listaMedicos,
        listaConsultorios,
        listaMotivos,
        listaEstados,
      ] = await Promise.all([
        listarCitas(),
        buscarPacientesCitas(),
        listarMedicos(),
        listarConsultorios(),
        listarMotivosConsulta(),
        listarEstadosCitas(),
      ]);

      setCitas(listaCitas);
      setPacientes(listaPacientes);
      setMedicos(listaMedicos);
      setConsultorios(listaConsultorios);
      setMotivos(listaMotivos);
      setEstados(listaEstados);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la información del módulo.');
    } finally {
      setCargando(false);
    }
  }

  async function cargarPacientesParaFormulario(filtroPaciente = '') {
    try {
      const lista = await buscarPacientesCitas(filtroPaciente);
      setPacientes(lista);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los pacientes.');
    }
  }

  async function buscarAgenda() {
    setCargando(true);
    setError('');

    try {
      const lista = await listarCitas({
        filtro,
        medicoId: filtroMedico,
        fecha: filtroFecha,
        estadoId: filtroEstado,
      });

      setCitas(lista);
    } catch (err) {
      setError(err.message || 'No se pudo buscar la agenda.');
    } finally {
      setCargando(false);
    }
  }

  function cambiarCampo(campo, valor) {
    setFormulario((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }

  async function cambiarPacienteSeleccionado(pacienteId) {
    cambiarCampo('paciente_id', pacienteId);

    if (!pacienteId) {
      cambiarCampo('telefono_contacto', '');
      cambiarCampo('correo_contacto', '');
      return;
    }

    const paciente = pacientes.find((p) => String(p.id) === String(pacienteId));

    cambiarCampo('telefono_contacto', paciente?.telefono_principal || '');
    cambiarCampo('correo_contacto', paciente?.correo || '');
  }

  function limpiarFormulario() {
    setFormulario(modelo);
    setBusquedaPaciente('');
    setError('');
    setMensaje('');
  }

  function cerrarModalNotificacion() {
    setModalVisible(false);
    setCitaNotificacion(null);
    setMensajePreview('');
  }

  function prepararNotificacionDesdeDetalle(detalle) {
    const pacienteNombre =
      `${detalle?.paciente_nombre || ''} ${detalle?.paciente_apellido || ''}`.trim();
    const medicoNombre =
      `${detalle?.medico_nombre || ''} ${detalle?.medico_apellido || ''}`.trim();

    const msg = construirMensajeRecordatorio({
      pacienteNombre,
      fecha: formatearFecha(detalle?.fecha),
      hora: detalle?.hora || '',
      medicoNombre,
      consultorioNombre: detalle?.consultorio_nombre || '',
    });

    setCitaNotificacion(detalle);
    setMensajePreview(msg);
    setModalVisible(true);
  }

  async function editarCita(id) {
    setError('');
    setMensaje('');

    try {
      const c = await obtenerCitaPorId(id);

      setFormulario({
        id: c.id,
        paciente_id: c.paciente_id || '',
        medico_id: c.medico_id || '',
        consultorio_id: c.consultorio_id || '',
        motivo_id: c.motivo_id || '',
        fecha: c.fecha || '',
        hora: c.hora || '',
        telefono_contacto: c.telefono_contacto || '',
        correo_contacto: c.correo_contacto || '',
        observacion: c.observacion || '',
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'No se pudo cargar la cita.');
    }
  }

  async function guardarCita(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      let nueva = null;
      const esEdicion = Boolean(formulario.id);

      if (esEdicion) {
        nueva = await actualizarCita(formulario.id, formulario);
        setMensaje('Cita actualizada correctamente.');
      } else {
        nueva = await crearCita(formulario);
        setMensaje('Cita creada correctamente.');
      }

      await cargarInicial();

      if (!esEdicion && nueva?.id) {
        const detalle = await obtenerDetalleAgendaCita(nueva.id);
        prepararNotificacionDesdeDetalle(detalle);
      }

      if (esEdicion) {
        limpiarFormulario();
      }
    } catch (err) {
      setError(err.message || 'No se pudo guardar la cita.');
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarCita(id) {
    try {
      await cambiarEstadoCita(id, 'confirmada');
      await cargarInicial();
      setMensaje('Cita confirmada.');
    } catch (err) {
      setError(err.message || 'No se pudo confirmar la cita.');
    }
  }

  async function marcarAtendida(id) {
    try {
      await cambiarEstadoCita(id, 'atendida');
      await cargarInicial();
      setMensaje('Cita marcada como atendida.');
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la cita.');
    }
  }

  async function cancelarCita(id) {
    try {
      await eliminarCita(id);
      await cargarInicial();
      setMensaje('Cita cancelada correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo cancelar la cita.');
    }
  }

  async function abrirModalDesdeAgenda(id) {
    try {
      setError('');
      const detalle = await obtenerDetalleAgendaCita(id);
      prepararNotificacionDesdeDetalle(detalle);
    } catch (err) {
      setError(err.message || 'No se pudo abrir la notificación.');
    }
  }

  async function enviarPorCorreo() {
    try {
      if (!citaNotificacion?.id) {
        throw new Error('No hay cita seleccionada para notificar.');
      }

      if (!citaNotificacion?.correo_contacto) {
        throw new Error('La cita no tiene correo de contacto.');
      }

      const pacienteNombre =
        `${citaNotificacion?.paciente_nombre || ''} ${citaNotificacion?.paciente_apellido || ''}`.trim();

      const asunto = `Recordatorio de cita médica - ${pacienteNombre}`;

      const url = construirMailtoCita({
        correo: citaNotificacion.correo_contacto,
        asunto,
        mensaje: mensajePreview,
      });

      await registrarNotificacionCita({
        cita_id: citaNotificacion.id,
        canal: 'email',
        mensaje: mensajePreview,
        estado: 'enviada',
      });

      window.location.href = url;
      setMensaje('Se abrió el correo con el mensaje listo para enviar.');
      cerrarModalNotificacion();
      await cargarInicial();
    } catch (err) {
      setError(err.message || 'No se pudo preparar el correo.');
    }
  }

  async function enviarPorWhatsApp() {
    try {
      if (!citaNotificacion?.id) {
        throw new Error('No hay cita seleccionada para notificar.');
      }

      if (!citaNotificacion?.telefono_contacto) {
        throw new Error('La cita no tiene teléfono de contacto.');
      }

      const link = construirLinkWhatsApp({
        telefono: citaNotificacion.telefono_contacto,
        mensaje: mensajePreview,
      });

      await registrarNotificacionCita({
        cita_id: citaNotificacion.id,
        canal: 'whatsapp',
        mensaje: mensajePreview,
        estado: 'enviada',
        respuesta: 'SIMULADO_SIN_API',
      });

      if (link) {
        window.open(link, '_blank', 'noopener,noreferrer');
      }

      setMensaje('WhatsApp simulado: se registró como enviado y se abrió el mensaje listo.');
      cerrarModalNotificacion();
      await cargarInicial();
    } catch (err) {
      setError(err.message || 'No se pudo simular el envío por WhatsApp.');
    }
  }

  function estiloEstado(nombre) {
    const n = (nombre || '').toLowerCase();

    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 800,
      border: '1px solid transparent',
      textTransform: 'capitalize',
    };

    if (n === 'confirmada') {
      return {
        ...base,
        background: darkMode ? 'rgba(5,150,105,0.16)' : '#ecfdf5',
        color: darkMode ? '#6ee7b7' : '#047857',
        borderColor: darkMode ? 'rgba(5,150,105,0.24)' : '#bbf7d0',
      };
    }

    if (n === 'cancelada') {
      return {
        ...base,
        background: darkMode ? 'rgba(220,38,38,0.14)' : '#fef2f2',
        color: darkMode ? '#fca5a5' : '#b91c1c',
        borderColor: darkMode ? 'rgba(220,38,38,0.22)' : '#fecaca',
      };
    }

    if (n === 'atendida') {
      return {
        ...base,
        background: darkMode ? 'rgba(37,99,235,0.14)' : '#eff6ff',
        color: darkMode ? '#93c5fd' : '#1d4ed8',
        borderColor: darkMode ? 'rgba(37,99,235,0.22)' : '#bfdbfe',
      };
    }

    return {
      ...base,
      background: darkMode ? 'rgba(234,88,12,0.14)' : '#fff7ed',
      color: darkMode ? '#fdba74' : '#c2410c',
      borderColor: darkMode ? 'rgba(234,88,12,0.22)' : '#fed7aa',
    };
  }

  const styles = {
    topBar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '18px',
      marginBottom: '22px',
      flexWrap: 'wrap',
    },
    titleBlock: {
      ...cardStyle(darkMode),
      background: colores.gradienteHeader,
      color: '#ffffff',
      padding: '24px',
      flex: '1 1 700px',
      minWidth: 0,
      position: 'relative',
      overflow: 'hidden',
    },
    titleGlow: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background: `
        radial-gradient(circle at 15% 20%, rgba(255,255,255,0.14) 0%, transparent 20%),
        radial-gradient(circle at 86% 18%, rgba(255,255,255,0.10) 0%, transparent 16%),
        radial-gradient(circle at 70% 82%, rgba(255,255,255,0.08) 0%, transparent 18%)
      `,
    },
    titleInner: {
      position: 'relative',
      zIndex: 1,
    },
    titleChip: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.14)',
      fontSize: '12px',
      fontWeight: 800,
      marginBottom: '14px',
    },
    title: {
      margin: 0,
      fontSize: '32px',
      fontWeight: 900,
      lineHeight: 1.15,
    },
    subtitle: {
      marginTop: '10px',
      marginBottom: 0,
      color: 'rgba(255,255,255,0.90)',
      fontSize: '15px',
      lineHeight: 1.6,
      maxWidth: '760px',
    },
    actionWrap: {
      display: 'flex',
      alignItems: 'stretch',
      flexShrink: 0,
    },
    cardsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '18px',
      marginBottom: '22px',
    },
    metricCard: {
      ...statCardStyle(darkMode),
      minWidth: 0,
    },
    metricIcon: {
      width: '46px',
      height: '46px',
      borderRadius: '16px',
      display: 'grid',
      placeItems: 'center',
      background: darkMode ? '#0b1220' : '#f4f8fc',
      border: `1px solid ${colores.borde}`,
      fontSize: '20px',
      marginBottom: '14px',
    },
    metricGhost: {
      position: 'absolute',
      top: '-14px',
      right: '-8px',
      fontSize: '58px',
      opacity: 0.08,
      pointerEvents: 'none',
    },
    metricLabel: {
      fontSize: '13px',
      color: colores.subtitulo,
    },
    metricValue: {
      marginTop: '8px',
      fontSize: '30px',
      fontWeight: 900,
      color: colores.texto,
      lineHeight: 1,
    },
    stack: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    },
    card: {
      ...cardStyle(darkMode),
      padding: '0',
      overflow: 'hidden',
    },
    cardBody: {
      padding: '20px',
      minWidth: 0,
    },
    sectionTitle: {
      margin: '0 0 16px',
      fontSize: '20px',
      fontWeight: 800,
      color: colores.texto,
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '14px',
      minWidth: 0,
    },
    full: {
      gridColumn: '1 / -1',
      minWidth: 0,
    },
    saveWrap: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '20px',
      flexWrap: 'wrap',
    },
    searchWrap: {
      display: 'grid',
      gridTemplateColumns: '1.25fr minmax(180px, 1fr) minmax(150px, 0.8fr) minmax(150px, 0.9fr) auto',
      gap: '10px',
      marginBottom: '18px',
      minWidth: 0,
      alignItems: 'stretch',
    },
    tableWrap: {
      overflowX: 'auto',
      borderRadius: '18px',
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
    },
    table: {
      width: '100%',
      minWidth: '1040px',
      borderCollapse: 'collapse',
    },
    th: {
      textAlign: 'left',
      padding: '14px 12px',
      fontSize: '13px',
      color: colores.subtitulo,
      borderBottom: `1px solid ${colores.borde}`,
      background: darkMode ? '#0b1220' : '#f8fbff',
      whiteSpace: 'nowrap',
    },
    td: {
      padding: '14px 12px',
      fontSize: '14px',
      borderBottom: `1px solid ${colores.borde}`,
      verticalAlign: 'top',
      color: colores.texto,
      background: 'transparent',
    },
    pacienteMain: {
      fontWeight: 800,
      color: colores.texto,
    },
    pacienteSub: {
      fontSize: '12px',
      color: colores.subtitulo,
      marginTop: '4px',
    },
    actionsWrap: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
    },
    softBtn: {
      ...buttonSoftStyle(darkMode),
      height: '38px',
      padding: '0 12px',
      borderRadius: '12px',
      fontSize: '13px',
    },
    primaryBtn: {
      ...buttonPrimaryStyle,
      height: '46px',
      borderRadius: '14px',
      boxShadow: '0 10px 22px rgba(37,99,235,0.18)',
    },
    okText: {
      color: darkMode ? '#6ee7b7' : '#059669',
      fontWeight: 700,
      marginTop: '12px',
      fontSize: '13px',
    },
    dangerText: {
      color: darkMode ? '#fca5a5' : '#dc2626',
      fontWeight: 700,
      marginTop: '12px',
      fontSize: '13px',
    },
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.70)',
      display: 'grid',
      placeItems: 'center',
      padding: '20px',
      zIndex: 9999,
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    },
    modalCard: {
      width: '100%',
      maxWidth: '900px',
      background: colores.card,
      borderRadius: '24px',
      border: `1px solid ${colores.borde}`,
      boxShadow: darkMode
        ? '0 25px 60px rgba(0,0,0,0.42)'
        : '0 25px 60px rgba(15,23,42,0.22)',
      overflow: 'hidden',
    },
    modalHeader: {
      padding: '18px 20px',
      borderBottom: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
    },
    modalTitle: {
      fontSize: '20px',
      fontWeight: 800,
      color: colores.texto,
      margin: 0,
    },
    modalSubtitle: {
      color: colores.subtitulo,
      marginTop: '4px',
      fontSize: '14px',
    },
    modalBody: {
      padding: '20px',
      display: 'grid',
      gap: '16px',
    },
    modalGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '12px',
    },
    modalBox: {
      border: `1px solid ${colores.borde}`,
      borderRadius: '16px',
      background: colores.cardSoft,
      padding: '14px',
      minWidth: 0,
    },
    modalLabel: {
      fontSize: '12px',
      color: colores.subtitulo,
      marginBottom: '4px',
    },
    modalValue: {
      color: colores.texto,
      fontWeight: 800,
      fontSize: '14px',
      wordBreak: 'break-word',
    },
  };

  return (
    <div style={pageWrapperStyle(darkMode)}>
      <div style={styles.topBar}>
        <div style={styles.titleBlock}>
          <div style={styles.titleGlow} />
          <div style={styles.titleInner}>
            <div style={styles.titleChip}>📅 Gestión de citas médicas</div>
            <h1 style={styles.title}>Citas Médicas</h1>
            <p style={styles.subtitle}>
              Programación, búsqueda, seguimiento y notificaciones de citas por médico y paciente.
            </p>
          </div>
        </div>

        <div style={styles.actionWrap}>
          <button type="button" style={styles.primaryBtn} onClick={limpiarFormulario}>
            + Nueva Cita
          </button>
        </div>
      </div>

      <div style={styles.cardsRow}>
        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>📋</div>
          <div style={styles.metricIcon}>📋</div>
          <div style={styles.metricLabel}>Total citas cargadas</div>
          <div style={styles.metricValue}>{citas.length}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>📅</div>
          <div style={styles.metricIcon}>📅</div>
          <div style={styles.metricLabel}>Citas de hoy</div>
          <div style={{ ...styles.metricValue, color: colores.primario }}>{totalHoy}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>✅</div>
          <div style={styles.metricIcon}>✅</div>
          <div style={styles.metricLabel}>Confirmadas</div>
          <div style={{ ...styles.metricValue, color: colores.exito }}>{totalConfirmadas}</div>
        </div>
      </div>

      <div style={styles.stack}>
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>
              {formulario.id ? 'Editar cita' : 'Registro de cita'}
            </h3>

            <form onSubmit={guardarCita}>
              <div style={styles.formGrid}>
                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Buscar paciente</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={busquedaPaciente}
                    onChange={(e) => setBusquedaPaciente(e.target.value)}
                    placeholder="Buscar por récord, cédula, nombre, apellido o afiliado"
                  />
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Paciente</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formulario.paciente_id}
                    onChange={(e) => cambiarPacienteSeleccionado(e.target.value)}
                    required
                  >
                    <option value="">Seleccione un paciente</option>
                    {pacientes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {etiquetaPaciente(p)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Médico</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formulario.medico_id}
                    onChange={(e) => cambiarCampo('medico_id', e.target.value)}
                    required
                  >
                    <option value="">Seleccione un médico</option>
                    {medicos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {etiquetaMedico(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Consultorio</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formulario.consultorio_id}
                    onChange={(e) => cambiarCampo('consultorio_id', e.target.value)}
                  >
                    <option value="">Seleccione consultorio</option>
                    {consultorios.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Fecha</label>
                  <input
                    type="date"
                    style={inputStyle(darkMode)}
                    value={formulario.fecha}
                    onChange={(e) => cambiarCampo('fecha', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Hora</label>
                  <input
                    type="time"
                    style={inputStyle(darkMode)}
                    value={formulario.hora}
                    onChange={(e) => cambiarCampo('hora', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Motivo</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formulario.motivo_id}
                    onChange={(e) => cambiarCampo('motivo_id', e.target.value)}
                  >
                    <option value="">Seleccione motivo</option>
                    {motivos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Teléfono de contacto</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formulario.telefono_contacto}
                    onChange={(e) => cambiarCampo('telefono_contacto', e.target.value)}
                  />
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Correo de contacto</label>
                  <input
                    type="email"
                    style={inputStyle(darkMode)}
                    value={formulario.correo_contacto}
                    onChange={(e) => cambiarCampo('correo_contacto', e.target.value)}
                  />
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Observación</label>
                  <textarea
                    style={textareaStyle(darkMode)}
                    value={formulario.observacion}
                    onChange={(e) => cambiarCampo('observacion', e.target.value)}
                  />
                </div>
              </div>

              <div style={styles.saveWrap}>
                <button type="button" style={styles.softBtn} onClick={limpiarFormulario}>
                  Limpiar
                </button>

                <button type="submit" style={styles.primaryBtn} disabled={guardando}>
                  {guardando
                    ? 'Guardando...'
                    : formulario.id
                    ? 'Actualizar cita'
                    : 'Registrar cita'}
                </button>
              </div>

              {error ? <div style={styles.dangerText}>{error}</div> : null}
              {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}
            </form>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>Agenda y búsqueda</h3>

            <div style={styles.searchWrap}>
              <input
                style={inputStyle(darkMode)}
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Paciente, récord, cédula, médico..."
              />

              <select
                style={selectStyle(darkMode)}
                value={filtroMedico}
                onChange={(e) => setFiltroMedico(e.target.value)}
              >
                <option value="">Todos los médicos</option>
                {medicos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {etiquetaMedico(m)}
                  </option>
                ))}
              </select>

              <input
                type="date"
                style={inputStyle(darkMode)}
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
              />

              <select
                style={selectStyle(darkMode)}
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                {estados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>

              <button type="button" style={styles.primaryBtn} onClick={buscarAgenda}>
                Buscar
              </button>
            </div>

            {cargando ? <div style={styles.okText}>Cargando citas...</div> : null}
            {error ? <div style={styles.dangerText}>{error}</div> : null}
            {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Paciente</th>
                    <th style={styles.th}>Fecha</th>
                    <th style={styles.th}>Hora</th>
                    <th style={styles.th}>Doctor</th>
                    <th style={styles.th}>Consultorio</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {!cargando && citas.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan="7">
                        No hay citas para mostrar.
                      </td>
                    </tr>
                  ) : (
                    citas.map((c) => (
                      <tr key={c.id}>
                        <td style={styles.td}>
                          <div style={styles.pacienteMain}>
                            {c.paciente_nombre} {c.paciente_apellido}
                          </div>
                          <div style={styles.pacienteSub}>{c.record || '-'}</div>
                        </td>
                        <td style={styles.td}>{c.fecha}</td>
                        <td style={styles.td}>{c.hora}</td>
                        <td style={styles.td}>
                          {c.medico_nombre} {c.medico_apellido}
                        </td>
                        <td style={styles.td}>{c.consultorio_nombre || '-'}</td>
                        <td style={styles.td}>
                          <span style={estiloEstado(c.estado_nombre)}>
                            {c.estado_nombre || 'pendiente'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.actionsWrap}>
                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => editarCita(c.id)}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => abrirModalDesdeAgenda(c.id)}
                            >
                              Notificar
                            </button>

                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => confirmarCita(c.id)}
                            >
                              Confirmar
                            </button>

                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => marcarAtendida(c.id)}
                            >
                              Atender
                            </button>

                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => cancelarCita(c.id)}
                            >
                              Cancelar
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
      </div>

      {modalVisible && citaNotificacion ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Envío de recordatorio de cita</div>
              <div style={styles.modalSubtitle}>
                Puedes enviar por correo o simular el envío por WhatsApp
              </div>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.modalGrid}>
                <div style={styles.modalBox}>
                  <div style={styles.modalLabel}>Paciente</div>
                  <div style={styles.modalValue}>
                    {citaNotificacion.paciente_nombre} {citaNotificacion.paciente_apellido}
                  </div>
                </div>

                <div style={styles.modalBox}>
                  <div style={styles.modalLabel}>Récord</div>
                  <div style={styles.modalValue}>{citaNotificacion.record || '-'}</div>
                </div>

                <div style={styles.modalBox}>
                  <div style={styles.modalLabel}>Médico</div>
                  <div style={styles.modalValue}>
                    {citaNotificacion.medico_nombre} {citaNotificacion.medico_apellido}
                  </div>
                </div>

                <div style={styles.modalBox}>
                  <div style={styles.modalLabel}>Consultorio</div>
                  <div style={styles.modalValue}>{citaNotificacion.consultorio_nombre || '-'}</div>
                </div>

                <div style={styles.modalBox}>
                  <div style={styles.modalLabel}>Fecha</div>
                  <div style={styles.modalValue}>{formatearFecha(citaNotificacion.fecha)}</div>
                </div>

                <div style={styles.modalBox}>
                  <div style={styles.modalLabel}>Hora</div>
                  <div style={styles.modalValue}>{citaNotificacion.hora || '-'}</div>
                </div>

                <div style={styles.modalBox}>
                  <div style={styles.modalLabel}>Correo</div>
                  <div style={styles.modalValue}>{citaNotificacion.correo_contacto || '-'}</div>
                </div>

                <div style={styles.modalBox}>
                  <div style={styles.modalLabel}>WhatsApp / Teléfono</div>
                  <div style={styles.modalValue}>{citaNotificacion.telefono_contacto || '-'}</div>
                </div>
              </div>

              <div>
                <label style={labelStyle(darkMode)}>Mensaje</label>
                <textarea
                  style={{
                    ...textareaStyle(darkMode),
                    minHeight: '190px',
                    lineHeight: 1.5,
                  }}
                  value={mensajePreview}
                  onChange={(e) => setMensajePreview(e.target.value)}
                />
              </div>

              <div style={styles.saveWrap}>
                <button type="button" style={styles.softBtn} onClick={cerrarModalNotificacion}>
                  Cerrar
                </button>

                <button type="button" style={styles.softBtn} onClick={enviarPorCorreo}>
                  Correo
                </button>

                <button type="button" style={styles.primaryBtn} onClick={enviarPorWhatsApp}>
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Citas;