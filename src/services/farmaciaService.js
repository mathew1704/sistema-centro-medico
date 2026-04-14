import { supabase } from '../lib/supabaseClient';

export async function buscarPacientesFarmacia(filtro = '') {
  let query = supabase
    .from('pacientes')
    .select('id, record, nombre, apellido, cedula, correo')
    .order('nombre', { ascending: true });

  if (filtro?.trim()) {
    const texto = filtro.trim();
    query = query.or(`record.ilike.%${texto}%,nombre.ilike.%${texto}%,apellido.ilike.%${texto}%,cedula.ilike.%${texto}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message || 'No se pudieron cargar los pacientes.');
  return data || [];
}

export async function listarProductosFarmacia(filtro = '') {
  // Filtro relajado: Trae todo lo activo, tenga o no categoría, sea o no de farmacia.
  let query = supabase
    .from('productos')
    .select(`
      id, codigo, nombre, categoria_id, unidad_id,
      precio_compra, precio_venta, stock_minimo,
      requiere_lote, activo, es_farmacia,
      categorias_productos (id, nombre)
    `)
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (filtro?.trim()) {
    const texto = filtro.trim();
    query = query.or(`codigo.ilike.%${texto}%,nombre.ilike.%${texto}%`);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error("Error al buscar productos:", error);
    throw new Error(error.message || 'No se pudieron cargar los productos.');
  }
  
  console.log(`📦 Catálogo: Se encontraron ${data?.length || 0} productos activos.`);
  return data || [];
}

export async function listarUbicacionesFarmacia() {
  const { data, error } = await supabase
    .from('ubicaciones')
    .select('id, nombre, descripcion')
    .order('nombre', { ascending: true });
    
  if (error) throw new Error(error.message || 'No se pudieron cargar las ubicaciones.');
  return data || [];
}

export async function listarStockFarmacia(ubicacionId = '') {
  let query = supabase
    .from('stock_ubicacion')
    .select(`
      id, producto_id, lote_id, ubicacion_id, cantidad,
      productos (id, codigo, nombre, precio_venta, stock_minimo, categorias_productos (id, nombre)),
      lotes (id, numero_lote, fecha_vencimiento),
      ubicaciones (id, nombre)
    `)
    .order('id', { ascending: false });

  if (ubicacionId) {
    query = query.eq('ubicacion_id', ubicacionId);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error("Error al cargar stock:", error);
    throw new Error(error.message || 'No se pudo cargar el stock de farmacia.');
  }

  console.log(`📦 Stock: Se encontraron ${data?.length || 0} registros de stock en esta ubicación.`);
  return data || [];
}

export async function listarCajasAbiertas() {
  const { data, error } = await supabase
    .from('cajas')
    .select(`
      id, usuario_id, fecha_apertura, fecha_cierre, abierta, monto_apertura, monto_cierre, observacion, ubicacion_id, created_at, updated_at,
      ubicaciones (id, nombre), usuarios (id, username, nombre, apellido)
    `)
    .eq('abierta', true)
    .order('fecha_apertura', { ascending: false });

  if (error) throw new Error(error.message || 'No se pudieron cargar las cajas abiertas.');
  return data || [];
}

export async function abrirCaja(payload) {
  const datos = {
    usuario_id: payload.usuario_id,
    monto_apertura: Number(payload.monto_apertura || 0),
    observacion: payload.observacion?.trim() || null,
    ubicacion_id: payload.ubicacion_id || null,
    abierta: true,
  };

  const { data, error } = await supabase.from('cajas').insert([datos]).select().single();
  if (error) throw new Error(error.message || 'No se pudo abrir la caja.');
  return data;
}

export async function cerrarCaja(cajaId, montoCierre = 0, observacion = '') {
  const { data, error } = await supabase.from('cajas').update({
      abierta: false, monto_cierre: Number(montoCierre || 0), observacion: observacion?.trim() || null,
      fecha_cierre: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', cajaId).select().single();

  if (error) throw new Error(error.message || 'No se pudo cerrar la caja.');
  return data;
}

export async function listarVentasFarmacia(filtro = '') {
  const { data, error } = await supabase.from('facturas').select(`
      id, numero, paciente_id, usuario_id, caja_id, subtotal, descuento, total, estado, fecha, tipo_factura, impuestos, saldo, ncf, tipo_comprobante, anulada_por, fecha_anulacion, motivo_anulacion, created_at, updated_at,
      pacientes (id, record, nombre, apellido), usuarios (id, username, nombre, apellido), cajas (id, fecha_apertura, ubicaciones (id, nombre))
    `).eq('tipo_factura', 'farmacia').order('fecha', { ascending: false });

  if (error) throw new Error(error.message || 'No se pudieron cargar las ventas.');

  let lista = data || [];
  if (filtro?.trim()) {
    const texto = filtro.trim().toLowerCase();
    lista = lista.filter((v) => {
      const numero = v.numero?.toLowerCase() || '';
      const paciente = `${v.pacientes?.nombre || ''} ${v.pacientes?.apellido || ''}`.toLowerCase();
      const usuario = `${v.usuarios?.nombre || ''} ${v.usuarios?.apellido || ''}`.toLowerCase();
      return numero.includes(texto) || paciente.includes(texto) || usuario.includes(texto);
    });
  }
  return lista;
}

export async function listarDetalleVentaFarmacia(facturaId) {
  const { data, error } = await supabase
    .from('detalle_factura')
    .select(`id, factura_id, tipo_item, referencia_id, descripcion, cantidad, precio_unitario, subtotal, descuento, impuesto, created_at`)
    .eq('factura_id', facturaId)
    .order('created_at', { ascending: true });
    
  if (error) throw new Error(error.message || 'No se pudo cargar el detalle de la venta.');
  return data || [];
}

export async function crearVentaFarmacia(payload) {
  if (!payload.caja_id) throw new Error('Debes seleccionar una caja abierta.');
  if (!payload.items || payload.items.length === 0) throw new Error('Debes agregar al menos un producto al carrito.');

  const caja = await obtenerCajaAbierta(payload.caja_id);
  if (!caja) throw new Error('La caja seleccionada ya no está abierta.');

  const ubicacionId = caja.ubicacion_id;
  if (!ubicacionId) throw new Error('La caja no tiene una ubicación asignada para descontar inventario.');

  // Validación de Stock
  for (const item of payload.items) {
    const disponible = await obtenerStockProducto(item.producto_id, ubicacionId);
    if (disponible < Number(item.cantidad || 0)) {
      throw new Error(`Stock insuficiente para "${item.nombre}". Disponible: ${disponible}`);
    }
  }

  const subtotal = payload.items.reduce((acc, item) => acc + Number(item.cantidad || 0) * Number(item.precio_unitario || 0), 0);
  const descuento = Number(payload.descuento || 0);
  const impuestos = Number(payload.impuestos || 0);
  const total = subtotal - descuento + impuestos;
  const monto_pagado = Number(payload.monto_pagado || 0);
  const devuelta = monto_pagado > total ? monto_pagado - total : 0;
  const saldo = monto_pagado < total ? total - monto_pagado : 0;
  const monto_a_registrar_en_caja = monto_pagado >= total ? total : monto_pagado;
  const numero = generarNumeroFacturaFarmacia();

  // Crear Factura
  const facturaPayload = {
    numero, paciente_id: payload.paciente_id || null, usuario_id: payload.usuario_id || null, caja_id: payload.caja_id,
    subtotal, descuento, total, estado: saldo > 0 ? 'parcial' : 'pagada', fecha: new Date().toISOString(), tipo_factura: 'farmacia', impuestos, saldo,
  };

  const { data: factura, error: facturaError } = await supabase.from('facturas').insert([facturaPayload]).select().single();
  if (facturaError) throw new Error(facturaError.message || 'No se pudo registrar la factura.');

  // Crear Detalle
  const detalles = payload.items.map((item) => ({
    factura_id: factura.id, tipo_item: 'producto', referencia_id: item.producto_id, descripcion: item.nombre,
    cantidad: Number(item.cantidad || 0), precio_unitario: Number(item.precio_unitario || 0),
    subtotal: Number(item.cantidad || 0) * Number(item.precio_unitario || 0), descuento: 0, impuesto: 0,
  }));

  const { error: detalleError } = await supabase.from('detalle_factura').insert(detalles);
  if (detalleError) throw new Error(detalleError.message || 'No se pudo registrar el detalle de la venta.');

  // Registrar Pago
  if (monto_a_registrar_en_caja > 0) {
    const { error: pagoError } = await supabase.from('pagos').insert([{
        factura_id: factura.id, metodo_pago: payload.metodo_pago || 'efectivo', monto: monto_a_registrar_en_caja,
        fecha: new Date().toISOString(), usuario_id: payload.usuario_id || null,
        observacion: payload.observacion_pago?.trim() || `Entregó: $${monto_pagado} | Devuelta: $${devuelta}`,
      }]);
    if (pagoError) throw new Error(pagoError.message || 'No se pudo registrar el pago en caja.');
  }

  // Descontar Inventario
  for (const item of payload.items) {
    await registrarSalidaInventarioFarmacia({
      producto_id: item.producto_id, cantidad: Number(item.cantidad || 0), ubicacion_id: ubicacionId,
      usuario_id: payload.usuario_id || null, referencia: factura.numero, referencia_id: factura.id, observacion: 'Venta POS Farmacia',
    });
  }

  return { factura_id: factura.id, numero: factura.numero, fecha: factura.fecha, subtotal, descuento, impuestos, total, saldo, items: payload.items, pago: { metodo: payload.metodo_pago, entregado: monto_pagado, cobrado: monto_a_registrar_en_caja, devuelta: devuelta } };
}

export async function anularVentaFarmacia(facturaId, usuarioId, motivo = '') {
  const factura = await obtenerFacturaFarmaciaPorId(facturaId);
  if (!factura) throw new Error('No se encontró la venta.');
  if (factura.estado === 'anulada') throw new Error('La venta ya está anulada.');

  const detalles = await listarDetalleVentaFarmacia(facturaId);
  const caja = await obtenerCajaAbierta(factura.caja_id);
  const ubicacionId = caja?.ubicacion_id || factura.cajas?.ubicaciones?.id || null;

  if (ubicacionId) {
    for (const item of detalles) {
      if (item.tipo_item === 'producto') {
        await registrarEntradaInventarioFarmacia({ producto_id: item.referencia_id, cantidad: Number(item.cantidad || 0), ubicacion_id: ubicacionId, usuario_id: usuarioId || null, referencia: factura.numero, referencia_id: factura.id, observacion: 'Reverso por anulación de venta' });
      }
    }
  }

  const { data, error } = await supabase.from('facturas').update({
      estado: 'anulada', anulada_por: usuarioId || null, fecha_anulacion: new Date().toISOString(),
      motivo_anulacion: motivo?.trim() || null, updated_at: new Date().toISOString(),
    }).eq('id', facturaId).select().single();

  if (error) throw new Error(error.message || 'No se pudo anular la venta.');
  return data;
}

// --- FUNCIONES INTERNAS (Helpers) ---

async function obtenerCajaAbierta(cajaId) {
  const { data, error } = await supabase.from('cajas').select('id, abierta, ubicacion_id').eq('id', cajaId).eq('abierta', true).maybeSingle();
  if (error) throw new Error(error.message || 'No se pudo validar la caja.');
  return data || null;
}

async function obtenerFacturaFarmaciaPorId(facturaId) {
  const { data, error } = await supabase.from('facturas').select(`id, numero, estado, caja_id, cajas (id, ubicaciones (id, nombre))`).eq('id', facturaId).eq('tipo_factura', 'farmacia').maybeSingle();
  if (error) throw new Error(error.message || 'No se pudo cargar la factura.');
  return data || null;
}

async function obtenerStockProducto(productoId, ubicacionId) {
  const { data, error } = await supabase.from('stock_ubicacion').select('id, cantidad').eq('producto_id', productoId).eq('ubicacion_id', ubicacionId);
  if (error) throw new Error(error.message || 'No se pudo validar el stock.');
  return (data || []).reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
}

async function registrarSalidaInventarioFarmacia(payload) {
  const disponible = await obtenerStockProducto(payload.producto_id, payload.ubicacion_id);
  if (disponible < Number(payload.cantidad || 0)) throw new Error('No hay stock suficiente para completar la venta.');

  const { error: movError } = await supabase.from('movimientos_inventario').insert([{
        producto_id: payload.producto_id, ubicacion_id: payload.ubicacion_id, tipo: 'salida', cantidad: Number(payload.cantidad || 0),
        referencia: payload.referencia || null, usuario_id: payload.usuario_id || null, fecha: new Date().toISOString(),
        modulo_origen: 'farmacia', referencia_id: payload.referencia_id || null, observacion: payload.observacion || null,
      }]);
  if (movError) throw new Error(movError.message || 'No se pudo registrar la salida de inventario.');
  await descontarStock(payload.producto_id, payload.ubicacion_id, Number(payload.cantidad || 0));
}

async function registrarEntradaInventarioFarmacia(payload) {
  const { error: movError } = await supabase.from('movimientos_inventario').insert([{
        producto_id: payload.producto_id, ubicacion_id: payload.ubicacion_id, tipo: 'entrada', cantidad: Number(payload.cantidad || 0),
        referencia: payload.referencia || null, usuario_id: payload.usuario_id || null, fecha: new Date().toISOString(),
        modulo_origen: 'farmacia', referencia_id: payload.referencia_id || null, observacion: payload.observacion || null,
      }]);
  if (movError) throw new Error(movError.message || 'No se pudo registrar el reverso de inventario.');
  await sumarStock(payload.producto_id, payload.ubicacion_id, Number(payload.cantidad || 0));
}

async function descontarStock(productoId, ubicacionId, cantidad) {
  const { data, error } = await supabase.from('stock_ubicacion').select('id, cantidad').eq('producto_id', productoId).eq('ubicacion_id', ubicacionId).order('cantidad', { ascending: false });
  if (error) throw new Error(error.message || 'No se pudo actualizar el stock.');

  let restante = Number(cantidad || 0);
  for (const fila of data || []) {
    if (restante <= 0) break;
    const disponible = Number(fila.cantidad || 0);
    const descuento = Math.min(disponible, restante);
    const nuevaCantidad = disponible - descuento;
    const { error: updateError } = await supabase.from('stock_ubicacion').update({ cantidad: nuevaCantidad }).eq('id', fila.id);
    if (updateError) throw new Error(updateError.message || 'No se pudo descontar el stock.');
    restante -= descuento;
  }
  if (restante > 0) throw new Error('No se pudo completar el descuento de stock.');
}

async function sumarStock(productoId, ubicacionId, cantidad) {
  const { data, error } = await supabase.from('stock_ubicacion').select('id, cantidad').eq('producto_id', productoId).eq('ubicacion_id', ubicacionId).is('lote_id', null).maybeSingle();
  if (error) throw new Error(error.message || 'No se pudo actualizar el stock.');

  if (!data) {
    const { error: insertError } = await supabase.from('stock_ubicacion').insert([{ producto_id: productoId, lote_id: null, ubicacion_id: ubicacionId, cantidad: Number(cantidad || 0) }]);
    if (insertError) throw new Error(insertError.message || 'No se pudo devolver el stock.');
    return;
  }
  const { error: updateError } = await supabase.from('stock_ubicacion').update({ cantidad: Number(data.cantidad || 0) + Number(cantidad || 0) }).eq('id', data.id);
  if (updateError) throw new Error(updateError.message || 'No se pudo devolver el stock.');
}

function generarNumeroFacturaFarmacia() {
  const ahora = new Date();
  const y = ahora.getFullYear().toString();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  const t = String(ahora.getTime()).slice(-6);
  return `FARM-${y}${m}${d}-${t}`;
}