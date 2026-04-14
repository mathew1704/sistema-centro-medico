export const ROLES = {
  ADMIN: 'admin',
  MEDICO: 'medico',
  ENFERMERA: 'enfermera',
  ENFERMERIA: 'enfermeria',
  RECEPCION: 'recepcion',
  BIOANALISTA: 'bioanalista',
  FARMACIA: 'farmacia',
  FACTURACION: 'facturacion',
  CONTABILIDAD: 'contabilidad',
};

export const PERMISOS_POR_ROL = {
  admin: [
    '/dashboard',
    '/citas',
    '/medicos',
    '/pacientes',
    '/emergencias',
    '/internamiento',
    '/enfermeria',
    '/inventario',
    '/farmacia',
    '/facturacion',
    '/laboratorio',
    '/usuarios',
  ],

  medico: [
    '/dashboard',
    '/pacientes',
    '/emergencias',
    '/internamiento',
    '/medicos',
  ],

  enfermera: [
    '/dashboard',
    '/pacientes',
    '/enfermeria',
  ],

  enfermeria: [
    '/dashboard',
    '/pacientes',
    '/enfermeria',
  ],

  recepcion: [
    '/dashboard',
    '/citas',
    '/pacientes',
    '/medicos',
  ],

  bioanalista: [
    '/dashboard',
    '/laboratorio',
    '/pacientes',
  ],

  farmacia: [
    '/dashboard',
    '/farmacia',
    '/inventario',
    '/pacientes',
  ],

  facturacion: [
    '/dashboard',
    '/facturacion',
    '/pacientes',
  ],

  contabilidad: [
    '/dashboard',
    '/facturacion',
  ],
};

export function normalizarRol(rol) {
  const valor = String(rol || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (valor === 'enfermeria') return 'enfermeria';
  if (valor === 'enfermera') return 'enfermera';

  return valor;
}

export function obtenerRolUsuario(usuario) {
  return normalizarRol(
    usuario?.rol ||
      usuario?.rol_nombre ||
      usuario?.role ||
      usuario?.nombre_rol ||
      usuario?.roles?.nombre ||
      ''
  );
}

export function tienePermisoRuta(usuario, ruta) {
  const rol = obtenerRolUsuario(usuario);

  if (!rol || !ruta) return false;

  const rutasPermitidas = PERMISOS_POR_ROL[rol] || [];
  return rutasPermitidas.includes(ruta);
}

export function obtenerMenuPorRol(usuario, menu = []) {
  return menu.filter((item) => tienePermisoRuta(usuario, item.to));
}