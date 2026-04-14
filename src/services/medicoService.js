import { supabase } from '../lib/supabaseClient';

export async function listarMedicos(filtro = '') {
  let query = supabase
    .from('medicos')
    .select(`
      id,
      codigo,
      nombre,
      apellido,
      cedula,
      telefono,
      correo,
      especialidad_id,
      usuario_id,
      exequatur,
      activo,
      created_at,
      updated_at,
      especialidades (
        id,
        nombre
      )
    `)
    .order('created_at', { ascending: false });

  if (filtro?.trim()) {
    const texto = filtro.trim();
    query = query.or(
      `codigo.ilike.%${texto}%,nombre.ilike.%${texto}%,apellido.ilike.%${texto}%,cedula.ilike.%${texto}%,correo.ilike.%${texto}%,exequatur.ilike.%${texto}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los médicos.');
  }

  return data || [];
}

export async function obtenerMedicoPorId(id) {
  const { data, error } = await supabase
    .from('medicos')
    .select(`
      id,
      codigo,
      nombre,
      apellido,
      cedula,
      telefono,
      correo,
      especialidad_id,
      usuario_id,
      exequatur,
      activo,
      created_at,
      updated_at,
      especialidades (
        id,
        nombre
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo cargar el médico.');
  }

  return data;
}

export async function crearMedico(payload) {
  const datos = {
    nombre: payload.nombre?.trim() || '',
    apellido: payload.apellido?.trim() || '',
    cedula: payload.cedula?.trim() || null,
    telefono: payload.telefono?.trim() || null,
    correo: payload.correo?.trim() || null,
    especialidad_id: payload.especialidad_id || null,
    usuario_id: payload.usuario_id || null,
    exequatur: payload.exequatur?.trim() || null,
    activo: payload.activo ?? true,
  };

  const { data, error } = await supabase
    .from('medicos')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo registrar el médico.');
  }

  return data;
}

export async function actualizarMedico(id, payload) {
  const datos = {
    nombre: payload.nombre?.trim() || '',
    apellido: payload.apellido?.trim() || '',
    cedula: payload.cedula?.trim() || null,
    telefono: payload.telefono?.trim() || null,
    correo: payload.correo?.trim() || null,
    especialidad_id: payload.especialidad_id || null,
    usuario_id: payload.usuario_id || null,
    exequatur: payload.exequatur?.trim() || null,
    activo: payload.activo ?? true,
  };

  const { data, error } = await supabase
    .from('medicos')
    .update(datos)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el médico.');
  }

  return data;
}

export async function eliminarMedico(id) {
  const { error } = await supabase
    .from('medicos')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message || 'No se pudo eliminar el médico.');
  }

  return true;
}

export async function cambiarEstadoMedico(id, activo) {
  const { data, error } = await supabase
    .from('medicos')
    .update({ activo })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo cambiar el estado del médico.');
  }

  return data;
}

export async function listarEspecialidades() {
  const { data, error } = await supabase
    .from('especialidades')
    .select('id, nombre')
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las especialidades.');
  }

  return data || [];
}

export async function listarUsuariosMedicos() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, username, nombre, apellido, email, activo')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los usuarios.');
  }

  return data || [];
}