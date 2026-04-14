import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext();

const STORAGE_KEY = 'centromed_user';

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        setUsuario(JSON.parse(guardado));
      }
    } catch (error) {
      console.error('Error cargando usuario desde localStorage:', error);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (userData) => {
    setUsuario(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  };

  const logout = () => {
    setUsuario(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      usuario,
      loading,
      login,
      logout,
      isAuthenticated: !!usuario,
    }),
    [usuario, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);