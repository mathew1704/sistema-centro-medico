import { supabase } from '../lib/supabaseClient';

// --- FUNCIONES PARA LOS CATÁLOGOS ---
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

/* =========================================================
   HELPERS
========================================================= */
function obtenerSeguroActivoDesdePaciente(paciente) {
  const lista = paciente?.pacientes_seguro || [];
  return lista.find((s) => s?.activo) || lista[0] || null;
}

function obtenerNombreAseguradora(seguro) {
  return seguro?.ars?.nombre || '';
}

function obtenerTelefonoPrincipalDesdePaciente(paciente) {
  return paciente?.pacientes_telefonos?.[0]?.telefono || paciente?.telefono || '';
}

function obtenerDireccionPrincipalDesdePaciente(paciente) {
  return (
    paciente?.pacientes_direcciones?.find((d) => d?.principal) ||
    paciente?.pacientes_direcciones?.[0] ||
    null
  );
}

function mapearPacienteInternamiento(paciente) {
  if (!paciente) return null;

  const seguroActivo = obtenerSeguroActivoDesdePaciente(paciente);
  const direccionPrincipal = obtenerDireccionPrincipalDesdePaciente(paciente);

  return {
    ...paciente,
    seguro_activo: seguroActivo,
    numero_afiliado: seguroActivo?.numero_afiliado || '',
    nombre_aseguradora: obtenerNombreAseguradora(seguroActivo),
    telefono_principal: obtenerTelefonoPrincipalDesdePaciente(paciente),
    telefono: obtenerTelefonoPrincipalDesdePaciente(paciente),
    direccion_principal: direccionPrincipal?.direccion || '',
    ciudad: direccionPrincipal?.ciudad || '',
    provincia: direccionPrincipal?.provincia || '',
  };
}

function mapearInternamientoConSeguro(item) {
  const pacienteMapeado = mapearPacienteInternamiento(item?.pacientes);
  const seguroActivo = obtenerSeguroActivoDesdePaciente(pacienteMapeado);

  return {
    ...item,
    pacientes: pacienteMapeado,
    habitacion: item?.camas?.habitaciones || null,
    seguro_activo: seguroActivo,
    numero_afiliado: seguroActivo?.numero_afiliado || '',
    nombre_aseguradora: obtenerNombreAseguradora(seguroActivo),
  };
}

async function actualizarEstadoCama(camaId, disponible) {
  if (!camaId) return true;

  const { error } = await supabase
    .from('camas')
    .update({ disponible })
    .eq('id', camaId);

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el estado de la cama.');
  }

  return true;
}

async function obtenerCamaDisponiblePorHabitacion(habitacionId, excluirCamaId = null) {
  if (!habitacionId) return null;

  let query = supabase
    .from('camas')
    .select('id, disponible, habitacion_id, codigo')
    .eq('habitacion_id', habitacionId)
    .eq('disponible', true)
    .order('codigo', { ascending: true })
    .limit(1);

  if (excluirCamaId) {
    query = query.neq('id', excluirCamaId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'No se pudo buscar una cama disponible.');
  }

  return data?.[0]?.id || null;
}

async function existeInternamientoActivoPaciente(pacienteId, excluirId = null) {
  if (!pacienteId) return false;

  let query = supabase
    .from('internamientos')
    .select('id, estado')
    .eq('paciente_id', pacienteId)
    .eq('estado', 'activo')
    .limit(1);

  if (excluirId) {
    query = query.neq('id', excluirId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'No se pudo validar el internamiento activo.');
  }

  return (data || []).length > 0;
}

async function cerrarEmergenciaOrigenSiAplica(emergenciaId) {
  if (!emergenciaId) return true;

  const { error } = await supabase
    .from('emergencias')
    .update({
      estado: 'de alta',
      estado_clinico: 'de alta',
      fecha_salida: new Date().toISOString(),
      internamiento_generado: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', emergenciaId);

  if (error) {
    throw new Error(error.message || 'No se pudo cerrar la emergencia origen.');
  }

  return true;
}

async function enlazarInternamientoConEmergencia(emergenciaId, internamientoId) {
  if (!emergenciaId || !internamientoId) return true;

  const { error } = await supabase
    .from('emergencias')
    .update({
      internamiento_generado: true,
      internamiento_id: internamientoId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', emergenciaId);

  if (error) {
    throw new Error(error.message || 'No se pudo enlazar la emergencia con el internamiento.');
  }

  return true;
}

async function obtenerPrecioProducto(productoId) {
  if (!productoId) return 0;

  const { data, error } = await supabase
    .from('productos')
    .select('id, precio_venta')
    .eq('id', productoId)
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo obtener el precio del producto.');
  }

  return Number(data?.precio_venta || 0);
}

function construirBarcodePrefactura(texto = '') {
  return `*${String(texto || '').replace(/\s+/g, '').toUpperCase()}*`;
}

async function generarNumeroPrefacturaFallback() {
  const { data, error } = await supabase
    .from('internamientos')
    .select('prefactura_numero')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return `PFIN-${Date.now()}`;

  let max = 0;

  for (const row of data || []) {
    const limpio = String(row?.prefactura_numero || '').replace(/[^\d]/g, '');
    const numero = Number(limpio || 0);
    if (numero > max) max = numero;
  }

  return `PFIN-${String(max + 1).padStart(6, '0')}`;
}

/* =========================================================
   PACIENTES
========================================================= */
export async function buscarPacientesInternamiento(filtro = '') {
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

/* =========================================================
   MÉDICOS
========================================================= */
export async function listarMedicosInternamiento() {
  const { data, error } = await supabase
    .from('medicos')
    .select(`
      id,
      codigo,
      nombre,
      apellido,
      activo,
      exequatur,
      especialidades (
        id,
        nombre
      )
    `)
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los médicos.');
  }

  return data || [];
}

/* =========================================================
   HABITACIONES / CAMAS
========================================================= */
export async function listarCamasDisponibles() {
  const { data, error } = await supabase
    .from('camas')
    .select(`
      id,
      codigo,
      disponible,
      habitacion_id,
      habitaciones (
        id,
        numero,
        tipo,
        piso,
        activa
      )
    `)
    .order('codigo', { ascending: true });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las camas.');
  }

  return data || [];
}

export async function listarHabitacionesDisponibles() {
  const camas = await listarCamasDisponibles();
  const habitacionesMap = new Map();

  for (const cama of camas) {
    const habitacion = cama.habitaciones;
    if (!habitacion?.id) continue;
    if (habitacion.activa === false) continue;

    if (!habitacionesMap.has(habitacion.id)) {
      habitacionesMap.set(habitacion.id, {
        id: habitacion.id,
        numero: habitacion.numero || '',
        tipo: habitacion.tipo || '',
        piso: habitacion.piso || '',
        activa: habitacion.activa ?? true,
        camas: [],
        camas_disponibles: 0,
        disponible: false,
      });
    }

    const actual = habitacionesMap.get(habitacion.id);

    actual.camas.push({
      id: cama.id,
      codigo: cama.codigo,
      disponible: !!cama.disponible,
    });

    if (cama.disponible) {
      actual.camas_disponibles += 1;
      actual.disponible = true;
    }
  }

  return Array.from(habitacionesMap.values())
    .filter((h) => h.disponible)
    .sort((a, b) =>
      String(a.numero || '').localeCompare(String(b.numero || ''), 'es', {
        numeric: true,
        sensitivity: 'base',
      })
    );
}

/* =========================================================
   EMERGENCIAS
========================================================= */
export async function listarEmergenciasAbiertas() {
  const { data, error } = await supabase
    .from('emergencias')
    .select(`
      id,
      paciente_id,
      medico_id,
      diagnostico_principal_id,
      diagnostico_nota,
      motivo_id,
      motivo_nota,
      tratamiento_principal_id,
      tratamiento_nota,
      estado,
      estado_clinico,
      fecha_ingreso,
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
      motivos_consulta ( id, nombre ),
      diagnosticos ( id, codigo, nombre )
    `)
    .or('estado.eq.abierta,estado.eq.abierto,estado_clinico.eq.abierta')
    .order('fecha_ingreso', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las emergencias.');
  }

  return data || [];
}

/* =========================================================
   PRODUCTOS / MEDICAMENTOS
========================================================= */
export async function listarProductosInternamiento(filtro = '') {
  let query = supabase
    .from('productos')
    .select(`
      id,
      codigo,
      nombre,
      precio_venta,
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

/* =========================================================
   INTERNAMIENTOS
========================================================= */
export async function listarInternamientos(filtros = {}) {
  let query = supabase
    .from('internamientos')
    .select(`
      id,
      paciente_id,
      cama_id,
      medico_id,
      diagnostico_ingreso_id,
      diagnostico_ingreso_nota,
      motivo_ingreso_id,
      motivo_ingreso_nota,
      nota_ingreso,
      autorizacion_numero,
      fecha_ingreso,
      fecha_alta,
      estado,
      estado_facturacion,
      origen_ingreso,
      prefactura_numero,
      total_bruto,
      total_neto,
      monto_diferencia,
      porcentaje_cobertura,
      monto_cobertura,
      updated_at,
      creado_desde,
      emergencia_origen_id,
      factura_id,
      tratamiento_cerrado,
      pacientes (
        id,
        record,
        nombre,
        apellido,
        cedula,
        correo,
        fecha_nacimiento,
        sexo,
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
        pacientes_seguro (
          id,
          numero_afiliado,
          activo,
          ars (
            id,
            nombre,
            codigo
          )
        )
      ),
      medicos (
        id,
        codigo,
        nombre,
        apellido,
        exequatur
      ),
      camas (
        id,
        codigo,
        disponible,
        habitacion_id,
        habitaciones (
          id,
          numero,
          tipo,
          piso,
          activa
        )
      ),
      diagnosticos ( id, codigo, nombre ),
      motivos_consulta ( id, nombre )
    `)
    .order('fecha_ingreso', { ascending: false });

  if (filtros.pacienteId) {
    query = query.eq('paciente_id', filtros.pacienteId);
  }

  if (filtros.estado) {
    query = query.eq('estado', filtros.estado);
  }

  if (filtros.desde) {
    query = query.gte('fecha_ingreso', filtros.desde);
  }

  if (filtros.filtro?.trim()) {
    const texto = filtros.filtro.trim();
    query = query.or(
      `diagnostico_ingreso_nota.ilike.%${texto}%,motivo_ingreso_nota.ilike.%${texto}%,nota_ingreso.ilike.%${texto}%,autorizacion_numero.ilike.%${texto}%,origen_ingreso.ilike.%${texto}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los internamientos.');
  }

  return (data || []).map(mapearInternamientoConSeguro);
}

export async function obtenerInternamientoPorId(id) {
  const { data, error } = await supabase
    .from('internamientos')
    .select(`
      id,
      paciente_id,
      cama_id,
      medico_id,
      diagnostico_ingreso_id,
      diagnostico_ingreso_nota,
      motivo_ingreso_id,
      motivo_ingreso_nota,
      nota_ingreso,
      autorizacion_numero,
      fecha_ingreso,
      fecha_alta,
      estado,
      estado_facturacion,
      origen_ingreso,
      prefactura_numero,
      total_bruto,
      total_neto,
      monto_diferencia,
      porcentaje_cobertura,
      monto_cobertura,
      updated_at,
      creado_desde,
      emergencia_origen_id,
      factura_id,
      tratamiento_cerrado,
      pacientes (
        id,
        record,
        nombre,
        apellido,
        cedula,
        correo,
        fecha_nacimiento,
        sexo,
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
        pacientes_seguro (
          id,
          numero_afiliado,
          activo,
          ars (
            id,
            nombre,
            codigo
          )
        )
      ),
      medicos (
        id,
        codigo,
        nombre,
        apellido,
        exequatur
      ),
      camas (
        id,
        codigo,
        disponible,
        habitacion_id,
        habitaciones (
          id,
          numero,
          tipo,
          piso,
          activa
        )
      ),
      diagnosticos ( id, codigo, nombre ),
      motivos_consulta ( id, nombre )
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo cargar el internamiento.');
  }

  return mapearInternamientoConSeguro(data);
}

export async function crearInternamiento(payload) {
  if (!payload.paciente_id) {
    throw new Error('Debe seleccionar un paciente.');
  }

  const existe = await existeInternamientoActivoPaciente(payload.paciente_id);
  if (existe) {
    throw new Error('Este paciente ya tiene un internamiento activo.');
  }

  const habitacionId = payload.habitacion_id || null;
  let camaAsignadaId = null;

  if (!habitacionId) {
    throw new Error('Debe seleccionar una habitación.');
  }

  camaAsignadaId = await obtenerCamaDisponiblePorHabitacion(habitacionId);
  if (!camaAsignadaId) {
    throw new Error('La habitación seleccionada no tiene camas disponibles.');
  }

  const vieneDeEmergencia = Boolean(payload.emergencia_origen_id);

  const numeroPrefactura = await generarNumeroPrefacturaFallback();

  const datos = {
    paciente_id: payload.paciente_id,
    cama_id: camaAsignadaId,
    medico_id: payload.medico_id || null,
    diagnostico_ingreso_id: payload.diagnostico_ingreso_id || null,
    diagnostico_ingreso_nota: payload.diagnostico_ingreso_nota?.trim() || '',
    motivo_ingreso_id: payload.motivo_ingreso_id || null,
    motivo_ingreso_nota: payload.motivo_ingreso_nota?.trim() || '',
    nota_ingreso: payload.nota_ingreso?.trim() || '',
    autorizacion_numero: payload.autorizacion_numero?.trim() || null,
    estado: 'activo',
    estado_facturacion: 'pendiente',
    creado_desde: vieneDeEmergencia ? 'emergencia' : 'ingreso',
    origen_ingreso: vieneDeEmergencia ? 'emergencia' : 'ingreso',
    emergencia_origen_id: payload.emergencia_origen_id || null,
    tratamiento_cerrado: payload.tratamiento_cerrado ?? false,
    prefactura_numero: payload.prefactura_numero || numeroPrefactura,
  };

  const { data, error } = await supabase
    .from('internamientos')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo registrar el internamiento.');
  }

  if (camaAsignadaId) {
    await actualizarEstadoCama(camaAsignadaId, false);
  }

  if (payload.emergencia_origen_id) {
    await cerrarEmergenciaOrigenSiAplica(payload.emergencia_origen_id);
    await enlazarInternamientoConEmergencia(payload.emergencia_origen_id, data.id);
  }

  return data;
}

export async function actualizarInternamiento(id, payload, internamientoAnterior = null) {
  if (!id) {
    throw new Error('Falta el ID del internamiento.');
  }

  const anterior =
    internamientoAnterior?.id ? internamientoAnterior : await obtenerInternamientoPorId(id);

  if (payload.paciente_id && payload.paciente_id !== anterior?.paciente_id) {
    const existe = await existeInternamientoActivoPaciente(payload.paciente_id, id);
    if (existe) {
      throw new Error('Este paciente ya tiene un internamiento activo.');
    }
  }

  const camaAnteriorId = anterior?.cama_id || null;
  const habitacionAnteriorId =
    anterior?.habitacion?.id || anterior?.camas?.habitaciones?.id || null;

  let camaNuevaId = camaAnteriorId;

  if (payload.habitacion_id) {
    const cambioHabitacion = payload.habitacion_id !== habitacionAnteriorId;

    if (cambioHabitacion) {
      camaNuevaId = await obtenerCamaDisponiblePorHabitacion(payload.habitacion_id);
      if (!camaNuevaId) {
        throw new Error('La habitación seleccionada no tiene camas disponibles.');
      }
    }
  }

  const vieneDeEmergencia = Boolean(payload.emergencia_origen_id);
  const estadoNormalizado = payload.estado === 'alta' ? 'alta' : 'activo';

  const datos = {
    paciente_id: payload.paciente_id,
    cama_id: camaNuevaId || null,
    medico_id: payload.medico_id || null,
    diagnostico_ingreso_id: payload.diagnostico_ingreso_id || null,
    diagnostico_ingreso_nota: payload.diagnostico_ingreso_nota?.trim() || '',
    motivo_ingreso_id: payload.motivo_ingreso_id || null,
    motivo_ingreso_nota: payload.motivo_ingreso_nota?.trim() || '',
    nota_ingreso: payload.nota_ingreso?.trim() || '',
    autorizacion_numero: payload.autorizacion_numero?.trim() || null,
    estado: estadoNormalizado,
    estado_facturacion:
      payload.estado_facturacion || anterior?.estado_facturacion || 'pendiente',
    creado_desde: vieneDeEmergencia ? 'emergencia' : 'ingreso',
    origen_ingreso: vieneDeEmergencia ? 'emergencia' : 'ingreso',
    emergencia_origen_id: payload.emergencia_origen_id || null,
    tratamiento_cerrado: payload.tratamiento_cerrado ?? false,
    fecha_alta:
      estadoNormalizado === 'alta'
        ? payload.fecha_alta || new Date().toISOString()
        : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('internamientos')
    .update(datos)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el internamiento.');
  }

  if (camaAnteriorId && camaAnteriorId !== camaNuevaId) {
    await actualizarEstadoCama(camaAnteriorId, true);
  }

  if (camaNuevaId && camaNuevaId !== camaAnteriorId) {
    await actualizarEstadoCama(camaNuevaId, false);
  }

  if (estadoNormalizado === 'alta' && camaNuevaId) {
    await actualizarEstadoCama(camaNuevaId, true);
  }

  return data;
}

export async function darAltaInternamiento(id) {
  const actual = await obtenerInternamientoPorId(id);

  const { data, error } = await supabase
    .from('internamientos')
    .update({
      estado: 'alta',
      estado_facturacion:
        actual?.estado_facturacion === 'facturado'
          ? 'facturado'
          : 'pendiente',
      fecha_alta: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo dar de alta el internamiento.');
  }

  if (actual?.cama_id) {
    await actualizarEstadoCama(actual.cama_id, true);
  }

  return data;
}

export async function eliminarInternamiento(id, camaId = null) {
  const { error } = await supabase
    .from('internamientos')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message || 'No se pudo eliminar el internamiento.');
  }

  if (camaId) {
    await actualizarEstadoCama(camaId, true);
  }

  return true;
}

/* =========================================================
   ÓRDENES MÉDICAS
========================================================= */
export async function registrarOrdenMedica(payload) {
  if (!payload.internamiento_id) {
    throw new Error('Debe indicar el internamiento.');
  }

  const datos = {
    internamiento_id: payload.internamiento_id,
    medico_id: payload.medico_id || null,
    indicacion: payload.indicacion?.trim() || '',
    estado: 'activa',
  };

  const { data, error } = await supabase
    .from('ordenes_medicas')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo registrar la orden médica.');
  }

  return data;
}

export async function listarOrdenesMedicas(internamientoId) {
  const { data, error } = await supabase
    .from('ordenes_medicas')
    .select(`
      id,
      internamiento_id,
      medico_id,
      indicacion,
      fecha,
      estado,
      medicos (
        id,
        codigo,
        nombre,
        apellido
      )
    `)
    .eq('internamiento_id', internamientoId)
    .order('fecha', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las órdenes médicas.');
  }

  return data || [];
}

/* =========================================================
   MEDICACIÓN
========================================================= */
export async function agregarMedicacionInternamiento(payload) {
  if (!payload.orden_id) {
    throw new Error('Debe seleccionar una orden médica.');
  }

  if (!payload.producto_id) {
    throw new Error('Debe seleccionar un medicamento.');
  }

  const { data: orden, error: errorOrden } = await supabase
    .from('ordenes_medicas')
    .select('id, internamiento_id')
    .eq('id', payload.orden_id)
    .single();

  if (errorOrden) {
    throw new Error(errorOrden.message || 'No se pudo validar la orden médica.');
  }

  const { data: existente, error: errorExistente } = await supabase
    .from('medicacion_internamiento')
    .select('id')
    .eq('internamiento_id', orden.internamiento_id)
    .eq('orden_id', payload.orden_id)
    .eq('producto_id', payload.producto_id)
    .eq('estado', 'activa')
    .maybeSingle();

  if (errorExistente) {
    throw new Error(errorExistente.message || 'No se pudo validar la medicación.');
  }

  if (existente?.id) {
    throw new Error('Ese medicamento ya está registrado en esa orden médica.');
  }

  const datos = {
    orden_id: payload.orden_id,
    internamiento_id: orden.internamiento_id,
    producto_id: payload.producto_id,
    dosis: payload.dosis?.trim() || '',
    frecuencia: payload.frecuencia?.trim() || '',
    via: payload.via?.trim() || '',
    activa: true,
    estado: 'activa',
  };

  const { data, error } = await supabase
    .from('medicacion_internamiento')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo registrar la medicación.');
  }

  return data;
}

export async function listarMedicacionInternamiento(internamientoId) {
  const { data, error } = await supabase
    .from('medicacion_internamiento')
    .select(`
      id,
      internamiento_id,
      orden_id,
      producto_id,
      dosis,
      frecuencia,
      via,
      activa,
      estado,
      created_at,
      productos (
        id,
        codigo,
        nombre,
        precio_venta
      ),
      ordenes_medicas (
        id,
        indicacion,
        fecha
      )
    `)
    .eq('internamiento_id', internamientoId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudo cargar la medicación.');
  }

  return data || [];
}

export async function actualizarMedicacionInternamiento(id, payload) {
  const datos = {
    producto_id: payload.producto_id || null,
    dosis: payload.dosis?.trim() || '',
    frecuencia: payload.frecuencia?.trim() || '',
    via: payload.via?.trim() || '',
    estado: payload.estado || 'activa',
  };

  const { data, error } = await supabase
    .from('medicacion_internamiento')
    .update(datos)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar la medicación.');
  }

  return data;
}

export async function eliminarMedicacionInternamiento(id) {
  const { error } = await supabase
    .from('medicacion_internamiento')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message || 'No se pudo eliminar la medicación.');
  }

  return true;
}

/* =========================================================
   ADMINISTRACIÓN DE MEDICACIÓN
========================================================= */
export async function registrarAplicacionMedicacion(payload) {
  if (!payload.medicacion_id) {
    throw new Error('Debe indicar la medicación.');
  }

  if (!payload.internamiento_id) {
    throw new Error('Debe indicar el internamiento.');
  }

  const datos = {
    medicacion_id: payload.medicacion_id,
    internamiento_id: payload.internamiento_id,
    aplicado_por: payload.aplicado_por || null,
    fecha_aplicacion: new Date().toISOString(),
    estado: payload.estado || 'aplicada',
    nota: payload.nota?.trim() || null,
  };

  const { data, error } = await supabase
    .from('administracion_medicacion')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo registrar la administración de medicación.');
  }

  return data;
}

export async function listarAdministracionMedicacion(internamientoId) {
  const { data, error } = await supabase
    .from('administracion_medicacion')
    .select(`
      id,
      medicacion_id,
      internamiento_id,
      aplicado_por,
      fecha_programada,
      fecha_aplicacion,
      estado,
      nota,
      created_at,
      updated_at,
      medicacion_internamiento (
        id,
        dosis,
        frecuencia,
        via,
        productos (
          id,
          codigo,
          nombre
        )
      ),
      usuarios:aplicado_por (
        id,
        username,
        nombre,
        apellido
      )
    `)
    .eq('internamiento_id', internamientoId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudo cargar la administración de medicación.');
  }

  return data || [];
}

/* =========================================================
   NOTAS DE ENFERMERÍA
========================================================= */
export async function guardarNotaEnfermeriaInternamiento(payload) {
  if (!payload.internamiento_id) {
    throw new Error('Debe indicar el internamiento.');
  }

  if (!payload.nota?.trim()) {
    throw new Error('Debe escribir una nota de enfermería.');
  }

  const datos = {
    internamiento_id: payload.internamiento_id,
    medicacion_id: payload.medicacion_id || null,
    usuario_id: payload.usuario_id || null,
    paciente_resumen: payload.paciente_resumen || null,
    habitacion_resumen: payload.habitacion_resumen || null,
    medicamento_resumen: payload.medicamento_resumen || null,
    nota: payload.nota.trim(),
  };

  const { data, error } = await supabase
    .from('notas_enfermeria_internamiento')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo guardar la nota de enfermería.');
  }

  return data;
}

export async function listarNotasEnfermeriaInternamiento(internamientoId) {
  const { data, error } = await supabase
    .from('notas_enfermeria_internamiento')
    .select(`
      id,
      internamiento_id,
      medicacion_id,
      usuario_id,
      paciente_resumen,
      habitacion_resumen,
      medicamento_resumen,
      nota,
      fecha,
      created_at,
      updated_at,
      usuarios (
        id,
        username,
        nombre,
        apellido
      )
    `)
    .eq('internamiento_id', internamientoId)
    .order('fecha', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las notas de enfermería.');
  }

  return data || [];
}

/* =========================================================
   INSUMOS / MATERIALES
========================================================= */
export async function agregarInsumoInternamiento(payload) {
  const cantidad = Number(payload.cantidad || 0);
  const precio =
    payload.precio_unitario !== undefined &&
    payload.precio_unitario !== null &&
    payload.precio_unitario !== ''
      ? Number(payload.precio_unitario)
      : await obtenerPrecioProducto(payload.producto_id);

  if (!payload.internamiento_id) {
    throw new Error('Debe indicar el internamiento.');
  }

  if (!payload.producto_id) {
    throw new Error('Debe seleccionar un producto.');
  }

  if (!cantidad || cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor que cero.');
  }

  const datos = {
    internamiento_id: payload.internamiento_id,
    producto_id: payload.producto_id,
    nota_enfermeria_id: payload.nota_enfermeria_id || null,
    cantidad,
    precio_unitario: Number.isNaN(precio) ? 0 : precio,
    creado_por: payload.creado_por || null,
    origen_registro: payload.origen_registro || 'enfermeria',
  };

  const { data, error } = await supabase
    .from('internamiento_insumos')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo agregar el insumo.');
  }

  return data;
}

export async function listarInsumosInternamiento(internamientoId) {
  const { data, error } = await supabase
    .from('internamiento_insumos')
    .select(`
      id,
      internamiento_id,
      nota_enfermeria_id,
      producto_id,
      cantidad,
      precio_unitario,
      subtotal,
      fecha,
      creado_por,
      productos (
        id,
        codigo,
        nombre,
        categorias_productos (
          id,
          nombre
        )
      ),
      usuarios:creado_por (
        id,
        username,
        nombre,
        apellido
      )
    `)
    .eq('internamiento_id', internamientoId)
    .order('fecha', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los insumos.');
  }

  return data || [];
}

export async function agregarInsumoNotaEnfermeria(payload) {
  return agregarInsumoInternamiento({
    internamiento_id: payload.internamiento_id,
    nota_enfermeria_id: payload.nota_enfermeria_id,
    producto_id: payload.producto_id,
    cantidad: payload.cantidad,
    precio_unitario: payload.precio_unitario,
    creado_por: payload.creado_por,
    origen_registro: 'enfermeria',
  });
}

export async function listarInsumosNotaEnfermeria(notaEnfermeriaId) {
  const { data, error } = await supabase
    .from('internamiento_insumos')
    .select(`
      id,
      internamiento_id,
      nota_enfermeria_id,
      producto_id,
      cantidad,
      precio_unitario,
      subtotal,
      fecha,
      creado_por,
      productos (
        id,
        codigo,
        nombre,
        categorias_productos (
          id,
          nombre
        )
      ),
      usuarios:creado_por (
        id,
        username,
        nombre,
        apellido
      )
    `)
    .eq('nota_enfermeria_id', notaEnfermeriaId)
    .order('fecha', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los materiales de la nota.');
  }

  return data || [];
}

export async function actualizarCantidadInsumoNotaEnfermeria(id, cantidad) {
  const cantidadNumero = Number(cantidad || 0);

  if (!cantidadNumero || cantidadNumero <= 0) {
    throw new Error('La cantidad debe ser mayor que cero.');
  }

  const { data, error } = await supabase
    .from('internamiento_insumos')
    .update({
      cantidad: cantidadNumero,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar la cantidad del material.');
  }

  return data;
}

/* =========================================================
   ANALÍTICAS
========================================================= */
export async function listarAnaliticasInternamiento(internamientoId) {
  const { data, error } = await supabase
    .from('internamiento_analiticas')
    .select(`
      id,
      internamiento_id,
      analitica_id,
      solicitada_por,
      estado,
      observacion,
      marcada_por,
      fecha_marcada,
      created_at,
      updated_at,
      analiticas (
        id,
        codigo,
        nombre,
        precio
      ),
      medicos:solicitada_por (
        id,
        codigo,
        nombre,
        apellido
      ),
      usuarios:marcada_por (
        id,
        username,
        nombre,
        apellido
      )
    `)
    .eq('internamiento_id', internamientoId)
    .order('created_at', { ascending: false });

  if (error) {
    return [];
  }

  return data || [];
}

export async function marcarAnaliticaInternamiento(id, estado, usuarioId, observacion = '') {
  const datos = {
    estado,
    marcada_por: usuarioId || null,
    fecha_marcada: new Date().toISOString(),
    observacion: observacion?.trim() || null,
  };

  const { data, error } = await supabase
    .from('internamiento_analiticas')
    .update(datos)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar la analítica.');
  }

  return data;
}

/* =========================================================
   PREFACTURA / IMPRESIÓN
========================================================= */
export async function generarPrefacturaInternamiento(internamientoId) {
  const internamiento = await obtenerInternamientoPorId(internamientoId);
  const [meds, insumos] = await Promise.all([
    listarMedicacionInternamiento(internamientoId),
    listarInsumosInternamiento(internamientoId),
  ]);

  const items = [];

  meds.forEach((m) => {
    const precio = Number(m?.productos?.precio_venta || 0);
    items.push({
      tipo_item: 'medicacion',
      referencia_id: m.id,
      descripcion: `Medicamento: ${m?.productos?.nombre || '-'}`,
      cantidad: 1,
      precio_unitario: precio,
    });
  });

  insumos.forEach((i) => {
    items.push({
      tipo_item: 'insumo',
      referencia_id: i.id,
      descripcion: `Insumo: ${i?.productos?.nombre || '-'}`,
      cantidad: Number(i?.cantidad || 0),
      precio_unitario: Number(i?.precio_unitario || 0),
    });
  });

  await supabase
    .from('internamientos_prefactura_detalle')
    .delete()
    .eq('internamiento_id', internamientoId);

  if (items.length > 0) {
    const detalles = items.map((item) => ({
      internamiento_id: internamientoId,
      ...item,
    }));

    const { error: errorDetalles } = await supabase
      .from('internamientos_prefactura_detalle')
      .insert(detalles);

    if (errorDetalles) {
      throw new Error(errorDetalles.message || 'No se pudo generar el detalle de prefactura.');
    }
  }

  const totalBruto = items.reduce(
    (acc, item) => acc + Number(item.cantidad || 0) * Number(item.precio_unitario || 0),
    0
  );

  const porcentajeCobertura = Number(internamiento?.porcentaje_cobertura || 0);
  const montoCobertura = Number(((totalBruto * porcentajeCobertura) / 100).toFixed(2));
  const montoDiferencia = Number((totalBruto - montoCobertura).toFixed(2));
  const totalNeto = montoDiferencia;

  const { data: actualizado, error } = await supabase
    .from('internamientos')
    .update({
      estado_facturacion: 'prefacturado',
      total_bruto: totalBruto,
      monto_cobertura: montoCobertura,
      monto_diferencia: montoDiferencia,
      total_neto: totalNeto,
      updated_at: new Date().toISOString(),
    })
    .eq('id', internamientoId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar la prefactura del internamiento.');
  }

  return {
    internamiento: actualizado,
    barcode: construirBarcodePrefactura(actualizado?.prefactura_numero || actualizado?.id),
    items,
    total_bruto: totalBruto,
    total_neto: totalNeto,
    monto_diferencia: montoDiferencia,
    paciente: internamiento?.pacientes || null,
    habitacion: internamiento?.habitacion || internamiento?.camas?.habitaciones || null,
  };
}

export async function obtenerResumenImpresionInternamiento(internamientoId) {
  const internamiento = await obtenerInternamientoPorId(internamientoId);
  const [
    ordenes,
    medicacion,
    historialMedicacion,
    notas,
    insumos,
    analiticas,
  ] = await Promise.all([
    listarOrdenesMedicas(internamientoId),
    listarMedicacionInternamiento(internamientoId),
    listarAdministracionMedicacion(internamientoId),
    listarNotasEnfermeriaInternamiento(internamientoId),
    listarInsumosInternamiento(internamientoId),
    listarAnaliticasInternamiento(internamientoId),
  ]);

  return {
    internamiento,
    ordenes,
    medicacion,
    historialMedicacion,
    notas,
    insumos,
    analiticas,
  };
}