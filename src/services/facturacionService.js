import { supabase } from '../lib/supabaseClient'

/* =========================================================
   HELPERS
========================================================= */

function limpiarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : ''
}

function normalizarNumero(valor, porDefecto = 0) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : porDefecto
}

function fechaIsoActual() {
  return new Date().toISOString()
}

function construirNombrePaciente(paciente) {
  if (!paciente) return ''
  return `${paciente.nombre || ''} ${paciente.apellido || ''}`.trim()
}

function obtenerSeguroActivoDesdePaciente(paciente) {
  const lista = paciente?.pacientes_seguro || []
  return lista.find((s) => s?.activo) || lista[0] || null
}

function obtenerTelefonoPrincipalDesdePaciente(paciente) {
  return paciente?.pacientes_telefonos?.[0]?.telefono || ''
}

function obtenerDireccionPrincipalDesdePaciente(paciente) {
  return (
    paciente?.pacientes_direcciones?.find((d) => d?.principal) ||
    paciente?.pacientes_direcciones?.[0] ||
    null
  )
}

function mapearPacienteFacturacion(paciente) {
  if (!paciente) return paciente

  const seguroActivo = obtenerSeguroActivoDesdePaciente(paciente)
  const telefonoPrincipal = obtenerTelefonoPrincipalDesdePaciente(paciente)
  const direccionPrincipal = obtenerDireccionPrincipalDesdePaciente(paciente)

  return {
    ...paciente,
    nombre_completo: construirNombrePaciente(paciente),
    numero_afiliado: seguroActivo?.numero_afiliado || '',
    plan_seguro: seguroActivo?.plan || '',
    aseguradora_nombre: seguroActivo?.ars?.nombre || '',
    aseguradora_id: seguroActivo?.ars_id || seguroActivo?.ars?.id || null,
    telefono: telefonoPrincipal,
    direccion: direccionPrincipal?.direccion || '',
    ciudad: direccionPrincipal?.ciudad || '',
    provincia: direccionPrincipal?.provincia || '',
  }
}

async function rpcSeguro(fn, params = {}, fallback = null) {
  try {
    const { data, error } = await supabase.rpc(fn, params)
    if (error) {
      if (fallback !== null) return fallback
      throw new Error(error.message || `No se pudo ejecutar ${fn}.`)
    }
    return data
  } catch (err) {
    if (fallback !== null) return fallback
    throw err
  }
}

async function ejecutarPostProcesoFactura(facturaId) {
  if (!facturaId) return
  try { await supabase.rpc('fn_facturacion_recalcular_totales', { p_factura_id: facturaId }) } catch (e) { }
  try { await supabase.rpc('fn_facturacion_refrescar_snapshot', { p_factura_id: facturaId }) } catch (e) { }
  try { await supabase.rpc('fn_facturacion_sincronizar_seguro', { p_factura_id: facturaId }) } catch (e) { }
}

/* =========================================================
   PACIENTES
========================================================= */

export async function buscarPacientesFacturacion(filtro = '') {
  let query = supabase
    .from('pacientes')
    .select(`
      id, record, nombre, apellido, cedula, correo, fecha_nacimiento, sexo,
      pacientes_telefonos (id, telefono, tipo),
      pacientes_direcciones (id, direccion, ciudad, provincia, principal),
      pacientes_seguro (id, ars_id, numero_afiliado, plan, activo, ars(id, nombre, codigo))
    `)
    .order('nombre', { ascending: true })

  if (filtro?.trim()) {
    const texto = filtro.trim()
    query = query.or(`record.ilike.%${texto}%,nombre.ilike.%${texto}%,apellido.ilike.%${texto}%,cedula.ilike.%${texto}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message || 'No se pudieron cargar los pacientes.')

  return (data || []).map(mapearPacienteFacturacion)
}

/* =========================================================
   PENDIENTES GENERALES DE FACTURACION
========================================================= */

export async function listarPendientesFacturacion(filtro = '') {
  const [emergenciasResp, internamientosResp, laboratoriosResp] = await Promise.all([
    supabase.from('emergencias').select('id, paciente_id, medico_id, motivo, fecha_ingreso, pacientes(nombre, apellido, record, cedula, pacientes_seguro(ars(nombre)))').in('estado_facturacion', ['sin_facturar', 'prefacturada']),
    supabase.from('internamientos').select('id, paciente_id, medico_id, diagnostico_ingreso, fecha_ingreso, pacientes(nombre, apellido, record, cedula, pacientes_seguro(ars(nombre)))').in('estado_facturacion', ['pendiente', 'prefacturado']),
    supabase.from('laboratorio_solicitudes').select('id, paciente_id, medico_id, codigo, fecha, pacientes(nombre, apellido, record, cedula, pacientes_seguro(ars(nombre)))').eq('facturada', false)
  ])

  const emergencias = (emergenciasResp.data || []).map((e) => {
    const ars = e.pacientes?.pacientes_seguro?.[0]?.ars?.nombre || '';
    return {
      origen: 'emergencia', referencia_id: e.id, paciente_id: e.paciente_id, medico_id: e.medico_id,
      descripcion: e.motivo || 'Emergencia', fecha_origen: e.fecha_ingreso,
      nombre: e.pacientes?.nombre || '', apellido: e.pacientes?.apellido || '',
      record: e.pacientes?.record || '', cedula: e.pacientes?.cedula || '',
      ars_nombre: ars, pendiente_facturar: true, tipo: 'emergencia'
    }
  })

  const internamientos = (internamientosResp.data || []).map((i) => {
    const ars = i.pacientes?.pacientes_seguro?.[0]?.ars?.nombre || '';
    return {
      origen: 'internamiento', referencia_id: i.id, paciente_id: i.paciente_id, medico_id: i.medico_id,
      descripcion: i.diagnostico_ingreso || 'Internamiento', fecha_origen: i.fecha_ingreso,
      nombre: i.pacientes?.nombre || '', apellido: i.pacientes?.apellido || '',
      record: i.pacientes?.record || '', cedula: i.pacientes?.cedula || '',
      ars_nombre: ars, pendiente_facturar: true, tipo: 'internamiento'
    }
  })

  const laboratorios = (laboratoriosResp.data || []).map((l) => {
    const ars = l.pacientes?.pacientes_seguro?.[0]?.ars?.nombre || '';
    return {
      origen: 'laboratorio', referencia_id: l.id, paciente_id: l.paciente_id, medico_id: l.medico_id,
      descripcion: l.codigo || 'Solicitud de laboratorio', fecha_origen: l.fecha,
      nombre: l.pacientes?.nombre || '', apellido: l.pacientes?.apellido || '',
      record: l.pacientes?.record || '', cedula: l.pacientes?.cedula || '',
      ars_nombre: ars, pendiente_facturar: true, tipo: 'laboratorio'
    }
  })

  let lista = [...emergencias, ...internamientos, ...laboratorios].sort((a, b) => new Date(b.fecha_origen || 0) - new Date(a.fecha_origen || 0))

  if (filtro?.trim()) {
    const texto = filtro.trim().toLowerCase()
    lista = lista.filter((item) => (
      String(item.origen || '').toLowerCase().includes(texto) ||
      String(item.descripcion || '').toLowerCase().includes(texto) ||
      String(item.nombre || '').toLowerCase().includes(texto) ||
      String(item.record || '').toLowerCase().includes(texto) ||
      String(item.cedula || '').toLowerCase().includes(texto)
    ))
  }

  return lista
}

/* =========================================================
   FACTURAS 
========================================================= */

export async function listarFacturas(filtros = {}) {
  let query = supabase
    .from('facturas')
    .select('*, pacientes(nombre, apellido, cedula, record), ars(nombre)')
    .order('fecha', { ascending: false })
    .limit(100)

  if (filtros.estado) query = query.eq('estado', filtros.estado)
  if (filtros.origen_principal) query = query.eq('origen_principal', filtros.origen_principal)
  if (filtros.tipo_factura) query = query.eq('tipo_factura', filtros.tipo_factura)

  const { data, error } = await query
  if (error) throw new Error(error.message || 'No se pudieron cargar las facturas.')

  let lista = data || []

  if (filtros.filtro?.trim()) {
    const texto = filtros.filtro.trim().toLowerCase()
    lista = lista.filter((f) => (
      String(f.numero || '').toLowerCase().includes(texto) ||
      String(f.codigo_barra || '').toLowerCase().includes(texto) ||
      String(f.pacientes?.nombre || '').toLowerCase().includes(texto) ||
      String(f.pacientes?.cedula || '').toLowerCase().includes(texto) ||
      String(f.pacientes?.record || '').toLowerCase().includes(texto) ||
      String(f.ars?.nombre || '').toLowerCase().includes(texto)
    ))
  }

  return lista
}

export async function obtenerFacturaPorId(id) {
  const { data, error } = await supabase.from('facturas').select('*, pacientes(*), ars(nombre), medicos(nombre, apellido)').eq('id', id).single()
  if (error) throw new Error(error.message || 'No se pudo cargar la factura.')
  return data
}

export async function listarDetalleFactura(facturaId) {
  const { data, error } = await supabase.from('detalle_factura').select('*').eq('factura_id', facturaId).order('id', { ascending: true }) 
  if (error) throw new Error(error.message || 'No se pudo cargar el detalle de la factura.')
  return (data || []).map((item) => ({ ...item, codigo_mostrar: item.referencia_id || '', categoria_mostrar: item.departamento || item.area_origen || item.tipo_item || '' }))
}

export async function listarPagosFactura(facturaId) {
  const { data, error } = await supabase.from('pagos').select('*').eq('factura_id', facturaId).order('fecha', { ascending: false })
  if (error) throw new Error(error.message || 'No se pudieron cargar los pagos.')
  return data || []
}

export async function listarOrigenesFactura(facturaId) {
  const { data, error } = await supabase.from('factura_origenes').select('*').eq('factura_id', facturaId).order('created_at', { ascending: true })
  if (error) throw new Error(error.message || 'No se pudieron cargar los orígenes de la factura.')
  return data || []
}

export async function obtenerFacturasSeguro(facturaId) {
  const { data, error } = await supabase.from('facturas_seguro').select('*, ars(nombre)').eq('factura_id', facturaId).maybeSingle()
  if (error && error.code !== 'PGRST116') throw new Error(error.message || 'No se pudo cargar la información del seguro.')
  return data || null
}

export async function obtenerFacturaCompleta(id) {
  const [factura, detalle, pagos, origenes, seguro] = await Promise.all([obtenerFacturaPorId(id), listarDetalleFactura(id), listarPagosFactura(id), listarOrigenesFactura(id), obtenerFacturasSeguro(id)])
  return { factura, detalle, pagos, origenes, seguro }
}

/* =========================================================
   EMERGENCIAS / INTERNAMIENTOS / LABORATORIO PENDIENTES
========================================================= */

export async function listarEmergenciasPendientesPaciente(pacienteId) {
  if (!pacienteId) return []
  const { data, error } = await supabase.from('emergencias').select('id, motivo, fecha_ingreso, estado_facturacion, medicos(nombre)').eq('paciente_id', pacienteId).in('estado_facturacion', ['sin_facturar', 'prefacturada']).order('fecha_ingreso', { ascending: false })
  if (error) throw new Error(error.message || 'No se pudieron cargar las emergencias pendientes.')
  return (data || []).map((item) => ({ ...item, medico_nombre: item.medicos?.nombre || '' }))
}

export async function listarInternamientosPendientesPaciente(pacienteId) {
  if (!pacienteId) return []
  const { data, error } = await supabase.from('internamientos').select('id, diagnostico_ingreso, fecha_ingreso, estado_facturacion, autorizacion_numero, medicos(nombre)').eq('paciente_id', pacienteId).in('estado_facturacion', ['pendiente', 'prefacturado']).order('fecha_ingreso', { ascending: false })
  if (error) throw new Error(error.message || 'No se pudieron cargar los internamientos pendientes.')
  return (data || []).map((item) => ({ ...item, medico_nombre: item.medicos?.nombre || '' }))
}

export async function listarLaboratoriosPendientesPaciente(pacienteId) {
  if (!pacienteId) return []
  const { data, error } = await supabase.from('laboratorio_solicitudes').select('id, codigo, fecha, facturada').eq('paciente_id', pacienteId).eq('facturada', false).order('fecha', { ascending: false })
  if (error) throw new Error(error.message || 'No se pudieron cargar las solicitudes de laboratorio pendientes.')
  return data || []
}

export async function listarDetalleLaboratorioSolicitud(solicitudId) {
  const { data, error } = await supabase.from('laboratorio_detalle').select('*, analiticas (id, codigo, nombre, precio)').eq('solicitud_id', solicitudId).order('id', { ascending: true }) 
  if (error) throw new Error(error.message || 'No se pudo cargar el detalle de laboratorio.')
  return data || []
}

export async function buscarLaboratorioPorNumeroFactura(numeroFactura) {
  const valor = limpiarTexto(numeroFactura)
  if (!valor) return []
  const { data, error } = await supabase.from('laboratorio_solicitudes').select('*, pacientes(nombre, apellido, cedula, record)').eq('numero_factura', valor)
  if (error) throw new Error(error.message || 'No se pudo buscar laboratorio por número de factura.')
  return data || []
}

/* =========================================================
   DETALLES CONSOLIDADOS PARA FACTURAR
========================================================= */

export async function obtenerDetalleConsolidadoEmergencia(emergenciaId) {
  if (!emergenciaId) return []
  const data = await rpcSeguro('fn_facturacion_detalle_emergencia', { p_emergencia_id: emergenciaId }, null)
  if (Array.isArray(data)) return data
  
  const { data: insumos } = await supabase.from('emergencia_insumos').select('*, productos(nombre, precio_venta, porcentaje_cobertura_default, departamento_facturacion)').eq('emergencia_id', emergenciaId);
  return (insumos || []).map(i => ({
    tipo_item: 'producto',
    referencia_id: i.producto_id,
    descripcion: i.productos?.nombre || 'Insumo',
    cantidad: i.cantidad,
    precio_unitario: i.productos?.precio_venta || 0,
    cobertura: 0,
    porcentaje_cobertura: i.productos?.porcentaje_cobertura_default || 0,
    origen_modulo: 'emergencias',
    departamento: i.productos?.departamento_facturacion || 'Emergencia'
  }));
}

export async function obtenerDetalleConsolidadoInternamiento(internamientoId) {
  if (!internamientoId) return []
  const data = await rpcSeguro('fn_facturacion_detalle_internamiento', { p_internamiento_id: internamientoId }, null)
  if (Array.isArray(data)) return data
  
  const { data: detalles } = await supabase.from('internamientos_prefactura_detalle').select('*').eq('internamiento_id', internamientoId);
  return detalles || [];
}

/* =========================================================
   CATALOGO / ORDENES NUEVAS
========================================================= */

export async function buscarCatalogo(textoBusqueda = '') {
  const valor = limpiarTexto(textoBusqueda)

  const [productosResp, analiticasResp, procesosResp] = await Promise.all([
    supabase.from('productos').select('id, codigo, nombre, precio_venta, activo, departamento_facturacion, area_origen_facturacion, porcentaje_cobertura_default').eq('activo', true).or(valor ? `codigo.ilike.%${valor}%,nombre.ilike.%${valor}%` : 'id.not.is.null').limit(80),
    supabase.from('analiticas').select('id, codigo, nombre, precio, activa, departamento, area_origen, porcentaje_cobertura_default').eq('activa', true).or(valor ? `codigo.ilike.%${valor}%,nombre.ilike.%${valor}%` : 'id.not.is.null').limit(80),
    supabase.from('procesos_clinicos').select('id, codigo, nombre, precio, activo, departamento, area_origen, porcentaje_cobertura_default').eq('activo', true).or(valor ? `codigo.ilike.%${valor}%,nombre.ilike.%${valor}%` : 'id.not.is.null').limit(80),
  ])

  const productos = (productosResp.data || []).map((p) => ({
    tipo: 'producto', tipo_item: 'producto', id: p.id, referencia_id: p.id,
    codigo: p.codigo, codigo_mostrar: p.codigo || 'PRODUCTO', descripcion: p.nombre, nombre: p.nombre,
    precio: normalizarNumero(p.precio_venta, 0), departamento: p.departamento_facturacion || 'Medicamento / Material',
    area_origen: p.area_origen_facturacion || 'Farmacia', porcentaje_cobertura_default: normalizarNumero(p.porcentaje_cobertura_default, 0),
    categoria_mostrar: p.departamento_facturacion || 'Producto', origen: 'catalogo',
  }))

  const analiticas = (analiticasResp.data || []).map((a) => ({
    tipo: 'analitica', tipo_item: 'analitica', id: a.id, referencia_id: a.id,
    codigo: a.codigo, codigo_mostrar: a.codigo || 'ANALITICA', descripcion: a.nombre, nombre: a.nombre,
    precio: normalizarNumero(a.precio, 0), departamento: a.departamento || 'Analítica',
    area_origen: a.area_origen || 'Laboratorio', porcentaje_cobertura_default: normalizarNumero(a.porcentaje_cobertura_default, 0),
    categoria_mostrar: 'Analítica', origen: 'catalogo',
  }))

  const procesos = (procesosResp.data || []).map((p) => ({
    tipo: 'servicio', tipo_item: 'servicio', id: p.id, referencia_id: p.id,
    codigo: p.codigo, codigo_mostrar: p.codigo || 'SERVICIO', descripcion: p.nombre, nombre: p.nombre,
    precio: normalizarNumero(p.precio, 0), departamento: p.departamento || 'Servicio',
    area_origen: p.area_origen || 'Clínica', porcentaje_cobertura_default: normalizarNumero(p.porcentaje_cobertura_default, 0),
    categoria_mostrar: p.departamento || 'Servicio', origen: 'catalogo',
  }))

  return [...productos, ...analiticas, ...procesos]
}

export async function buscarCatalogoFacturacion(textoBusqueda = '') {
  return await buscarCatalogo(textoBusqueda)
}

/* =========================================================
   ANTICIPOS / DEPOSITOS
========================================================= */

export async function listarAnticiposPaciente(pacienteId) {
  if (!pacienteId) return []
  const { data, error } = await supabase.from('anticipos_pacientes').select('*').eq('paciente_id', pacienteId).neq('estado', 'anulado').order('fecha', { ascending: false })
  if (error) throw new Error(error.message || 'No se pudieron cargar los anticipos del paciente.')
  return data || []
}

export async function crearAnticipo(payload) {
  const monto = normalizarNumero(payload.monto, 0)
  if (monto <= 0) throw new Error('El monto del anticipo debe ser mayor que cero.')
  const { data, error } = await supabase.from('anticipos_pacientes').insert([{ ...payload, monto, saldo_disponible: monto, estado: 'disponible', fecha: payload.fecha || fechaIsoActual() }]).select().single()
  if (error) throw new Error(error.message || 'No se pudo registrar el anticipo.')
  return data
}

export async function aplicarAnticipoAFactura(payload) {
  const montoAplicado = normalizarNumero(payload.monto_aplicado, 0)
  if (montoAplicado <= 0) throw new Error('El monto aplicado debe ser mayor que cero.')
  
  const { data: anticipo } = await supabase.from('anticipos_pacientes').select('*').eq('id', payload.anticipo_id).single()
  if (!anticipo || normalizarNumero(anticipo.saldo_disponible, 0) < montoAplicado) throw new Error('El anticipo no tiene saldo suficiente.')

  const pago = await registrarPagoFactura({
    factura_id: payload.factura_id, metodo_pago: payload.metodo_pago || 'anticipo', monto: montoAplicado,
    usuario_id: payload.usuario_id || null, referencia: payload.referencia || `Aplicación anticipo ${anticipo.id}`,
    observacion: payload.observacion || 'Aplicación de anticipo', tipo_pago: 'adelanto',
    es_anticipo: true, anticipo_id: anticipo.id, caja_id: payload.caja_id || null, creado_desde: 'facturacion',
  })

  await supabase.from('anticipos_aplicaciones').insert([{ anticipo_id: anticipo.id, factura_id: payload.factura_id, pago_id: pago.id, monto_aplicado: montoAplicado, fecha: fechaIsoActual(), usuario_id: payload.usuario_id || null, observacion: limpiarTexto(payload.observacion) || null }])

  const nuevoSaldo = normalizarNumero(anticipo.saldo_disponible, 0) - montoAplicado
  const nuevoEstado = nuevoSaldo <= 0 ? 'aplicado_total' : 'aplicado_parcial'
  await supabase.from('anticipos_pacientes').update({ saldo_disponible: nuevoSaldo, estado: nuevoEstado, updated_at: fechaIsoActual() }).eq('id', anticipo.id)

  return pago
}

/* =========================================================
   CREAR FACTURA (CORREGIDA PARA EVITAR BUCLES INFINITOS)
========================================================= */

async function vincularOrigenFactura(facturaId, tipoOrigen, referenciaId, descripcion = null) {
  await supabase.from('factura_origenes').insert([{ factura_id: facturaId, tipo_origen: tipoOrigen, referencia_id: referenciaId, descripcion }])
}

export async function crearFactura(payload) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error('Debes agregar al menos un ítem a la factura.')

  const esLaboratorio = payload.tipo_orden === 'laboratorio';
  const numero = limpiarTexto(payload.numero) || (await generarNumeroFactura(esLaboratorio ? 'laboratorio' : (payload.origen_principal || 'clinica')))
  const codigo_barra = `FAC${Date.now()}`

  // 1. CREAMOS LA CABECERA
  const { data: factura, error: facturaError } = await supabase
    .from('facturas')
    .insert([{
      numero, paciente_id: payload.paciente_id || null, usuario_id: payload.usuario_id || null, caja_id: payload.caja_id || null,
      medico_id: payload.medico_id || null, ars_id: payload.ars_id || null, fecha: fechaIsoActual(), estado: 'pendiente',
      estado_facturacion: 'sin_facturar', tipo_factura: payload.tipo_factura || 'clinica', origen_principal: payload.origen_principal || 'manual',
      tipo_orden: payload.tipo_orden || null,
      numero_autorizacion: limpiarTexto(payload.numero_autorizacion) || null, ncf: limpiarTexto(payload.ncf) || null,
      tipo_comprobante: limpiarTexto(payload.tipo_comprobante) || null, requiere_deposito: !!payload.requiere_deposito,
      deposito_requerido: normalizarNumero(payload.deposito_requerido, 0), deposito_aplicado: normalizarNumero(payload.deposito_aplicado, 0),
      permite_pago_cuotas: payload.permite_pago_cuotas !== false, observacion: limpiarTexto(payload.observacion) || null,
      laboratorio_solicitud_id: payload.laboratorio_solicitud_id || null, porcentaje_cobertura: normalizarNumero(payload.porcentaje_cobertura, 0),
      porcentaje_cobertura_global: normalizarNumero(payload.porcentaje_cobertura, 0), descuento: normalizarNumero(payload.descuento, 0),
      impuestos: normalizarNumero(payload.impuestos, 0), cobertura_total: normalizarNumero(payload.cobertura_total, 0), 
      codigo_barra, nombre_paciente_manual: limpiarTexto(payload.nombre_paciente_manual) || null, apellido_paciente_manual: limpiarTexto(payload.apellido_paciente_manual) || null,
      cedula_paciente_manual: limpiarTexto(payload.cedula_paciente_manual) || null, telefono_paciente_manual: limpiarTexto(payload.telefono_paciente_manual) || null,
      direccion_paciente_manual: limpiarTexto(payload.direccion_paciente_manual) || null, record_paciente_manual: limpiarTexto(payload.record_paciente_manual) || null, updated_at: fechaIsoActual(),
    }])
    .select().single()

  if (facturaError || !factura) throw new Error(facturaError?.message || 'No se pudo crear la factura.')

  // 2. CREAMOS LOS DETALLES (BULK INSERT PARA EVITAR SOBRECARGAR TRIGGERS)
  const arrayDetalles = payload.items.map((item, i) => {
    const subtotal = normalizarNumero(item.subtotal, 0) || normalizarNumero(item.cantidad, 1) * normalizarNumero(item.precio_unitario, 0)
    const porc = normalizarNumero(item.porcentaje_cobertura, 0)
    const cobertura = normalizarNumero(item.cobertura, subtotal * (porc / 100))
    const diferencia = normalizarNumero(item.diferencia, subtotal - cobertura)

    return {
      factura_id: factura.id, tipo_item: item.tipo_item || 'cargo_manual', referencia_id: item.referencia_id || null, descripcion: limpiarTexto(item.descripcion) || 'Ítem sin descripción',
      cantidad: normalizarNumero(item.cantidad, 1), precio_unitario: normalizarNumero(item.precio_unitario, 0), subtotal, descuento: normalizarNumero(item.descuento, 0), impuesto: normalizarNumero(item.impuesto, 0),
      orden: i + 1, departamento: limpiarTexto(item.departamento) || 'General', area_origen: limpiarTexto(item.area_origen) || 'General', origen_modulo: limpiarTexto(item.origen_modulo) || 'manual',
      cobertura, diferencia, porcentaje_cobertura: porc, autorizacion_numero: limpiarTexto(item.autorizacion_numero) || null, medico_id: item.medico_id || null, laboratorio_solicitud_id: item.laboratorio_solicitud_id || null,
      laboratorio_detalle_id: item.laboratorio_detalle_id || null, ars_id: payload.ars_id || null, es_honorario: !!item.es_honorario, es_deposito: !!item.es_deposito, es_diferencia_cirugia: !!item.es_diferencia_cirugia,
      es_pago_adelantado: !!item.es_pago_adelantado, facturable_por_seguro: item.facturable_por_seguro !== false,
    }
  });

  const { error: errDetalles } = await supabase.from('detalle_factura').insert(arrayDetalles);

  if (errDetalles) {
    await supabase.from('facturas').delete().eq('id', factura.id); // Rollback
    throw new Error(`Fallo de Base de Datos: Tienes un trigger recursivo. Detalle: ${errDetalles.message}`);
  }

  // 3. VÍNCULOS Y PAGOS
  const emergenciaIds = Array.isArray(payload.emergencia_ids) ? payload.emergencia_ids : []
  const internamientoIds = Array.isArray(payload.internamiento_ids) ? payload.internamiento_ids : []
  for (const emergenciaId of emergenciaIds) await vincularOrigenFactura(factura.id, 'emergencia', emergenciaId, 'Factura desde emergencia')
  for (const internamientoId of internamientoIds) await vincularOrigenFactura(factura.id, 'internamiento', internamientoId, 'Factura desde internamiento')
  if (payload.laboratorio_solicitud_id) await vincularOrigenFactura(factura.id, 'laboratorio', payload.laboratorio_solicitud_id, 'Factura desde laboratorio')

  if (payload.ars_id) {
    await supabase.from('facturas_seguro').upsert([{ factura_id: factura.id, ars_id: payload.ars_id, monto_cobertura: 0, monto_paciente: 0, numero_autorizacion: limpiarTexto(payload.numero_autorizacion) || null, porcentaje_cobertura: normalizarNumero(payload.porcentaje_cobertura, 0), observacion: 'Registrado desde facturación', activo: true, updated_at: fechaIsoActual() }], { onConflict: 'factura_id' })
  }

  await ejecutarPostProcesoFactura(factura.id)

  if (normalizarNumero(payload.monto_pagado, 0) > 0) {
    await registrarPagoFactura({ factura_id: factura.id, metodo_pago: payload.metodo_pago || 'efectivo', monto: normalizarNumero(payload.monto_pagado, 0), referencia: limpiarTexto(payload.referencia_pago) || null, observacion: limpiarTexto(payload.observacion_pago) || null, usuario_id: payload.usuario_id || null, caja_id: payload.caja_id || null, tipo_pago: 'abono' })
  }

  if (Array.isArray(payload.anticipo_aplicaciones) && payload.anticipo_aplicaciones.length > 0) {
    for (const aplicacion of payload.anticipo_aplicaciones) {
      await aplicarAnticipoAFactura({ ...aplicacion, factura_id: factura.id, usuario_id: payload.usuario_id || null, caja_id: payload.caja_id || null })
    }
  }

  return factura
}

/* =========================================================
   PAGOS Y ANULACION
========================================================= */

export async function registrarPagoFactura(payload) {
  const monto = normalizarNumero(payload.monto, 0)
  if (monto <= 0) throw new Error('El monto del pago debe ser mayor que cero.')
  
  const { data, error } = await supabase.from('pagos').insert([{ factura_id: payload.factura_id, metodo_pago: payload.metodo_pago || 'efectivo', monto, fecha: fechaIsoActual(), usuario_id: payload.usuario_id || null, referencia: limpiarTexto(payload.referencia) || null, observacion: limpiarTexto(payload.observacion) || null, caja_id: payload.caja_id || null, estado: payload.estado || 'aplicado', tipo_pago: payload.tipo_pago || 'abono', es_anticipo: payload.es_anticipo || false, anticipo_id: payload.anticipo_id || null, creado_desde: payload.creado_desde || 'facturacion', fecha_aplicacion: fechaIsoActual() }]).select().single()
  if (error) throw new Error(error.message || 'No se pudo registrar el pago.')

  await ejecutarPostProcesoFactura(payload.factura_id)
  return data
}

export async function anularFactura(facturaId, usuarioId, motivo = '') {
  const { data, error } = await supabase.from('facturas').update({ estado: 'anulada', estado_facturacion: 'anulada', anulada_por: usuarioId || null, fecha_anulacion: fechaIsoActual(), motivo_anulacion: limpiarTexto(motivo) || null, updated_at: fechaIsoActual() }).eq('id', facturaId).select().single()
  if (error) throw new Error(error.message || 'No se pudo anular la factura.')
  return data
}

export async function marcarFacturaComoImpresa(facturaId) {
  const { error } = await supabase.from('facturas').update({ impresa: true, fecha_impresion: fechaIsoActual() }).eq('id', facturaId)
  if (error) throw new Error(error.message || 'No se pudo marcar la factura como impresa.')
  return true
}

export async function generarNumeroFactura(tipo = 'clinica') {
  let prefijo = 'CLI'
  if (tipo === 'laboratorio') prefijo = 'LAB'
  else if (tipo === 'internamiento') prefijo = 'INT'
  else if (tipo === 'emergencia') prefijo = 'EME'
  else if (tipo === 'farmacia') prefijo = 'FAR'

  try {
    const { data, error } = await supabase.rpc('fn_facturacion_generar_numero', { p_prefijo: prefijo })
    if (error || !data) throw new Error()
    return data
  } catch {
    const ahora = new Date()
    return `${prefijo}-${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}-${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}${String(ahora.getSeconds()).padStart(2, '0')}`
  }
}