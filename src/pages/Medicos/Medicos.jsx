import { useEffect, useMemo, useState } from 'react';
import {
  actualizarMedico,
  cambiarEstadoMedico,
  crearMedico,
  eliminarMedico,
  listarEspecialidades,
  listarMedicos,
  listarUsuariosMedicos,
  obtenerMedicoPorId,
} from '../../services/medicoService';
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

const modelo = {
  id: null,
  codigo: '',
  nombre: '',
  apellido: '',
  cedula: '',
  telefono: '',
  correo: '',
  especialidad_id: '',
  usuario_id: '',
  exequatur: '',
  activo: true,
};

function etiquetaUsuario(u) {
  const nombre = `${u.nombre || ''} ${u.apellido || ''}`.trim();
  if (nombre) return `${nombre} - ${u.username}`;
  return u.username || u.email || 'Usuario';
}

const Medicos = ({ darkMode = false }) => {
  const colores = getUiColors(darkMode);

  const [medicos, setMedicos] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [formulario, setFormulario] = useState(modelo);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const totalActivos = useMemo(
    () => medicos.filter((m) => m.activo).length,
    [medicos]
  );

  const totalInactivos = useMemo(
    () => medicos.filter((m) => !m.activo).length,
    [medicos]
  );

  useEffect(() => {
    cargarInicial();
  }, []);

  async function cargarInicial() {
    setCargando(true);
    setError('');

    try {
      const [listaMedicos, listaEspecialidades, listaUsuarios] = await Promise.all([
        listarMedicos(),
        listarEspecialidades(),
        listarUsuariosMedicos(),
      ]);

      setMedicos(listaMedicos);
      setEspecialidades(listaEspecialidades);
      setUsuarios(listaUsuarios);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el módulo de médicos.');
    } finally {
      setCargando(false);
    }
  }

  async function buscarMedicos() {
    setCargando(true);
    setError('');

    try {
      const lista = await listarMedicos(filtro);
      setMedicos(lista);
    } catch (err) {
      setError(err.message || 'No se pudieron buscar los médicos.');
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

  function limpiarFormulario() {
    setFormulario(modelo);
    setError('');
    setMensaje('');
  }

  async function editarMedico(id) {
    setError('');
    setMensaje('');

    try {
      const medico = await obtenerMedicoPorId(id);

      setFormulario({
        id: medico.id,
        codigo: medico.codigo || '',
        nombre: medico.nombre || '',
        apellido: medico.apellido || '',
        cedula: medico.cedula || '',
        telefono: medico.telefono || '',
        correo: medico.correo || '',
        especialidad_id: medico.especialidad_id || '',
        usuario_id: medico.usuario_id || '',
        exequatur: medico.exequatur || '',
        activo: medico.activo ?? true,
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'No se pudo cargar el médico.');
    }
  }

  async function guardarMedico(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      if (formulario.id) {
        await actualizarMedico(formulario.id, formulario);
        setMensaje('Médico actualizado correctamente.');
      } else {
        const creado = await crearMedico(formulario);
        setMensaje(`Médico registrado correctamente. Código generado: ${creado.codigo || 'MED-...'}`);
      }

      await cargarInicial();
      setFormulario(modelo);
    } catch (err) {
      setError(err.message || 'No se pudo guardar el médico.');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(id, activoActual) {
    setError('');
    setMensaje('');

    try {
      await cambiarEstadoMedico(id, !activoActual);
      await cargarInicial();
      setMensaje(!activoActual ? 'Médico activado.' : 'Médico desactivado.');
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado.');
    }
  }

  async function borrarMedico(id) {
    const ok = window.confirm('¿Seguro que deseas eliminar este médico?');
    if (!ok) return;

    setError('');
    setMensaje('');

    try {
      await eliminarMedico(id);
      await cargarInicial();
      setMensaje('Médico eliminado correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el médico.');
    }
  }

  function estiloEstado(activo) {
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 800,
      border: '1px solid transparent',
    };

    return activo
      ? {
          ...base,
          background: darkMode ? 'rgba(5,150,105,0.16)' : '#ecfdf5',
          color: darkMode ? '#6ee7b7' : '#047857',
          borderColor: darkMode ? 'rgba(5,150,105,0.24)' : '#bbf7d0',
        }
      : {
          ...base,
          background: darkMode ? 'rgba(220,38,38,0.14)' : '#fef2f2',
          color: darkMode ? '#fca5a5' : '#b91c1c',
          borderColor: darkMode ? 'rgba(220,38,38,0.22)' : '#fecaca',
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
      padding: 0,
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
    inputDisabled: {
      ...inputStyle(darkMode),
      background: darkMode ? '#111827' : '#f1f5f9',
      color: colores.subtitulo,
      cursor: 'not-allowed',
    },
    helperText: {
      marginTop: '6px',
      fontSize: '12px',
      color: colores.subtitulo,
      lineHeight: 1.5,
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
      gridTemplateColumns: '1.5fr auto',
      gap: '10px',
      marginBottom: '16px',
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
      minWidth: '980px',
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
    tableMain: {
      fontWeight: 800,
      color: colores.texto,
    },
    tableSub: {
      fontSize: '12px',
      color: colores.subtitulo,
      marginTop: '4px',
      lineHeight: 1.4,
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
  };

  return (
    <div style={pageWrapperStyle(darkMode)}>
      <div style={styles.topBar}>
        <div style={styles.titleBlock}>
          <div style={styles.titleGlow} />
          <div style={styles.titleInner}>
            <div style={styles.titleChip}>🩺 Gestión del personal médico</div>
            <h1 style={styles.title}>Médicos</h1>
            <p style={styles.subtitle}>
              Registro, edición, activación y control del personal médico del centro.
            </p>
          </div>
        </div>

        <div style={styles.actionWrap}>
          <button type="button" style={styles.primaryBtn} onClick={limpiarFormulario}>
            + Nuevo Médico
          </button>
        </div>
      </div>

      <div style={styles.cardsRow}>
        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>🧑‍⚕️</div>
          <div style={styles.metricIcon}>🧑‍⚕️</div>
          <div style={styles.metricLabel}>Total médicos</div>
          <div style={styles.metricValue}>{medicos.length}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>✅</div>
          <div style={styles.metricIcon}>✅</div>
          <div style={styles.metricLabel}>Activos</div>
          <div style={{ ...styles.metricValue, color: colores.exito }}>{totalActivos}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>⛔</div>
          <div style={styles.metricIcon}>⛔</div>
          <div style={{ ...styles.metricLabel }}>Inactivos</div>
          <div style={{ ...styles.metricValue, color: '#dc2626' }}>{totalInactivos}</div>
        </div>
      </div>

      <div style={styles.stack}>
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>
              {formulario.id ? 'Editar médico' : 'Registro de médico'}
            </h3>

            <form onSubmit={guardarMedico}>
              <div style={styles.formGrid}>
                <div>
                  <label style={labelStyle(darkMode)}>Código</label>
                  <input
                    style={styles.inputDisabled}
                    value={formulario.id ? formulario.codigo : 'Se genera automáticamente'}
                    disabled
                    readOnly
                  />
                  <div style={styles.helperText}>
                    Este código lo genera el sistema automáticamente en formato MED-001.
                  </div>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Exequátur</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formulario.exequatur}
                    onChange={(e) => cambiarCampo('exequatur', e.target.value)}
                    placeholder="Número de exequátur"
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
                  <label style={labelStyle(darkMode)}>Cédula</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formulario.cedula}
                    onChange={(e) => cambiarCampo('cedula', e.target.value)}
                    placeholder="000-0000000-0"
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Teléfono</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formulario.telefono}
                    onChange={(e) => cambiarCampo('telefono', e.target.value)}
                    placeholder="809-000-0000"
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Correo</label>
                  <input
                    type="email"
                    style={inputStyle(darkMode)}
                    value={formulario.correo}
                    onChange={(e) => cambiarCampo('correo', e.target.value)}
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Especialidad</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formulario.especialidad_id}
                    onChange={(e) => cambiarCampo('especialidad_id', e.target.value)}
                    required
                  >
                    <option value="">Seleccione una especialidad</option>
                    {especialidades.map((esp) => (
                      <option key={esp.id} value={esp.id}>
                        {esp.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Usuario vinculado</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formulario.usuario_id}
                    onChange={(e) => cambiarCampo('usuario_id', e.target.value)}
                  >
                    <option value="">Sin usuario vinculado</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {etiquetaUsuario(u)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Estado</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formulario.activo ? 'true' : 'false'}
                    onChange={(e) => cambiarCampo('activo', e.target.value === 'true')}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
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
                    ? 'Actualizar médico'
                    : 'Registrar médico'}
                </button>
              </div>

              {error ? <div style={styles.dangerText}>{error}</div> : null}
              {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}
            </form>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>Lista de médicos</h3>

            <div style={styles.searchWrap}>
              <input
                style={inputStyle(darkMode)}
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar por código, nombre, apellido, cédula, correo o exequátur"
              />

              <button type="button" style={styles.primaryBtn} onClick={buscarMedicos}>
                Buscar
              </button>
            </div>

            {cargando ? <div style={styles.okText}>Cargando médicos...</div> : null}
            {error ? <div style={styles.dangerText}>{error}</div> : null}
            {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Código</th>
                    <th style={styles.th}>Nombre</th>
                    <th style={styles.th}>Cédula</th>
                    <th style={styles.th}>Contacto</th>
                    <th style={styles.th}>Especialidad</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {!cargando && medicos.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan="7">
                        No hay médicos para mostrar.
                      </td>
                    </tr>
                  ) : (
                    medicos.map((m) => (
                      <tr key={m.id}>
                        <td style={styles.td}>{m.codigo}</td>
                        <td style={styles.td}>
                          <div style={styles.tableMain}>
                            {m.nombre} {m.apellido}
                          </div>
                          <div style={styles.tableSub}>
                            Exequátur: {m.exequatur || '-'}
                          </div>
                        </td>
                        <td style={styles.td}>{m.cedula || '-'}</td>
                        <td style={styles.td}>
                          <div>{m.telefono || '-'}</div>
                          <div style={styles.tableSub}>{m.correo || '-'}</div>
                        </td>
                        <td style={styles.td}>{m.especialidades?.nombre || '-'}</td>
                        <td style={styles.td}>
                          <span style={estiloEstado(m.activo)}>
                            {m.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.actionsWrap}>
                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => editarMedico(m.id)}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => cambiarEstado(m.id, m.activo)}
                            >
                              {m.activo ? 'Desactivar' : 'Activar'}
                            </button>

                            <button
                              type="button"
                              style={styles.dangerBtn}
                              onClick={() => borrarMedico(m.id)}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Medicos;