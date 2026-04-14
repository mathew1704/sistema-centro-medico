import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RutaProtegida from './RutaProtegida';
import MainLayout from '../layout/MainLayout';

import Dashboard from '../pages/Dashboard/Dashboard';
import ListaPacientes from '../pages/Pacientes/ListaPacientes';
import Citas from '../pages/Citas/Citas';
import Medicos from '../pages/Medicos/Medicos';
import Emergencia from '../pages/Emergencias/Emergencia';
import Internamiento from '../pages/Internamiento/Internamiento';
import EnfermeriaInternamiento from '../pages/Internamiento/ENFERMERIAInternamiento';
import Laboratorio from '../pages/Laboratorio/Laboratorio';
import Inventario from '../pages/Inventario/Inventario';
import Farmacia from '../pages/Farmacia/Farmacia';
import Facturacion from '../pages/Facturacion/Facturacion';
import Usuarios from '../pages/Configuracion/Usuarios';
import Login from '../pages/Auth/Login';

const PantallaCarga = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: '#f4f8fc',
      fontFamily: 'Segoe UI, sans-serif',
      color: '#123a72',
      fontWeight: 700,
      fontSize: '18px',
    }}
  >
    Cargando sistema...
  </div>
);

const RedireccionInicio = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PantallaCarga />;

  return isAuthenticated ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/login" replace />
  );
};

const RutaLogin = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PantallaCarga />;

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />;
};

const EnrutadorApp = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RedireccionInicio />} />
        <Route path="/login" element={<RutaLogin />} />

        <Route
          path="/dashboard"
          element={
            <RutaProtegida ruta="/dashboard">
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </RutaProtegida>
          }
        />

        <Route
          path="/pacientes"
          element={
            <RutaProtegida ruta="/pacientes">
              <MainLayout>
                <ListaPacientes />
              </MainLayout>
            </RutaProtegida>
          }
        />

        <Route
          path="/citas"
          element={
            <RutaProtegida ruta="/citas">
              <MainLayout>
                <Citas />
              </MainLayout>
            </RutaProtegida>
          }
        />

        <Route
          path="/medicos"
          element={
            <RutaProtegida ruta="/medicos">
              <MainLayout>
                <Medicos />
              </MainLayout>
            </RutaProtegida>
          }
        />

        <Route
          path="/emergencias"
          element={
            <RutaProtegida ruta="/emergencias">
              <MainLayout>
                <Emergencia />
              </MainLayout>
            </RutaProtegida>
          }
        />

        <Route
          path="/internamiento"
          element={
            <RutaProtegida ruta="/internamiento">
              <MainLayout>
                <Internamiento />
              </MainLayout>
            </RutaProtegida>
          }
        />

        <Route
          path="/enfermeria"
          element={
            <RutaProtegida ruta="/enfermeria">
              <MainLayout>
                <EnfermeriaInternamiento />
              </MainLayout>
            </RutaProtegida>
          }
        />

        <Route
          path="/laboratorio"
          element={
            <RutaProtegida ruta="/laboratorio">
              <MainLayout>
                <Laboratorio />
              </MainLayout>
            </RutaProtegida>
          }
        />

        <Route
          path="/inventario"
          element={
            <RutaProtegida ruta="/inventario">
              <MainLayout>
                <Inventario />
              </MainLayout>
            </RutaProtegida>
          }
        />

        <Route
          path="/farmacia"
          element={
            <RutaProtegida ruta="/farmacia">
              <MainLayout>
                <Farmacia />
              </MainLayout>
            </RutaProtegida>
          }
        />

        <Route
          path="/facturacion"
          element={
            <RutaProtegida ruta="/facturacion">
              <MainLayout>
                <Facturacion />
              </MainLayout>
            </RutaProtegida>
          }
        />

        <Route
          path="/usuarios"
          element={
            <RutaProtegida ruta="/usuarios">
              <MainLayout>
                <Usuarios />
              </MainLayout>
            </RutaProtegida>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default EnrutadorApp;