import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { obtenerMenuPorRol, obtenerRolUsuario } from '../pages/Configuracion/permisos';
import { getUiColors } from '../styles/uiTheme';

const menu = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/citas', label: 'Citas', icon: '📅' },
  { to: '/medicos', label: 'Médicos', icon: '🩺' },
  { to: '/pacientes', label: 'Pacientes', icon: '🧑‍⚕️' },
  { to: '/emergencias', label: 'Emergencias', icon: '🚑' },
  { to: '/internamiento', label: 'Internamiento', icon: '🛏️' },
  { to: '/enfermeria', label: 'Enfermería', icon: '👩‍⚕️' },
  { to: '/inventario', label: 'Inventario', icon: '📦' },
  { to: '/farmacia', label: 'Farmacia', icon: '💊' },
  { to: '/facturacion', label: 'Facturación', icon: '🧾' },
  { to: '/laboratorio', label: 'Laboratorio', icon: '🧪' },
  { to: '/usuarios', label: 'Usuarios', icon: '🔐' },
];

const Sidebar = ({ darkMode = false, isOpen = true }) => {
  const { usuario } = useAuth();

  const rol = obtenerRolUsuario(usuario);
  const menuFiltrado = obtenerMenuPorRol(usuario, menu);
  const colores = getUiColors(darkMode);

  return (
    <aside
      style={{
        width: '290px', // Mantenemos el ancho fijo interno para que no se comprima el diseño al cerrar
        background: colores.gradienteSidebar,
        color: '#ffffff',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isOpen ? '12px 0 30px rgba(0,0,0,0.10)' : 'none',
        position: 'sticky',
        top: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(circle at 20% 15%, rgba(255,255,255,0.10) 0%, transparent 22%),
            radial-gradient(circle at 85% 10%, rgba(255,255,255,0.06) 0%, transparent 18%),
            radial-gradient(circle at 50% 80%, rgba(14,165,233,0.10) 0%, transparent 22%)
          `,
        }}
      />

      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid rgba(255,255,255,0.10)`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.12)',
              display: 'grid',
              placeItems: 'center',
              fontSize: '20px',
              border: '1px solid rgba(255,255,255,0.12)',
              flexShrink: 0,
            }}
          >
            🏥
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: '17px' }}>Centro Médico</div>
            <div style={{ fontSize: '12px', opacity: 0.82 }}>Sistema clínico integral</div>
          </div>
        </div>

        <div
          style={{
            marginTop: '16px',
            borderRadius: '18px',
            padding: '14px',
            background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '96px',
              borderRadius: '14px',
              background: `
                linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04)),
                radial-gradient(circle at 25% 30%, rgba(255,255,255,0.14) 0%, transparent 24%),
                radial-gradient(circle at 80% 25%, rgba(14,165,233,0.16) 0%, transparent 22%)
              `,
              marginBottom: '12px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              padding: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', opacity: 0.85 }}>Panel administrativo</div>
              <div style={{ fontSize: '18px', fontWeight: 900, marginTop: '4px' }}>
                CentroMed
              </div>
            </div>

            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '14px',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.10)',
                fontSize: '18px',
                flexShrink: 0,
              }}
            >
              ✚
            </div>
          </div>

          <div style={{ fontSize: '12px', opacity: 0.82 }}>Rol actual</div>
          <div
            style={{
              fontWeight: 800,
              fontSize: '13px',
              marginTop: '4px',
              textTransform: 'capitalize',
            }}
          >
            {rol || 'sin rol'}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '14px 16px 8px',
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          opacity: 0.8,
          position: 'relative',
          zIndex: 1,
        }}
      >
        Menú principal
      </div>

      <nav
        style={{
          padding: '0 12px 16px',
          display: 'grid',
          gap: '8px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {menuFiltrado.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              textDecoration: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '13px 14px',
              borderRadius: '16px',
              background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
              fontWeight: isActive ? 800 : 600,
              transition: 'all .2s ease',
              border: isActive
                ? '1px solid rgba(255,255,255,0.12)'
                : '1px solid transparent',
              boxShadow: isActive ? '0 10px 20px rgba(0,0,0,0.10)' : 'none',
            })}
            onMouseEnter={(e) => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.background = darkMode
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(255,255,255,0.10)';
                e.currentTarget.style.transform = 'translateX(2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.transform = 'translateX(0)';
              }
            }}
          >
            <span
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '12px',
                background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '16px',
                border: '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0,
              }}
            >
              {item.icon}
            </span>

            <span>{item.label}</span>
          </NavLink>
        ))}

        {menuFiltrado.length === 0 && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.08)',
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            Este usuario no tiene módulos asignados.
          </div>
        )}
      </nav>

      <div
        style={{
          marginTop: 'auto',
          padding: '16px',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            borderRadius: '16px',
            background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '12px 14px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ fontSize: '12px', opacity: 0.85 }}>Estado del sistema</div>
          <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 800 }}>
            Operativo
          </div>
        </div>

        <div
          style={{
            marginTop: '12px',
            fontSize: '12px',
            opacity: 0.8,
            textAlign: 'center',
          }}
        >
          © 2026 Centro Médico
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;