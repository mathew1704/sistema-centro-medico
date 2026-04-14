import { Children, cloneElement, isValidElement, useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { getUiColors } from '../styles/uiTheme';

const MainLayout = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const guardado = localStorage.getItem('centromed-darkmode');
    return guardado === null ? true : guardado === 'true';
  });
  
  // NUEVO ESTADO: Controla si el menú lateral está abierto o cerrado
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    localStorage.setItem('centromed-darkmode', darkMode ? 'true' : 'false');
  }, [darkMode]);

  const colores = getUiColors(darkMode);

  const childrenConProps = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    return cloneElement(child, { darkMode });
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        // Transición suave para ocultar/mostrar el menú
        gridTemplateColumns: isSidebarOpen ? '290px minmax(0, 1fr)' : '0px minmax(0, 1fr)',
        transition: 'grid-template-columns 0.3s ease',
        background: colores.fondoApp,
        color: colores.texto,
      }}
    >
      <div
        style={{
          minHeight: '100vh',
          borderRight: isSidebarOpen ? `1px solid ${colores.bordeSuave}` : 'none',
          minWidth: 0,
          overflow: 'hidden', // Importante para que el contenido no se desborde al cerrar
          transition: 'border 0.3s ease',
        }}
      >
        <Sidebar darkMode={darkMode} isOpen={isSidebarOpen} />
      </div>

      <div
        style={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: colores.fondoContenido,
        }}
      >
        <Navbar
          darkMode={darkMode}
          toggleTheme={() => setDarkMode((prev) => !prev)}
          toggleSidebar={() => setIsSidebarOpen((prev) => !prev)} // Función para el botón del Navbar
        />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            overflowX: 'hidden',
            background: colores.fondoContenido,
            color: colores.texto,
          }}
        >
          {childrenConProps}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;