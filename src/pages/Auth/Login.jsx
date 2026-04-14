import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { normalizarRol } from '../Configuracion/permisos';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, usuario } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [recordarme, setRecordarme] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  function obtenerRutaPorRol(rol) {
    const rolNormalizado = normalizarRol(rol);

    if (rolNormalizado === 'enfermera' || rolNormalizado === 'enfermeria') {
      return '/enfermeria';
    }

    return '/dashboard';
  }

  useEffect(() => {
    if (isAuthenticated && usuario) {
      navigate(obtenerRutaPorRol(usuario.rol || usuario.rol_nombre), { replace: true });
    }
  }, [isAuthenticated, usuario, navigate]);

  const limpiarMensajes = () => {
    setError('');
    setMensaje('');
  };

  const registrarSesion = async (usuarioData) => {
    try {
      await supabase.from('sesiones').insert([
        {
          usuario_id: usuarioData.id,
          ip: null,
          dispositivo: navigator.userAgent || 'Desconocido',
          estado: 'activa',
          observacion: 'Inicio de sesión desde login web',
        },
      ]);
    } catch (err) {
      console.error('No se pudo registrar la sesión:', err);
    }
  };

  const actualizarUltimoLogin = async (usuarioId) => {
    try {
      await supabase
        .from('usuarios')
        .update({
          ultimo_login: new Date().toISOString(),
        })
        .eq('id', usuarioId);
    } catch (err) {
      console.error('No se pudo actualizar ultimo_login:', err);
    }
  };

  const registrarAuditoria = async (usuarioId, detalle = {}) => {
    try {
      await supabase.from('auditoria_detallada').insert([
        {
          usuario_id: usuarioId,
          modulo: 'auth',
          accion: 'LOGIN',
          detalle,
        },
      ]);
    } catch (err) {
      console.error('No se pudo registrar auditoría:', err);
    }
  };

  const obtenerNombreRol = async (rolId) => {
    try {
      if (!rolId) return 'usuario';

      const { data, error } = await supabase
        .from('roles')
        .select('nombre')
        .eq('id', rolId)
        .maybeSingle();

      if (error) {
        console.error('Error consultando rol:', error);
        return 'usuario';
      }

      return data?.nombre || 'usuario';
    } catch (err) {
      console.error('No se pudo obtener el rol:', err);
      return 'usuario';
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    limpiarMensajes();

    const userOrEmail = username.trim();
    const pass = password.trim();

    if (!userOrEmail || !pass) {
      setError('Debes completar usuario y contraseña.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: userError } = await supabase
        .from('usuarios')
        .select(`
          id,
          username,
          password_hash,
          nombre,
          apellido,
          email,
          rol_id,
          activo
        `)
        .or(`username.eq.${userOrEmail},email.eq.${userOrEmail}`)
        .maybeSingle();

      if (userError) {
        console.error('Error consultando usuario:', userError);
        setError('Ocurrió un error al intentar iniciar sesión.');
        return;
      }

      if (!data) {
        setError('Usuario no encontrado.');
        return;
      }

      if (!data.activo) {
        setError('Este usuario está inactivo. Contacta al administrador.');
        return;
      }

      if ((data.password_hash || '') !== pass) {
        setError('Contraseña incorrecta.');
        return;
      }

      const rolNombre = await obtenerNombreRol(data.rol_id);
      const rolNormalizado = normalizarRol(rolNombre);

      const usuarioSesion = {
        id: data.id,
        username: data.username || '',
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        email: data.email || '',
        rol_id: data.rol_id || null,
        rol_nombre: rolNombre,
        rol: rolNormalizado,
        recordarme,
      };

      login(usuarioSesion);

      await Promise.all([
        actualizarUltimoLogin(data.id),
        registrarSesion(data),
        registrarAuditoria(data.id, {
          username: data.username,
          email: data.email,
          rol: rolNombre,
        }),
      ]);

      setMensaje('Inicio de sesión correcto.');

      setTimeout(() => {
        navigate(obtenerRutaPorRol(rolNormalizado), { replace: true });
      }, 250);
    } catch (err) {
      console.error('Error inesperado en login:', err);
      setError('No se pudo iniciar sesión. Revisa la configuración.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left">
          <div className="login-left-overlay" />

          <div className="login-left-content">
            <div className="login-brand-large">
              <div className="login-brand-icon">✚</div>
              <div>
                <h1>Centro Médico</h1>
                <p>Dr. Morel</p>
              </div>
            </div>

            <div className="login-left-card">
              <h2>Sistema Clínico Integral</h2>
              <p>
                Gestiona pacientes, citas, emergencias, internamientos,
                facturación, farmacia, inventario y laboratorio en un solo lugar.
              </p>
            </div>

            <div className="login-left-footer">
              © 2026 Centro Médico Dr. Morel
            </div>
          </div>
        </div>

        <div className="login-right">
          <div className="login-box">
            <div className="login-header">
              <div className="login-brand-center">
                <div className="login-brand-icon small">✚</div>
                <div>
                  <div className="brand-title">Centro Médico</div>
                  <div className="brand-subtitle">Dr. Morel</div>
                </div>
              </div>

              <h2>Iniciar Sesión</h2>
              <p>Ingresa tus credenciales para acceder al sistema</p>
            </div>

            <form className="login-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label>Usuario o correo</label>
                <div className="input-icon-wrap">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    placeholder="Ingresa tu usuario o correo"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Contraseña</label>
                <div className="input-icon-wrap">
                  <span className="input-icon">🔒</span>
                  <input
                    type={mostrarPassword ? 'text' : 'password'}
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    disabled={loading}
                  >
                    {mostrarPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              <div className="login-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={recordarme}
                    onChange={(e) => setRecordarme(e.target.checked)}
                    disabled={loading}
                  />
                  <span>Recordarme</span>
                </label>

                <button
                  type="button"
                  className="forgot-link"
                  disabled={loading}
                  onClick={() =>
                    setError('La recuperación de contraseña todavía no está implementada.')
                  }
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>

              {error && <div className="login-alert error">{error}</div>}
              {mensaje && <div className="login-alert success">{mensaje}</div>}

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>
            </form>

            <div className="login-divider">
              <span>Acceso seguro al sistema médico</span>
            </div>

            <div className="login-mini-info">
              <div className="info-chip">Pacientes</div>
              <div className="info-chip">Citas</div>
              <div className="info-chip">Emergencias</div>
              <div className="info-chip">Inventario</div>
            </div>
          </div>

          <div className="login-bottom-links">
            <button type="button">Términos y Condiciones</button>
            <button type="button">Política de Privacidad</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;