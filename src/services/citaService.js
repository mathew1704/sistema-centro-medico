import { supabase } from '../lib/supabaseClient';

function texto(valor) {
  return (valor || '').toString().trim();
}

function limpiarTelefono(valor) {
  return texto(valor).replace(/\D/g, '');
}

function obtenerUsuarioLocal() {
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
        modulo: 'citas',
        accion,
        detalle,
      },
    ]);
  } catch (error) {
    console.error('Error registrando auditoría de citas:', error);
  }
}

async function obtenerEstadoPorNombre(nombre) {
  const { data, error } = await supabase
    .from('estados_citas')
    .select('id, nombre')
    .ilike('nombre', nombre)
    .maybeSingle();

  if (error) {
    console.error('Error obteniendo estado de cita:', error);
    throw new Error(`No se pudo obtener el estado ${nombre}.`);
  }

  return data || null;
}

export function construirMensajeRecordatorio({
  pacienteNombre = '',
  fecha = '',
  hora = '',
  medicoNombre = '',
  consultorioNombre = '',
}) {
  return [
    `Hola ${pacienteNombre},`,
    '',
    'Le recordamos su cita médica en Centro Médico Dr. Morel.',
    '',
    `Fecha: ${fecha}`,
    `Hora: ${hora}`,
    `Médico: ${medicoNombre}`,
    `Consultorio: ${consultorioNombre || 'Por confirmar'}`,
    '',
    'Responda con una palabra simple:',
    'SI = confirmar cita',
    'NO = cancelar cita',
    'CAMBIAR = solicitar reprogramación',
    '',
    'Gracias.'
  ].join('\n');
}

export async function registrarNotificacionCita({
  cita_id,
  canal,
  mensaje,
  estado = 'enviada',
  tipo = 'recordatorio',
  respuesta = null,
}) {
  const { data, error } = await supabase
    .from('citas_notificaciones')
    .insert([
      {
        cita_id,
        canal,
        tipo,
        fecha_programada: new Date().toISOString(),
        fecha_envio: new Date().toISOString(),
        estado,
        mensaje: texto(mensaje) || null,
        respuesta: respuesta || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error registrando notificación:', error);
    throw new Error(`No se pudo registrar la notificación: ${error.message}`);
  }

  return data;
}

export async function obtenerDetalleAgendaCita(citaId) {
  const { data, error } = await supabase
    .from('v_citas_agenda')
    .select('*')
    .eq('id', citaId)
    .single();

  if (error) {
    console.error('Error obteniendo detalle de cita:', error);
    throw new Error(`No se pudo cargar el detalle de la cita: ${error.message}`);
  }

  return data;
}

export async function listarMedicos() {
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
      activo
    `)
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error listando médicos:', error);
    throw new Error(`No se pudieron cargar los médicos: ${error.message}`);
  }

  return data || [];
}

export async function listarConsultorios() {
  const { data, error } = await supabase
    .from('consultorios')
    .select(`
      id,
      nombre,
      descripcion,
      ubicacion,
      activo
    `)
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error listando consultorios:', error);
    throw new Error(`No se pudieron cargar los consultorios: ${error.message}`);
  }

  return data || [];
}

export async function listarMotivosConsulta() {
  const { data, error } = await supabase
    .from('motivos_consulta')
    .select('id, nombre')
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error listando motivos:', error);
    throw new Error(`No se pudieron cargar los motivos: ${error.message}`);
  }

  return data || [];
}

export async function listarEstadosCitas() {
  const { data, error } = await supabase
    .from('estados_citas')
    .select('id, nombre')
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error listando estados:', error);
    throw new Error(`No se pudieron cargar los estados: ${error.message}`);
  }

  return data || [];
}

export async function buscarPacientesCitas(filtro = '') {
  const textoFiltro = texto(filtro).toLowerCase();

  const [pacientesRes, segurosRes, telefonosRes] = await Promise.all([
    supabase
      .from('pacientes')
      .select(`
        id,
        record,
        nombre,
        apellido,
        cedula,
        correo,
        menor_edad
      `)
      .order('nombre', { ascending: true }),

    supabase
      .from('pacientes_seguro')
      .select(`
        id,
        paciente_id,
        numero_afiliado,
        plan,
        activo,
        ars:ars_id (
          id,
          nombre
        )
      `),

    supabase
      .from('pacientes_telefonos')
      .select(`
        id,
        paciente_id,
        telefono,
        tipo
      `),
  ]);

  if (pacientesRes.error) {
    console.error('Error cargando pacientes para citas:', pacientesRes.error);
    throw new Error(`No se pudieron cargar los pacientes: ${pacientesRes.error.message}`);
  }

  if (segurosRes.error) {
    console.error('Error cargando seguros de pacientes:', segurosRes.error);
    throw new Error(`No se pudieron cargar los seguros de pacientes: ${segurosRes.error.message}`);
  }

  if (telefonosRes.error) {
    console.error('Error cargando teléfonos de pacientes:', telefonosRes.error);
    throw new Error(`No se pudieron cargar los teléfonos de pacientes: ${telefonosRes.error.message}`);
  }

  const pacientes = pacientesRes.data || [];
  const seguros = segurosRes.data || [];
  const telefonos = telefonosRes.data || [];

  const pacientesEnriquecidos = pacientes.map((p) => {
    const segurosPaciente = seguros.filter((s) => s.paciente_id === p.id);
    const seguroActivo =
      segurosPaciente.find((s) => s.activo === true) || segurosPaciente[0] || null;

    const telefonosPaciente = telefonos.filter((t) => t.paciente_id === p.id);
    const telefonoPrincipal = telefonosPaciente[0]?.telefono || '';

    return {
      ...p,
      numero_afiliado: seguroActivo?.numero_afiliado || '',
      plan_seguro: seguroActivo?.plan || '',
      ars_nombre: seguroActivo?.ars?.nombre || '',
      telefono_principal: telefonoPrincipal,
    };
  });

  if (!textoFiltro) {
    return pacientesEnriquecidos;
  }

  return pacientesEnriquecidos.filter((p) => {
    const bolsaBusqueda = [
      p.record,
      p.cedula,
      p.nombre,
      p.apellido,
      `${p.nombre || ''} ${p.apellido || ''}`,
      p.numero_afiliado,
      p.telefono_principal,
      p.ars_nombre,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return bolsaBusqueda.includes(textoFiltro);
  });
}

export async function obtenerTelefonosPaciente(pacienteId) {
  const { data, error } = await supabase
    .from('pacientes_telefonos')
    .select('id, telefono, tipo')
    .eq('paciente_id', pacienteId)
    .order('id', { ascending: true });

  if (error) {
    console.error('Error obteniendo teléfonos del paciente:', error);
    return [];
  }

  return data || [];
}

export async function listarCitas({
  filtro = '',
  medicoId = '',
  fecha = '',
  estadoId = '',
} = {}) {
  let query = supabase
    .from('v_citas_agenda')
    .select('*')
    .order('fecha', { ascending: false })
    .order('hora', { ascending: false });

  if (texto(filtro)) {
    query = query.or(
      [
        `record.ilike.%${filtro}%`,
        `paciente_cedula.ilike.%${filtro}%`,
        `paciente_nombre.ilike.%${filtro}%`,
        `paciente_apellido.ilike.%${filtro}%`,
        `medico_nombre.ilike.%${filtro}%`,
        `medico_apellido.ilike.%${filtro}%`,
        `medico_codigo.ilike.%${filtro}%`,
      ].join(',')
    );
  }

  if (medicoId) query = query.eq('medico_id', medicoId);
  if (fecha) query = query.eq('fecha', fecha);
  if (estadoId) query = query.eq('estado_id', estadoId);

  const { data, error } = await query;

  if (error) {
    console.error('Error listando citas:', error);
    throw new Error(`No se pudieron cargar las citas: ${error.message}`);
  }

  return data || [];
}

export async function obtenerCitaPorId(id) {
  const { data, error } = await supabase
    .from('citas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error obteniendo cita:', error);
    throw new Error(`No se pudo cargar la cita: ${error.message}`);
  }

  return data;
}

export async function validarDisponibilidadMedico({
  medico_id,
  fecha,
  hora,
  excluirId = null,
}) {
  if (!medico_id || !fecha || !hora) {
    throw new Error('Faltan datos para validar la disponibilidad del médico.');
  }

  let query = supabase
    .from('citas')
    .select('id')
    .eq('medico_id', medico_id)
    .eq('fecha', fecha)
    .eq('hora', hora)
    .limit(1);

  if (excluirId) {
    query = query.neq('id', excluirId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error validando disponibilidad del médico:', error);
    throw new Error(`No se pudo validar la disponibilidad del médico: ${error.message}`);
  }

  if ((data || []).length > 0) {
    return false;
  }

  const { data: bloqueos, error: errBloqueo } = await supabase
    .from('bloqueos_agenda')
    .select('id, hora_inicio, hora_fin')
    .eq('medico_id', medico_id)
    .eq('fecha', fecha);

  if (errBloqueo) {
    console.error('Error consultando bloqueos de agenda:', errBloqueo);
    throw new Error(`No se pudo validar la agenda del médico: ${errBloqueo.message}`);
  }

  const horaSeleccionada = texto(hora);

  const estaBloqueado = (bloqueos || []).some((b) => {
    if (!b.hora_inicio || !b.hora_fin) return false;
    return horaSeleccionada >= b.hora_inicio && horaSeleccionada < b.hora_fin;
  });

  return !estaBloqueado;
}

export async function crearCita(payload) {
  const usuario = obtenerUsuarioLocal();

  if (!payload.paciente_id) throw new Error('Debes seleccionar un paciente.');
  if (!payload.medico_id) throw new Error('Debes seleccionar un médico.');
  if (!payload.fecha) throw new Error('Debes seleccionar una fecha.');
  if (!payload.hora) throw new Error('Debes seleccionar una hora.');

  const disponible = await validarDisponibilidadMedico({
    medico_id: payload.medico_id,
    fecha: payload.fecha,
    hora: payload.hora,
  });

  if (!disponible) {
    throw new Error('El médico ya tiene una cita o un bloqueo en ese horario.');
  }

  const estadoPendiente = await obtenerEstadoPorNombre('pendiente');
  if (!estadoPendiente?.id) {
    throw new Error('No existe el estado inicial pendiente.');
  }

  const citaPayload = {
    paciente_id: payload.paciente_id,
    medico_id: payload.medico_id,
    consultorio_id: payload.consultorio_id || null,
    estado_id: estadoPendiente.id,
    motivo_id: payload.motivo_id || null,
    fecha: payload.fecha,
    hora: payload.hora,
    observacion: texto(payload.observacion) || null,
    creado_por: usuario?.id || null,
    telefono_contacto: texto(payload.telefono_contacto) || null,
    correo_contacto: texto(payload.correo_contacto) || null,
  };

  const { data, error } = await supabase
    .from('citas')
    .insert([citaPayload])
    .select()
    .single();

  if (error) {
    console.error('Error creando cita:', error);
    throw new Error(error.message || 'No se pudo crear la cita.');
  }

  await supabase.from('historial_citas').insert([
    {
      cita_id: data.id,
      accion: 'CREADA',
      usuario_id: usuario?.id || null,
      detalle: 'Cita creada desde el módulo de citas',
    },
  ]);

  await registrarAuditoria(usuario?.id || null, 'CREAR_CITA', {
    cita_id: data.id,
    paciente_id: data.paciente_id,
    medico_id: data.medico_id,
    fecha: data.fecha,
    hora: data.hora,
  });

  return data;
}

export async function actualizarCita(id, payload) {
  const usuario = obtenerUsuarioLocal();

  if (!payload.paciente_id) throw new Error('Debes seleccionar un paciente.');
  if (!payload.medico_id) throw new Error('Debes seleccionar un médico.');
  if (!payload.fecha) throw new Error('Debes seleccionar una fecha.');
  if (!payload.hora) throw new Error('Debes seleccionar una hora.');

  const disponible = await validarDisponibilidadMedico({
    medico_id: payload.medico_id,
    fecha: payload.fecha,
    hora: payload.hora,
    excluirId: id,
  });

  if (!disponible) {
    throw new Error('El médico ya tiene una cita o un bloqueo en ese horario.');
  }

  const updatePayload = {
    paciente_id: payload.paciente_id,
    medico_id: payload.medico_id,
    consultorio_id: payload.consultorio_id || null,
    motivo_id: payload.motivo_id || null,
    fecha: payload.fecha,
    hora: payload.hora,
    observacion: texto(payload.observacion) || null,
    telefono_contacto: texto(payload.telefono_contacto) || null,
    correo_contacto: texto(payload.correo_contacto) || null,
  };

  const { data, error } = await supabase
    .from('citas')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error actualizando cita:', error);
    throw new Error(error.message || 'No se pudo actualizar la cita.');
  }

  await supabase.from('historial_citas').insert([
    {
      cita_id: data.id,
      accion: 'ACTUALIZADA',
      usuario_id: usuario?.id || null,
      detalle: 'Cita actualizada desde el módulo de citas',
    },
  ]);

  await registrarAuditoria(usuario?.id || null, 'ACTUALIZAR_CITA', {
    cita_id: data.id,
    paciente_id: data.paciente_id,
    medico_id: data.medico_id,
    fecha: data.fecha,
    hora: data.hora,
  });

  return data;
}

export async function cambiarEstadoCita(citaId, nombreEstado) {
  const usuario = obtenerUsuarioLocal();

  const estado = await obtenerEstadoPorNombre(nombreEstado);

  if (!estado?.id) {
    throw new Error(`No existe el estado ${nombreEstado}.`);
  }

  const updatePayload = {
    estado_id: estado.id,
    cancelada: nombreEstado.toLowerCase() === 'cancelada',
    atendida: nombreEstado.toLowerCase() === 'atendida',
  };

  const { data, error } = await supabase
    .from('citas')
    .update(updatePayload)
    .eq('id', citaId)
    .select()
    .single();

  if (error) {
    console.error('Error cambiando estado de cita:', error);
    throw new Error(`No se pudo cambiar el estado de la cita: ${error.message}`);
  }

  await supabase.from('historial_citas').insert([
    {
      cita_id: citaId,
      accion: `ESTADO_${nombreEstado.toUpperCase()}`,
      usuario_id: usuario?.id || null,
      detalle: `Cambio de estado a ${nombreEstado}`,
    },
  ]);

  return data;
}

export async function eliminarCita(citaId) {
  const usuario = obtenerUsuarioLocal();

  const estadoCancelada = await obtenerEstadoPorNombre('cancelada');

  if (!estadoCancelada?.id) {
    throw new Error('No existe el estado cancelada.');
  }

  const { data, error } = await supabase
    .from('citas')
    .update({
      estado_id: estadoCancelada.id,
      cancelada: true,
    })
    .eq('id', citaId)
    .select()
    .single();

  if (error) {
    console.error('Error cancelando cita:', error);
    throw new Error(`No se pudo cancelar la cita: ${error.message}`);
  }

  await supabase.from('historial_citas').insert([
    {
      cita_id: citaId,
      accion: 'CANCELADA',
      usuario_id: usuario?.id || null,
      detalle: 'Cita cancelada desde el módulo',
    },
  ]);

  await registrarAuditoria(usuario?.id || null, 'CANCELAR_CITA', {
    cita_id: citaId,
  });

  return data;
}

export function construirMailtoCita({
  correo = '',
  asunto = '',
  mensaje = '',
}) {
  const to = encodeURIComponent(texto(correo));
  const subject = encodeURIComponent(texto(asunto));
  const body = encodeURIComponent(texto(mensaje));
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

export function construirLinkWhatsApp({
  telefono = '',
  mensaje = '',
}) {
  const numero = limpiarTelefono(telefono);
  const textoMsg = encodeURIComponent(texto(mensaje));

  if (!numero) return '';
  return `https://wa.me/${numero}?text=${textoMsg}`;
}