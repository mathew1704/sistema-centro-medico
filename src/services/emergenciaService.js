import { supabase } from '../lib/supabaseClient';

// --- NUEVAS FUNCIONES PARA LOS CATÁLOGOS ---
export async function listarDiagnosticos() {
  const { data, error } = await supabase
    .from('diagnosticos')
    .select('id, codigo, nombre')
    .order('nombre', { ascending: true })
    .limit(1000); 
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listarMotivosConsulta() {
  const { data, error } = await supabase
    .from('motivos_consulta')
    .select('id, nombre')
    .order('nombre', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listarProcesosClinicos() {
  const { data, error } = await supabase
    .from('procesos_clinicos')
    .select('id, codigo, nombre')
    .eq('activo', true)
    .order('nombre', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}
// ------------------------------------------

export async function buscarPacientesEmergencia(filtro = '') {
  let query = supabase
    .from('pacientes')
    .select(`
      id,
      record,
      nombre,
      apellido,
      cedula,
      correo,
      fecha_nacimiento,
      sexo,
      pacientes_seguro (
        id,
        numero_afiliado,
        plan,
        activo,
        ars (
          id,
          nombre,
          codigo
        )
      ),
      pacientes_telefonos (
        id,
        telefono,
        tipo
      ),
      pacientes_direcciones (
        id,
        direccion,
        ciudad,
        provincia,
        principal
      )
    `)
    .order('nombre', { ascending: true });

  if (filtro?.trim()) {
    const texto = filtro.trim();
    query = query.or(
      `record.ilike.%${texto}%,nombre.ilike.%${texto}%,apellido.ilike.%${texto}%,cedula.ilike.%${texto}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los pacientes.');
  }

  return (data || []).map((p) => {
    const seguroActivo =
      p.pacientes_seguro?.find((s) => s.activo) || p.pacientes_seguro?.[0] || null;

    const telefonoPrincipal = p.pacientes_telefonos?.[0]?.telefono || '';
    const direccionPrincipal =
      p.pacientes_direcciones?.find((d) => d.principal) ||
      p.pacientes_direcciones?.[0] ||
      null;

    return {
      ...p,
      numero_afiliado: seguroActivo?.numero_afiliado || '',
      plan_seguro: seguroActivo?.plan || '',
      ars_nombre: seguroActivo?.ars?.nombre || '',
      telefono_principal: telefonoPrincipal,
      direccion_principal: direccionPrincipal?.direccion || '',
      ciudad: direccionPrincipal?.ciudad || '',
      provincia: direccionPrincipal?.provincia || '',
    };
  });
}

export async function obtenerMedicoPorUsuario(usuarioId) {
  if (!usuarioId) return null;

  const { data, error } = await supabase
    .from('medicos')
    .select(`
      id,
      codigo,
      nombre,
      apellido,
      cedula,
      correo,
      telefono,
      exequatur,
      usuario_id,
      especialidades (
        id,
        nombre
      )
    `)
    .eq('usuario_id', usuarioId)
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo cargar el médico del usuario.');
  }

  return data || null;
}

export async function listarCamillasDisponibles() {
  const { data, error } = await supabase
    .from('camillas')
    .select('id, codigo, descripcion, disponible')
    .order('codigo', { ascending: true });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las camillas.');
  }

  return data || [];
}

export async function listarProductosEmergencia(filtro = '') {
  let query = supabase
    .from('productos')
    .select(`
      id,
      codigo,
      nombre,
      activo,
      categorias_productos (
        id,
        nombre
      )
    `)
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (filtro?.trim()) {
    const texto = filtro.trim();
    query = query.or(`codigo.ilike.%${texto}%,nombre.ilike.%${texto}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los productos.');
  }

  return data || [];
}

export async function listarEmergencias(filtros = {}) {
  let query = supabase
    .from('emergencias')
    .select(`
      id,
      numero_emergencia,
      paciente_id,
      camilla_id,
      triage_id,
      medico_id,
      motivo_id,
      motivo_nota,
      historia,
      diagnostico_principal_id,
      diagnostico_nota,
      tratamiento_principal_id,
      tratamiento_nota,
      estado,
      estado_clinico,
      estado_facturacion,
      creado_por,
      fecha_ingreso,
      fecha_salida,
      updated_at,
      facturada,
      factura_id,
      pacientes (
        id,
        record,
        nombre,
        apellido,
        cedula
      ),
      medicos (
        id,
        codigo,
        nombre,
        apellido
      ),
      camillas (
        id,
        codigo,
        descripcion
      ),
      motivos_consulta ( id, nombre ),
      diagnosticos ( id, codigo, nombre ),
      procesos_clinicos ( id, codigo, nombre )
    `)
    .order('fecha_ingreso', { ascending: false });

  if (filtros.pacienteId) {
    query = query.eq('paciente_id', filtros.pacienteId);
  }

  if (filtros.estado) {
    if (filtros.estado === 'abierto') {
      query = query.or('estado.eq.abierto,estado.eq.abierta,estado_clinico.eq.abierta');
    } else if (filtros.estado === 'de alta') {
      query = query.or('estado.eq.de alta,estado.eq.alta,estado_clinico.eq.de alta');
    } else {
      query = query.eq('estado', filtros.estado);
    }
  }

  if (filtros.filtro?.trim()) {
    const texto = filtros.filtro.trim();
    query = query.or(
      `motivo_nota.ilike.%${texto}%,diagnostico_nota.ilike.%${texto}%,historia.ilike.%${texto}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las emergencias.');
  }

  return data || [];
}

export async function obtenerEmergenciaPorId(id) {
  const { data, error } = await supabase
    .from('emergencias')
    .select(`
      id,
      numero_emergencia,
      paciente_id,
      camilla_id,
      triage_id,
      medico_id,
      motivo_id,
      motivo_nota,
      historia,
      diagnostico_principal_id,
      diagnostico_nota,
      tratamiento_principal_id,
      tratamiento_nota,
      estado,
      estado_clinico,
      estado_facturacion,
      creado_por,
      fecha_ingreso,
      fecha_salida,
      updated_at,
      facturada,
      factura_id,
      pacientes (
        id,
        record,
        nombre,
        apellido,
        cedula,
        fecha_nacimiento,
        sexo,
        correo,
        pacientes_seguro (
          id,
          numero_afiliado,
          plan,
          activo,
          ars (
            id,
            nombre,
            codigo
          )
        ),
        pacientes_telefonos (
          id,
          telefono,
          tipo
        ),
        pacientes_direcciones (
          id,
          direccion,
          ciudad,
          provincia,
          principal
        ),
        pacientes_documentos (
          id,
          tipo,
          url,
          fecha_subida
        )
      ),
      medicos (
        id,
        codigo,
        nombre,
        apellido,
        cedula,
        exequatur,
        especialidades (
          id,
          nombre
        )
      ),
      camillas (
        id,
        codigo,
        descripcion
      ),
      motivos_consulta ( id, nombre ),
      diagnosticos ( id, codigo, nombre ),
      procesos_clinicos ( id, codigo, nombre )
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo cargar la emergencia.');
  }

  return data;
}

export async function crearEmergencia(payload) {
  if (!payload?.paciente_id) {
    throw new Error('Debe seleccionar un paciente.');
  }

  const validar = await existeEmergenciaActivaPaciente(payload.paciente_id);
  if (validar) {
    throw new Error('Este paciente ya tiene una emergencia abierta.');
  }

  if (payload.camilla_id) {
    const camillaOcupada = await camillaTieneEmergenciaActiva(payload.camilla_id);
    if (camillaOcupada) {
      throw new Error('La camilla seleccionada ya está ocupada por otra emergencia activa.');
    }
  }

  const medicoId =
    payload.medico_id || (await resolverMedicoIdDesdeUsuario(payload.usuario_id));

  // --- GENERACIÓN AUTOMÁTICA DEL NÚMERO DE EMERGENCIA ---
  const ahora = new Date();
  const numeroGenerado = `EME-${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}-${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}${String(ahora.getSeconds()).padStart(2, '0')}`;

  const datos = {
    numero_emergencia: payload.numero_emergencia || numeroGenerado, // Solución al error null constraint
    paciente_id: payload.paciente_id,
    camilla_id: payload.camilla_id || null,
    medico_id: medicoId || null,
    motivo_id: payload.motivo_id || null,
    motivo_nota: payload.motivo_nota?.trim() || '',
    historia: payload.historia?.trim() || '',
    diagnostico_principal_id: payload.diagnostico_principal_id || null,
    diagnostico_nota: payload.diagnostico_nota?.trim() || '',
    tratamiento_principal_id: payload.tratamiento_principal_id || null,
    tratamiento_nota: payload.tratamiento_nota?.trim() || '',
    estado: payload.estado === 'de alta' ? 'de alta' : 'abierta',
    estado_clinico: payload.estado === 'de alta' ? 'de alta' : 'abierta',
    estado_facturacion: 'sin_facturar',
    creado_por: payload.creado_por || payload.usuario_id || null,
    facturada: false,
  };

  const { data, error } = await supabase
    .from('emergencias')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo registrar la emergencia.');
  }

  if (payload.camilla_id) {
    await actualizarEstadoCamilla(payload.camilla_id, false);
  }

  await agregarCargoBaseSalaEmergencia(data.id, payload.usuario_id || payload.creado_por || null);

  return data;
}

export async function actualizarEmergencia(id, payload, emergenciaAnterior = null) {
  const medicoId =
    payload.medico_id || (await resolverMedicoIdDesdeUsuario(payload.usuario_id));

  const estadoNormalizado =
    String(payload.estado || '').toLowerCase().trim() === 'de alta'
      ? 'de alta'
      : 'abierta';

  const camillaAnteriorId = emergenciaAnterior?.camilla_id || null;
  const camillaNuevaId = payload.camilla_id || null;

  if (camillaNuevaId && camillaNuevaId !== camillaAnteriorId && estadoNormalizado === 'abierta') {
    const camillaOcupada = await camillaTieneEmergenciaActiva(camillaNuevaId, id);
    if (camillaOcupada) {
      throw new Error('La camilla seleccionada ya está ocupada por otra emergencia activa.');
    }
  }

  const datos = {
    paciente_id: payload.paciente_id,
    camilla_id: payload.camilla_id || null,
    medico_id: medicoId || null,
    motivo_id: payload.motivo_id || null,
    motivo_nota: payload.motivo_nota?.trim() || '',
    historia: payload.historia?.trim() || '',
    diagnostico_principal_id: payload.diagnostico_principal_id || null,
    diagnostico_nota: payload.diagnostico_nota?.trim() || '',
    tratamiento_principal_id: payload.tratamiento_principal_id || null,
    tratamiento_nota: payload.tratamiento_nota?.trim() || '',
    estado: estadoNormalizado,
    estado_clinico: estadoNormalizado,
    fecha_salida:
      estadoNormalizado === 'de alta'
        ? payload.fecha_salida || new Date().toISOString()
        : payload.fecha_salida || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('emergencias')
    .update(datos)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar la emergencia.');
  }

  if (camillaAnteriorId && camillaAnteriorId !== camillaNuevaId) {
    await actualizarEstadoCamilla(camillaAnteriorId, true);
  }

  if (camillaNuevaId) {
    const debeLiberarse = estadoNormalizado === 'de alta';
    await actualizarEstadoCamilla(camillaNuevaId, debeLiberarse ? true : false);
  }

  return data;
}

export async function marcarEmergenciaDeAlta(id) {
  const actual = await obtenerEmergenciaPorId(id);

  const { data, error } = await supabase
    .from('emergencias')
    .update({
      estado: 'de alta',
      estado_clinico: 'de alta',
      fecha_salida: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo marcar la emergencia como de alta.');
  }

  if (actual?.camilla_id) {
    await actualizarEstadoCamilla(actual.camilla_id, true);
  }

  return data;
}

export async function eliminarEmergencia(id, camillaId = null) {
  const { error } = await supabase.from('emergencias').delete().eq('id', id);

  if (error) {
    throw new Error(error.message || 'No se pudo eliminar la emergencia.');
  }

  if (camillaId) {
    await actualizarEstadoCamilla(camillaId, true);
  }

  return true;
}

export async function registrarSignosVitales(payload) {
  const datos = {
    emergencia_id: payload.emergencia_id,
    presion: payload.presion?.trim() || null,
    temperatura: payload.temperatura?.trim() || null,
    pulso: payload.pulso?.trim() || null,
    frecuencia_respiratoria: payload.frecuencia_respiratoria?.trim() || null,
    saturacion: payload.saturacion?.trim() || null,
    peso: payload.peso?.trim() || null,
  };

  const { data, error } = await supabase
    .from('signos_vitales')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudieron registrar los signos vitales.');
  }

  return data;
}

export async function listarSignosVitales(emergenciaId) {
  const { data, error } = await supabase
    .from('signos_vitales')
    .select('*')
    .eq('emergencia_id', emergenciaId)
    .order('fecha', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los signos vitales.');
  }

  return data || [];
}

export async function agregarInsumoEmergencia(payload) {
  const cantidad = Number(payload.cantidad || 1);

  if (!payload.producto_id) {
    throw new Error('Debe seleccionar un producto.');
  }

  if (!cantidad || cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor que cero.');
  }

  const { data: existente, error: errorExistente } = await supabase
    .from('emergencia_insumos')
    .select('id, cantidad')
    .eq('emergencia_id', payload.emergencia_id)
    .eq('producto_id', payload.producto_id)
    .maybeSingle();

  if (errorExistente) {
    throw new Error(errorExistente.message || 'No se pudo validar el insumo.');
  }

  if (existente?.id) {
    const nuevaCantidad = Number(existente.cantidad || 0) + cantidad;

    const { data, error } = await supabase
      .from('emergencia_insumos')
      .update({ cantidad: nuevaCantidad })
      .eq('id', existente.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'No se pudo actualizar la cantidad del insumo.');
    }

    return data;
  }

  let ubicacionId = payload.ubicacion_id || null;

  if (!ubicacionId) {
    ubicacionId = await obtenerUbicacionEmergenciaId();
  }

  const datos = {
    emergencia_id: payload.emergencia_id,
    producto_id: payload.producto_id,
    cantidad,
    creado_por: payload.creado_por || null,
    lote_id: payload.lote_id || null,
    ubicacion_id: ubicacionId || null,
  };

  const { data, error } = await supabase
    .from('emergencia_insumos')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo agregar el insumo.');
  }

  return data;
}

export async function actualizarCantidadInsumoEmergencia(id, cantidad) {
  const cantidadNumero = Number(cantidad || 0);

  if (!cantidadNumero || cantidadNumero <= 0) {
    throw new Error('La cantidad debe ser mayor que cero.');
  }

  const { data, error } = await supabase
    .from('emergencia_insumos')
    .update({ cantidad: cantidadNumero })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar la cantidad del insumo.');
  }

  return data;
}

export async function listarInsumosEmergencia(emergenciaId) {
  const { data, error } = await supabase
    .from('emergencia_insumos')
    .select(`
      id,
      emergencia_id,
      producto_id,
      cantidad,
      lote_id,
      ubicacion_id,
      fecha,
      productos (
        id,
        codigo,
        nombre,
        categorias_productos (
          id,
          nombre
        )
      ),
      lotes (
        id,
        numero_lote,
        fecha_vencimiento
      ),
      ubicaciones (
        id,
        nombre
      )
    `)
    .eq('emergencia_id', emergenciaId)
    .order('fecha', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los insumos.');
  }

  return data || [];
}

export async function eliminarInsumoEmergencia(id) {
  const { error } = await supabase
    .from('emergencia_insumos')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message || 'No se pudo eliminar el insumo.');
  }

  return true;
}

export async function obtenerDetalleImpresionEmergencia(emergenciaId) {
  const emergencia = await obtenerEmergenciaPorId(emergenciaId);
  const [signos, insumos] = await Promise.all([
    listarSignosVitales(emergenciaId),
    listarInsumosEmergencia(emergenciaId),
  ]);

  return {
    emergencia,
    signos,
    insumos,
  };
}

export async function prepararDatosInternamientoDesdeEmergencia(emergenciaId) {
  const emergencia = await obtenerEmergenciaPorId(emergenciaId);

  if (!emergencia) {
    throw new Error('No se encontró la emergencia seleccionada.');
  }

  return {
    emergencia_id: emergencia.id,
    paciente_id: emergencia.paciente_id,
    medico_id: emergencia.medico_id || null,
    origen_ingreso: 'emergencia',
    diagnostico_ingreso_id: emergencia.diagnostico_principal_id || null,
    diagnostico_ingreso_nota: emergencia.diagnostico_nota || '',
    motivo_ingreso_id: emergencia.motivo_id || null,
    motivo_ingreso_nota: emergencia.motivo_nota || '',
    tratamiento_inicial: emergencia.tratamiento_nota || '',
    camilla_id: emergencia.camilla_id || null,
    paciente: emergencia.pacientes || null,
  };
}

async function existeEmergenciaActivaPaciente(pacienteId) {
  if (!pacienteId) return false;

  const { data, error } = await supabase
    .from('emergencias')
    .select('id')
    .eq('paciente_id', pacienteId)
    .or('estado.eq.abierta,estado.eq.abierto,estado_clinico.eq.abierta')
    .limit(1);

  if (error) {
    throw new Error(error.message || 'No se pudo validar la emergencia activa.');
  }

  return (data || []).length > 0;
}

async function camillaTieneEmergenciaActiva(camillaId, excluirEmergenciaId = null) {
  if (!camillaId) return false;

  let query = supabase
    .from('emergencias')
    .select('id')
    .eq('camilla_id', camillaId)
    .or('estado.eq.abierta,estado.eq.abierto,estado_clinico.eq.abierta')
    .limit(1);

  if (excluirEmergenciaId) {
    query = query.neq('id', excluirEmergenciaId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'No se pudo validar la disponibilidad de la camilla.');
  }

  return (data || []).length > 0;
}

async function actualizarEstadoCamilla(camillaId, disponible) {
  const { error } = await supabase
    .from('camillas')
    .update({ disponible })
    .eq('id', camillaId);

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar la camilla.');
  }
}

async function resolverMedicoIdDesdeUsuario(usuarioId) {
  if (!usuarioId) return null;

  const { data, error } = await supabase
    .from('medicos')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo identificar el médico del usuario.');
  }

  return data?.id || null;
}

async function obtenerUbicacionEmergenciaId() {
  const { data, error } = await supabase
    .from('ubicaciones')
    .select('id, nombre, codigo')
    .or('codigo.eq.EMERG,nombre.ilike.%emergencia%')
    .eq('activa', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo identificar la ubicación de emergencia.');
  }

  return data?.id || null;
}

async function obtenerProductoSalaEmergencia() {
  let { data, error } = await supabase
    .from('productos')
    .select('id, codigo, nombre')
    .eq('codigo', 'SRV-EMERGENCIA')
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo validar Sala de Emergencia.');
  }

  if (data?.id) return data;

  const resultadoNombre = await supabase
    .from('productos')
    .select('id, codigo, nombre')
    .ilike('nombre', 'Sala de Emergencia')
    .eq('activo', true)
    .maybeSingle();

  if (resultadoNombre.error) {
    throw new Error(resultadoNombre.error.message || 'No se pudo validar Sala de Emergencia.');
  }

  return resultadoNombre.data || null;
}

async function agregarCargoBaseSalaEmergencia(emergenciaId, usuarioId = null) {
  const productoSala = await obtenerProductoSalaEmergencia();

  if (!productoSala?.id) {
    return false;
  }

  const { data: existe, error: errorExiste } = await supabase
    .from('emergencia_insumos')
    .select('id, cantidad')
    .eq('emergencia_id', emergenciaId)
    .eq('producto_id', productoSala.id)
    .maybeSingle();

  if (errorExiste) {
    throw new Error(errorExiste.message || 'No se pudo validar el cargo base.');
  }

  if (existe?.id) {
    return true;
  }

  const ubicacionId = await obtenerUbicacionEmergenciaId();

  const { error } = await supabase
    .from('emergencia_insumos')
    .insert([
      {
        emergencia_id: emergenciaId,
        producto_id: productoSala.id,
        cantidad: 1,
        creado_por: usuarioId || null,
        ubicacion_id: ubicacionId || null,
      },
    ]);

  if (error) {
    throw new Error(error.message || 'No se pudo agregar Sala de Emergencia automáticamente.');
  }

  return true;
}