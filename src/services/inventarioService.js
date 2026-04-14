import { supabase } from '../lib/supabaseClient';

/* =========================================================
   HELPERS
========================================================= */

function normalizarNumero(valor, porDefecto = 0) {
  if (valor === null || valor === undefined || valor === '') return porDefecto;

  const texto = String(valor).replace(/,/g, '').trim();
  const n = Number(texto);

  return Number.isFinite(n) ? n : porDefecto;
}

function limpiarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function fechaIsoActual() {
  return new Date().toISOString();
}

function normalizarClave(valor = '') {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\//g, '_')
    .replace(/\s+/g, '_')
    .trim();
}

function interpretarBooleano(valor, porDefecto = false) {
  if (typeof valor === 'boolean') return valor;
  if (valor === null || valor === undefined || valor === '') return porDefecto;

  const v = String(valor).trim().toLowerCase();

  if (['true', '1', 'si', 'sí', 'yes', 'y', 'activo', 'activa'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'inactivo', 'inactiva'].includes(v)) return false;

  return porDefecto;
}

function generarCodigoImportacion(indice = 1) {
  const ahora = new Date();
  const yy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const dd = String(ahora.getDate()).padStart(2, '0');
  const hh = String(ahora.getHours()).padStart(2, '0');
  const mi = String(ahora.getMinutes()).padStart(2, '0');
  const ss = String(ahora.getSeconds()).padStart(2, '0');
  return `IMP-${yy}${mm}${dd}${hh}${mi}${ss}-${String(indice).padStart(4, '0')}`;
}

function normalizarFechaImportacion(valor) {
  if (!valor) return null;

  if (typeof valor === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const fecha = new Date(excelEpoch.getTime() + valor * 86400000);
    return fecha.toISOString().slice(0, 10);
  }

  const texto = String(valor).trim();

  if (!texto) return null;

  const iso = new Date(texto);
  if (!Number.isNaN(iso.getTime())) {
    return iso.toISOString().slice(0, 10);
  }

  const match = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const dia = match[1].padStart(2, '0');
    const mes = match[2].padStart(2, '0');
    const anio = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${anio}-${mes}-${dia}`;
  }

  return null;
}

function obtenerValorFlexible(fila, aliases = []) {
  if (!fila || typeof fila !== 'object') return '';

  const mapa = {};
  for (const [key, value] of Object.entries(fila)) {
    mapa[normalizarClave(key)] = value;
  }

  for (const alias of aliases) {
    const valor = mapa[normalizarClave(alias)];
    if (valor !== undefined && valor !== null && valor !== '') {
      return valor;
    }
  }

  return '';
}

async function obtenerUbicacionPrincipal() {
  const { data, error } = await supabase
    .from('ubicaciones')
    .select('id, nombre, tipo, es_principal, activa')
    .eq('es_principal', true)
    .eq('activa', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo obtener el almacén principal.');
  }

  return data || null;
}

async function obtenerUbicacionPorNombre(nombre) {
  const texto = limpiarTexto(nombre);
  if (!texto) return null;

  const { data, error } = await supabase
    .from('ubicaciones')
    .select('id, nombre, activa, es_principal')
    .ilike('nombre', texto)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo buscar la ubicación.');
  }

  return data || null;
}

async function obtenerOCrearCategoria(nombre) {
  const texto = limpiarTexto(nombre);
  if (!texto) return null;

  const { data: existente, error: errorBusqueda } = await supabase
    .from('categorias_productos')
    .select('id, nombre')
    .ilike('nombre', texto)
    .limit(1)
    .maybeSingle();

  if (errorBusqueda) {
    throw new Error(errorBusqueda.message || 'No se pudo buscar la categoría.');
  }

  if (existente) return existente.id;

  const { data, error } = await supabase
    .from('categorias_productos')
    .insert([{ nombre: texto }])
    .select('id, nombre')
    .single();

  if (error) {
    throw new Error(error.message || `No se pudo crear la categoría ${texto}.`);
  }

  return data.id;
}

async function obtenerOCrearUnidad(nombre) {
  const texto = limpiarTexto(nombre);
  if (!texto) return null;

  const { data: existente, error: errorBusqueda } = await supabase
    .from('unidades_medida')
    .select('id, nombre, abreviatura')
    .or(`nombre.ilike.${texto},abreviatura.ilike.${texto}`)
    .limit(1)
    .maybeSingle();

  if (errorBusqueda) {
    throw new Error(errorBusqueda.message || 'No se pudo buscar la unidad.');
  }

  if (existente) return existente.id;

  const { data, error } = await supabase
    .from('unidades_medida')
    .insert([
      {
        nombre: texto,
        abreviatura: texto.length <= 10 ? texto : texto.slice(0, 10),
      },
    ])
    .select('id, nombre')
    .single();

  if (error) {
    throw new Error(error.message || `No se pudo crear la unidad ${texto}.`);
  }

  return data.id;
}

async function obtenerOCrearTipoMaterial(nombre) {
  const texto = limpiarTexto(nombre);
  if (!texto) return null;

  const { data: existente, error: errorBusqueda } = await supabase
    .from('tipos_materiales')
    .select('id, nombre, activo')
    .ilike('nombre', texto)
    .limit(1)
    .maybeSingle();

  if (errorBusqueda) {
    throw new Error(errorBusqueda.message || 'No se pudo buscar el tipo de material.');
  }

  if (existente) return existente.id;

  const { data, error } = await supabase
    .from('tipos_materiales')
    .insert([{ nombre: texto, activo: true }])
    .select('id, nombre')
    .single();

  if (error) {
    throw new Error(error.message || `No se pudo crear el tipo de material ${texto}.`);
  }

  return data.id;
}

async function buscarProductoPorCodigo(codigo) {
  const texto = limpiarTexto(codigo);
  if (!texto) return null;

  const { data, error } = await supabase
    .from('productos')
    .select(`
      id,
      codigo,
      nombre,
      categoria_id,
      unidad_id,
      tipo_material_id,
      precio_compra,
      precio_venta,
      stock_minimo,
      requiere_lote,
      activo,
      created_at,
      updated_at
    `)
    .eq('codigo', texto)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo buscar el producto por código.');
  }

  return data || null;
}

async function obtenerOCrearLoteImportacion({
  producto_id,
  numero_lote,
  fecha_vencimiento,
  fecha_fabricacion,
  cantidad_inicial = 0,
}) {
  const numero = limpiarTexto(numero_lote);
  if (!producto_id || !numero) return null;

  const { data: existente, error: errorBusqueda } = await supabase
    .from('lotes')
    .select('id, producto_id, numero_lote, fecha_vencimiento, fecha_fabricacion, activo')
    .eq('producto_id', producto_id)
    .eq('numero_lote', numero)
    .limit(1)
    .maybeSingle();

  if (errorBusqueda) {
    throw new Error(errorBusqueda.message || 'No se pudo buscar el lote.');
  }

  if (existente) {
    return existente;
  }

  const { data, error } = await supabase
    .from('lotes')
    .insert([
      {
        producto_id,
        numero_lote: numero,
        fecha_vencimiento: fecha_vencimiento || null,
        fecha_fabricacion: fecha_fabricacion || null,
        activo: true,
        cantidad_inicial: normalizarNumero(cantidad_inicial, 0),
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || `No se pudo crear el lote ${numero}.`);
  }

  return data;
}

async function crearRegistroImportacion({
  documento_nombre,
  tipo_documento,
  total_filas,
  usuario_id,
  ubicacion_id,
}) {
  const { data, error } = await supabase
    .from('importaciones_inventario')
    .insert([
      {
        documento_nombre: documento_nombre || null,
        tipo_documento: tipo_documento || null,
        total_filas: total_filas || 0,
        filas_ok: 0,
        filas_error: 0,
        estado: 'procesando',
        resumen: {},
        usuario_id: usuario_id || null,
        ubicacion_id: ubicacion_id || null,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo crear el registro de importación.');
  }

  return data;
}

async function crearDetalleImportacion({
  importacion_id,
  fila_numero,
  estado,
  mensaje,
  fila,
  producto_id,
  lote_id,
  movimiento_id,
}) {
  const { error } = await supabase.from('importaciones_inventario_detalle').insert([
    {
      importacion_id,
      fila_numero,
      estado,
      mensaje: mensaje || null,
      fila: fila || {},
      producto_id: producto_id || null,
      lote_id: lote_id || null,
      movimiento_id: movimiento_id || null,
    },
  ]);

  if (error) {
    throw new Error(error.message || 'No se pudo registrar el detalle de importación.');
  }
}

async function finalizarImportacion(importacionId, payload) {
  const { error } = await supabase
    .from('importaciones_inventario')
    .update({
      filas_ok: payload.filas_ok || 0,
      filas_error: payload.filas_error || 0,
      estado: payload.estado || 'completada',
      resumen: payload.resumen || {},
      updated_at: fechaIsoActual(),
    })
    .eq('id', importacionId);

  if (error) {
    throw new Error(error.message || 'No se pudo finalizar la importación.');
  }
}

/* =========================================================
   PRODUCTOS
========================================================= */

export async function listarProductosInventario(filtro = '') {
  let query = supabase
    .from('productos')
    .select(`
      id,
      codigo,
      nombre,
      categoria_id,
      unidad_id,
      tipo_material_id,
      precio_compra,
      precio_venta,
      stock_minimo,
      requiere_lote,
      activo,
      created_at,
      updated_at,
      categorias_productos (
        id,
        nombre
      ),
      unidades_medida (
        id,
        nombre,
        abreviatura
      ),
      tipos_materiales (
        id,
        nombre
      )
    `)
    .order('created_at', { ascending: false });

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

export async function obtenerProductoPorId(id) {
  const { data, error } = await supabase
    .from('productos')
    .select(`
      id,
      codigo,
      nombre,
      categoria_id,
      unidad_id,
      tipo_material_id,
      precio_compra,
      precio_venta,
      stock_minimo,
      requiere_lote,
      activo,
      created_at,
      updated_at
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo cargar el producto.');
  }

  return data;
}

export async function crearProducto(payload) {
  const datos = {
    codigo: limpiarTexto(payload.codigo),
    nombre: limpiarTexto(payload.nombre),
    categoria_id: payload.categoria_id || null,
    unidad_id: payload.unidad_id || null,
    tipo_material_id: payload.tipo_material_id || null,
    precio_compra: normalizarNumero(payload.precio_compra, 0),
    precio_venta: normalizarNumero(payload.precio_venta, 0),
    stock_minimo: normalizarNumero(payload.stock_minimo, 0),
    requiere_lote: payload.requiere_lote ?? true,
    activo: payload.activo ?? true,
  };

  const { data, error } = await supabase
    .from('productos')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo registrar el producto.');
  }

  return data;
}

export async function actualizarProducto(id, payload) {
  const datos = {
    codigo: limpiarTexto(payload.codigo),
    nombre: limpiarTexto(payload.nombre),
    categoria_id: payload.categoria_id || null,
    unidad_id: payload.unidad_id || null,
    tipo_material_id: payload.tipo_material_id || null,
    precio_compra: normalizarNumero(payload.precio_compra, 0),
    precio_venta: normalizarNumero(payload.precio_venta, 0),
    stock_minimo: normalizarNumero(payload.stock_minimo, 0),
    requiere_lote: payload.requiere_lote ?? true,
    activo: payload.activo ?? true,
    updated_at: fechaIsoActual(),
  };

  const { data, error } = await supabase
    .from('productos')
    .update(datos)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el producto.');
  }

  return data;
}

export async function eliminarProducto(id) {
  const { error } = await supabase.from('productos').delete().eq('id', id);

  if (error) {
    throw new Error(error.message || 'No se pudo eliminar el producto.');
  }

  return true;
}

/* =========================================================
   IMPORTACION MASIVA
========================================================= */

export async function importarProductosDesdeFilas(
  filas = [],
  {
    usuario_id = null,
    ubicacion_id = null,
    nombre_archivo = 'importacion.xlsx',
    tipo_documento = 'excel',
  } = {}
) {
  if (!Array.isArray(filas) || filas.length === 0) {
    throw new Error('El archivo no contiene filas para importar.');
  }

  const ubicacionDestino =
    ubicacion_id
      ? await supabase
          .from('ubicaciones')
          .select('id, nombre, activa')
          .eq('id', ubicacion_id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) throw new Error(error.message || 'No se pudo validar la ubicación.');
            return data;
          })
      : await obtenerUbicacionPrincipal();

  if (!ubicacionDestino?.id) {
    throw new Error('No se encontró una ubicación válida para la importación.');
  }

  const importacion = await crearRegistroImportacion({
    documento_nombre: nombre_archivo,
    tipo_documento,
    total_filas: filas.length,
    usuario_id,
    ubicacion_id: ubicacionDestino.id,
  });

  let filas_ok = 0;
  let filas_error = 0;
  const errores = [];
  const advertencias = [];

  for (let i = 0; i < filas.length; i += 1) {
    const fila = filas[i];
    const filaNumero = i + 2;

    try {
      const codigoBruto = obtenerValorFlexible(fila, [
        'codigo',
        'código',
        'code',
        'sku',
        'referencia',
      ]);

      const nombre = limpiarTexto(
        obtenerValorFlexible(fila, [
          'nombre',
          'producto',
          'medicamento',
          'descripcion',
          'descripción',
          'articulo',
          'artículo',
        ])
      );

      if (!nombre) {
        throw new Error('La fila no tiene nombre de producto/medicamento.');
      }

      const codigo = limpiarTexto(codigoBruto) || generarCodigoImportacion(i + 1);

      const categoriaTexto = obtenerValorFlexible(fila, ['categoria', 'categoría']);
      const unidadTexto = obtenerValorFlexible(fila, [
        'unidad',
        'unidad_medida',
        'unidad_de_medida',
        'um',
      ]);
      const tipoMaterialTexto = obtenerValorFlexible(fila, [
        'tipo_material',
        'tipo_material_id',
        'tipo',
        'tipo_de_material',
      ]);
      const precioCompra = obtenerValorFlexible(fila, [
        'precio_compra',
        'costo',
        'precio_costo',
      ]);
      const precioVenta = obtenerValorFlexible(fila, [
        'precio_venta',
        'precio',
        'pvp',
      ]);
      const stockMinimo = obtenerValorFlexible(fila, [
        'stock_minimo',
        'stock_mínimo',
        'minimo',
        'mínimo',
      ]);
      const requiereLote = obtenerValorFlexible(fila, [
        'requiere_lote',
        'lote_requerido',
        'usa_lote',
      ]);
      const activo = obtenerValorFlexible(fila, ['activo', 'estado']);
      const cantidad = obtenerValorFlexible(fila, [
        'cantidad',
        'existencia',
        'stock',
        'stock_inicial',
        'cantidad_inicial',
      ]);
      const numeroLote = obtenerValorFlexible(fila, [
        'lote',
        'numero_lote',
        'n_lote',
      ]);
      const fechaVencimiento = obtenerValorFlexible(fila, [
        'fecha_vencimiento',
        'vencimiento',
        'expiracion',
        'expiración',
      ]);
      const fechaFabricacion = obtenerValorFlexible(fila, [
        'fecha_fabricacion',
        'fecha_fabricación',
        'fabricacion',
        'fabricación',
      ]);
      const ubicacionTexto = obtenerValorFlexible(fila, [
        'ubicacion',
        'ubicación',
        'almacen',
        'almacén',
        'estacion',
        'estación',
      ]);

      const categoria_id = await obtenerOCrearCategoria(categoriaTexto);
      const unidad_id = await obtenerOCrearUnidad(unidadTexto);
      const tipo_material_id = await obtenerOCrearTipoMaterial(tipoMaterialTexto);

      const productoExistente = await buscarProductoPorCodigo(codigo);

      let productoGuardado = null;

      if (productoExistente) {
        const payloadUpdate = {
          codigo,
          nombre: nombre || productoExistente.nombre,
          categoria_id: categoria_id || productoExistente.categoria_id,
          unidad_id: unidad_id || productoExistente.unidad_id,
          tipo_material_id: tipo_material_id || productoExistente.tipo_material_id,
          precio_compra:
            precioCompra !== '' ? normalizarNumero(precioCompra, 0) : productoExistente.precio_compra,
          precio_venta:
            precioVenta !== '' ? normalizarNumero(precioVenta, 0) : productoExistente.precio_venta,
          stock_minimo:
            stockMinimo !== ''
              ? normalizarNumero(stockMinimo, 0)
              : productoExistente.stock_minimo,
          requiere_lote:
            requiereLote !== ''
              ? interpretarBooleano(requiereLote, productoExistente.requiere_lote ?? true)
              : productoExistente.requiere_lote ?? true,
          activo:
            activo !== ''
              ? interpretarBooleano(activo, productoExistente.activo ?? true)
              : productoExistente.activo ?? true,
        };

        productoGuardado = await actualizarProducto(productoExistente.id, payloadUpdate);
      } else {
        productoGuardado = await crearProducto({
          codigo,
          nombre,
          categoria_id,
          unidad_id,
          tipo_material_id,
          precio_compra: normalizarNumero(precioCompra, 0),
          precio_venta: normalizarNumero(precioVenta, 0),
          stock_minimo: normalizarNumero(stockMinimo, 0),
          requiere_lote: interpretarBooleano(requiereLote, true),
          activo: interpretarBooleano(activo, true),
        });
      }

      let loteGuardado = null;
      let movimientoRegistrado = null;
      const cantidadNumerica = normalizarNumero(cantidad, 0);

      const productoRequiereLote = productoGuardado?.requiere_lote ?? true;

      let ubicacionFila = null;
      if (limpiarTexto(ubicacionTexto)) {
        ubicacionFila = await obtenerUbicacionPorNombre(ubicacionTexto);
      }

      const ubicacionFinal = ubicacionFila?.id ? ubicacionFila : ubicacionDestino;

      if (cantidadNumerica > 0) {
        if (productoRequiereLote || limpiarTexto(numeroLote)) {
          const loteTexto = limpiarTexto(numeroLote) || `LOTE-IMP-${String(i + 1).padStart(4, '0')}`;

          loteGuardado = await obtenerOCrearLoteImportacion({
            producto_id: productoGuardado.id,
            numero_lote: loteTexto,
            fecha_vencimiento: normalizarFechaImportacion(fechaVencimiento),
            fecha_fabricacion: normalizarFechaImportacion(fechaFabricacion),
            cantidad_inicial: cantidadNumerica,
          });
        }

        movimientoRegistrado = await registrarMovimientoInventario({
          tipo: 'entrada',
          producto_id: productoGuardado.id,
          lote_id: loteGuardado?.id || null,
          ubicacion_id: ubicacionFinal.id,
          destino_ubicacion_id: ubicacionFinal.id,
          cantidad: cantidadNumerica,
          referencia: `Importación ${nombre_archivo}`,
          usuario_id,
          fecha: fechaIsoActual(),
          modulo_origen: 'importacion_inventario',
          referencia_id: importacion.id,
          documento_tipo: 'importacion_inventario',
          documento_numero: importacion.id,
          observacion: 'Entrada por importación masiva de inventario',
        });
      }

      await crearDetalleImportacion({
        importacion_id: importacion.id,
        fila_numero: filaNumero,
        estado: 'ok',
        mensaje: productoExistente
          ? 'Producto actualizado correctamente.'
          : 'Producto creado correctamente.',
        fila,
        producto_id: productoGuardado?.id || null,
        lote_id: loteGuardado?.id || null,
        movimiento_id: movimientoRegistrado?.id || null,
      });

      if (!codigoBruto) {
        advertencias.push(`Fila ${filaNumero}: no tenía código, se generó ${codigo}.`);
      }

      filas_ok += 1;
    } catch (err) {
      filas_error += 1;
      errores.push(`Fila ${filaNumero}: ${err.message || 'Error desconocido.'}`);

      await crearDetalleImportacion({
        importacion_id: importacion.id,
        fila_numero: filaNumero,
        estado: 'error',
        mensaje: err.message || 'Error desconocido.',
        fila,
        producto_id: null,
        lote_id: null,
        movimiento_id: null,
      });
    }
  }

  const estadoFinal =
    filas_error > 0
      ? filas_ok > 0
        ? 'completada_con_errores'
        : 'error'
      : 'completada';

  const resumen = {
    total_filas: filas.length,
    filas_ok,
    filas_error,
    errores,
    advertencias,
    ubicacion_destino: ubicacionDestino?.nombre || null,
  };

  await finalizarImportacion(importacion.id, {
    filas_ok,
    filas_error,
    estado: estadoFinal,
    resumen,
  });

  return {
    importacion_id: importacion.id,
    estado: estadoFinal,
    total_filas: filas.length,
    filas_ok,
    filas_error,
    errores,
    advertencias,
  };
}

/* =========================================================
   CATALOGOS
========================================================= */

export async function listarCategoriasProductos() {
  const { data, error } = await supabase
    .from('categorias_productos')
    .select('id, nombre, descripcion')
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las categorías.');
  }

  return data || [];
}

export async function listarUnidadesMedida() {
  const { data, error } = await supabase
    .from('unidades_medida')
    .select('id, nombre, abreviatura')
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las unidades.');
  }

  return data || [];
}

export async function listarTiposMateriales() {
  const { data, error } = await supabase
    .from('tipos_materiales')
    .select('id, nombre, descripcion, activo')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los tipos de materiales.');
  }

  return data || [];
}

export async function listarUbicaciones({ soloActivas = true, incluirSubareas = true } = {}) {
  let query = supabase
    .from('ubicaciones')
    .select(`
      id,
      codigo,
      nombre,
      descripcion,
      tipo,
      es_principal,
      activa,
      orden,
      created_at,
      updated_at
    `)
    .order('es_principal', { ascending: false })
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true });

  if (soloActivas) {
    query = query.eq('activa', true);
  }

  if (!incluirSubareas) {
    query = query.neq('tipo', 'subarea');
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las ubicaciones.');
  }

  return data || [];
}

export async function listarEstaciones() {
  const { data, error } = await supabase
    .from('ubicaciones')
    .select(`
      id,
      codigo,
      nombre,
      descripcion,
      tipo,
      es_principal,
      activa,
      orden
    `)
    .eq('activa', true)
    .in('tipo', ['almacen', 'estacion'])
    .order('es_principal', { ascending: false })
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las estaciones.');
  }

  return data || [];
}

/* =========================================================
   STOCK
========================================================= */

export async function listarStockUbicacion(filtro = '') {
  const { data, error } = await supabase
    .from('stock_ubicacion')
    .select(`
      id,
      producto_id,
      lote_id,
      ubicacion_id,
      cantidad,
      productos (
        id,
        codigo,
        nombre,
        stock_minimo,
        categorias_productos (
          id,
          nombre
        ),
        tipos_materiales (
          id,
          nombre
        )
      ),
      lotes (
        id,
        numero_lote,
        fecha_vencimiento,
        activo
      ),
      ubicaciones (
        id,
        codigo,
        nombre,
        tipo,
        es_principal,
        activa
      )
    `)
    .order('id', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudo cargar el stock.');
  }

  let lista = data || [];

  if (filtro?.trim()) {
    const texto = filtro.trim().toLowerCase();
    lista = lista.filter((item) => {
      const codigo = item.productos?.codigo?.toLowerCase() || '';
      const nombre = item.productos?.nombre?.toLowerCase() || '';
      const categoria = item.productos?.categorias_productos?.nombre?.toLowerCase() || '';
      const tipoMaterial = item.productos?.tipos_materiales?.nombre?.toLowerCase() || '';
      const ubicacion = item.ubicaciones?.nombre?.toLowerCase() || '';
      const lote = item.lotes?.numero_lote?.toLowerCase() || '';

      return (
        codigo.includes(texto) ||
        nombre.includes(texto) ||
        categoria.includes(texto) ||
        tipoMaterial.includes(texto) ||
        ubicacion.includes(texto) ||
        lote.includes(texto)
      );
    });
  }

  return lista;
}

export async function obtenerStockProductoEnUbicacion(productoId, loteId, ubicacionId) {
  return await obtenerCantidadStock(productoId, loteId || null, ubicacionId);
}

/* =========================================================
   LOTES
========================================================= */

export async function listarLotesProducto(productoId) {
  const { data, error } = await supabase
    .from('lotes')
    .select(`
      id,
      producto_id,
      numero_lote,
      fecha_vencimiento,
      fecha_fabricacion,
      activo,
      cantidad_inicial,
      created_at,
      updated_at
    `)
    .eq('producto_id', productoId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los lotes.');
  }

  return data || [];
}

export async function crearLote(payload) {
  const datos = {
    producto_id: payload.producto_id,
    numero_lote: limpiarTexto(payload.numero_lote),
    fecha_vencimiento: payload.fecha_vencimiento || null,
    fecha_fabricacion: payload.fecha_fabricacion || null,
    activo: payload.activo ?? true,
    cantidad_inicial: normalizarNumero(payload.cantidad_inicial, 0),
  };

  const { data, error } = await supabase
    .from('lotes')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo registrar el lote.');
  }

  return data;
}

/* =========================================================
   ALERTAS
========================================================= */

export async function listarAlertasInventario() {
  const { data, error } = await supabase
    .from('alertas_inventario')
    .select(`
      id,
      producto_id,
      lote_id,
      ubicacion_id,
      tipo_alerta,
      mensaje,
      nivel,
      atendida,
      fecha,
      fecha_atendida,
      productos (
        id,
        codigo,
        nombre
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
    .order('fecha', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las alertas.');
  }

  return data || [];
}

/* =========================================================
   MOVIMIENTOS DE INVENTARIO
========================================================= */

export async function listarMovimientosInventario(filtro = '') {
  const { data, error } = await supabase
    .from('movimientos_inventario')
    .select(`
      id,
      producto_id,
      lote_id,
      ubicacion_id,
      tipo,
      cantidad,
      referencia,
      usuario_id,
      fecha,
      origen_ubicacion_id,
      destino_ubicacion_id,
      modulo_origen,
      referencia_id,
      observacion,
      estado,
      documento_tipo,
      documento_numero,
      created_at,
      productos (
        id,
        codigo,
        nombre
      ),
      lotes (
        id,
        numero_lote,
        fecha_vencimiento
      ),
      ubicacion:ubicaciones!movimientos_inventario_ubicacion_id_fkey (
        id,
        nombre,
        tipo,
        es_principal
      ),
      origen_ubicacion:ubicaciones!movimientos_inventario_origen_ubicacion_id_fkey (
        id,
        nombre,
        tipo,
        es_principal
      ),
      destino_ubicacion:ubicaciones!movimientos_inventario_destino_ubicacion_id_fkey (
        id,
        nombre,
        tipo,
        es_principal
      ),
      usuarios (
        id,
        username,
        nombre,
        apellido
      )
    `)
    .order('fecha', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los movimientos.');
  }

  let lista = data || [];

  if (filtro?.trim()) {
    const texto = filtro.trim().toLowerCase();
    lista = lista.filter((m) => {
      const codigo = m.productos?.codigo?.toLowerCase() || '';
      const nombre = m.productos?.nombre?.toLowerCase() || '';
      const tipo = m.tipo?.toLowerCase() || '';
      const referencia = m.referencia?.toLowerCase() || '';
      const modulo = m.modulo_origen?.toLowerCase() || '';
      const documento = m.documento_numero?.toLowerCase() || '';
      const ubicacion = m.ubicacion?.nombre?.toLowerCase() || '';
      const origen = m.origen_ubicacion?.nombre?.toLowerCase() || '';
      const destino = m.destino_ubicacion?.nombre?.toLowerCase() || '';

      return (
        codigo.includes(texto) ||
        nombre.includes(texto) ||
        tipo.includes(texto) ||
        referencia.includes(texto) ||
        modulo.includes(texto) ||
        documento.includes(texto) ||
        ubicacion.includes(texto) ||
        origen.includes(texto) ||
        destino.includes(texto)
      );
    });
  }

  return lista;
}

export async function registrarMovimientoInventario(payload) {
  const tipo = payload.tipo;
  const cantidad = normalizarNumero(payload.cantidad, 0);

  if (cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor que cero.');
  }

  if (!payload.producto_id) {
    throw new Error('Debes seleccionar un producto.');
  }

  const tiposSoportados = [
    'entrada',
    'salida',
    'transferencia',
    'ajuste',
    'devolucion',
    'consumo',
    'vencido',
    'perdida',
  ];

  if (!tiposSoportados.includes(tipo)) {
    throw new Error('Tipo de movimiento no soportado.');
  }

  let resultado = null;

  if (tipo === 'entrada') {
    resultado = await aplicarEntrada(payload);
  } else if (tipo === 'salida') {
    resultado = await aplicarSalida(payload);
  } else if (tipo === 'transferencia') {
    resultado = await aplicarTransferencia(payload);
  } else if (tipo === 'ajuste') {
    resultado = await aplicarAjuste(payload);
  } else if (tipo === 'devolucion') {
    resultado = await aplicarDevolucion(payload);
  } else if (tipo === 'consumo') {
    resultado = await aplicarConsumo(payload);
  } else if (tipo === 'vencido') {
    resultado = await aplicarBaja(payload, 'vencido');
  } else if (tipo === 'perdida') {
    resultado = await aplicarBaja(payload, 'perdida');
  }

  await generarAlertasProducto(payload.producto_id);

  return resultado;
}

async function construirMovimientoBase(payload, overrides = {}) {
  return {
    producto_id: payload.producto_id,
    lote_id: payload.lote_id || null,
    ubicacion_id: payload.ubicacion_id || null,
    tipo: payload.tipo,
    cantidad: normalizarNumero(payload.cantidad, 0),
    referencia: limpiarTexto(payload.referencia) || null,
    usuario_id: payload.usuario_id || null,
    fecha: payload.fecha || fechaIsoActual(),
    origen_ubicacion_id: payload.origen_ubicacion_id || null,
    destino_ubicacion_id: payload.destino_ubicacion_id || null,
    modulo_origen: payload.modulo_origen || 'inventario',
    referencia_id: payload.referencia_id || null,
    observacion: limpiarTexto(payload.observacion) || null,
    estado: payload.estado || 'aplicado',
    documento_tipo: payload.documento_tipo || null,
    documento_numero: limpiarTexto(payload.documento_numero) || null,
    ...overrides,
  };
}

async function insertarMovimiento(movimiento) {
  const { data, error } = await supabase
    .from('movimientos_inventario')
    .insert([movimiento])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo registrar el movimiento.');
  }

  return data;
}

async function aplicarEntrada(payload) {
  const ubicacionId =
    payload.ubicacion_id || payload.destino_ubicacion_id || (await obtenerUbicacionPrincipal())?.id;

  if (!ubicacionId) {
    throw new Error('No se encontró una ubicación válida para la entrada.');
  }

  const movimiento = await construirMovimientoBase(payload, {
    tipo: 'entrada',
    ubicacion_id: ubicacionId,
    destino_ubicacion_id: payload.destino_ubicacion_id || ubicacionId,
  });

  const movimientoGuardado = await insertarMovimiento(movimiento);
  await sumarStock(
    payload.producto_id,
    payload.lote_id || null,
    ubicacionId,
    normalizarNumero(payload.cantidad, 0)
  );

  return movimientoGuardado;
}

async function aplicarSalida(payload) {
  const ubicacionId = payload.ubicacion_id || payload.origen_ubicacion_id;

  if (!ubicacionId) {
    throw new Error('Debes indicar la ubicación de salida.');
  }

  const disponible = await obtenerCantidadStock(
    payload.producto_id,
    payload.lote_id || null,
    ubicacionId
  );

  const cantidad = normalizarNumero(payload.cantidad, 0);

  if (disponible < cantidad) {
    throw new Error('No hay stock suficiente para la salida.');
  }

  const movimiento = await construirMovimientoBase(payload, {
    tipo: 'salida',
    ubicacion_id: ubicacionId,
    origen_ubicacion_id: payload.origen_ubicacion_id || ubicacionId,
  });

  const movimientoGuardado = await insertarMovimiento(movimiento);
  await sumarStock(payload.producto_id, payload.lote_id || null, ubicacionId, -cantidad);

  return movimientoGuardado;
}

async function aplicarTransferencia(payload) {
  const origenId = payload.origen_ubicacion_id;
  const destinoId = payload.destino_ubicacion_id;
  const cantidad = normalizarNumero(payload.cantidad, 0);

  if (!origenId || !destinoId) {
    throw new Error('Debes indicar origen y destino.');
  }

  if (origenId === destinoId) {
    throw new Error('El origen y el destino no pueden ser iguales.');
  }

  const disponible = await obtenerCantidadStock(
    payload.producto_id,
    payload.lote_id || null,
    origenId
  );

  if (disponible < cantidad) {
    throw new Error('No hay stock suficiente para la transferencia.');
  }

  const movimiento = await construirMovimientoBase(payload, {
    tipo: 'transferencia',
    ubicacion_id: origenId,
    origen_ubicacion_id: origenId,
    destino_ubicacion_id: destinoId,
  });

  const movimientoGuardado = await insertarMovimiento(movimiento);
  await sumarStock(payload.producto_id, payload.lote_id || null, origenId, -cantidad);
  await sumarStock(payload.producto_id, payload.lote_id || null, destinoId, cantidad);

  return movimientoGuardado;
}

async function aplicarAjuste(payload) {
  const ubicacionId = payload.ubicacion_id;

  if (!ubicacionId) {
    throw new Error('Debes indicar la ubicación del ajuste.');
  }

  const delta = normalizarNumero(payload.cantidad, 0);

  const movimiento = await construirMovimientoBase(payload, {
    tipo: 'ajuste',
    ubicacion_id: ubicacionId,
  });

  const disponible = await obtenerCantidadStock(
    payload.producto_id,
    payload.lote_id || null,
    ubicacionId
  );

  const nuevaCantidad = disponible + delta;

  if (nuevaCantidad < 0) {
    throw new Error('El ajuste dejaría el stock negativo.');
  }

  const movimientoGuardado = await insertarMovimiento(movimiento);
  await sumarStock(payload.producto_id, payload.lote_id || null, ubicacionId, delta);

  return movimientoGuardado;
}

async function aplicarDevolucion(payload) {
  const destinoId =
    payload.destino_ubicacion_id || payload.ubicacion_id || (await obtenerUbicacionPrincipal())?.id;

  if (!destinoId) {
    throw new Error('Debes indicar la ubicación destino de la devolución.');
  }

  const origenId = payload.origen_ubicacion_id || null;
  const cantidad = normalizarNumero(payload.cantidad, 0);

  if (origenId) {
    const disponible = await obtenerCantidadStock(
      payload.producto_id,
      payload.lote_id || null,
      origenId
    );

    if (disponible < cantidad) {
      throw new Error('No hay stock suficiente en la ubicación de origen para devolver.');
    }
  }

  const movimiento = await construirMovimientoBase(payload, {
    tipo: 'devolucion',
    ubicacion_id: destinoId,
    origen_ubicacion_id: origenId,
    destino_ubicacion_id: destinoId,
  });

  const movimientoGuardado = await insertarMovimiento(movimiento);

  if (origenId) {
    await sumarStock(payload.producto_id, payload.lote_id || null, origenId, -cantidad);
  }

  await sumarStock(payload.producto_id, payload.lote_id || null, destinoId, cantidad);

  return movimientoGuardado;
}

async function aplicarConsumo(payload) {
  const ubicacionId = payload.ubicacion_id || payload.origen_ubicacion_id;
  const cantidad = normalizarNumero(payload.cantidad, 0);

  if (!ubicacionId) {
    throw new Error('Debes indicar la ubicación del consumo.');
  }

  const disponible = await obtenerCantidadStock(
    payload.producto_id,
    payload.lote_id || null,
    ubicacionId
  );

  if (disponible < cantidad) {
    throw new Error('No hay stock suficiente para registrar el consumo.');
  }

  const movimiento = await construirMovimientoBase(payload, {
    tipo: 'consumo',
    ubicacion_id: ubicacionId,
    origen_ubicacion_id: ubicacionId,
  });

  const movimientoGuardado = await insertarMovimiento(movimiento);
  await sumarStock(payload.producto_id, payload.lote_id || null, ubicacionId, -cantidad);

  return movimientoGuardado;
}

async function aplicarBaja(payload, tipoBaja) {
  const ubicacionId = payload.ubicacion_id || payload.origen_ubicacion_id;
  const cantidad = normalizarNumero(payload.cantidad, 0);

  if (!ubicacionId) {
    throw new Error(`Debes indicar la ubicación del movimiento ${tipoBaja}.`);
  }

  const disponible = await obtenerCantidadStock(
    payload.producto_id,
    payload.lote_id || null,
    ubicacionId
  );

  if (disponible < cantidad) {
    throw new Error(`No hay stock suficiente para registrar ${tipoBaja}.`);
  }

  const movimiento = await construirMovimientoBase(payload, {
    tipo: tipoBaja,
    ubicacion_id: ubicacionId,
    origen_ubicacion_id: ubicacionId,
  });

  const movimientoGuardado = await insertarMovimiento(movimiento);
  await sumarStock(payload.producto_id, payload.lote_id || null, ubicacionId, -cantidad);

  return movimientoGuardado;
}

/* =========================================================
   STOCK INTERNO
========================================================= */

async function obtenerCantidadStock(productoId, loteId, ubicacionId) {
  if (!productoId || !ubicacionId) return 0;

  let query = supabase
    .from('stock_ubicacion')
    .select('id, cantidad')
    .eq('producto_id', productoId)
    .eq('ubicacion_id', ubicacionId);

  if (loteId) {
    query = query.eq('lote_id', loteId);
  } else {
    query = query.is('lote_id', null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo consultar el stock.');
  }

  return normalizarNumero(data?.cantidad, 0);
}

async function sumarStock(productoId, loteId, ubicacionId, delta) {
  if (!productoId) {
    throw new Error('Producto no válido para actualizar stock.');
  }

  if (!ubicacionId) {
    throw new Error('Ubicación no válida para actualizar stock.');
  }

  let query = supabase
    .from('stock_ubicacion')
    .select('id, cantidad')
    .eq('producto_id', productoId)
    .eq('ubicacion_id', ubicacionId);

  if (loteId) {
    query = query.eq('lote_id', loteId);
  } else {
    query = query.is('lote_id', null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el stock.');
  }

  if (!data) {
    const cantidadNueva = normalizarNumero(delta, 0);

    if (cantidadNueva < 0) {
      throw new Error('No se puede dejar stock negativo.');
    }

    const { error: insertError } = await supabase.from('stock_ubicacion').insert([
      {
        producto_id: productoId,
        lote_id: loteId || null,
        ubicacion_id: ubicacionId,
        cantidad: cantidadNueva,
      },
    ]);

    if (insertError) {
      throw new Error(insertError.message || 'No se pudo crear el stock.');
    }

    return;
  }

  const nuevaCantidad = normalizarNumero(data.cantidad, 0) + normalizarNumero(delta, 0);

  if (nuevaCantidad < 0) {
    throw new Error('No se puede dejar stock negativo.');
  }

  const { error: updateError } = await supabase
    .from('stock_ubicacion')
    .update({ cantidad: nuevaCantidad })
    .eq('id', data.id);

  if (updateError) {
    throw new Error(updateError.message || 'No se pudo actualizar el stock.');
  }
}

/* =========================================================
   ALERTAS INTERNAS
========================================================= */

async function generarAlertasProducto(productoId) {
  const { data: producto, error: productoError } = await supabase
    .from('productos')
    .select('id, nombre, stock_minimo')
    .eq('id', productoId)
    .single();

  if (productoError) {
    throw new Error(productoError.message || 'No se pudo validar alertas.');
  }

  const { data: stocks, error: stockError } = await supabase
    .from('stock_ubicacion')
    .select(`
      id,
      cantidad,
      ubicacion_id,
      lote_id,
      ubicaciones (
        id,
        nombre
      ),
      lotes (
        id,
        numero_lote,
        fecha_vencimiento
      )
    `)
    .eq('producto_id', productoId);

  if (stockError) {
    throw new Error(stockError.message || 'No se pudo validar alertas de stock.');
  }

  for (const item of stocks || []) {
    const cantidad = normalizarNumero(item.cantidad, 0);

    if (cantidad === 0) {
      await crearAlertaInventarioSiNoExiste({
        producto_id: productoId,
        lote_id: item.lote_id || null,
        ubicacion_id: item.ubicacion_id || null,
        tipo_alerta: 'agotado',
        nivel: 'alta',
        mensaje: `${producto.nombre} está agotado en ${item.ubicaciones?.nombre || 'ubicación'}.`,
      });
    } else if (cantidad <= normalizarNumero(producto.stock_minimo, 0)) {
      await crearAlertaInventarioSiNoExiste({
        producto_id: productoId,
        lote_id: item.lote_id || null,
        ubicacion_id: item.ubicacion_id || null,
        tipo_alerta: 'stock_bajo',
        nivel: 'media',
        mensaje: `${producto.nombre} está por debajo del stock mínimo en ${item.ubicaciones?.nombre || 'ubicación'}.`,
      });
    }

    const fv = item.lotes?.fecha_vencimiento;
    if (fv) {
      const hoy = new Date();
      const venc = new Date(fv);
      const diffDias = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));

      if (diffDias < 0) {
        await crearAlertaInventarioSiNoExiste({
          producto_id: productoId,
          lote_id: item.lote_id || null,
          ubicacion_id: item.ubicacion_id || null,
          tipo_alerta: 'vencido',
          nivel: 'critica',
          mensaje: `${producto.nombre} lote ${item.lotes?.numero_lote || ''} está vencido.`,
        });
      } else if (diffDias <= 30) {
        await crearAlertaInventarioSiNoExiste({
          producto_id: productoId,
          lote_id: item.lote_id || null,
          ubicacion_id: item.ubicacion_id || null,
          tipo_alerta: 'proximo_vencer',
          nivel: 'alta',
          mensaje: `${producto.nombre} lote ${item.lotes?.numero_lote || ''} vence pronto.`,
        });
      }
    }
  }
}

async function crearAlertaInventarioSiNoExiste(alerta) {
  let query = supabase
    .from('alertas_inventario')
    .select('id')
    .eq('producto_id', alerta.producto_id)
    .eq('tipo_alerta', alerta.tipo_alerta)
    .eq('atendida', false)
    .eq('ubicacion_id', alerta.ubicacion_id || null);

  if (alerta.lote_id) {
    query = query.eq('lote_id', alerta.lote_id);
  } else {
    query = query.is('lote_id', null);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(error.message || 'No se pudo verificar la alerta.');
  }

  if ((data || []).length > 0) {
    return;
  }

  const { error: insertError } = await supabase.from('alertas_inventario').insert([alerta]);

  if (insertError) {
    throw new Error(insertError.message || 'No se pudo crear la alerta.');
  }
}

/* =========================================================
   PROVEEDORES
========================================================= */

export async function listarProveedores(filtro = '') {
  let query = supabase
    .from('proveedores')
    .select('id, nombre, telefono, correo, rnc, direccion, activo')
    .order('nombre', { ascending: true });

  if (filtro?.trim()) {
    const texto = filtro.trim();
    query = query.or(`nombre.ilike.%${texto}%,rnc.ilike.%${texto}%,correo.ilike.%${texto}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los proveedores.');
  }

  return data || [];
}

export async function crearProveedor(payload) {
  const datos = {
    nombre: limpiarTexto(payload.nombre),
    telefono: limpiarTexto(payload.telefono) || null,
    correo: limpiarTexto(payload.correo) || null,
    rnc: limpiarTexto(payload.rnc) || null,
    direccion: limpiarTexto(payload.direccion) || null,
    activo: payload.activo ?? true,
  };

  const { data, error } = await supabase
    .from('proveedores')
    .insert([datos])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo registrar el proveedor.');
  }

  return data;
}

/* =========================================================
   ORDENES DE COMPRA
========================================================= */

export async function listarOrdenesCompra(filtro = '') {
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select(`
      id,
      numero,
      proveedor_id,
      usuario_id,
      fecha,
      estado,
      observacion,
      subtotal,
      itbis,
      total,
      created_at,
      updated_at,
      proveedores (
        id,
        nombre,
        rnc
      ),
      usuarios (
        id,
        username,
        nombre,
        apellido
      )
    `)
    .order('fecha', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las órdenes de compra.');
  }

  let lista = data || [];

  if (filtro?.trim()) {
    const texto = filtro.trim().toLowerCase();
    lista = lista.filter((o) => {
      const numero = o.numero?.toLowerCase() || '';
      const proveedor = o.proveedores?.nombre?.toLowerCase() || '';
      const estado = o.estado?.toLowerCase() || '';
      return numero.includes(texto) || proveedor.includes(texto) || estado.includes(texto);
    });
  }

  return lista;
}

export async function listarOrdenesCompraPendientes() {
  const { data, error } = await supabase
    .from('v_ordenes_compra_pendientes')
    .select('*')
    .gt('cantidad_pendiente', 0)
    .order('fecha', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las órdenes pendientes.');
  }

  return data || [];
}

/* =========================================================
   RECEPCION PARCIAL DE COMPRAS
========================================================= */

export async function listarRecepcionesCompra() {
  const { data, error } = await supabase
    .from('recepciones_compra')
    .select(`
      id,
      orden_compra_id,
      proveedor_id,
      usuario_id,
      ubicacion_id,
      numero_recepcion,
      fecha,
      estado,
      observacion,
      created_at,
      updated_at,
      proveedores (
        id,
        nombre
      ),
      ubicaciones (
        id,
        nombre,
        tipo,
        es_principal
      ),
      ordenes_compra (
        id,
        numero,
        estado
      )
    `)
    .order('fecha', { ascending: false });

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las recepciones de compra.');
  }

  return data || [];
}

export async function registrarRecepcionCompra(payload) {
  if (!payload.orden_compra_id) {
    throw new Error('Debes seleccionar una orden de compra.');
  }

  if (!Array.isArray(payload.detalles) || payload.detalles.length === 0) {
    throw new Error('Debes agregar al menos un producto recibido.');
  }

  const ubicacionDestino =
    payload.ubicacion_id || (await obtenerUbicacionPrincipal())?.id;

  if (!ubicacionDestino) {
    throw new Error('No se encontró el almacén principal para registrar la recepción.');
  }

  const numeroRecepcion =
    limpiarTexto(payload.numero_recepcion) || (await generarNumeroRecepcionCompra());

  const cabecera = {
    orden_compra_id: payload.orden_compra_id,
    proveedor_id: payload.proveedor_id || null,
    usuario_id: payload.usuario_id || null,
    ubicacion_id: ubicacionDestino,
    numero_recepcion: numeroRecepcion,
    fecha: payload.fecha || fechaIsoActual(),
    estado: payload.estado || 'aplicada',
    observacion: limpiarTexto(payload.observacion) || null,
  };

  const { data: recepcion, error: recepcionError } = await supabase
    .from('recepciones_compra')
    .insert([cabecera])
    .select()
    .single();

  if (recepcionError) {
    throw new Error(recepcionError.message || 'No se pudo registrar la recepción.');
  }

  for (const item of payload.detalles) {
    const cantidad = normalizarNumero(item.cantidad_recibida, 0);
    const precio = normalizarNumero(item.precio_unitario, 0);

    if (cantidad <= 0) continue;

    const detalle = {
      recepcion_id: recepcion.id,
      orden_compra_detalle_id: item.orden_compra_detalle_id || null,
      producto_id: item.producto_id,
      lote_id: item.lote_id || null,
      cantidad_recibida: cantidad,
      precio_unitario: precio,
    };

    const { error: detalleError } = await supabase
      .from('recepciones_compra_detalle')
      .insert([detalle]);

    if (detalleError) {
      throw new Error(detalleError.message || 'No se pudo registrar el detalle de la recepción.');
    }

    await registrarMovimientoInventario({
      tipo: 'entrada',
      producto_id: item.producto_id,
      lote_id: item.lote_id || null,
      ubicacion_id: ubicacionDestino,
      destino_ubicacion_id: ubicacionDestino,
      cantidad,
      referencia: `Recepción ${numeroRecepcion}`,
      usuario_id: payload.usuario_id || null,
      fecha: payload.fecha || fechaIsoActual(),
      modulo_origen: 'compras',
      referencia_id: recepcion.id,
      documento_tipo: 'recepcion_compra',
      documento_numero: numeroRecepcion,
      observacion: limpiarTexto(payload.observacion) || 'Entrada por recepción de compra',
    });
  }

  await actualizarEstadoOrdenCompraSegunRecepcion(payload.orden_compra_id);

  return recepcion;
}

async function actualizarEstadoOrdenCompraSegunRecepcion(ordenCompraId) {
  const { data, error } = await supabase
    .from('v_ordenes_compra_pendientes')
    .select('cantidad_pendiente')
    .eq('orden_compra_id', ordenCompraId);

  if (error) {
    throw new Error(error.message || 'No se pudo validar el estado de la orden de compra.');
  }

  const pendientes = (data || []).some(
    (item) => normalizarNumero(item.cantidad_pendiente, 0) > 0
  );

  const nuevoEstado = pendientes ? 'enviada' : 'recibida';

  const { error: updateError } = await supabase
    .from('ordenes_compra')
    .update({
      estado: nuevoEstado,
      updated_at: fechaIsoActual(),
    })
    .eq('id', ordenCompraId);

  if (updateError) {
    throw new Error(updateError.message || 'No se pudo actualizar el estado de la orden de compra.');
  }
}

export async function generarNumeroRecepcionCompra() {
  const { data, error } = await supabase.rpc('generar_numero_recepcion_compra');

  if (error) {
    throw new Error(error.message || 'No se pudo generar el número de recepción.');
  }

  return data;
}