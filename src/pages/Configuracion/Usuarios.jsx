import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  actualizarUsuario,
  cambiarEstadoUsuario,
  crearUsuario,
  eliminarUsuario,
  listarMedicosSinUsuario,
  listarRoles,
  listarUsuarios,
  obtenerMedicoVinculadoUsuario,
  obtenerUsuarioPorId,
} from '../../services/usuarioService';
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
  username: '',
  password: '',
  nombre: '',
  apellido: '',
  email: '',
  rol_id: '',
  activo: true,
  medico_id: '',
};

function etiquetaMedico(m) {
  return `${m.codigo || ''} - ${m.nombre || ''} ${m.apellido || ''}`.trim();
}

const Usuarios = ({ darkMode = false }) => {
  const { usuario: usuarioSesion } = useAuth();
  const colores = getUiColors(darkMode);

  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [formulario, setFormulario] = useState(modelo);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const totalActivos = useMemo(
    () => usuarios.filter((u) => u.activo).length,
    [usuarios]
  );

  const totalInactivos = useMemo(
    () => usuarios.filter((u) => !u.activo).length,
    [usuarios]
  );

  useEffect(() => {
    cargarInicial();
  }, []);

  async function cargarInicial() {
    setCargando(true);
    setError('');

    try {
      const [listaUsuarios, listaRoles, listaMedicos] = await Promise.all([
        listarUsuarios(),
        listarRoles(),
        listarMedicosSinUsuario(),
      ]);

      setUsuarios(listaUsuarios || []);
      setRoles(listaRoles || []);
      setMedicos(listaMedicos || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el módulo de usuarios.');
    } finally {
      setCargando(false);
    }
  }

  async function buscarUsuarios() {
    setCargando(true);
    setError('');

    try {
      const lista = await listarUsuarios(filtro);
      setUsuarios(lista || []);
    } catch (err) {
      setError(err.message || 'No se pudieron buscar los usuarios.');
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

  async function editarUsuario(id) {
    setError('');
    setMensaje('');

    try {
      const usuario = await obtenerUsuarioPorId(id);
      const medicoVinculado = await obtenerMedicoVinculadoUsuario(id);

      setFormulario({
        id: usuario.id,
        username: usuario.username || '',
        password: '',
        nombre: usuario.nombre || '',
        apellido: usuario.apellido || '',
        email: usuario.email || '',
        rol_id: usuario.rol_id || '',
        activo: usuario.activo ?? true,
        medico_id: medicoVinculado?.id || '',
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'No se pudo cargar el usuario.');
    }
  }

  async function guardarUsuario(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      if (!formulario.username.trim()) {
        throw new Error('Debe indicar el username.');
      }

      if (!formulario.id && !formulario.password.trim()) {
        throw new Error('Debe indicar la contraseña.');
      }

      if (!formulario.rol_id) {
        throw new Error('Debe seleccionar un rol.');
      }

      if (formulario.id) {
        await actualizarUsuario(formulario.id, formulario);
        setMensaje('Usuario actualizado correctamente.');
      } else {
        await crearUsuario(formulario);
        setMensaje('Usuario registrado correctamente.');
      }

      await cargarInicial();
      limpiarFormulario();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el usuario.');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(id, activoActual) {
    setError('');
    setMensaje('');

    try {
      if (usuarioSesion?.id === id && activoActual) {
        throw new Error('No puedes desactivar tu propio usuario mientras estás logueado.');
      }

      await cambiarEstadoUsuario(id, !activoActual);
      await cargarInicial();
      setMensaje(!activoActual ? 'Usuario activado.' : 'Usuario desactivado.');
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado.');
    }
  }

  async function borrarUsuario(id, username) {
    const ok = window.confirm(
      `¿Seguro que deseas eliminar este usuario?\n\n${username ? `Usuario: ${username}` : ''}\n\nEsta acción lo ocultará del sistema, cerrará su acceso y conservará el historial.`
    );
    if (!ok) return;

    setError('');
    setMensaje('');

    try {
      if (!usuarioSesion?.id) {
        throw new Error('No se pudo identificar el usuario administrador actual.');
      }

      if (usuarioSesion.id === id) {
        throw new Error('No puedes eliminar tu propio usuario mientras estás logueado.');
      }

      await eliminarUsuario(
        id,
        usuarioSesion.id,
        `Usuario eliminado desde el módulo de usuarios por ${usuarioSesion.username || 'admin'}`
      );

      await cargarInicial();
      setMensaje('Usuario eliminado correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el usuario.');
    }
  }

  function claseEstado(activo) {
    return activo
      ? {
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 800,
          background: darkMode ? 'rgba(5,150,105,0.16)' : '#ecfdf5',
          color: darkMode ? '#6ee7b7' : '#047857',
          border: darkMode ? '1px solid rgba(5,150,105,0.24)' : '1px solid #bbf7d0',
        }
      : {
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 800,
          background: darkMode ? 'rgba(220,38,38,0.14)' : '#fef2f2',
          color: darkMode ? '#fca5a5' : '#b91c1c',
          border: darkMode ? '1px solid rgba(220,38,38,0.24)' : '1px solid #fecaca',
        };
  }

  const styles = {
    topBar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '22px',
      flexWrap: 'wrap',
      gap: '18px',
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
    primaryBtn: {
      ...buttonPrimaryStyle,
      height: '46px',
      borderRadius: '14px',
      boxShadow: '0 10px 22px rgba(37,99,235,0.18)',
    },
    cardsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
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
      fontWeight: 700,
    },
    metricValue: {
      marginTop: '8px',
      fontSize: '30px',
      fontWeight: 900,
      color: colores.texto,
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
    saveWrap: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '20px',
      flexWrap: 'wrap',
    },
    softBtn: {
      ...buttonSoftStyle(darkMode),
      height: '40px',
      padding: '0 12px',
      borderRadius: '12px',
      fontSize: '13px',
    },
    dangerBtn: {
      height: '40px',
      padding: '0 12px',
      borderRadius: '12px',
      border: darkMode ? '1px solid rgba(220,38,38,0.25)' : '1px solid #fecaca',
      background: darkMode ? 'rgba(220,38,38,0.12)' : '#fef2f2',
      color: darkMode ? '#fca5a5' : '#dc2626',
      cursor: 'pointer',
      fontWeight: 800,
      fontSize: '13px',
    },
    okText: {
      color: darkMode ? '#6ee7b7' : '#059669',
      fontWeight: 600,
      marginTop: '10px',
      fontSize: '13px',
    },
    dangerText: {
      color: darkMode ? '#fca5a5' : '#dc2626',
      fontWeight: 600,
      marginTop: '10px',
      fontSize: '13px',
    },
    searchWrap: {
      display: 'grid',
      gridTemplateColumns: '1.5fr auto',
      gap: '10px',
      marginBottom: '16px',
    },
    tableWrap: {
      width: '100%',
      overflowX: 'auto',
      borderRadius: '18px',
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      minWidth: '980px',
    },
    th: {
      textAlign: 'left',
      padding: '12px',
      fontSize: '13px',
      color: colores.subtitulo,
      borderBottom: `1px solid ${colores.borde}`,
      background: darkMode ? '#0b1220' : '#f8fbff',
      fontWeight: 800,
      whiteSpace: 'nowrap',
    },
    td: {
      padding: '12px',
      fontSize: '14px',
      borderBottom: `1px solid ${colores.borde}`,
      verticalAlign: 'top',
      color: colores.texto,
    },
  };

  return (
    <div style={pageWrapperStyle(darkMode)}>
      <div style={styles.topBar}>
        <div style={styles.titleBlock}>
          <div style={styles.titleGlow} />
          <div style={styles.titleInner}>
            <div style={styles.titleChip}>🔐 Gestión de usuarios</div>
            <h1 style={styles.title}>Usuarios</h1>
            <p style={styles.subtitle}>
              Creación, roles, activación y vínculo con médicos.
            </p>
          </div>
        </div>

        <button type="button" style={styles.primaryBtn} onClick={limpiarFormulario}>
          + Nuevo Usuario
        </button>
      </div>

      <div style={styles.cardsRow}>
        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>👥</div>
          <div style={styles.metricIcon}>👥</div>
          <div style={styles.metricLabel}>Total usuarios</div>
          <div style={styles.metricValue}>{usuarios.length}</div>
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
          <div style={styles.metricLabel}>Inactivos</div>
          <div style={{ ...styles.metricValue, color: '#b91c1c' }}>{totalInactivos}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>🧩</div>
          <div style={styles.metricIcon}>🧩</div>
          <div style={styles.metricLabel}>Roles disponibles</div>
          <div style={styles.metricValue}>{roles.length}</div>
        </div>
      </div>

      <div style={styles.stack}>
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>
              {formulario.id ? 'Editar usuario' : 'Registro de usuario'}
            </h3>

            <form onSubmit={guardarUsuario}>
              <div style={styles.formGrid}>
                <div>
                  <label style={labelStyle(darkMode)}>Username</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formulario.username}
                    onChange={(e) => cambiarCampo('username', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>
                    {formulario.id ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                  </label>
                  <input
                    type="password"
                    style={inputStyle(darkMode)}
                    value={formulario.password}
                    onChange={(e) => cambiarCampo('password', e.target.value)}
                    placeholder={formulario.id ? 'Déjalo vacío para no cambiarla' : ''}
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Nombre</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formulario.nombre}
                    onChange={(e) => cambiarCampo('nombre', e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Apellido</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formulario.apellido}
                    onChange={(e) => cambiarCampo('apellido', e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Email</label>
                  <input
                    type="email"
                    style={inputStyle(darkMode)}
                    value={formulario.email}
                    onChange={(e) => cambiarCampo('email', e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Rol</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formulario.rol_id}
                    onChange={(e) => cambiarCampo('rol_id', e.target.value)}
                    required
                  >
                    <option value="">Seleccione un rol</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
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

                <div>
                  <label style={labelStyle(darkMode)}>Vincular médico</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formulario.medico_id}
                    onChange={(e) => cambiarCampo('medico_id', e.target.value)}
                  >
                    <option value="">Sin vínculo</option>
                    {medicos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {etiquetaMedico(m)}
                      </option>
                    ))}
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
                    ? 'Actualizar usuario'
                    : 'Registrar usuario'}
                </button>
              </div>

              {error ? <div style={styles.dangerText}>{error}</div> : null}
              {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}
            </form>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>Lista de usuarios</h3>

            <div style={styles.searchWrap}>
              <input
                style={inputStyle(darkMode)}
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar por username, nombre, apellido o email"
              />

              <button type="button" style={styles.primaryBtn} onClick={buscarUsuarios}>
                Buscar
              </button>
            </div>

            {cargando ? <div style={styles.okText}>Cargando usuarios...</div> : null}
            {error ? <div style={styles.dangerText}>{error}</div> : null}
            {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Username</th>
                    <th style={styles.th}>Nombre</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Rol</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Último login</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {!cargando && usuarios.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan="7">
                        No hay usuarios para mostrar.
                      </td>
                    </tr>
                  ) : (
                    usuarios.map((u) => (
                      <tr key={u.id}>
                        <td style={styles.td}>{u.username}</td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 700, color: colores.texto }}>
                            {u.nombre || '-'} {u.apellido || ''}
                          </div>
                        </td>
                        <td style={styles.td}>{u.email || '-'}</td>
                        <td style={styles.td}>{u.roles?.nombre || '-'}</td>
                        <td style={styles.td}>
                          <span style={claseEstado(u.activo)}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString() : '-'}
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => editarUsuario(u.id)}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => cambiarEstado(u.id, u.activo)}
                            >
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </button>

                            <button
                              type="button"
                              style={styles.dangerBtn}
                              onClick={() => borrarUsuario(u.id, u.username)}
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

export default Usuarios;