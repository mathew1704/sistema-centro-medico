import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { tienePermisoRuta, obtenerRolUsuario } from '../pages/Configuracion/permisos';

const RutaProtegida = ({ children, ruta = null }) => {
  const { isAuthenticated, loading, usuario, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'Segoe UI, sans-serif',
          background: '#f4f8fc',
          color: '#123a72',
          fontSize: '18px',
          fontWeight: 600,
        }}
      >
        Cargando sistema...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const rol = obtenerRolUsuario(usuario);

  if (!rol) {
    logout();
    return <Navigate to="/login" replace />;
  }

  if (ruta && !tienePermisoRuta(usuario, ruta)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default RutaProtegida;