import { supabase } from '../lib/supabaseClient';

const TABLA_PACIENTES = 'pacientes';
const TABLA_TELEFONOS = 'pacientes_telefonos';
const TABLA_DIRECCIONES = 'pacientes_direcciones';
const TABLA_TUTORES = 'pacientes_tutores';
const TABLA_DOCUMENTOS = 'pacientes_documentos';
const TABLA_SEGUROS = 'pacientes_seguro';
const BUCKET_DOCUMENTOS = 'pacientes-documentos';

function texto(valor) {
  return (valor || '').toString().trim();
}

function limpiarCedula(valor) {
  return texto(valor).replace(/\D/g, '');
}

function normalizarNombreArchivo(nombre = 'archivo') {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function obtenerExtension(file) {
  const nombre = file?.name || '';
  const partes = nombre.split('.');
  return partes.length > 1 ? partes.pop().toLowerCase() : 'jpg';
}

function extraerPathDesdeUrl(url) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET_DOCUMENTOS}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(url.substring(idx + marker.length));
  return null;
}

export function generarRecordPaciente() {
  const ahora = new Date();
  const yy = String(ahora.getFullYear()).slice(-2);
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const dd = String(ahora.getDate()).padStart(2, '0');
  const hh = String(ahora.getHours()).padStart(2, '0');
  const mi = String(ahora.getMinutes()).padStart(2, '0');
  const ss = String(ahora.getSeconds()).padStart(2, '0');
  const rnd = Math.floor(Math.random() * 900 + 100);
  return `R${yy}${mm}${dd}${hh}${mi}${ss}${rnd}`;
}

export function obtenerUsuarioLocal() {
  try {
    const raw =
      localStorage.getItem('centromed_user') ||
      localStorage.getItem('clinica_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function registrarAuditoria(usuarioId, accion, detalle) {
  if (!usuarioId) return;

  try {
    await supabase.from('auditoria_detallada').insert([
      {
        usuario_id: usuarioId,
        modulo: 'pacientes',
        accion,
        detalle,
      },
    ]);
  } catch (error) {
    console.error('No se pudo registrar auditoría:', error);
  }
}

export async function listarARS() {
  const { data, error } = await supabase
    .from('ars')
    .select('id, nombre, codigo')
    .eq('activa', true)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error listando ARS:', error);
    return [];
  }

  return data || [];
}

export async function buscarPacientes(filtro = '') {
  let query = supabase
    .from(TABLA_PACIENTES)
    .select(`
      id,
      record,
      nombre,
      apellido,
      cedula,
      nacionalidad,
      sexo,
      estado_civil,
      fecha_nacimiento,
      correo,
      menor_edad,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false });

  if (texto(filtro)) {
    const t = texto(filtro);
    query = query.or(
      `record.ilike.%${t}%,cedula.ilike.%${t}%,nombre.ilike.%${t}%,apellido.ilike.%${t}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error buscando pacientes:', error);
    throw new Error('No se pudieron cargar los pacientes.');
  }

  const pacientes = data || [];
  if (!pacientes.length) return [];

  const ids = pacientes.map((p) => p.id);

  const [telefonosRes, segurosRes, documentosRes, tutoresRes] = await Promise.all([
    supabase
      .from(TABLA_TELEFONOS)
      .select('id, paciente_id, telefono, tipo')
      .in('paciente_id', ids),
    supabase
      .from(TABLA_SEGUROS)
      .select(`
        id,
        paciente_id,
        ars_id,
        numero_afiliado,
        plan,
        activo,
        ars:ars_id(id, nombre, codigo)
      `)
      .in('paciente_id', ids),
    supabase
      .from(TABLA_DOCUMENTOS)
      .select('id, paciente_id, tipo, url, fecha_subida')
      .in('paciente_id', ids),
    supabase
      .from(TABLA_TUTORES)
      .select('id, paciente_id, nombre, apellido, cedula, telefono, parentesco, es_titular')
      .in('paciente_id', ids),
  ]);

  const telefonos = telefonosRes.data || [];
  const seguros = segurosRes.data || [];
  const documentos = documentosRes.data || [];
  const tutores = tutoresRes.data || [];

  return pacientes.map((paciente) => {
    const telefonosPaciente = telefonos.filter((t) => t.paciente_id === paciente.id);
    const segurosPaciente = seguros.filter((s) => s.paciente_id === paciente.id && s.activo !== false);
    const documentosPaciente = documentos.filter((d) => d.paciente_id === paciente.id);
    const tutoresPaciente = tutores.filter((t) => t.paciente_id === paciente.id);

    const docCedula =
      documentosPaciente.find((d) => d.tipo === 'cedula') || null;

    const tutorTitular =
      tutoresPaciente.find((t) => t.es_titular) || tutoresPaciente[0] || null;

    return {
      ...paciente,
      telefono_principal: telefonosPaciente[0]?.telefono || '',
      seguro_nombre: segurosPaciente[0]?.ars?.nombre || '',
      documento_cedula_url: docCedula?.url || '',
      tutor_titular: tutorTitular,
      telefonos: telefonosPaciente,
      seguros: segurosPaciente,
      documentos: documentosPaciente,
      tutores: tutoresPaciente,
    };
  });
}

export async function obtenerPacientePorId(id) {
  const { data: paciente, error } = await supabase
    .from(TABLA_PACIENTES)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error obteniendo paciente:', error);
    throw new Error('No se pudo cargar el paciente.');
  }

  const [
    telefonosRes,
    direccionesRes,
    documentosRes,
    segurosRes,
    tutoresRes,
  ] = await Promise.all([
    supabase
      .from(TABLA_TELEFONOS)
      .select('*')
      .eq('paciente_id', id)
      .order('id', { ascending: true }),
    supabase
      .from(TABLA_DIRECCIONES)
      .select('*')
      .eq('paciente_id', id)
      .order('id', { ascending: true }),
    supabase
      .from(TABLA_DOCUMENTOS)
      .select('*')
      .eq('paciente_id', id)
      .order('fecha_subida', { ascending: false }),
    supabase
      .from(TABLA_SEGUROS)
      .select(`
        *,
        ars:ars_id(id, nombre, codigo)
      `)
      .eq('paciente_id', id)
      .order('id', { ascending: true }),
    supabase
      .from(TABLA_TUTORES)
      .select('*')
      .eq('paciente_id', id)
      .order('es_titular', { ascending: false }),
  ]);

  return {
    ...paciente,
    telefonos: telefonosRes.data || [],
    direcciones: direccionesRes.data || [],
    documentos: documentosRes.data || [],
    seguros: segurosRes.data || [],
    tutores: tutoresRes.data || [],
  };
}

export async function validarCedulaDuplicada({ cedula, menor_edad = false, excluirId = null }) {
  const ced = limpiarCedula(cedula);

  if (!ced) return false;
  if (menor_edad) return false;

  let query = supabase
    .from(TABLA_PACIENTES)
    .select('id, cedula')
    .eq('cedula', ced)
    .limit(1);

  if (excluirId) {
    query = query.neq('id', excluirId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error validando cédula:', error);
    throw new Error(`No se pudo validar la cédula: ${error.message}`);
  }

  return (data || []).length > 0;
}

function validarPayload(payload) {
  const errores = [];

  if (!texto(payload.nombre)) errores.push('El nombre es obligatorio.');
  if (!texto(payload.apellido)) errores.push('El apellido es obligatorio.');

  const tieneTelefono = (payload.telefonos || []).some((x) => texto(x.telefono));
  const tieneDireccion = (payload.direcciones || []).some((x) => texto(x.direccion));

  if (!tieneTelefono && !tieneDireccion) {
    errores.push('Debes registrar al menos un teléfono o una dirección.');
  }

  if (payload.menor_edad) {
    const tutorTitular = (payload.tutores || []).find((x) => x.es_titular) || payload.tutores?.[0];

    if (!tutorTitular || !texto(tutorTitular.nombre) || !texto(tutorTitular.apellido)) {
      errores.push('Si el paciente es menor, debes registrar nombre y apellido del tutor titular.');
    }

    if (!texto(tutorTitular?.cedula)) {
      errores.push('Si el paciente es menor, debes registrar la cédula del padre, madre o tutor titular.');
    }
  }

  return errores;
}

function prepararTelefonos(telefonos, pacienteId) {
  return (telefonos || [])
    .filter((x) => texto(x.telefono))
    .map((x) => ({
      paciente_id: pacienteId,
      telefono: texto(x.telefono),
      tipo: texto(x.tipo) || 'Principal',
    }));
}

function prepararDirecciones(direcciones, pacienteId) {
  return (direcciones || [])
    .filter((x) => texto(x.direccion))
    .map((x, index) => ({
      paciente_id: pacienteId,
      direccion: texto(x.direccion),
      ciudad: texto(x.ciudad) || null,
      provincia: texto(x.provincia) || null,
      principal: x.principal ?? index === 0,
    }));
}

function prepararTutores(tutores, pacienteId) {
  return (tutores || [])
    .filter((x) => texto(x.nombre) || texto(x.apellido) || texto(x.cedula))
    .map((x, index) => ({
      paciente_id: pacienteId,
      nombre: texto(x.nombre) || null,
      apellido: texto(x.apellido) || null,
      cedula: limpiarCedula(x.cedula) || null,
      telefono: texto(x.telefono) || null,
      parentesco: texto(x.parentesco) || null,
      es_titular: x.es_titular ?? index === 0,
    }));
}

function prepararSeguros(seguros, pacienteId) {
  return (seguros || [])
    .filter((x) => x.ars_id)
    .map((x) => ({
      paciente_id: pacienteId,
      ars_id: x.ars_id,
      numero_afiliado: texto(x.numero_afiliado) || null,
      plan: texto(x.plan) || null,
      activo: x.activo ?? true,
    }));
}

export async function crearPaciente(payload) {
  const errores = validarPayload(payload);
  if (errores.length) throw new Error(errores.join(' '));

  const usuario = obtenerUsuarioLocal();

  const existeCedula = await validarCedulaDuplicada({
    cedula: payload.cedula,
    menor_edad: payload.menor_edad,
  });

  if (existeCedula) {
    throw new Error('Ya existe un paciente con esa cédula.');
  }

  let record = generarRecordPaciente();

  for (let i = 0; i < 5; i += 1) {
    const { data, error } = await supabase
      .from(TABLA_PACIENTES)
      .select('id')
      .eq('record', record)
      .maybeSingle();

    if (error) {
      console.error('Error validando récord:', error);
      throw new Error('No se pudo generar el récord del paciente.');
    }

    if (!data) break;
    record = generarRecordPaciente();
  }

  const pacientePayload = {
    record,
    nombre: texto(payload.nombre),
    apellido: texto(payload.apellido),
    cedula: payload.menor_edad ? null : limpiarCedula(payload.cedula) || null,
    nacionalidad: texto(payload.nacionalidad) || null,
    sexo: texto(payload.sexo) || null,
    estado_civil: texto(payload.estado_civil) || null,
    fecha_nacimiento: payload.fecha_nacimiento || null,
    correo: texto(payload.correo) || null,
    menor_edad: !!payload.menor_edad,
    created_by: usuario?.id || null,
    updated_by: usuario?.id || null,
  };

  const { data: paciente, error } = await supabase
    .from(TABLA_PACIENTES)
    .insert([pacientePayload])
    .select()
    .single();

  if (error) {
    console.error('Error creando paciente:', error);
    throw new Error(error.message || 'No se pudo registrar el paciente.');
  }

  const telefonos = prepararTelefonos(payload.telefonos, paciente.id);
  const direcciones = prepararDirecciones(payload.direcciones, paciente.id);
  const tutores = prepararTutores(payload.tutores, paciente.id);
  const seguros = prepararSeguros(payload.seguros, paciente.id);

  if (telefonos.length) {
    const { error: errTel } = await supabase.from(TABLA_TELEFONOS).insert(telefonos);
    if (errTel) throw new Error(`Error guardando teléfonos: ${errTel.message}`);
  }

  if (direcciones.length) {
    const { error: errDir } = await supabase.from(TABLA_DIRECCIONES).insert(direcciones);
    if (errDir) throw new Error(`Error guardando direcciones: ${errDir.message}`);
  }

  if (tutores.length) {
    const { error: errTut } = await supabase.from(TABLA_TUTORES).insert(tutores);
    if (errTut) throw new Error(`Error guardando tutor: ${errTut.message}`);
  }

  if (seguros.length) {
    const { error: errSeg } = await supabase.from(TABLA_SEGUROS).insert(seguros);
    if (errSeg) throw new Error(`Error guardando seguro: ${errSeg.message}`);
  }

  await registrarAuditoria(usuario?.id || null, 'CREAR_PACIENTE', {
    paciente_id: paciente.id,
    record: paciente.record,
    nombre: `${paciente.nombre} ${paciente.apellido}`,
  });

  return paciente;
}

export async function actualizarPaciente(id, payload) {
  const errores = validarPayload(payload);
  if (errores.length) throw new Error(errores.join(' '));

  const usuario = obtenerUsuarioLocal();

  const existeCedula = await validarCedulaDuplicada({
    cedula: payload.cedula,
    menor_edad: payload.menor_edad,
    excluirId: id,
  });

  if (existeCedula) {
    throw new Error('Ya existe otro paciente con esa cédula.');
  }

  const pacientePayload = {
    nombre: texto(payload.nombre),
    apellido: texto(payload.apellido),
    cedula: payload.menor_edad ? null : limpiarCedula(payload.cedula) || null,
    nacionalidad: texto(payload.nacionalidad) || null,
    sexo: texto(payload.sexo) || null,
    estado_civil: texto(payload.estado_civil) || null,
    fecha_nacimiento: payload.fecha_nacimiento || null,
    correo: texto(payload.correo) || null,
    menor_edad: !!payload.menor_edad,
    updated_by: usuario?.id || null,
    updated_at: new Date().toISOString(),
  };

  const { data: paciente, error } = await supabase
    .from(TABLA_PACIENTES)
    .update(pacientePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error actualizando paciente:', error);
    throw new Error(error.message || 'No se pudo actualizar el paciente.');
  }

  const operacionesDelete = await Promise.all([
    supabase.from(TABLA_TELEFONOS).delete().eq('paciente_id', id),
    supabase.from(TABLA_DIRECCIONES).delete().eq('paciente_id', id),
    supabase.from(TABLA_TUTORES).delete().eq('paciente_id', id),
    supabase.from(TABLA_SEGUROS).delete().eq('paciente_id', id),
  ]);

  for (const op of operacionesDelete) {
    if (op.error) {
      throw new Error(op.error.message || 'No se pudieron limpiar los datos relacionados.');
    }
  }

  const telefonos = prepararTelefonos(payload.telefonos, id);
  const direcciones = prepararDirecciones(payload.direcciones, id);
  const tutores = prepararTutores(payload.tutores, id);
  const seguros = prepararSeguros(payload.seguros, id);

  if (telefonos.length) {
    const { error: errTel } = await supabase.from(TABLA_TELEFONOS).insert(telefonos);
    if (errTel) throw new Error(`Error guardando teléfonos: ${errTel.message}`);
  }

  if (direcciones.length) {
    const { error: errDir } = await supabase.from(TABLA_DIRECCIONES).insert(direcciones);
    if (errDir) throw new Error(`Error guardando direcciones: ${errDir.message}`);
  }

  if (tutores.length) {
    const { error: errTut } = await supabase.from(TABLA_TUTORES).insert(tutores);
    if (errTut) throw new Error(`Error guardando tutor: ${errTut.message}`);
  }

  if (seguros.length) {
    const { error: errSeg } = await supabase.from(TABLA_SEGUROS).insert(seguros);
    if (errSeg) throw new Error(`Error guardando seguro: ${errSeg.message}`);
  }

  await registrarAuditoria(usuario?.id || null, 'ACTUALIZAR_PACIENTE', {
    paciente_id: paciente.id,
    record: paciente.record,
    nombre: `${paciente.nombre} ${paciente.apellido}`,
  });

  return paciente;
}

export async function eliminarPaciente(id) {
  const usuario = obtenerUsuarioLocal();
  const paciente = await obtenerPacientePorId(id);

  const documentos = paciente.documentos || [];

  for (const doc of documentos) {
    if (doc.url) {
      const path = extraerPathDesdeUrl(doc.url);
      if (path) {
        await supabase.storage.from(BUCKET_DOCUMENTOS).remove([path]);
      }
    }
  }

  const { error } = await supabase
    .from(TABLA_PACIENTES)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error eliminando paciente:', error);
    throw new Error(error.message || 'No se pudo eliminar el paciente.');
  }

  await registrarAuditoria(usuario?.id || null, 'ELIMINAR_PACIENTE', {
    paciente_id: id,
  });

  return true;
}

export async function subirDocumentoPaciente(pacienteId, file, tipo = 'cedula') {
  if (!pacienteId) throw new Error('Primero guarda el paciente.');
  if (!file) throw new Error('No se recibió ningún archivo.');

  const ext = obtenerExtension(file);
  const nombreBase = normalizarNombreArchivo(file.name || `${tipo}.${ext}`);
  const nombreFinal = `${Date.now()}_${nombreBase}`;
  const path = `pacientes/${pacienteId}/${tipo}/${nombreFinal}`;

  const { error: storageError } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(path, file, {
      upsert: true,
      cacheControl: '3600',
    });

  if (storageError) {
    console.error('Error subiendo documento:', storageError);
    throw new Error(storageError.message || 'No se pudo subir el documento.');
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .getPublicUrl(path);

  const url = publicUrlData?.publicUrl;
  if (!url) throw new Error('No se pudo obtener la URL del documento.');

  const { data: existente } = await supabase
    .from(TABLA_DOCUMENTOS)
    .select('*')
    .eq('paciente_id', pacienteId)
    .eq('tipo', tipo)
    .maybeSingle();

  if (existente?.url) {
    const pathAnterior = extraerPathDesdeUrl(existente.url);
    if (pathAnterior) {
      await supabase.storage.from(BUCKET_DOCUMENTOS).remove([pathAnterior]);
    }

    const { error: updateError } = await supabase
      .from(TABLA_DOCUMENTOS)
      .update({
        url,
        fecha_subida: new Date().toISOString(),
      })
      .eq('id', existente.id);

    if (updateError) {
      throw new Error(updateError.message || 'No se pudo actualizar el documento.');
    }

    return { ...existente, url };
  }

  const { data, error } = await supabase
    .from(TABLA_DOCUMENTOS)
    .insert([
      {
        paciente_id: pacienteId,
        tipo,
        url,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo guardar el documento.');
  }

  return data;
}

export async function eliminarDocumentoPaciente(documentoId) {
  const { data: doc, error: findError } = await supabase
    .from(TABLA_DOCUMENTOS)
    .select('*')
    .eq('id', documentoId)
    .single();

  if (findError) {
    throw new Error(findError.message || 'No se encontró el documento.');
  }

  if (doc?.url) {
    const path = extraerPathDesdeUrl(doc.url);
    if (path) {
      await supabase.storage.from(BUCKET_DOCUMENTOS).remove([path]);
    }
  }

  const { error } = await supabase
    .from(TABLA_DOCUMENTOS)
    .delete()
    .eq('id', documentoId);

  if (error) {
    throw new Error(error.message || 'No se pudo eliminar el documento.');
  }

  return true;
}