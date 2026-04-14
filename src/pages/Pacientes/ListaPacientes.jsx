import { useEffect, useMemo, useState } from 'react';
import {
  listarARS,
  buscarPacientes,
  obtenerPacientePorId,
  crearPaciente,
  actualizarPaciente,
  eliminarPaciente,
  subirDocumentoPaciente,
  eliminarDocumentoPaciente,
} from '../../services/pacienteService';
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
} from '../../styles/uiTheme';

const modeloBase = {
  id: null,
  record: '',
  nombre: '',
  apellido: '',
  cedula: '',
  nacionalidad: 'Dominicana',
  sexo: '',
  estado_civil: '',
  fecha_nacimiento: '',
  correo: '',
  menor_edad: false,
  telefono: '',
  direccion: '',
  ciudad: '',
  provincia: '',
  ars_id: '',
  numero_afiliado: '',
  plan: '',
  tutor_nombre: '',
  tutor_apellido: '',
  tutor_cedula: '',
  tutor_telefono: '',
  tutor_parentesco: 'Padre/Madre',
  documentos: [],
};

function esImagen(url = '') {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
}

function ListaPacientes({ darkMode = false }) {
  const colores = getUiColors(darkMode);

  const [pacientes, setPacientes] = useState([]);
  const [arsList, setArsList] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [formulario, setFormulario] = useState(modeloBase);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const totalMenores = useMemo(
    () => pacientes.filter((p) => p.menor_edad).length,
    [pacientes]
  );

  const totalConSeguro = useMemo(
    () => pacientes.filter((p) => p.seguro_nombre).length,
    [pacientes]
  );

  useEffect(() => {
    cargarInicial();
  }, []);

  async function cargarInicial() {
    setCargando(true);
    setError('');

    try {
      const [lista, listaARS] = await Promise.all([
        buscarPacientes(),
        listarARS(),
      ]);

      setPacientes(lista);
      setArsList(listaARS);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la información.');
    } finally {
      setCargando(false);
    }
  }

  async function ejecutarBusqueda() {
    setCargando(true);
    setError('');

    try {
      const data = await buscarPacientes(busqueda);
      setPacientes(data);
    } catch (err) {
      setError(err.message || 'Error buscando pacientes.');
    } finally {
      setCargando(false);
    }
  }

  function limpiarFormulario() {
    setFormulario(modeloBase);
    setError('');
    setMensaje('');
  }

  function cambiarCampo(campo, valor) {
    setFormulario((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }

  function construirPayloadDesdeFormulario() {
    return {
      id: formulario.id,
      record: formulario.record,
      nombre: formulario.nombre,
      apellido: formulario.apellido,
      cedula: formulario.cedula,
      nacionalidad: formulario.nacionalidad,
      sexo: formulario.sexo,
      estado_civil: formulario.estado_civil,
      fecha_nacimiento: formulario.fecha_nacimiento || null,
      correo: formulario.correo,
      menor_edad: !!formulario.menor_edad,
      telefonos: formulario.telefono
        ? [{ telefono: formulario.telefono, tipo: 'Principal' }]
        : [],
      direcciones: formulario.direccion
        ? [
            {
              direccion: formulario.direccion,
              ciudad: formulario.ciudad,
              provincia: formulario.provincia,
              principal: true,
            },
          ]
        : [],
      tutores: formulario.menor_edad
        ? [
            {
              nombre: formulario.tutor_nombre,
              apellido: formulario.tutor_apellido,
              cedula: formulario.tutor_cedula,
              telefono: formulario.tutor_telefono,
              parentesco: formulario.tutor_parentesco,
              es_titular: true,
            },
          ]
        : [],
      seguros: formulario.ars_id
        ? [
            {
              ars_id: formulario.ars_id,
              numero_afiliado: formulario.numero_afiliado,
              plan: formulario.plan,
              activo: true,
            },
          ]
        : [],
    };
  }

  async function cargarPacienteEnFormulario(id) {
    setError('');
    setMensaje('');

    try {
      const p = await obtenerPacientePorId(id);
      const tutor = p.tutores?.find((x) => x.es_titular) || p.tutores?.[0] || null;

      setFormulario({
        id: p.id,
        record: p.record || '',
        nombre: p.nombre || '',
        apellido: p.apellido || '',
        cedula: p.cedula || '',
        nacionalidad: p.nacionalidad || 'Dominicana',
        sexo: p.sexo || '',
        estado_civil: p.estado_civil || '',
        fecha_nacimiento: p.fecha_nacimiento || '',
        correo: p.correo || '',
        menor_edad: !!p.menor_edad,
        telefono: p.telefonos?.[0]?.telefono || '',
        direccion: p.direcciones?.[0]?.direccion || '',
        ciudad: p.direcciones?.[0]?.ciudad || '',
        provincia: p.direcciones?.[0]?.provincia || '',
        ars_id: p.seguros?.[0]?.ars_id || '',
        numero_afiliado: p.seguros?.[0]?.numero_afiliado || '',
        plan: p.seguros?.[0]?.plan || '',
        tutor_nombre: tutor?.nombre || '',
        tutor_apellido: tutor?.apellido || '',
        tutor_cedula: tutor?.cedula || '',
        tutor_telefono: tutor?.telefono || '',
        tutor_parentesco: tutor?.parentesco || 'Padre/Madre',
        documentos: p.documentos || [],
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'No se pudo cargar el paciente.');
    }
  }

  async function guardarPaciente(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const payload = construirPayloadDesdeFormulario();
      let pacienteGuardado = null;

      if (formulario.id) {
        pacienteGuardado = await actualizarPaciente(formulario.id, payload);
        setMensaje('Paciente modificado correctamente.');
      } else {
        pacienteGuardado = await crearPaciente(payload);
        setMensaje('Paciente agregado correctamente.');
      }

      await cargarInicial();

      if (pacienteGuardado?.id) {
        await cargarPacienteEnFormulario(pacienteGuardado.id);
      } else {
        limpiarFormulario();
      }
    } catch (err) {
      setError(err.message || 'No se pudo guardar el paciente.');
    } finally {
      setGuardando(false);
    }
  }

  async function manejarArchivoDocumento(event, tipo) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!formulario.id) {
      setError('Primero debes guardar el paciente y luego subir la cédula o el seguro.');
      return;
    }

    setError('');
    setMensaje('');

    try {
      await subirDocumentoPaciente(formulario.id, file, tipo);
      await cargarPacienteEnFormulario(formulario.id);
      await cargarInicial();

      setMensaje(
        tipo === 'cedula'
          ? 'Cédula guardada correctamente.'
          : 'Seguro guardado correctamente.'
      );
    } catch (err) {
      setError(err.message || 'No se pudo subir el documento.');
    }
  }

  async function eliminarDocumentoPorTipo(tipo) {
    const documento = formulario.documentos?.find((d) => d.tipo === tipo);
    if (!documento) return;

    const confirmar = window.confirm(`¿Seguro que deseas eliminar el documento "${tipo}"?`);
    if (!confirmar) return;

    setError('');
    setMensaje('');

    try {
      await eliminarDocumentoPaciente(documento.id);
      await cargarPacienteEnFormulario(formulario.id);
      await cargarInicial();
      setMensaje('Documento eliminado correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el documento.');
    }
  }

  async function eliminarPacienteActual() {
    if (!formulario.id) return;

    const confirmar = window.confirm(
      `¿Seguro que deseas eliminar a ${formulario.nombre} ${formulario.apellido}?`
    );
    if (!confirmar) return;

    setError('');
    setMensaje('');

    try {
      await eliminarPaciente(formulario.id);
      await cargarInicial();
      limpiarFormulario();
      setMensaje('Paciente eliminado correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el paciente.');
    }
  }

  function badgeTipoPaciente(menor) {
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 800,
      border: '1px solid transparent',
    };

    return menor
      ? {
          ...base,
          background: darkMode ? 'rgba(234,88,12,0.14)' : '#fff7ed',
          color: darkMode ? '#fdba74' : '#c2410c',
          borderColor: darkMode ? 'rgba(234,88,12,0.22)' : '#fed7aa',
        }
      : {
          ...base,
          background: darkMode ? 'rgba(8,145,178,0.14)' : '#ecfeff',
          color: darkMode ? '#67e8f9' : '#0f766e',
          borderColor: darkMode ? 'rgba(8,145,178,0.22)' : '#a5f3fc',
        };
  }

  const docCedula = formulario.documentos?.find((d) => d.tipo === 'cedula') || null;
  const docSeguro = formulario.documentos?.find((d) => d.tipo === 'carnet') || null;

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
    card: {
      ...cardStyle(darkMode),
      padding: 0,
      overflow: 'hidden',
      marginBottom: '20px',
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
    formLayout: {
      display: 'grid',
      gridTemplateColumns: '1.7fr 0.9fr',
      gap: '20px',
      alignItems: 'start',
      minWidth: 0,
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
    inputDisabled: {
      ...inputStyle(darkMode),
      background: darkMode ? '#111827' : '#f1f5f9',
      color: colores.subtitulo,
      cursor: 'not-allowed',
    },
    sideBox: {
      border: `1px solid ${colores.borde}`,
      borderRadius: '20px',
      background: colores.cardSoft,
      padding: '16px',
    },
    sideTitle: {
      margin: '0 0 12px',
      color: colores.texto,
      fontWeight: 800,
      fontSize: '16px',
    },
    previewBox: {
      width: '100%',
      height: '220px',
      borderRadius: '18px',
      border: `1px dashed ${darkMode ? '#334155' : '#b8cbe2'}`,
      background: colores.card,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: '12px',
    },
    previewImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    previewText: {
      textAlign: 'center',
      color: colores.subtitulo,
      fontSize: '13px',
      padding: '12px',
      lineHeight: 1.5,
    },
    actionCol: {
      display: 'grid',
      gap: '10px',
      marginBottom: '14px',
    },
    saveWrap: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '20px',
      flexWrap: 'wrap',
    },
    searchWrap: {
      display: 'flex',
      gap: '10px',
      marginBottom: '16px',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    tableWrap: {
      overflowX: 'auto',
      borderRadius: '18px',
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
    },
    table: {
      width: '100%',
      minWidth: '1180px',
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
    },
    patientName: {
      fontWeight: 800,
      color: colores.texto,
    },
    patientSub: {
      marginTop: '4px',
      color: colores.subtitulo,
      fontSize: '12px',
      lineHeight: 1.4,
    },
    thumb: {
      width: '54px',
      height: '54px',
      borderRadius: '12px',
      objectFit: 'cover',
      border: `1px solid ${colores.borde}`,
      background: colores.card,
    },
    emptyThumb: {
      width: '54px',
      height: '54px',
      borderRadius: '12px',
      border: `1px dashed ${darkMode ? '#334155' : '#cbd5e1'}`,
      background: darkMode ? '#111827' : '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: colores.subtitulo,
      fontSize: '11px',
      textAlign: 'center',
      padding: '6px',
      boxSizing: 'border-box',
    },
    rowActions: {
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
    dangerBtn: {
      height: '38px',
      padding: '0 12px',
      borderRadius: '12px',
      border: darkMode ? '1px solid rgba(220,38,38,0.25)' : '1px solid #fecaca',
      background: darkMode ? 'rgba(220,38,38,0.12)' : '#fef2f2',
      color: darkMode ? '#fca5a5' : '#dc2626',
      cursor: 'pointer',
      fontWeight: 800,
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
    infoText: {
      color: colores.subtitulo,
      fontSize: '12px',
      lineHeight: 1.5,
      marginTop: '6px',
    },
  };

  return (
    <div style={pageWrapperStyle(darkMode)}>
      <div style={styles.topBar}>
        <div style={styles.titleBlock}>
          <div style={styles.titleGlow} />
          <div style={styles.titleInner}>
            <div style={styles.titleChip}>🧑‍⚕️ Gestión de pacientes</div>
            <h1 style={styles.title}>Pacientes</h1>
            <p style={styles.subtitle}>
              Registro arriba, documentos a la derecha y listado debajo con el mismo estilo visual del sistema.
            </p>
          </div>
        </div>

        <div style={styles.actionWrap}>
          <button style={styles.primaryBtn} onClick={limpiarFormulario}>
            + Nuevo Paciente
          </button>
        </div>
      </div>

      <div style={styles.cardsRow}>
        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>👥</div>
          <div style={styles.metricIcon}>👥</div>
          <div style={styles.metricLabel}>Total pacientes</div>
          <div style={styles.metricValue}>{pacientes.length}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>🧒</div>
          <div style={styles.metricIcon}>🧒</div>
          <div style={styles.metricLabel}>Pacientes menores</div>
          <div style={{ ...styles.metricValue, color: '#c2410c' }}>{totalMenores}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>🛡️</div>
          <div style={styles.metricIcon}>🛡️</div>
          <div style={styles.metricLabel}>Con seguro</div>
          <div style={{ ...styles.metricValue, color: colores.primario }}>{totalConSeguro}</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardBody}>
          <h3 style={styles.sectionTitle}>
            {formulario.id ? 'Editar paciente' : 'Registro de paciente'}
          </h3>

          <form onSubmit={guardarPaciente}>
            <div style={styles.formLayout}>
              <div>
                <div style={styles.formGrid}>
                  <div>
                    <label style={labelStyle(darkMode)}>Récord</label>
                    <input
                      style={styles.inputDisabled}
                      value={formulario.record || 'Se genera automáticamente'}
                      disabled
                    />
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>¿Es menor de edad?</label>
                    <select
                      style={selectStyle(darkMode)}
                      value={formulario.menor_edad ? 'si' : 'no'}
                      onChange={(e) => cambiarCampo('menor_edad', e.target.value === 'si')}
                    >
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>
                      {formulario.menor_edad ? 'Cédula del menor (opcional)' : 'Cédula'}
                    </label>
                    <input
                      style={inputStyle(darkMode)}
                      value={formulario.cedula}
                      onChange={(e) => cambiarCampo('cedula', e.target.value)}
                      placeholder={formulario.menor_edad ? 'Opcional para menor' : '00112345678'}
                    />
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Nacionalidad</label>
                    <input
                      style={inputStyle(darkMode)}
                      value={formulario.nacionalidad}
                      onChange={(e) => cambiarCampo('nacionalidad', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Nombre</label>
                    <input
                      style={inputStyle(darkMode)}
                      value={formulario.nombre}
                      onChange={(e) => cambiarCampo('nombre', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Apellido</label>
                    <input
                      style={inputStyle(darkMode)}
                      value={formulario.apellido}
                      onChange={(e) => cambiarCampo('apellido', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Fecha de nacimiento</label>
                    <input
                      type="date"
                      style={inputStyle(darkMode)}
                      value={formulario.fecha_nacimiento}
                      onChange={(e) => cambiarCampo('fecha_nacimiento', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Sexo</label>
                    <select
                      style={selectStyle(darkMode)}
                      value={formulario.sexo}
                      onChange={(e) => cambiarCampo('sexo', e.target.value)}
                    >
                      <option value="">Seleccione</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Estado civil</label>
                    <select
                      style={selectStyle(darkMode)}
                      value={formulario.estado_civil}
                      onChange={(e) => cambiarCampo('estado_civil', e.target.value)}
                    >
                      <option value="">Seleccione</option>
                      <option value="Soltero/a">Soltero/a</option>
                      <option value="Casado/a">Casado/a</option>
                      <option value="Unión libre">Unión libre</option>
                      <option value="Divorciado/a">Divorciado/a</option>
                      <option value="Viudo/a">Viudo/a</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Teléfono</label>
                    <input
                      style={inputStyle(darkMode)}
                      value={formulario.telefono}
                      onChange={(e) => cambiarCampo('telefono', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Correo</label>
                    <input
                      type="email"
                      style={inputStyle(darkMode)}
                      value={formulario.correo}
                      onChange={(e) => cambiarCampo('correo', e.target.value)}
                    />
                  </div>

                  <div style={styles.full}>
                    <label style={labelStyle(darkMode)}>Dirección</label>
                    <input
                      style={inputStyle(darkMode)}
                      value={formulario.direccion}
                      onChange={(e) => cambiarCampo('direccion', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Ciudad</label>
                    <input
                      style={inputStyle(darkMode)}
                      value={formulario.ciudad}
                      onChange={(e) => cambiarCampo('ciudad', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>Provincia</label>
                    <input
                      style={inputStyle(darkMode)}
                      value={formulario.provincia}
                      onChange={(e) => cambiarCampo('provincia', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>ARS (opcional)</label>
                    <select
                      style={selectStyle(darkMode)}
                      value={formulario.ars_id}
                      onChange={(e) => cambiarCampo('ars_id', e.target.value)}
                    >
                      <option value="">Sin seguro</option>
                      {arsList.map((ars) => (
                        <option key={ars.id} value={ars.id}>
                          {ars.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle(darkMode)}>No. afiliado</label>
                    <input
                      style={inputStyle(darkMode)}
                      value={formulario.numero_afiliado}
                      onChange={(e) => cambiarCampo('numero_afiliado', e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>

                  <div style={styles.full}>
                    <label style={labelStyle(darkMode)}>Plan</label>
                    <input
                      style={inputStyle(darkMode)}
                      value={formulario.plan}
                      onChange={(e) => cambiarCampo('plan', e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                {formulario.menor_edad ? (
                  <div style={{ marginTop: '18px' }}>
                    <h4 style={styles.sideTitle}>Padre / Madre / Tutor titular</h4>

                    <div style={styles.formGrid}>
                      <div>
                        <label style={labelStyle(darkMode)}>Nombre del titular</label>
                        <input
                          style={inputStyle(darkMode)}
                          value={formulario.tutor_nombre}
                          onChange={(e) => cambiarCampo('tutor_nombre', e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={labelStyle(darkMode)}>Apellido del titular</label>
                        <input
                          style={inputStyle(darkMode)}
                          value={formulario.tutor_apellido}
                          onChange={(e) => cambiarCampo('tutor_apellido', e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={labelStyle(darkMode)}>Cédula del titular</label>
                        <input
                          style={inputStyle(darkMode)}
                          value={formulario.tutor_cedula}
                          onChange={(e) => cambiarCampo('tutor_cedula', e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={labelStyle(darkMode)}>Teléfono del titular</label>
                        <input
                          style={inputStyle(darkMode)}
                          value={formulario.tutor_telefono}
                          onChange={(e) => cambiarCampo('tutor_telefono', e.target.value)}
                        />
                      </div>

                      <div style={styles.full}>
                        <label style={labelStyle(darkMode)}>Parentesco</label>
                        <input
                          style={inputStyle(darkMode)}
                          value={formulario.tutor_parentesco}
                          onChange={(e) => cambiarCampo('tutor_parentesco', e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={styles.infoText}>
                      En menores, el sistema guardará el titular en la tabla de tutores.
                    </div>
                  </div>
                ) : null}

                {error ? <div style={styles.dangerText}>{error}</div> : null}
                {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}

                <div style={styles.saveWrap}>
                  <button type="button" style={styles.softBtn} onClick={limpiarFormulario}>
                    Limpiar
                  </button>

                  {formulario.id ? (
                    <button type="button" style={styles.dangerBtn} onClick={eliminarPacienteActual}>
                      Eliminar paciente
                    </button>
                  ) : null}

                  <button type="submit" style={styles.primaryBtn} disabled={guardando}>
                    {guardando
                      ? 'Guardando...'
                      : formulario.id
                      ? 'Modificar paciente'
                      : 'Agregar paciente'}
                  </button>
                </div>
              </div>

              <div style={styles.sideBox}>
                <h4 style={styles.sideTitle}>Cédula del paciente</h4>

                <div style={styles.previewBox}>
                  {docCedula?.url ? (
                    esImagen(docCedula.url) ? (
                      <img src={docCedula.url} alt="Cédula" style={styles.previewImage} />
                    ) : (
                      <div style={styles.previewText}>Documento cargado</div>
                    )
                  ) : (
                    <div style={styles.previewText}>
                      Aquí aparecerá la imagen
                      <br />
                      de la cédula
                    </div>
                  )}
                </div>

                <div style={styles.actionCol}>
                  <label style={styles.softBtn}>
                    {docCedula?.url ? 'Modificar cédula' : 'Agregar cédula'}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => manejarArchivoDocumento(e, 'cedula')}
                    />
                  </label>

                  {docCedula?.url ? (
                    <button type="button" style={styles.dangerBtn} onClick={() => eliminarDocumentoPorTipo('cedula')}>
                      Eliminar cédula
                    </button>
                  ) : null}

                  {docCedula?.url ? (
                    <button
                      type="button"
                      style={styles.primaryBtn}
                      onClick={() => window.open(docCedula.url, '_blank')}
                    >
                      Ver cédula
                    </button>
                  ) : null}
                </div>

                <h4 style={{ ...styles.sideTitle, marginTop: '18px' }}>Seguro (opcional)</h4>

                <div style={styles.previewBox}>
                  {docSeguro?.url ? (
                    esImagen(docSeguro.url) ? (
                      <img src={docSeguro.url} alt="Seguro" style={styles.previewImage} />
                    ) : (
                      <div style={styles.previewText}>Documento cargado</div>
                    )
                  ) : (
                    <div style={styles.previewText}>
                      Aquí aparecerá la imagen
                      <br />
                      del carnet del seguro
                    </div>
                  )}
                </div>

                <div style={styles.actionCol}>
                  <label style={styles.softBtn}>
                    {docSeguro?.url ? 'Modificar seguro' : 'Agregar seguro'}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => manejarArchivoDocumento(e, 'carnet')}
                    />
                  </label>

                  {docSeguro?.url ? (
                    <button type="button" style={styles.dangerBtn} onClick={() => eliminarDocumentoPorTipo('carnet')}>
                      Eliminar seguro
                    </button>
                  ) : null}

                  {docSeguro?.url ? (
                    <button
                      type="button"
                      style={styles.primaryBtn}
                      onClick={() => window.open(docSeguro.url, '_blank')}
                    >
                      Ver seguro
                    </button>
                  ) : null}
                </div>

                <div style={styles.infoText}>
                  El escáner debe guardar JPG, PNG o PDF en la computadora. Luego lo eliges aquí y el sistema lo sube a Supabase Storage.
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardBody}>
          <h3 style={styles.sectionTitle}>Listado de pacientes</h3>

          <div style={styles.searchWrap}>
            <input
              style={{ ...inputStyle(darkMode), maxWidth: '420px' }}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ejecutarBusqueda()}
              placeholder="Buscar por récord, cédula, nombre o apellido"
            />
            <button type="button" style={styles.primaryBtn} onClick={ejecutarBusqueda}>
              Buscar
            </button>
            <button
              type="button"
              style={styles.softBtn}
              onClick={() => {
                setBusqueda('');
                cargarInicial();
              }}
            >
              Recargar
            </button>
          </div>

          {cargando ? <div style={styles.okText}>Cargando pacientes...</div> : null}

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Foto cédula</th>
                  <th style={styles.th}>Paciente</th>
                  <th style={styles.th}>Récord</th>
                  <th style={styles.th}>Cédula</th>
                  <th style={styles.th}>Teléfono</th>
                  <th style={styles.th}>Seguro</th>
                  <th style={styles.th}>Titular menor</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {!cargando && pacientes.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan="9">
                      No hay pacientes para mostrar.
                    </td>
                  </tr>
                ) : (
                  pacientes.map((p) => (
                    <tr key={p.id}>
                      <td style={styles.td}>
                        {p.documento_cedula_url ? (
                          esImagen(p.documento_cedula_url) ? (
                            <img src={p.documento_cedula_url} alt="Cédula" style={styles.thumb} />
                          ) : (
                            <div style={styles.emptyThumb}>PDF</div>
                          )
                        ) : (
                          <div style={styles.emptyThumb}>Sin imagen</div>
                        )}
                      </td>

                      <td style={styles.td}>
                        <div style={styles.patientName}>
                          {p.nombre} {p.apellido}
                        </div>
                        <div style={styles.patientSub}>
                          {p.correo || 'Sin correo'}
                        </div>
                      </td>

                      <td style={styles.td}>{p.record || '-'}</td>
                      <td style={styles.td}>{p.cedula || '-'}</td>
                      <td style={styles.td}>{p.telefono_principal || '-'}</td>
                      <td style={styles.td}>{p.seguro_nombre || '-'}</td>
                      <td style={styles.td}>
                        {p.menor_edad
                          ? `${p.tutor_titular?.nombre || ''} ${p.tutor_titular?.apellido || ''}`.trim() || '-'
                          : '-'}
                      </td>

                      <td style={styles.td}>
                        <span style={badgeTipoPaciente(p.menor_edad)}>
                          {p.menor_edad ? 'Menor' : 'Adulto'}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.rowActions}>
                          <button
                            type="button"
                            style={styles.softBtn}
                            onClick={() => cargarPacienteEnFormulario(p.id)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            style={styles.dangerBtn}
                            onClick={async () => {
                              const confirmar = window.confirm(
                                `¿Seguro que deseas eliminar a ${p.nombre} ${p.apellido}?`
                              );
                              if (!confirmar) return;

                              try {
                                await eliminarPaciente(p.id);
                                if (formulario.id === p.id) limpiarFormulario();
                                await cargarInicial();
                                setMensaje('Paciente eliminado correctamente.');
                              } catch (err) {
                                setError(err.message || 'No se pudo eliminar el paciente.');
                              }
                            }}
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
    </div>
  );
}

export default ListaPacientes;