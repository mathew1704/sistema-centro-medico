export const getUiColors = (darkMode = false) => ({
  fondoApp: darkMode ? '#020617' : '#f4f8fc',
  fondoContenido: darkMode ? '#0b1220' : '#f4f8fc',
  card: darkMode ? '#111827' : '#ffffff',
  cardSoft: darkMode ? '#0f172a' : '#f8fbff',
  input: darkMode ? '#0b1220' : '#ffffff',

  texto: darkMode ? '#e5e7eb' : '#123a72',
  subtitulo: darkMode ? '#94a3b8' : '#64748b',
  textoSuave: darkMode ? '#cbd5e1' : '#475569',

  borde: darkMode ? '#1f2937' : '#dbe7f5',
  bordeSuave: darkMode ? 'rgba(148,163,184,0.14)' : '#e5edf8',

  primario: '#2563eb',
  exito: '#059669',
  alerta: '#ea580c',
  violeta: '#7c3aed',
  rosa: '#db2777',

  sombra: darkMode
    ? '0 10px 28px rgba(0,0,0,0.34)'
    : '0 10px 28px rgba(15,23,42,0.06)',

  gradienteNavbar: darkMode
    ? 'linear-gradient(180deg, rgba(11,18,32,0.96) 0%, rgba(15,23,42,0.98) 100%)'
    : 'rgba(255,255,255,0.95)',

  gradienteSidebar: darkMode
    ? 'linear-gradient(180deg, #020617 0%, #0b1220 38%, #0f172a 100%)'
    : 'linear-gradient(180deg, #0b4cc2 0%, #0d56cf 35%, #0f4eb3 100%)',

  gradienteHeader: darkMode
    ? 'linear-gradient(135deg, #0f172a 0%, #111827 50%, #0b1220 100%)'
    : 'linear-gradient(135deg, #0f4eb3 0%, #2563eb 45%, #38bdf8 100%)',
});

export const pageWrapperStyle = (darkMode = false) => {
  const c = getUiColors(darkMode);

  return {
    minHeight: '100%',
    background: c.fondoContenido,
    color: c.texto,
    padding: '24px',
    overflowX: 'hidden',
  };
};

export const cardStyle = (darkMode = false) => {
  const c = getUiColors(darkMode);

  return {
    background: c.card,
    border: `1px solid ${c.borde}`,
    borderRadius: '22px',
    padding: '20px',
    boxShadow: c.sombra,
  };
};

export const statCardStyle = (darkMode = false) => {
  const c = getUiColors(darkMode);

  return {
    background: c.card,
    border: `1px solid ${c.borde}`,
    borderRadius: '22px',
    padding: '18px',
    boxShadow: c.sombra,
    position: 'relative',
    overflow: 'hidden',
    minHeight: '140px',
  };
};

export const inputStyle = (darkMode = false) => {
  const c = getUiColors(darkMode);

  return {
    width: '100%',
    height: '48px',
    borderRadius: '14px',
    border: `1px solid ${c.borde}`,
    background: c.input,
    color: c.texto,
    padding: '0 14px',
    outline: 'none',
    fontSize: '14px',
  };
};

export const selectStyle = (darkMode = false) => {
  const c = getUiColors(darkMode);

  return {
    width: '100%',
    height: '48px',
    borderRadius: '14px',
    border: `1px solid ${c.borde}`,
    background: c.input,
    color: c.texto,
    padding: '0 14px',
    outline: 'none',
    fontSize: '14px',
  };
};

export const textareaStyle = (darkMode = false) => {
  const c = getUiColors(darkMode);

  return {
    width: '100%',
    minHeight: '110px',
    borderRadius: '14px',
    border: `1px solid ${c.borde}`,
    background: c.input,
    color: c.texto,
    padding: '14px',
    outline: 'none',
    fontSize: '14px',
    resize: 'vertical',
  };
};

export const labelStyle = (darkMode = false) => {
  const c = getUiColors(darkMode);

  return {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 700,
    color: c.texto,
    fontSize: '14px',
  };
};

export const buttonPrimaryStyle = {
  height: '46px',
  padding: '0 18px',
  borderRadius: '14px',
  border: 'none',
  background: '#2563eb',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
};

export const buttonSoftStyle = (darkMode = false) => {
  const c = getUiColors(darkMode);

  return {
    height: '46px',
    padding: '0 18px',
    borderRadius: '14px',
    border: `1px solid ${c.borde}`,
    background: c.cardSoft,
    color: c.texto,
    fontWeight: 800,
    cursor: 'pointer',
  };
};