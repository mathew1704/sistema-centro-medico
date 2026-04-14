import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import {
  actualizarProducto,
  crearLote,
  crearProducto,
  eliminarProducto,
  generarNumeroRecepcionCompra,
  importarProductosDesdeFilas,
  listarAlertasInventario,
  listarCategoriasProductos,
  listarLotesProducto,
  listarMovimientosInventario,
  listarOrdenesCompraPendientes,
  listarProductosInventario,
  listarStockUbicacion,
  listarTiposMateriales,
  listarUbicaciones,
  listarUnidadesMedida,
  obtenerProductoPorId,
  registrarMovimientoInventario,
  registrarRecepcionCompra,
} from '../../services/inventarioService';
import {
  buttonPrimaryStyle,
  buttonSoftStyle,
  cardStyle,
  getUiColors,
  inputStyle,
  labelStyle,
  pageWrapperStyle,
  selectStyle,
  statCardStyle,
} from '../../styles/uiTheme';

const modeloProducto = {
  id: null,
  codigo: '',
  nombre: '',
  categoria_id: '',
  unidad_id: '',
  tipo_material_id: '',
  precio_compra: '',
  precio_venta: '',
  stock_minimo: '',
  requiere_lote: true,
  activo: true,
};

const modeloMovimiento = {
  tipo: 'entrada',
  producto_id: '',
  lote_id: '',
  ubicacion_id: '',
  origen_ubicacion_id: '',
  destino_ubicacion_id: '',
  cantidad: 1,
  referencia: '',
  observacion: '',
  documento_tipo: '',
  documento_numero: '',
  modulo_origen: 'inventario',
};

const modeloLote = {
  producto_id: '',
  numero_lote: '',
  fecha_vencimiento: '',
  fecha_fabricacion: '',
  activo: true,
  cantidad_inicial: 0,
};

const modeloRecepcion = {
  orden_compra_id: '',
  proveedor_id: '',
  ubicacion_id: '',
  numero_recepcion: '',
  fecha: '',
  observacion: '',
  detalles: [],
};

function leerArchivoExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (evento) => {
      try {
        const data = new Uint8Array(evento.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const nombreHoja = workbook.SheetNames[0];

        if (!nombreHoja) {
          reject(new Error('El archivo no contiene hojas.'));
          return;
        }

        const hoja = workbook.Sheets[nombreHoja];
        const filas = XLSX.utils.sheet_to_json(hoja, {
          defval: '',
          raw: false,
          dateNF: 'yyyy-mm-dd',
        });

        resolve(filas);
      } catch (error) {
        reject(new Error('No se pudo leer el archivo Excel.'));
      }
    };

    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsArrayBuffer(file);
  });
}

function obtenerNombreUsuario(usuarioMovimiento) {
  if (!usuarioMovimiento) return '-';
  const nombre = [usuarioMovimiento.nombre, usuarioMovimiento.apellido]
    .filter(Boolean)
    .join(' ')
    .trim();

  return nombre || usuarioMovimiento.username || '-';
}

function obtenerUbicacionMovimiento(m) {
  const ubicacionDirecta = m.ubicacion?.nombre || '-';
  const origen = m.origen_ubicacion?.nombre || '-';
  const destino = m.destino_ubicacion?.nombre || '-';

  if (m.tipo === 'transferencia' || m.tipo === 'devolucion') {
    return `${origen} → ${destino}`;
  }

  return ubicacionDirecta;
}

function obtenerTextoTipoMovimiento(tipo) {
  const mapa = {
    entrada: 'Entrada',
    salida: 'Salida',
    transferencia: 'Transferencia',
    ajuste: 'Ajuste',
    devolucion: 'Devolución',
    consumo: 'Consumo',
    vencido: 'Vencido',
    perdida: 'Pérdida',
  };

  return mapa[tipo] || tipo;
}

const Inventario = ({ darkMode = false }) => {
  const { usuario } = useAuth();
  const inputFileRef = useRef(null);
  const colores = getUiColors(darkMode);

  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [tiposMateriales, setTiposMateriales] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [stock, setStock] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [lotesMovimiento, setLotesMovimiento] = useState([]);
  const [ordenesPendientes, setOrdenesPendientes] = useState([]);

  const [filtroProducto, setFiltroProducto] = useState('');
  const [filtroStock, setFiltroStock] = useState('');
  const [filtroMovimiento, setFiltroMovimiento] = useState('');

  const [formProducto, setFormProducto] = useState(modeloProducto);
  const [formMovimiento, setFormMovimiento] = useState(modeloMovimiento);
  const [formLote, setFormLote] = useState(modeloLote);
  const [formRecepcion, setFormRecepcion] = useState(modeloRecepcion);

  const [cargando, setCargando] = useState(false);
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);
  const [guardandoLote, setGuardandoLote] = useState(false);
  const [guardandoRecepcion, setGuardandoRecepcion] = useState(false);

  const [mostrarImportador, setMostrarImportador] = useState(false);
  const [archivoImportacion, setArchivoImportacion] = useState(null);
  const [procesandoImportacion, setProcesandoImportacion] = useState(false);
  const [resultadoImportacion, setResultadoImportacion] = useState(null);
  const [ubicacionImportacionId, setUbicacionImportacionId] = useState('');

  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const totalActivos = useMemo(
    () => productos.filter((p) => p.activo).length,
    [productos]
  );

  const totalBajoStock = useMemo(
    () =>
      stock.filter((s) => {
        const cantidad = Number(s.cantidad || 0);
        const minimo = Number(s.productos?.stock_minimo || 0);
        return cantidad <= minimo;
      }).length,
    [stock]
  );

  const almacenPrincipal = useMemo(
    () => ubicaciones.find((u) => u.es_principal) || null,
    [ubicaciones]
  );

  const estacionesDisponibles = useMemo(
    () => ubicaciones.filter((u) => u.activa !== false),
    [ubicaciones]
  );

  const ordenesAgrupadas = useMemo(() => {
    const mapa = new Map();

    for (const item of ordenesPendientes) {
      if (!mapa.has(item.orden_compra_id)) {
        mapa.set(item.orden_compra_id, {
          orden_compra_id: item.orden_compra_id,
          numero: item.numero,
          proveedor_id: item.proveedor_id,
          proveedor_nombre: item.proveedor_nombre,
          fecha: item.fecha,
          estado: item.estado,
          detalles: [],
        });
      }

      mapa.get(item.orden_compra_id).detalles.push(item);
    }

    return Array.from(mapa.values());
  }, [ordenesPendientes]);

  const detallesRecepcionSeleccionados = useMemo(() => {
    if (!formRecepcion.orden_compra_id) return [];
    return ordenesPendientes.filter(
      (item) => item.orden_compra_id === formRecepcion.orden_compra_id
    );
  }, [ordenesPendientes, formRecepcion.orden_compra_id]);

  useEffect(() => {
    cargarInicial();
  }, []);

  useEffect(() => {
    if (formLote.producto_id) {
      cargarLotes(formLote.producto_id, 'lote');
    } else {
      setLotes([]);
    }
  }, [formLote.producto_id]);

  useEffect(() => {
    if (formMovimiento.producto_id) {
      cargarLotes(formMovimiento.producto_id, 'movimiento');
    } else {
      setLotesMovimiento([]);
      setFormMovimiento((prev) => ({ ...prev, lote_id: '' }));
    }
  }, [formMovimiento.producto_id]);

  useEffect(() => {
    cargarNumeroRecepcion();
  }, []);

  async function cargarInicial() {
    setCargando(true);
    setError('');

    try {
      const [
        listaProductos,
        listaCategorias,
        listaUnidades,
        listaTiposMateriales,
        listaUbicaciones,
        listaStock,
        listaMovimientos,
        listaAlertas,
        listaOrdenesPendientes,
      ] = await Promise.all([
        listarProductosInventario(),
        listarCategoriasProductos(),
        listarUnidadesMedida(),
        listarTiposMateriales(),
        listarUbicaciones(),
        listarStockUbicacion(),
        listarMovimientosInventario(),
        listarAlertasInventario(),
        listarOrdenesCompraPendientes(),
      ]);

      setProductos(listaProductos);
      setCategorias(listaCategorias);
      setUnidades(listaUnidades);
      setTiposMateriales(listaTiposMateriales);
      setUbicaciones(listaUbicaciones);
      setStock(listaStock);
      setMovimientos(listaMovimientos);
      setAlertas(listaAlertas);
      setOrdenesPendientes(listaOrdenesPendientes);

      const principal = listaUbicaciones.find((u) => u.es_principal);

      setFormRecepcion((prev) => ({
        ...prev,
        ubicacion_id: prev.ubicacion_id || principal?.id || '',
      }));

      setUbicacionImportacionId((prev) => prev || principal?.id || '');
    } catch (err) {
      setError(err.message || 'No se pudo cargar el módulo de inventario.');
    } finally {
      setCargando(false);
    }
  }

  async function cargarNumeroRecepcion() {
    try {
      const numero = await generarNumeroRecepcionCompra();
      setFormRecepcion((prev) => ({
        ...prev,
        numero_recepcion: prev.numero_recepcion || numero,
      }));
    } catch {
      // silencioso
    }
  }

  async function cargarLotes(productoId, destino = 'lote') {
    try {
      const lista = await listarLotesProducto(productoId);

      if (destino === 'movimiento') {
        setLotesMovimiento(lista);
      } else {
        setLotes((prev) => {
          const resto = prev.filter((x) => x.producto_id !== productoId);
          return [...lista, ...resto];
        });
      }
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los lotes.');
    }
  }

  function cambiarProducto(campo, valor) {
    setFormProducto((prev) => ({ ...prev, [campo]: valor }));
  }

  function cambiarMovimiento(campo, valor) {
    setFormMovimiento((prev) => ({ ...prev, [campo]: valor }));
  }

  function cambiarLote(campo, valor) {
    setFormLote((prev) => ({ ...prev, [campo]: valor }));
  }

  function cambiarRecepcion(campo, valor) {
    setFormRecepcion((prev) => ({ ...prev, [campo]: valor }));
  }

  function limpiarProducto() {
    setFormProducto(modeloProducto);
    setError('');
    setMensaje('');
  }

  function limpiarMovimiento() {
    setFormMovimiento(modeloMovimiento);
    setLotesMovimiento([]);
    setError('');
    setMensaje('');
  }

  function limpiarLote() {
    setFormLote(modeloLote);
    setLotes([]);
    setError('');
    setMensaje('');
  }

  async function limpiarRecepcion() {
    const numero = await generarNumeroRecepcionCompra().catch(() => '');
    setFormRecepcion({
      ...modeloRecepcion,
      numero_recepcion: numero,
      ubicacion_id: almacenPrincipal?.id || '',
    });
    setError('');
    setMensaje('');
  }

  function abrirImportador() {
    setMostrarImportador(true);
    setResultadoImportacion(null);
    setArchivoImportacion(null);
    setError('');
    setMensaje('');
  }

  function cerrarImportador() {
    setMostrarImportador(false);
    setArchivoImportacion(null);
    setResultadoImportacion(null);
    if (inputFileRef.current) {
      inputFileRef.current.value = '';
    }
  }

  function manejarCambioArchivo(e) {
    const file = e.target.files?.[0] || null;
    setArchivoImportacion(file);
    setResultadoImportacion(null);
  }

  async function procesarImportacion() {
    setError('');
    setMensaje('');
    setResultadoImportacion(null);

    if (!archivoImportacion) {
      setError('Debes seleccionar un archivo Excel o CSV.');
      return;
    }

    const extension = archivoImportacion.name.split('.').pop()?.toLowerCase() || '';
    if (!['xlsx', 'xls', 'csv'].includes(extension)) {
      setError('Solo se permiten archivos .xlsx, .xls o .csv');
      return;
    }

    setProcesandoImportacion(true);

    try {
      const filas = await leerArchivoExcel(archivoImportacion);

      if (!filas.length) {
        throw new Error('El archivo no contiene filas válidas para importar.');
      }

      const resultado = await importarProductosDesdeFilas(filas, {
        usuario_id: usuario?.id || null,
        ubicacion_id: ubicacionImportacionId || almacenPrincipal?.id || null,
        nombre_archivo: archivoImportacion.name,
        tipo_documento: extension,
      });

      setResultadoImportacion(resultado);
      await cargarInicial();
      setMensaje(
        `Importación completada. OK: ${resultado.filas_ok} | Errores: ${resultado.filas_error}`
      );
    } catch (err) {
      setError(err.message || 'No se pudo procesar la importación.');
    } finally {
      setProcesandoImportacion(false);
    }
  }

  async function guardarProducto(e) {
    e.preventDefault();
    setGuardandoProducto(true);
    setError('');
    setMensaje('');

    try {
      if (formProducto.id) {
        await actualizarProducto(formProducto.id, formProducto);
        setMensaje('Producto actualizado correctamente.');
      } else {
        await crearProducto(formProducto);
        setMensaje('Producto registrado correctamente.');
      }

      await cargarInicial();
      limpiarProducto();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el producto.');
    } finally {
      setGuardandoProducto(false);
    }
  }

  async function editarProducto(id) {
    setError('');
    setMensaje('');

    try {
      const p = await obtenerProductoPorId(id);

      setFormProducto({
        id: p.id,
        codigo: p.codigo || '',
        nombre: p.nombre || '',
        categoria_id: p.categoria_id || '',
        unidad_id: p.unidad_id || '',
        tipo_material_id: p.tipo_material_id || '',
        precio_compra: p.precio_compra || '',
        precio_venta: p.precio_venta || '',
        stock_minimo: p.stock_minimo || '',
        requiere_lote: p.requiere_lote ?? true,
        activo: p.activo ?? true,
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'No se pudo cargar el producto.');
    }
  }

  async function borrarProducto(id) {
    const ok = window.confirm('¿Seguro que deseas eliminar este producto?');
    if (!ok) return;

    setError('');
    setMensaje('');

    try {
      await eliminarProducto(id);
      await cargarInicial();
      setMensaje('Producto eliminado correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el producto.');
    }
  }

  async function guardarMovimiento(e) {
    e.preventDefault();
    setGuardandoMovimiento(true);
    setError('');
    setMensaje('');

    try {
      await registrarMovimientoInventario({
        ...formMovimiento,
        usuario_id: usuario?.id || null,
      });

      await cargarInicial();
      limpiarMovimiento();
      setMensaje('Movimiento registrado correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo registrar el movimiento.');
    } finally {
      setGuardandoMovimiento(false);
    }
  }

  async function guardarLote(e) {
    e.preventDefault();
    setGuardandoLote(true);
    setError('');
    setMensaje('');

    try {
      await crearLote(formLote);
      await cargarLotes(formLote.producto_id, 'lote');
      setMensaje('Lote registrado correctamente.');
      setFormLote((prev) => ({
        ...modeloLote,
        producto_id: prev.producto_id,
      }));
    } catch (err) {
      setError(err.message || 'No se pudo registrar el lote.');
    } finally {
      setGuardandoLote(false);
    }
  }

  async function seleccionarOrdenRecepcion(ordenId) {
    const detalles = ordenesPendientes.filter((item) => item.orden_compra_id === ordenId);
    const primera = detalles[0];

    const lotesCargados = [];
    for (const d of detalles) {
      const lista = await listarLotesProducto(d.producto_id).catch(() => []);
      lotesCargados.push(...lista);
    }

    setLotes((prev) => {
      const mapa = new Map();
      [...prev, ...lotesCargados].forEach((l) => mapa.set(l.id, l));
      return Array.from(mapa.values());
    });

    setFormRecepcion((prev) => ({
      ...prev,
      orden_compra_id: ordenId,
      proveedor_id: primera?.proveedor_id || '',
      detalles: detalles.map((d) => ({
        orden_compra_detalle_id: d.orden_compra_detalle_id,
        producto_id: d.producto_id,
        producto_codigo: d.producto_codigo,
        producto_nombre: d.producto_nombre,
        cantidad_pedida: Number(d.cantidad_pedida || 0),
        cantidad_recibida_historica: Number(d.cantidad_recibida || 0),
        cantidad_pendiente: Number(d.cantidad_pendiente || 0),
        precio_unitario: Number(d.precio_unitario || 0),
        cantidad_recibida: Number(d.cantidad_pendiente || 0),
        lote_id: '',
      })),
    }));
  }

  function cambiarDetalleRecepcion(index, campo, valor) {
    setFormRecepcion((prev) => ({
      ...prev,
      detalles: prev.detalles.map((item, i) =>
        i === index ? { ...item, [campo]: valor } : item
      ),
    }));
  }

  async function guardarRecepcionCompra(e) {
    e.preventDefault();
    setGuardandoRecepcion(true);
    setError('');
    setMensaje('');

    try {
      const detallesValidos = (formRecepcion.detalles || [])
        .map((d) => ({
          ...d,
          cantidad_recibida: Number(d.cantidad_recibida || 0),
        }))
        .filter((d) => d.cantidad_recibida > 0);

      if (detallesValidos.length === 0) {
        throw new Error('Debes colocar al menos una cantidad recibida mayor que cero.');
      }

      await registrarRecepcionCompra({
        ...formRecepcion,
        usuario_id: usuario?.id || null,
        detalles: detallesValidos,
      });

      await cargarInicial();
      await limpiarRecepcion();
      setMensaje('Recepción de compra registrada correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo registrar la recepción de compra.');
    } finally {
      setGuardandoRecepcion(false);
    }
  }

  async function buscarProductos() {
    setCargando(true);
    try {
      const lista = await listarProductosInventario(filtroProducto);
      setProductos(lista);
    } catch (err) {
      setError(err.message || 'No se pudieron buscar los productos.');
    } finally {
      setCargando(false);
    }
  }

  async function buscarStock() {
    setCargando(true);
    try {
      const lista = await listarStockUbicacion(filtroStock);
      setStock(lista);
    } catch (err) {
      setError(err.message || 'No se pudo buscar el stock.');
    } finally {
      setCargando(false);
    }
  }

  async function buscarMovimientos() {
    setCargando(true);
    try {
      const lista = await listarMovimientosInventario(filtroMovimiento);
      setMovimientos(lista);
    } catch (err) {
      setError(err.message || 'No se pudieron buscar los movimientos.');
    } finally {
      setCargando(false);
    }
  }

  function claseEstadoProducto(activo) {
    return activo
      ? {
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 800,
          background: darkMode ? 'rgba(5,150,105,0.16)' : '#ecfdf5',
          color: darkMode ? '#6ee7b7' : '#047857',
          border: darkMode ? '1px solid rgba(5,150,105,0.24)' : '1px solid #bbf7d0',
        }
      : {
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 800,
          background: darkMode ? 'rgba(220,38,38,0.14)' : '#fef2f2',
          color: darkMode ? '#fca5a5' : '#b91c1c',
          border: darkMode ? '1px solid rgba(220,38,38,0.24)' : '1px solid #fecaca',
        };
  }

  function claseStock(item) {
    const cantidad = Number(item.cantidad || 0);
    const minimo = Number(item.productos?.stock_minimo || 0);

    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 800,
      border: '1px solid transparent',
    };

    if (cantidad === 0) {
      return {
        ...base,
        background: darkMode ? 'rgba(220,38,38,0.14)' : '#fef2f2',
        color: darkMode ? '#fca5a5' : '#b91c1c',
        borderColor: darkMode ? 'rgba(220,38,38,0.24)' : '#fecaca',
      };
    }

    if (cantidad <= minimo) {
      return {
        ...base,
        background: darkMode ? 'rgba(234,88,12,0.14)' : '#fff7ed',
        color: darkMode ? '#fdba74' : '#c2410c',
        borderColor: darkMode ? 'rgba(234,88,12,0.24)' : '#fed7aa',
      };
    }

    return {
      ...base,
      background: darkMode ? 'rgba(37,99,235,0.14)' : '#eff6ff',
      color: darkMode ? '#93c5fd' : '#1d4ed8',
      borderColor: darkMode ? 'rgba(37,99,235,0.24)' : '#bfdbfe',
    };
  }

  const styles = {
    topBar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '22px',
      flexWrap: 'wrap',
      gap: '18px',
    },
    titleBlock: {
      ...cardStyle(darkMode),
      background: colores.gradienteHeader,
      color: '#ffffff',
      padding: '24px',
      flex: '1 1 700px',
      minWidth: 0,
      position: 'relative',
      overflow: 'hidden',
    },
    titleGlow: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background: `
        radial-gradient(circle at 15% 20%, rgba(255,255,255,0.14) 0%, transparent 20%),
        radial-gradient(circle at 86% 18%, rgba(255,255,255,0.10) 0%, transparent 16%),
        radial-gradient(circle at 70% 82%, rgba(255,255,255,0.08) 0%, transparent 18%)
      `,
    },
    titleInner: {
      position: 'relative',
      zIndex: 1,
    },
    titleChip: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.14)',
      fontSize: '12px',
      fontWeight: 800,
      marginBottom: '14px',
    },
    title: {
      margin: 0,
      fontSize: '32px',
      fontWeight: 900,
      lineHeight: 1.15,
    },
    subtitle: {
      marginTop: '10px',
      marginBottom: 0,
      color: 'rgba(255,255,255,0.90)',
      fontSize: '15px',
      lineHeight: 1.6,
      maxWidth: '760px',
    },
    topBarActions: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      alignItems: 'stretch',
    },
    primaryBtn: {
      ...buttonPrimaryStyle,
      height: '46px',
      borderRadius: '14px',
      boxShadow: '0 10px 22px rgba(37,99,235,0.18)',
    },
    secondaryBtn: {
      ...buttonSoftStyle(darkMode),
      height: '46px',
      padding: '0 16px',
      borderRadius: '14px',
      fontSize: '13px',
    },
    cardsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: '18px',
      marginBottom: '22px',
    },
    metricCard: {
      ...statCardStyle(darkMode),
      minWidth: 0,
    },
    metricIcon: {
      width: '46px',
      height: '46px',
      borderRadius: '16px',
      display: 'grid',
      placeItems: 'center',
      background: darkMode ? '#0b1220' : '#f4f8fc',
      border: `1px solid ${colores.borde}`,
      fontSize: '20px',
      marginBottom: '14px',
    },
    metricGhost: {
      position: 'absolute',
      top: '-14px',
      right: '-8px',
      fontSize: '58px',
      opacity: 0.08,
      pointerEvents: 'none',
    },
    metricLabel: {
      fontSize: '13px',
      color: colores.subtitulo,
      fontWeight: 700,
    },
    metricValue: {
      marginTop: '8px',
      fontSize: '30px',
      fontWeight: 900,
      color: colores.texto,
    },
    stack: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    },
    card: {
      ...cardStyle(darkMode),
      padding: 0,
      overflow: 'hidden',
    },
    cardBody: {
      padding: '20px',
      minWidth: 0,
    },
    sectionTitle: {
      margin: '0 0 16px',
      fontSize: '20px',
      fontWeight: 800,
      color: colores.texto,
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '14px',
      minWidth: 0,
    },
    full: {
      gridColumn: '1 / -1',
      minWidth: 0,
    },
    saveWrap: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '20px',
      flexWrap: 'wrap',
    },
    softBtn: {
      ...buttonSoftStyle(darkMode),
      height: '40px',
      padding: '0 12px',
      borderRadius: '12px',
      fontSize: '13px',
    },
    dangerBtn: {
      height: '40px',
      padding: '0 12px',
      borderRadius: '12px',
      border: darkMode ? '1px solid rgba(220,38,38,0.25)' : '1px solid #fecaca',
      background: darkMode ? 'rgba(220,38,38,0.12)' : '#fef2f2',
      color: darkMode ? '#fca5a5' : '#dc2626',
      cursor: 'pointer',
      fontWeight: 800,
      fontSize: '13px',
    },
    okText: {
      color: darkMode ? '#6ee7b7' : '#059669',
      fontWeight: 600,
      marginTop: '10px',
      fontSize: '13px',
    },
    dangerText: {
      color: darkMode ? '#fca5a5' : '#dc2626',
      fontWeight: 600,
      marginTop: '10px',
      fontSize: '13px',
    },
    searchWrap: {
      display: 'grid',
      gridTemplateColumns: '1.4fr auto',
      gap: '10px',
      marginBottom: '16px',
    },
    tableWrap: {
      width: '100%',
      overflowX: 'auto',
      borderRadius: '18px',
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      minWidth: '1000px',
    },
    th: {
      textAlign: 'left',
      padding: '12px',
      fontSize: '13px',
      color: colores.subtitulo,
      borderBottom: `1px solid ${colores.borde}`,
      background: darkMode ? '#0b1220' : '#f8fbff',
      whiteSpace: 'nowrap',
      fontWeight: 800,
    },
    td: {
      padding: '12px',
      fontSize: '14px',
      borderBottom: `1px solid ${colores.borde}`,
      verticalAlign: 'top',
      color: colores.texto,
    },
    tagPrincipal: {
      background: darkMode ? 'rgba(37,99,235,0.14)' : '#dbeafe',
      color: darkMode ? '#93c5fd' : '#1d4ed8',
      borderRadius: '999px',
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: 800,
      marginLeft: '8px',
      border: darkMode ? '1px solid rgba(37,99,235,0.24)' : 'none',
    },
    miniText: {
      fontSize: '12px',
      color: colores.subtitulo,
      marginTop: '4px',
    },
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      background: darkMode ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    },
    modal: {
      width: 'min(920px, 100%)',
      background: colores.card,
      borderRadius: '22px',
      border: `1px solid ${colores.borde}`,
      boxShadow: darkMode
        ? '0 30px 80px rgba(0,0,0,0.42)'
        : '0 30px 80px rgba(15,23,42,0.18)',
      overflow: 'hidden',
      maxHeight: '90vh',
      overflowY: 'auto',
    },
    modalHeader: {
      padding: '18px 20px',
      borderBottom: `1px solid ${colores.borde}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
      position: 'sticky',
      top: 0,
      background: colores.card,
      zIndex: 1,
    },
    modalTitle: {
      margin: 0,
      color: colores.texto,
      fontSize: '20px',
      fontWeight: 800,
    },
    modalBody: {
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
    },
    importBox: {
      border: darkMode ? '1px dashed rgba(96,165,250,0.35)' : '1px dashed #93c5fd',
      background: colores.cardSoft,
      borderRadius: '18px',
      padding: '18px',
    },
  };

  return (
    <div style={pageWrapperStyle(darkMode)}>
      <div style={styles.topBar}>
        <div style={styles.titleBlock}>
          <div style={styles.titleGlow} />
          <div style={styles.titleInner}>
            <div style={styles.titleChip}>📦 Gestión de inventario</div>
            <h1 style={styles.title}>Inventario</h1>
            <p style={styles.subtitle}>
              Productos, materiales, lotes, estaciones, recepciones, stock y alertas.
            </p>
          </div>
        </div>

        <div style={styles.topBarActions}>
          <button type="button" style={styles.secondaryBtn} onClick={abrirImportador}>
            Importar Excel
          </button>

          <button type="button" style={styles.primaryBtn} onClick={cargarInicial}>
            Actualizar módulo
          </button>
        </div>
      </div>

      <div style={styles.cardsRow}>
        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>📋</div>
          <div style={styles.metricIcon}>📋</div>
          <div style={styles.metricLabel}>Total productos</div>
          <div style={styles.metricValue}>{productos.length}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>✅</div>
          <div style={styles.metricIcon}>✅</div>
          <div style={styles.metricLabel}>Productos activos</div>
          <div style={{ ...styles.metricValue, color: colores.exito }}>{totalActivos}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>⚠️</div>
          <div style={styles.metricIcon}>⚠️</div>
          <div style={styles.metricLabel}>Registros con bajo stock</div>
          <div style={{ ...styles.metricValue, color: '#c2410c' }}>{totalBajoStock}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>🚨</div>
          <div style={styles.metricIcon}>🚨</div>
          <div style={styles.metricLabel}>Alertas abiertas</div>
          <div style={{ ...styles.metricValue, color: '#b91c1c' }}>
            {alertas.filter((a) => !a.atendida).length}
          </div>
        </div>
      </div>

      <div style={styles.stack}>
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>
              {formProducto.id ? 'Editar producto / material' : 'Registro de producto / material'}
            </h3>

            <form onSubmit={guardarProducto}>
              <div style={styles.formGrid}>
                <div>
                  <label style={labelStyle(darkMode)}>Código</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formProducto.codigo}
                    onChange={(e) => cambiarProducto('codigo', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Nombre</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formProducto.nombre}
                    onChange={(e) => cambiarProducto('nombre', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Categoría</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formProducto.categoria_id}
                    onChange={(e) => cambiarProducto('categoria_id', e.target.value)}
                  >
                    <option value="">Seleccione una categoría</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Tipo de material</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formProducto.tipo_material_id}
                    onChange={(e) => cambiarProducto('tipo_material_id', e.target.value)}
                  >
                    <option value="">Seleccione un tipo</option>
                    {tiposMateriales.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Unidad de medida</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formProducto.unidad_id}
                    onChange={(e) => cambiarProducto('unidad_id', e.target.value)}
                  >
                    <option value="">Seleccione una unidad</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} {u.abreviatura ? `(${u.abreviatura})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Precio compra</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={inputStyle(darkMode)}
                    value={formProducto.precio_compra}
                    onChange={(e) => cambiarProducto('precio_compra', e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Precio venta</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={inputStyle(darkMode)}
                    value={formProducto.precio_venta}
                    onChange={(e) => cambiarProducto('precio_venta', e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Stock mínimo</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={inputStyle(darkMode)}
                    value={formProducto.stock_minimo}
                    onChange={(e) => cambiarProducto('stock_minimo', e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Requiere lote</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formProducto.requiere_lote ? 'true' : 'false'}
                    onChange={(e) => cambiarProducto('requiere_lote', e.target.value === 'true')}
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Estado</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formProducto.activo ? 'true' : 'false'}
                    onChange={(e) => cambiarProducto('activo', e.target.value === 'true')}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>

              <div style={styles.saveWrap}>
                <button type="button" style={styles.softBtn} onClick={limpiarProducto}>
                  Limpiar
                </button>

                {formProducto.id ? (
                  <button
                    type="button"
                    style={styles.dangerBtn}
                    onClick={() => borrarProducto(formProducto.id)}
                  >
                    Eliminar
                  </button>
                ) : null}

                <button type="submit" style={styles.primaryBtn} disabled={guardandoProducto}>
                  {guardandoProducto
                    ? 'Guardando...'
                    : formProducto.id
                    ? 'Actualizar producto'
                    : 'Registrar producto'}
                </button>
              </div>

              {error ? <div style={styles.dangerText}>{error}</div> : null}
              {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}
            </form>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>Registrar lote</h3>

            <form onSubmit={guardarLote}>
              <div style={styles.formGrid}>
                <div>
                  <label style={labelStyle(darkMode)}>Producto</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formLote.producto_id}
                    onChange={(e) => cambiarLote('producto_id', e.target.value)}
                    required
                  >
                    <option value="">Seleccione un producto</option>
                    {productos
                      .filter((p) => p.activo)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.codigo} - {p.nombre}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Número de lote</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formLote.numero_lote}
                    onChange={(e) => cambiarLote('numero_lote', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Fecha fabricación</label>
                  <input
                    type="date"
                    style={inputStyle(darkMode)}
                    value={formLote.fecha_fabricacion}
                    onChange={(e) => cambiarLote('fecha_fabricacion', e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Fecha vencimiento</label>
                  <input
                    type="date"
                    style={inputStyle(darkMode)}
                    value={formLote.fecha_vencimiento}
                    onChange={(e) => cambiarLote('fecha_vencimiento', e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Cantidad inicial</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={inputStyle(darkMode)}
                    value={formLote.cantidad_inicial}
                    onChange={(e) => cambiarLote('cantidad_inicial', e.target.value)}
                  />
                </div>
              </div>

              <div style={styles.saveWrap}>
                <button type="button" style={styles.softBtn} onClick={limpiarLote}>
                  Limpiar
                </button>

                <button type="submit" style={styles.primaryBtn} disabled={guardandoLote}>
                  {guardandoLote ? 'Guardando...' : 'Registrar lote'}
                </button>
              </div>
            </form>

            <div style={{ ...styles.tableWrap, marginTop: '16px' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Lote</th>
                    <th style={styles.th}>Fabricación</th>
                    <th style={styles.th}>Vencimiento</th>
                    <th style={styles.th}>Cantidad inicial</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.filter((l) => l.producto_id === formLote.producto_id).length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan="4">
                        No hay lotes cargados para este producto.
                      </td>
                    </tr>
                  ) : (
                    lotes
                      .filter((l) => l.producto_id === formLote.producto_id)
                      .map((l) => (
                        <tr key={l.id}>
                          <td style={styles.td}>{l.numero_lote}</td>
                          <td style={styles.td}>{l.fecha_fabricacion || '-'}</td>
                          <td style={styles.td}>{l.fecha_vencimiento || '-'}</td>
                          <td style={styles.td}>{l.cantidad_inicial}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>Registrar movimiento de inventario</h3>

            <form onSubmit={guardarMovimiento}>
              <div style={styles.formGrid}>
                <div>
                  <label style={labelStyle(darkMode)}>Tipo</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formMovimiento.tipo}
                    onChange={(e) => cambiarMovimiento('tipo', e.target.value)}
                  >
                    <option value="entrada">Entrada</option>
                    <option value="salida">Salida</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="ajuste">Ajuste</option>
                    <option value="devolucion">Devolución</option>
                    <option value="consumo">Consumo</option>
                    <option value="vencido">Vencido</option>
                    <option value="perdida">Pérdida</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Producto</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formMovimiento.producto_id}
                    onChange={(e) => cambiarMovimiento('producto_id', e.target.value)}
                    required
                  >
                    <option value="">Seleccione un producto</option>
                    {productos
                      .filter((p) => p.activo)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.codigo} - {p.nombre}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Lote</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formMovimiento.lote_id}
                    onChange={(e) => cambiarMovimiento('lote_id', e.target.value)}
                  >
                    <option value="">Sin lote</option>
                    {lotesMovimiento.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.numero_lote}
                      </option>
                    ))}
                  </select>
                </div>

                {formMovimiento.tipo === 'transferencia' || formMovimiento.tipo === 'devolucion' ? (
                  <>
                    <div>
                      <label style={labelStyle(darkMode)}>Origen</label>
                      <select
                        style={selectStyle(darkMode)}
                        value={formMovimiento.origen_ubicacion_id}
                        onChange={(e) => cambiarMovimiento('origen_ubicacion_id', e.target.value)}
                        required
                      >
                        <option value="">Seleccione origen</option>
                        {estacionesDisponibles.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre}
                            {u.es_principal ? ' (Principal)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle(darkMode)}>Destino</label>
                      <select
                        style={selectStyle(darkMode)}
                        value={formMovimiento.destino_ubicacion_id}
                        onChange={(e) => cambiarMovimiento('destino_ubicacion_id', e.target.value)}
                        required
                      >
                        <option value="">Seleccione destino</option>
                        {estacionesDisponibles.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre}
                            {u.es_principal ? ' (Principal)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <label style={labelStyle(darkMode)}>Ubicación</label>
                    <select
                      style={selectStyle(darkMode)}
                      value={formMovimiento.ubicacion_id}
                      onChange={(e) => cambiarMovimiento('ubicacion_id', e.target.value)}
                      required
                    >
                      <option value="">Seleccione una ubicación</option>
                      {estacionesDisponibles.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre}
                          {u.es_principal ? ' (Principal)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={labelStyle(darkMode)}>Cantidad</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    style={inputStyle(darkMode)}
                    value={formMovimiento.cantidad}
                    onChange={(e) => cambiarMovimiento('cantidad', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Referencia</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formMovimiento.referencia}
                    onChange={(e) => cambiarMovimiento('referencia', e.target.value)}
                    placeholder="Factura, compra, ajuste..."
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Documento tipo</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formMovimiento.documento_tipo}
                    onChange={(e) => cambiarMovimiento('documento_tipo', e.target.value)}
                    placeholder="recepcion_compra, consumo_area..."
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Documento número</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formMovimiento.documento_numero}
                    onChange={(e) => cambiarMovimiento('documento_numero', e.target.value)}
                    placeholder="REC-20260405-0001"
                  />
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Observación</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formMovimiento.observacion}
                    onChange={(e) => cambiarMovimiento('observacion', e.target.value)}
                  />
                </div>
              </div>

              <div style={styles.saveWrap}>
                <button type="button" style={styles.softBtn} onClick={limpiarMovimiento}>
                  Limpiar
                </button>

                <button type="submit" style={styles.primaryBtn} disabled={guardandoMovimiento}>
                  {guardandoMovimiento ? 'Guardando...' : 'Registrar movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>Recepción parcial de órdenes de compra</h3>

            <form onSubmit={guardarRecepcionCompra}>
              <div style={styles.formGrid}>
                <div>
                  <label style={labelStyle(darkMode)}>Orden de compra</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formRecepcion.orden_compra_id}
                    onChange={(e) => seleccionarOrdenRecepcion(e.target.value)}
                    required
                  >
                    <option value="">Seleccione una orden</option>
                    {ordenesAgrupadas.map((o) => (
                      <option key={o.orden_compra_id} value={o.orden_compra_id}>
                        {o.numero} - {o.proveedor_nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Número de recepción</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formRecepcion.numero_recepcion}
                    onChange={(e) => cambiarRecepcion('numero_recepcion', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Ubicación destino</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formRecepcion.ubicacion_id}
                    onChange={(e) => cambiarRecepcion('ubicacion_id', e.target.value)}
                    required
                  >
                    <option value="">Seleccione destino</option>
                    {estacionesDisponibles.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                        {u.es_principal ? ' (Principal)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Fecha</label>
                  <input
                    type="datetime-local"
                    style={inputStyle(darkMode)}
                    value={formRecepcion.fecha}
                    onChange={(e) => cambiarRecepcion('fecha', e.target.value)}
                  />
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Observación</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={formRecepcion.observacion}
                    onChange={(e) => cambiarRecepcion('observacion', e.target.value)}
                    placeholder="Observación de la recepción"
                  />
                </div>
              </div>

              {detallesRecepcionSeleccionados.length > 0 ? (
                <div style={{ ...styles.tableWrap, marginTop: '18px' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Producto</th>
                        <th style={styles.th}>Pedido</th>
                        <th style={styles.th}>Recibido</th>
                        <th style={styles.th}>Pendiente</th>
                        <th style={styles.th}>Recibir ahora</th>
                        <th style={styles.th}>Lote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formRecepcion.detalles.map((d, index) => (
                        <tr key={d.orden_compra_detalle_id}>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 700, color: colores.texto }}>
                              {d.producto_nombre}
                            </div>
                            <div style={styles.miniText}>{d.producto_codigo}</div>
                          </td>
                          <td style={styles.td}>{d.cantidad_pedida}</td>
                          <td style={styles.td}>{d.cantidad_recibida_historica}</td>
                          <td style={styles.td}>{d.cantidad_pendiente}</td>
                          <td style={styles.td}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              style={inputStyle(darkMode)}
                              value={d.cantidad_recibida}
                              onChange={(e) =>
                                cambiarDetalleRecepcion(index, 'cantidad_recibida', e.target.value)
                              }
                            />
                          </td>
                          <td style={styles.td}>
                            <select
                              style={selectStyle(darkMode)}
                              value={d.lote_id || ''}
                              onChange={(e) =>
                                cambiarDetalleRecepcion(index, 'lote_id', e.target.value)
                              }
                            >
                              <option value="">Sin lote</option>
                              {lotes
                                .filter((l) => l.producto_id === d.producto_id)
                                .map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.numero_lote}
                                  </option>
                                ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div style={styles.saveWrap}>
                <button type="button" style={styles.softBtn} onClick={limpiarRecepcion}>
                  Limpiar
                </button>

                <button type="submit" style={styles.primaryBtn} disabled={guardandoRecepcion}>
                  {guardandoRecepcion ? 'Guardando...' : 'Registrar recepción'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>Productos y materiales</h3>

            <div style={styles.searchWrap}>
              <input
                style={inputStyle(darkMode)}
                value={filtroProducto}
                onChange={(e) => setFiltroProducto(e.target.value)}
                placeholder="Buscar por código o nombre"
              />
              <button type="button" style={styles.primaryBtn} onClick={buscarProductos}>
                Buscar
              </button>
            </div>

            {cargando ? <div style={styles.okText}>Cargando inventario...</div> : null}
            {error ? <div style={styles.dangerText}>{error}</div> : null}
            {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Código</th>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Categoría</th>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Precios</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {!cargando && productos.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan="7">
                        No hay productos para mostrar.
                      </td>
                    </tr>
                  ) : (
                    productos.map((p) => (
                      <tr key={p.id}>
                        <td style={styles.td}>{p.codigo}</td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 700, color: colores.texto }}>{p.nombre}</div>
                          <div style={styles.miniText}>Stock mínimo: {p.stock_minimo}</div>
                        </td>
                        <td style={styles.td}>{p.categorias_productos?.nombre || '-'}</td>
                        <td style={styles.td}>{p.tipos_materiales?.nombre || '-'}</td>
                        <td style={styles.td}>
                          <div>Compra: {Number(p.precio_compra || 0).toFixed(2)}</div>
                          <div style={styles.miniText}>
                            Venta: {Number(p.precio_venta || 0).toFixed(2)}
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={claseEstadoProducto(p.activo)}>
                            {p.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              style={styles.softBtn}
                              onClick={() => editarProducto(p.id)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              style={styles.dangerBtn}
                              onClick={() => borrarProducto(p.id)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>Stock por estación / ubicación</h3>

            <div style={styles.searchWrap}>
              <input
                style={inputStyle(darkMode)}
                value={filtroStock}
                onChange={(e) => setFiltroStock(e.target.value)}
                placeholder="Buscar por producto, categoría, ubicación o lote"
              />
              <button type="button" style={styles.primaryBtn} onClick={buscarStock}>
                Buscar
              </button>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Ubicación</th>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Lote</th>
                    <th style={styles.th}>Cantidad</th>
                    <th style={styles.th}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan="6">
                        No hay stock para mostrar.
                      </td>
                    </tr>
                  ) : (
                    stock.map((s) => (
                      <tr key={s.id}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 700, color: colores.texto }}>
                            {s.productos?.nombre || '-'}
                          </div>
                          <div style={styles.miniText}>{s.productos?.codigo || '-'}</div>
                        </td>
                        <td style={styles.td}>
                          {s.ubicaciones?.nombre || '-'}
                          {s.ubicaciones?.es_principal ? (
                            <span style={styles.tagPrincipal}>Principal</span>
                          ) : null}
                        </td>
                        <td style={styles.td}>{s.ubicaciones?.tipo || '-'}</td>
                        <td style={styles.td}>{s.lotes?.numero_lote || '-'}</td>
                        <td style={styles.td}>{s.cantidad}</td>
                        <td style={styles.td}>
                          <span style={claseStock(s)}>
                            {Number(s.cantidad || 0) === 0
                              ? 'Agotado'
                              : Number(s.cantidad || 0) <= Number(s.productos?.stock_minimo || 0)
                              ? 'Bajo'
                              : 'Normal'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>Historial de movimientos</h3>

            <div style={styles.searchWrap}>
              <input
                style={inputStyle(darkMode)}
                value={filtroMovimiento}
                onChange={(e) => setFiltroMovimiento(e.target.value)}
                placeholder="Buscar por producto, tipo, referencia o módulo"
              />
              <button type="button" style={styles.primaryBtn} onClick={buscarMovimientos}>
                Buscar
              </button>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Fecha</th>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Cantidad</th>
                    <th style={styles.th}>Ubicación</th>
                    <th style={styles.th}>Documento</th>
                    <th style={styles.th}>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan="7">
                        No hay movimientos para mostrar.
                      </td>
                    </tr>
                  ) : (
                    movimientos.map((m) => (
                      <tr key={m.id}>
                        <td style={styles.td}>
                          {m.fecha ? new Date(m.fecha).toLocaleString() : '-'}
                        </td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 700, color: colores.texto }}>
                            {m.productos?.nombre || '-'}
                          </div>
                          <div style={styles.miniText}>{m.productos?.codigo || '-'}</div>
                        </td>
                        <td style={styles.td}>{obtenerTextoTipoMovimiento(m.tipo)}</td>
                        <td style={styles.td}>{m.cantidad}</td>
                        <td style={styles.td}>{obtenerUbicacionMovimiento(m)}</td>
                        <td style={styles.td}>
                          <div>{m.documento_numero || m.referencia || '-'}</div>
                          <div style={styles.miniText}>
                            {m.documento_tipo || m.modulo_origen || '-'}
                          </div>
                        </td>
                        <td style={styles.td}>{obtenerNombreUsuario(m.usuarios)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>Alertas de inventario</h3>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Fecha</th>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Ubicación</th>
                    <th style={styles.th}>Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan="5">
                        No hay alertas para mostrar.
                      </td>
                    </tr>
                  ) : (
                    alertas.map((a) => (
                      <tr key={a.id}>
                        <td style={styles.td}>
                          {a.fecha ? new Date(a.fecha).toLocaleString() : '-'}
                        </td>
                        <td style={styles.td}>{a.productos?.nombre || '-'}</td>
                        <td style={styles.td}>{a.tipo_alerta}</td>
                        <td style={styles.td}>{a.ubicaciones?.nombre || '-'}</td>
                        <td style={styles.td}>{a.mensaje}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {mostrarImportador ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Importación masiva de medicamentos / productos</h3>
              <button type="button" style={styles.dangerBtn} onClick={cerrarImportador}>
                Cerrar
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.importBox}>
                <div style={{ fontWeight: 700, color: colores.texto, marginBottom: '8px' }}>
                  Formato recomendado del Excel
                </div>
                <div style={styles.miniText}>
                  Columnas sugeridas:
                  <br />
                  <strong>
                    codigo, nombre, categoria, unidad, tipo_material, precio_compra, precio_venta,
                    stock_minimo, requiere_lote, cantidad, lote, fecha_vencimiento,
                    fecha_fabricacion, ubicacion
                  </strong>
                </div>
                <div style={{ ...styles.miniText, marginTop: '8px' }}>
                  Puedes subir .xlsx, .xls o .csv
                </div>
              </div>

              <div style={styles.formGrid}>
                <div>
                  <label style={labelStyle(darkMode)}>Ubicación destino por defecto</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={ubicacionImportacionId}
                    onChange={(e) => setUbicacionImportacionId(e.target.value)}
                  >
                    <option value="">Seleccione ubicación</option>
                    {estacionesDisponibles.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                        {u.es_principal ? ' (Principal)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Archivo</label>
                  <input
                    ref={inputFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={inputStyle(darkMode)}
                    onChange={manejarCambioArchivo}
                  />
                </div>
              </div>

              {archivoImportacion ? (
                <div style={styles.okText}>Archivo seleccionado: {archivoImportacion.name}</div>
              ) : null}

              {resultadoImportacion ? (
                <div style={styles.importBox}>
                  <div style={{ fontWeight: 700, color: colores.texto, marginBottom: '10px' }}>
                    Resultado de la importación
                  </div>
                  <div style={styles.miniText}>Estado: {resultadoImportacion.estado}</div>
                  <div style={styles.miniText}>
                    Total filas: {resultadoImportacion.total_filas}
                  </div>
                  <div style={styles.miniText}>
                    Filas correctas: {resultadoImportacion.filas_ok}
                  </div>
                  <div style={styles.miniText}>
                    Filas con error: {resultadoImportacion.filas_error}
                  </div>

                  {resultadoImportacion.advertencias?.length > 0 ? (
                    <div style={{ marginTop: '10px' }}>
                      <div
                        style={{ fontWeight: 700, color: colores.texto, marginBottom: '6px' }}
                      >
                        Advertencias
                      </div>
                      {resultadoImportacion.advertencias.map((item, idx) => (
                        <div key={idx} style={styles.miniText}>
                          • {item}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {resultadoImportacion.errores?.length > 0 ? (
                    <div style={{ marginTop: '10px' }}>
                      <div
                        style={{ fontWeight: 700, color: '#b91c1c', marginBottom: '6px' }}
                      >
                        Errores
                      </div>
                      {resultadoImportacion.errores.map((item, idx) => (
                        <div
                          key={idx}
                          style={{ ...styles.miniText, color: darkMode ? '#fca5a5' : '#b91c1c' }}
                        >
                          • {item}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {error ? <div style={styles.dangerText}>{error}</div> : null}
              {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}

              <div style={styles.saveWrap}>
                <button type="button" style={styles.softBtn} onClick={cerrarImportador}>
                  Cancelar
                </button>

                <button
                  type="button"
                  style={styles.primaryBtn}
                  disabled={procesandoImportacion}
                  onClick={procesarImportacion}
                >
                  {procesandoImportacion ? 'Importando...' : 'Procesar importación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Inventario;