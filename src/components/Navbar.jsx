import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUiColors } from '../styles/uiTheme';

const Navbar = ({ darkMode = false, toggleTheme = () => {}, toggleSidebar = () => {} }) => {
  const { usuario, logout } = useAuth();

  const nombreCompleto = useMemo(() => {
    if (!usuario) return 'Usuario';
    const nombre = usuario.nombre || '';
    const apellido = usuario.apellido || '';
    return `${nombre} ${apellido}`.trim() || usuario.username || 'Usuario';
  }, [usuario]);

  const colores = getUiColors(darkMode);
  const primeraLetra = (usuario?.nombre || usuario?.username || 'U').charAt(0).toUpperCase();

  return (
    <header
      style={{
        height: '78px',
        background: colores.gradienteNavbar,
        borderBottom: `1px solid ${colores.bordeSuave}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 22px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: darkMode
          ? '0 8px 20px rgba(0,0,0,0.18)'
          : '0 8px 20px rgba(15,23,42,0.05)',
        gap: '18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: '1 1 auto' }}>
        {/* NUEVO BOTÓN DE MENÚ */}
        <button
          onClick={toggleSidebar}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '14px',
            border: `1px solid ${colores.borde}`,
            background: colores.card,
            color: colores.texto,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            fontSize: '20px',
            flexShrink: 0,
          }}
          title="Alternar Menú"
        >
          ☰
        </button>

        <div
          style={{
            flex: '1 1 auto',
            maxWidth: '430px',
            minWidth: '200px',
            height: '46px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderRadius: '16px',
            border: `1px solid ${colores.borde}`,
            background: colores.cardSoft,
            padding: '0 14px',
            boxShadow: darkMode
              ? 'inset 0 1px 0 rgba(255,255,255,0.02)'
              : 'inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
        >
          <span style={{ color: colores.subtitulo }}>🔎</span>
          <input
            type="text"
            placeholder="Buscar pacientes, citas, facturas..."
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: colores.texto,
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={toggleTheme}
          style={{
            height: '42px',
            padding: '0 16px',
            borderRadius: '14px',
            border: `1px solid ${colores.borde}`,
            background: colores.card,
            color: colores.texto,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {darkMode ? '☀️ Claro' : '🌙 Oscuro'}
        </button>

        <button
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '14px',
            border: `1px solid ${colores.borde}`,
            background: colores.card,
            color: colores.texto,
            cursor: 'pointer',
          }}
        >
          🔔
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 10px',
            borderRadius: '16px',
            border: `1px solid ${colores.borde}`,
            background: colores.card,
            minWidth: '270px',
            maxWidth: '360px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
              color: '#fff',
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            {primeraLetra}
          </div>

          <div
            style={{
              minWidth: 0,
              flex: 1,
            }}
          >
            <div
              style={{
                color: colores.texto,
                fontWeight: 800,
                fontSize: '14px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {nombreCompleto}
            </div>

            <div
              style={{
                color: colores.subtitulo,
                fontSize: '12px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {usuario?.rol_nombre || 'Usuario'}
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              border: 'none',
              background: darkMode ? 'rgba(37,99,235,0.14)' : '#eff6ff',
              color: '#2563eb',
              padding: '10px 12px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;