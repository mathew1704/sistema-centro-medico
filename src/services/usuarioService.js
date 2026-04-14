import { supabase } from '../lib/supabaseClient';

export async function listarUsuarios(filtro = '') {
  let query = supabase
    .from('usuarios')
    .select(`
      id,
      username,
      password_hash,
      nombre,
      apellido,
      email,
      rol_id,
      activo,
      ultimo_login,
      created_at,
      updated_at,
      auth_user_id,
      eliminado_at,
      eliminado_por,
      motivo_baja,
      roles (
        id,
        nombre,
        descripcion
      )
    `)
    .is('eliminado_at', null)
    .order('created_at', { ascending: false });

  if (filtro?.trim()) {
    const texto = filtro.trim();
    query = query.or(
      `username.ilike.%${texto}%,nombre.ilike.%${texto}%,apellido.ilike.%${texto}%,email.ilike.%${texto}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los usuarios.');
  }

  return data || [];
}

export async function obtenerUsuarioPorId(id) {
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id,
      username,
      password_hash,
      nombre,
      apellido,
      email,
      rol_id,
      activo,
      ultimo_login,
      created_at,
      updated_at,
      auth_user_id,
      eliminado_at,
      eliminado_por,
      motivo_baja,
      roles (
        id,
        nombre,
        descripcion
      )
    `)
    .eq('id', id)
    .is('eliminado_at', null)
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo cargar el usuario.');
  }

  return data;
}

export async function listarRoles() {
  const { data, error } = await supabase
    .from('roles')
    .select('id, nombre, descripcion')
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los roles.');
  }

  return data || [];
}

export async function listarMedicosSinUsuario() {
  const { data, error } = await supabase
    .from('medicos')
    .select(`
      id,
      codigo,
      nombre,
      apellido,
      usuario_id,
      activo
    `)
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los médicos.');
  }

  return data || [];
}

export async function crearUsuario(payload) {
  const datos = {
    username: payload.username?.trim() || '',
    password_hash: payload.password?.trim() || payload.password_hash?.trim() || '',
    nombre: payload.nombre?.trim() || null,
    apellido: payload.apellido?.trim() || null,
    email: payload.email?.trim() || null,
    rol_id: payload.rol_id || null,
    activo: payload.activo ?? true,
    eliminado_at: null,
    eliminado_por: null,
    motivo_baja: null,
  };

  const { data, error } = await supabase
    .from('usuarios')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo registrar el usuario.');
  }

  if (payload.medico_id) {
    await vincularUsuarioConMedico(data.id, payload.medico_id);
  }

  return data;
}

export async function actualizarUsuario(id, payload) {
  const updateData = {
    username: payload.username?.trim() || '',
    nombre: payload.nombre?.trim() || null,
    apellido: payload.apellido?.trim() || null,
    email: payload.email?.trim() || null,
    rol_id: payload.rol_id || null,
    activo: payload.activo ?? true,
    updated_at: new Date().toISOString(),
  };

  if (payload.password?.trim()) {
    updateData.password_hash = payload.password.trim();
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update(updateData)
    .eq('id', id)
    .is('eliminado_at', null)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el usuario.');
  }

  await limpiarVinculoMedicoUsuario(id);

  if (payload.medico_id) {
    await vincularUsuarioConMedico(id, payload.medico_id);
  }

  return data;
}

export async function cambiarEstadoUsuario(id, activo) {
  const { data, error } = await supabase
    .from('usuarios')
    .update({
      activo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('eliminado_at', null)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo cambiar el estado del usuario.');
  }

  return data;
}

export async function eliminarUsuario(id, adminId, motivo = 'Eliminado desde módulo de usuarios') {
  await limpiarVinculoMedicoUsuario(id);

  const { error } = await supabase.rpc('soft_delete_usuario', {
    p_usuario_id: id,
    p_admin_id: adminId || null,
    p_motivo: motivo,
  });

  if (error) {
    throw new Error(error.message || 'No se pudo eliminar el usuario.');
  }

  return true;
}

export async function obtenerMedicoVinculadoUsuario(usuarioId) {
  const { data, error } = await supabase
    .from('medicos')
    .select('id, codigo, nombre, apellido, usuario_id')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo obtener el médico vinculado.');
  }

  return data || null;
}

async function limpiarVinculoMedicoUsuario(usuarioId) {
  const { error } = await supabase
    .from('medicos')
    .update({ usuario_id: null })
    .eq('usuario_id', usuarioId);

  if (error) {
    throw new Error(error.message || 'No se pudo limpiar la relación con médico.');
  }
}

async function vincularUsuarioConMedico(usuarioId, medicoId) {
  const { error } = await supabase
    .from('medicos')
    .update({ usuario_id: usuarioId })
    .eq('id', medicoId);

  if (error) {
    throw new Error(error.message || 'No se pudo vincular el usuario con el médico.');
  }
}