import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  abrirCaja,
  anularVentaFarmacia,
  buscarPacientesFarmacia,
  cerrarCaja,
  crearVentaFarmacia,
  listarCajasAbiertas,
  listarDetalleVentaFarmacia,
  listarProductosFarmacia,
  listarStockFarmacia,
  listarUbicacionesFarmacia,
  listarVentasFarmacia,
} from '../../services/farmaciaService';
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

const modeloCaja = {
  ubicacion_id: '',
  monto_apertura: '',
  observacion: '',
};

const modeloVenta = {
  caja_id: '',
  paciente_id: '',
  descuento: 0,
  impuestos: 0,
  metodo_pago: 'efectivo',
  monto_pagado: '',
  observacion_pago: '',
};

function etiquetaPaciente(p) {
  return [
    p.record ? `Rec: ${p.record}` : null,
    `${p.nombre || ''} ${p.apellido || ''}`.trim(),
    p.cedula ? `Céd: ${p.cedula}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

const Farmacia = ({ darkMode = false }) => {
  const { usuario } = useAuth();
  const colores = getUiColors(darkMode);

  const [cajas, setCajas] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [stock, setStock] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [detalleVenta, setDetalleVenta] = useState([]);
  
  const [busquedaPaciente, setBusquedaPaciente] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [filtroVenta, setFiltroVenta] = useState('');
  const [formCaja, setFormCaja] = useState(modeloCaja);
  const [formVenta, setFormVenta] = useState(modeloVenta);
  const [carrito, setCarrito] = useState([]);
  
  const [cargando, setCargando] = useState(false);
  const [guardandoCaja, setGuardandoCaja] = useState(false);
  const [guardandoVenta, setGuardandoVenta] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  // Modales y Tabs
  const [tabActiva, setTabActiva] = useState('inicio');
  const [showModalApertura, setShowModalApertura] = useState(false);
  const [showModalProductos, setShowModalProductos] = useState(false);
  const [showModalFacturar, setShowModalFacturar] = useState(false);
  const [showModalConsultas, setShowModalConsultas] = useState(false);
  
  // Estados para Cierre de Caja
  const [showModalCierre, setShowModalCierre] = useState(false);
  const [cajaParaCerrar, setCajaParaCerrar] = useState(null);
  const [formCierre, setFormCierre] = useState({ monto_cierre: '', observacion: '' });
  const [fechaActual, setFechaActual] = useState(new Date());

  const rolNombre = (usuario?.rol_nombre || '').toLowerCase();
  const puedeDescuento = rolNombre.includes('admin') || rolNombre.includes('farma');

  const cajaActiva = useMemo(() => cajas.find((c) => c.id === formVenta.caja_id) || null, [cajas, formVenta.caja_id]);

  const totalCarritoSinImpuestos = useMemo(() => {
    return carrito.reduce((acc, item) => acc + Number(item.cantidad || 0) * Number(item.precio_unitario || 0), 0);
  }, [carrito]);

  const totalVenta = useMemo(() => {
    return totalCarritoSinImpuestos - Number(formVenta.descuento || 0) + Number(formVenta.impuestos || 0);
  }, [totalCarritoSinImpuestos, formVenta.descuento, formVenta.impuestos]);

  const devuelta = useMemo(() => {
    const pagado = Number(formVenta.monto_pagado || 0);
    return pagado > totalVenta ? pagado - totalVenta : 0;
  }, [formVenta.monto_pagado, totalVenta]);

  // Cálculo de ventas para el modal de cierre
  const ventasCajaCerrar = useMemo(() => {
    if (!cajaParaCerrar) return [];
    return ventas.filter(v => v.caja_id === cajaParaCerrar.id && v.estado !== 'anulada');
  }, [cajaParaCerrar, ventas]);

  const totalVendidoCaja = useMemo(() => {
    return ventasCajaCerrar.reduce((acc, v) => acc + Number(v.total || 0), 0);
  }, [ventasCajaCerrar]);

  useEffect(() => { cargarInicial(); }, []);
  useEffect(() => { cargarPacientes(busquedaPaciente); }, [busquedaPaciente]);
  useEffect(() => {
    if (cajaActiva?.ubicacion_id) cargarStock(cajaActiva.ubicacion_id);
    else setStock([]);
  }, [cajaActiva?.ubicacion_id]);

  useEffect(() => {
    if (showModalApertura || showModalCierre) setFechaActual(new Date());
  }, [showModalApertura, showModalCierre]);

  async function cargarInicial() {
    setCargando(true);
    setError('');
    try {
      const listaCajas = await listarCajasAbiertas().catch(() => []);
      const listaUbicaciones = await listarUbicacionesFarmacia().catch(() => []);
      const listaPacientes = await buscarPacientesFarmacia().catch(() => []);
      const listaProductos = await listarProductosFarmacia().catch(() => []);
      const listaVentas = await listarVentasFarmacia().catch(() => []);

      setCajas(listaCajas);
      setUbicaciones(listaUbicaciones);
      setPacientes(listaPacientes);
      setProductos(listaProductos);
      setVentas(listaVentas);
      
      if (listaCajas.length > 0 && !formVenta.caja_id) {
        setFormVenta(prev => ({ ...prev, caja_id: listaCajas[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  async function cargarPacientes(filtro = '') {
    const lista = await buscarPacientesFarmacia(filtro).catch(() => []);
    setPacientes(lista);
  }

  async function cargarStock(ubicacionId) {
    const lista = await listarStockFarmacia(ubicacionId).catch(() => []);
    setStock(lista);
  }

  function limpiarVenta() {
    setFormVenta(prev => ({ ...modeloVenta, caja_id: prev.caja_id }));
    setCarrito([]);
    setError('');
    setMensaje('');
  }

  async function guardarCaja(e) {
    e.preventDefault();
    if (!formCaja.ubicacion_id) { alert("Seleccione una ubicación."); return; }
    setGuardandoCaja(true);
    try {
      const nuevaCaja = await abrirCaja({ ...formCaja, usuario_id: usuario?.id || null });
      await cargarInicial();
      setFormCaja(modeloCaja);
      setShowModalApertura(false);
      setTabActiva('inicio');
      if (nuevaCaja && nuevaCaja.id) setFormVenta(prev => ({ ...prev, caja_id: nuevaCaja.id }));
      alert('Caja abierta correctamente.');
    } catch (err) { alert(err.message || 'No se pudo abrir la caja.'); } 
    finally { setGuardandoCaja(false); }
  }

  function iniciarCierreCaja(caja) {
    setCajaParaCerrar(caja);
    setFormCierre({ monto_cierre: '', observacion: '' });
    setShowModalCierre(true);
  }

  async function procesarCierreCaja(e) {
    e.preventDefault();
    setGuardandoCaja(true);
    try {
      await cerrarCaja(cajaParaCerrar.id, formCierre.monto_cierre, formCierre.observacion);
      await cargarInicial();
      if (formVenta.caja_id === cajaParaCerrar.id) {
        setFormVenta((prev) => ({ ...prev, caja_id: '' }));
      }
      setShowModalCierre(false);
      alert('Caja cerrada correctamente.');
    } catch (err) {
      alert(err.message || 'No se pudo cerrar la caja.');
    } finally {
      setGuardandoCaja(false);
    }
  }

  function imprimirResumenCaja() {
    const ventana = window.open('', '_blank', 'width=400,height=600');
    const cajeroNombre = cajaParaCerrar?.usuarios?.nombre ? `${cajaParaCerrar.usuarios.nombre} ${cajaParaCerrar.usuarios.apellido || ''}` : 'Usuario';
    
    ventana.document.write(`
      <html>
      <head>
        <title>Cierre de Caja</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; padding: 20px; font-size: 14px; color: #000; }
          h2, h3 { text-align: center; margin: 5px 0; }
          .divider { border-bottom: 1px dashed #000; margin: 15px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .firma { margin-top: 50px; text-align: center; border-top: 1px solid #000; width: 80%; margin-left: auto; margin-right: auto; padding-top: 5px; }
        </style>
      </head>
      <body>
        <h2>TICKET DE CIERRE</h2>
        <h3>FARMACIA</h3>
        <div class="divider"></div>
        <div class="row"><span>Cajero:</span> <span>${cajeroNombre}</span></div>
        <div class="row"><span>Apertura:</span> <span>${new Date(cajaParaCerrar.fecha_apertura).toLocaleString()}</span></div>
        <div class="row"><span>Cierre:</span> <span>${new Date().toLocaleString()}</span></div>
        <div class="divider"></div>
        <div class="row"><span>Monto Inicial:</span> <span>$${Number(cajaParaCerrar.monto_apertura || 0).toFixed(2)}</span></div>
        <div class="row"><span>Total Ventas (${ventasCajaCerrar.length}):</span> <span>$${totalVendidoCaja.toFixed(2)}</span></div>
        <div class="row" style="font-weight: bold; margin-top: 10px;">
          <span>TOTAL ESPERADO:</span> 
          <span>$${(Number(cajaParaCerrar.monto_apertura || 0) + totalVendidoCaja).toFixed(2)}</span>
        </div>
        <div class="divider"></div>
        <div class="row"><span>Monto Declarado:</span> <span>$${Number(formCierre.monto_cierre || 0).toFixed(2)}</span></div>
        <br/><br/>
        <div class="firma">Firma del Cajero</div>
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `);
    ventana.document.close();
  }

  function agregarProductoRapido(producto) {
    const existe = carrito.find((i) => i.producto_id === producto.id);
    if (existe) {
      setCarrito((prev) => prev.map((i) => i.producto_id === producto.id ? { ...i, cantidad: Number(i.cantidad) + 1 } : i));
    } else {
      setCarrito((prev) => [...prev, { producto_id: producto.id, nombre: producto.nombre, codigo: producto.codigo, cantidad: 1, precio_unitario: Number(producto.precio_venta || 0) }]);
    }
  }

  function cambiarCantidadCarrito(productoId, nuevaCantidad) {
    if (nuevaCantidad <= 0) return;
    setCarrito((prev) => prev.map((i) => (i.producto_id === productoId ? { ...i, cantidad: nuevaCantidad } : i)));
  }

  function quitarProductoCarrito(productoId) {
    setCarrito((prev) => prev.filter((i) => i.producto_id !== productoId));
  }

  async function guardarVenta(e) {
    e.preventDefault();
    if (!formVenta.caja_id) { alert('Seleccione una caja abierta.'); return; }
    setGuardandoVenta(true);
    try {
      await crearVentaFarmacia({ ...formVenta, items: carrito, usuario_id: usuario?.id || null });
      await cargarInicial();
      if (formVenta.caja_id) await cargarStock(cajaActiva?.ubicacion_id);
      limpiarVenta();
      setShowModalFacturar(false);
      alert('Venta registrada correctamente.');
    } catch (err) { alert(err.message || 'No se pudo registrar la venta.'); } 
    finally { setGuardandoVenta(false); }
  }

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) || 
    p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
  );

  const handleTabClick = (tab) => {
    setTabActiva(tab);
    if (tab === 'apertura') setShowModalApertura(true);
    if (tab === 'consultas') setShowModalConsultas(true);
  };

  const nombreUsuarioApertura = `${usuario?.nombre || usuario?.username || ''} ${usuario?.apellido || ''}`.trim() || 'Cajero';

  const styles = {
    headerWrapper: { display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' },
    banner: { flex: '1 1 600px', background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)', borderRadius: '16px', padding: '30px 40px', color: '#ffffff', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 25px rgba(37,99,235,0.2)' },
    titleChip: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(255,255,255,0.2)', fontSize: '12px', fontWeight: 700, marginBottom: '16px' },
    title: { margin: 0, fontSize: '36px', fontWeight: 900, letterSpacing: '-0.5px' },
    subtitle: { margin: '10px 0 0 0', fontSize: '15px', color: 'rgba(255,255,255,0.9)' },
    tabsWrap: { display: 'flex', gap: '12px', flexShrink: 0 },
    tabPill: (isActive) => ({ padding: '12px 24px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', border: isActive ? 'none' : `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, background: isActive ? '#2563eb' : (darkMode ? '#1f2937' : '#ffffff'), color: isActive ? '#ffffff' : (darkMode ? '#d1d5db' : '#4b5563'), boxShadow: isActive ? '0 4px 14px rgba(37,99,235,0.3)' : '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }),
    cardsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' },
    metricCard: { ...statCardStyle(darkMode), position: 'relative', overflow: 'hidden', padding: '24px', minWidth: 0 },
    metricIconWrap: { width: '40px', height: '40px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: darkMode ? '#1e293b' : '#f1f5f9', fontSize: '18px', marginBottom: '16px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` },
    metricGhost: { position: 'absolute', top: '10px', right: '10px', fontSize: '60px', opacity: 0.04, pointerEvents: 'none' },
    metricLabel: { fontSize: '14px', color: colores.subtitulo, fontWeight: 600 },
    metricValue: { marginTop: '8px', fontSize: '32px', fontWeight: 900, color: colores.texto },
    posGrid: { display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '20px', alignItems: 'start' },
    card: { ...cardStyle(darkMode), padding: '24px', overflow: 'hidden' },
    primaryBtn: { ...buttonPrimaryStyle, borderRadius: '8px', padding: '10px 16px', background: '#2563eb' },
    successBtn: { padding: '16px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, fontSize: '18px', border: 'none', background: '#10b981', color: '#fff', width: '100%', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' },
    tableWrap: { width: '100%', overflowX: 'auto', borderRadius: '12px', border: `1px solid ${colores.borde}` },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '14px 16px', fontSize: '13px', color: colores.subtitulo, borderBottom: `1px solid ${colores.borde}`, background: darkMode ? '#0f172a' : '#f8fafc' },
    td: { padding: '14px 16px', fontSize: '14px', borderBottom: `1px solid ${colores.borde}`, color: colores.texto },
    dangerBtn: { padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '12px', border: darkMode ? '1px solid rgba(220,38,38,0.25)' : '1px solid #fecaca', background: darkMode ? 'rgba(220,38,38,0.12)' : '#fef2f2', color: darkMode ? '#fca5a5' : '#dc2626' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(3px)' },
    modalContent: { ...cardStyle(darkMode), width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', position: 'relative' },
    modalClose: { background: darkMode ? '#1f2937' : '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '14px', cursor: 'pointer', color: colores.texto, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }
  };

  return (
    <div style={pageWrapperStyle(darkMode)}>
      
      {/* HEADER TIPO BANNER */}
      <div style={styles.headerWrapper}>
        <div style={styles.banner}>
          <div style={styles.titleChip}>💊 Gestión de farmacia</div>
          <h1 style={styles.title}>Farmacia</h1>
          <p style={styles.subtitle}>Buscador, inventario, pagos, apertura e impresión dentro del mismo módulo.</p>
        </div>

        <div style={styles.tabsWrap}>
          <button style={styles.tabPill(tabActiva === 'inicio')} onClick={() => { setTabActiva('inicio'); setShowModalApertura(false); setShowModalConsultas(false); }}>Inicio</button>
          <button style={styles.tabPill(tabActiva === 'apertura')} onClick={() => handleTabClick('apertura')}>Apertura Caja</button>
          <button style={styles.tabPill(tabActiva === 'consultas')} onClick={() => handleTabClick('consultas')}>Consultas</button>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div style={styles.cardsRow}>
        <div style={styles.metricCard}><div style={styles.metricGhost}>🧰</div><div style={styles.metricIconWrap}>🧰</div><div style={styles.metricLabel}>Cajas abiertas</div><div style={{...styles.metricValue, color: '#1e40af'}}>{cajas.length}</div></div>
        <div style={styles.metricCard}><div style={styles.metricGhost}>🧾</div><div style={styles.metricIconWrap}>🧾</div><div style={styles.metricLabel}>Total facturas</div><div style={{...styles.metricValue, color: '#1f2937'}}>{ventas.length}</div></div>
        <div style={styles.metricCard}><div style={styles.metricGhost}>💵</div><div style={styles.metricIconWrap}>💵</div><div style={styles.metricLabel}>Total carrito</div><div style={{...styles.metricValue, color: '#10b981'}}>${totalVenta.toFixed(2)}</div></div>
        <div style={styles.metricCard}><div style={styles.metricGhost}>📦</div><div style={styles.metricIconWrap}>📦</div><div style={styles.metricLabel}>Stock registros</div><div style={{...styles.metricValue, color: '#d97706'}}>{stock.length}</div></div>
      </div>

      {/* POS PRINCIPAL */}
      <div style={styles.posGrid}>
        {/* CARRITO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>Caja Activa y Cliente</h3>
              <select style={{...selectStyle(darkMode), width: 'auto', minWidth: '220px', margin: 0}} value={formVenta.caja_id} onChange={(e) => setFormVenta((prev) => ({ ...prev, caja_id: e.target.value }))}>
                <option value="">-- Seleccionar Caja --</option>
                {cajas.map((c) => (<option key={c.id} value={c.id}>{c.ubicaciones?.nombre || 'Caja'} (Abierta)</option>))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
               <div><label style={labelStyle(darkMode)}>Buscar Paciente</label><input style={inputStyle(darkMode)} placeholder="Nombre o Cédula" value={busquedaPaciente} onChange={(e) => setBusquedaPaciente(e.target.value)} /></div>
               <div><label style={labelStyle(darkMode)}>Seleccionar (Opcional)</label><select style={selectStyle(darkMode)} value={formVenta.paciente_id} onChange={(e) => setFormVenta((prev) => ({ ...prev, paciente_id: e.target.value }))}><option value="">Venta al detalle (Sin paciente)</option>{pacientes.map((p) => (<option key={p.id} value={p.id}>{etiquetaPaciente(p)}</option>))}</select></div>
            </div>
          </div>

          <div style={{...styles.card, flex: 1}}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>Productos a facturar</h3>
              <button style={styles.primaryBtn} onClick={() => setShowModalProductos(true)}>+ Buscar Productos</button>
            </div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Precio</th>
                    <th style={{...styles.th, width: '100px'}}>Cant.</th>
                    <th style={styles.th}>Subtotal</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {carrito.length === 0 ? (
                    <tr><td colSpan="5" style={{...styles.td, textAlign: 'center', padding: '40px', color: colores.subtitulo}}>No hay productos en el carrito</td></tr>
                  ) : (
                    carrito.map((item) => (
                      <tr key={item.producto_id}>
                        <td style={styles.td}><strong>{item.nombre}</strong><br/><small style={{color: colores.subtitulo}}>{item.codigo}</small></td>
                        <td style={styles.td}>${Number(item.precio_unitario).toFixed(2)}</td>
                        <td style={styles.td}><input type="number" min="1" style={{...inputStyle(darkMode), padding: '6px', width: '70px', textAlign: 'center'}} value={item.cantidad} onChange={(e) => cambiarCantidadCarrito(item.producto_id, Number(e.target.value))} /></td>
                        <td style={styles.td}><b>${(item.cantidad * item.precio_unitario).toFixed(2)}</b></td>
                        <td style={{...styles.td, textAlign: 'right'}}><button style={styles.dangerBtn} onClick={() => quitarProductoCarrito(item.producto_id)}>X</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RESUMEN */}
        <div style={{...styles.card, position: 'sticky', top: '20px'}}>
          <h3 style={{ margin: '0 0 24px', fontSize: '20px' }}>Resumen de Venta</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '16px' }}><span style={{ color: colores.subtitulo }}>Subtotal:</span><span style={{ fontWeight: 600 }}>${totalCarritoSinImpuestos.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '16px' }}><span style={{ color: colores.subtitulo }}>Impuestos:</span><span style={{ fontWeight: 600 }}>${Number(formVenta.impuestos || 0).toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '16px' }}><span style={{ color: colores.subtitulo }}>Descuento:</span><span style={{ color: '#ef4444', fontWeight: 600 }}>-${Number(formVenta.descuento || 0).toFixed(2)}</span></div>
          <div style={{ borderTop: `2px dashed ${colores.borde}`, margin: '24px 0' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}><span style={{ fontSize: '22px', fontWeight: 800 }}>TOTAL</span><span style={{ fontSize: '36px', fontWeight: 900, color: '#10b981' }}>${totalVenta.toFixed(2)}</span></div>
          <button style={{...styles.successBtn, opacity: carrito.length === 0 ? 0.5 : 1}} disabled={carrito.length === 0} onClick={() => setShowModalFacturar(true)}>💵 Facturar y Cobrar</button>
          <button style={{...buttonSoftStyle(darkMode), width: '100%', marginTop: '12px', padding: '14px', borderRadius: '12px', fontWeight: 600}} onClick={limpiarVenta}>Limpiar Venta</button>
        </div>
      </div>

      {/* ================= MODALES ================= */}

      {/* MODAL: INVENTARIO */}
      {showModalProductos && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modalContent, maxWidth: '800px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h2 style={{margin: 0, fontSize: '24px'}}>Inventario de Farmacia</h2>
              <button style={styles.modalClose} onClick={() => setShowModalProductos(false)}>✖</button>
            </div>
            <input style={{...inputStyle(darkMode), marginBottom: '24px', padding: '14px'}} placeholder="Escribe para buscar código o producto..." value={busquedaProducto} onChange={(e) => setBusquedaProducto(e.target.value)} autoFocus />
            <div style={{maxHeight: '400px', overflowY: 'auto'}}>
              <table style={styles.table}>
                <thead><tr><th style={styles.th}>Código</th><th style={styles.th}>Producto</th><th style={styles.th}>Precio</th><th style={styles.th}>Acción</th></tr></thead>
                <tbody>{productosFiltrados.slice(0, 50).map(p => (<tr key={p.id}><td style={styles.td}>{p.codigo}</td><td style={styles.td}>{p.nombre}</td><td style={styles.td}>${Number(p.precio_venta || 0).toFixed(2)}</td><td style={styles.td}><button style={styles.primaryBtn} onClick={() => agregarProductoRapido(p)}>+ Agregar</button></td></tr>))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PAGO */}
      {showModalFacturar && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modalContent, maxWidth: '500px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h2 style={{margin: 0, fontSize: '24px'}}>Completar Pago</h2>
              <button style={styles.modalClose} onClick={() => setShowModalFacturar(false)}>✖</button>
            </div>
            <div style={{ background: darkMode ? '#0f172a' : '#f0fdf4', padding: '24px', borderRadius: '16px', textAlign: 'center', marginBottom: '24px', border: `1px solid ${darkMode ? '#1e293b' : '#bbf7d0'}`}}>
              <div style={{ fontSize: '15px', color: colores.subtitulo, fontWeight: 600 }}>Total a Pagar</div>
              <div style={{ fontSize: '42px', fontWeight: 900, color: '#10b981', marginTop: '8px' }}>${totalVenta.toFixed(2)}</div>
            </div>
            <form onSubmit={guardarVenta} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {puedeDescuento && (<div style={{ display: 'flex', gap: '16px' }}><div style={{ flex: 1 }}><label style={labelStyle(darkMode)}>Descuento ($)</label><input type="number" step="0.01" style={inputStyle(darkMode)} value={formVenta.descuento} onChange={(e) => setFormVenta(prev => ({...prev, descuento: e.target.value}))} /></div><div style={{ flex: 1 }}><label style={labelStyle(darkMode)}>Impuestos ($)</label><input type="number" step="0.01" style={inputStyle(darkMode)} value={formVenta.impuestos} onChange={(e) => setFormVenta(prev => ({...prev, impuestos: e.target.value}))} /></div></div>)}
              <div><label style={labelStyle(darkMode)}>Método de Pago</label><select style={selectStyle(darkMode)} value={formVenta.metodo_pago} onChange={(e) => setFormVenta(prev => ({...prev, metodo_pago: e.target.value}))}><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option><option value="seguro">Seguro Médico</option></select></div>
              <div><label style={labelStyle(darkMode)}>Monto Recibido</label><input type="number" step="0.01" style={{...inputStyle(darkMode), fontSize: '24px', fontWeight: 'bold', padding: '16px'}} value={formVenta.monto_pagado} onChange={(e) => setFormVenta(prev => ({...prev, monto_pagado: e.target.value}))} required /></div>
              {formVenta.metodo_pago === 'efectivo' && (<div style={{ textAlign: 'center', fontSize: '20px', padding: '16px', background: darkMode ? '#1f2937' : '#f8fafc', borderRadius: '12px' }}>Devuelta: <b style={{color: devuelta > 0 ? '#3b82f6' : colores.texto}}>${devuelta.toFixed(2)}</b></div>)}
              <button type="submit" style={{...styles.successBtn, marginTop: '10px'}} disabled={guardandoVenta}>{guardandoVenta ? 'Procesando...' : 'Confirmar e Imprimir'}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: APERTURA CAJA */}
      {showModalApertura && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modalContent, maxWidth: '400px', borderRadius: '16px', padding: '32px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
              <h2 style={{margin: 0, fontSize: '22px', color: darkMode ? '#ffffff' : '#1e3a8a', fontWeight: '800'}}>Abrir Caja</h2>
              <button style={styles.modalClose} onClick={() => { setShowModalApertura(false); setTabActiva('inicio'); }}>✖</button>
            </div>
            <form onSubmit={guardarCaja} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div><label style={{...labelStyle(darkMode), fontWeight: '700'}}>Ubicación</label><select style={{...selectStyle(darkMode), padding: '12px', fontSize: '15px'}} value={formCaja.ubicacion_id} onChange={(e) => setFormCaja(prev => ({ ...prev, ubicacion_id: e.target.value }))} required><option value="">Seleccione ubicación</option>{ubicaciones.map((u) => (<option key={u.id} value={u.id}>{u.nombre}</option>))}</select></div>
              <div><label style={{...labelStyle(darkMode), fontWeight: '700'}}>Usuario</label><input style={{...inputStyle(darkMode), backgroundColor: darkMode ? '#374151' : '#f3f4f6', cursor: 'not-allowed', color: darkMode ? '#d1d5db' : '#6b7280'}} value={nombreUsuarioApertura} disabled /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}><div><label style={{...labelStyle(darkMode), fontWeight: '700'}}>Fecha</label><input style={{...inputStyle(darkMode), backgroundColor: darkMode ? '#374151' : '#f3f4f6', cursor: 'not-allowed', color: darkMode ? '#d1d5db' : '#6b7280'}} value={fechaActual.toLocaleDateString()} disabled /></div><div><label style={{...labelStyle(darkMode), fontWeight: '700'}}>Hora</label><input style={{...inputStyle(darkMode), backgroundColor: darkMode ? '#374151' : '#f3f4f6', cursor: 'not-allowed', color: darkMode ? '#d1d5db' : '#6b7280'}} value={fechaActual.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} disabled /></div></div>
              <div><label style={{...labelStyle(darkMode), fontWeight: '700'}}>Monto de Apertura ($)</label><input type="number" step="0.01" style={{...inputStyle(darkMode), padding: '12px', fontSize: '16px'}} value={formCaja.monto_apertura} onChange={(e) => setFormCaja(prev => ({ ...prev, monto_apertura: e.target.value }))} required autoFocus /></div>
              <button type="submit" style={{...styles.primaryBtn, width: '100%', padding: '14px', fontSize: '16px', marginTop: '10px', borderRadius: '10px'}} disabled={guardandoCaja}>{guardandoCaja ? 'Abriendo...' : 'Guardar Apertura'}</button>
            </form>
          </div>
        </div>
      )}

      {/* ================= NUEVO MODAL: CIERRE DE CAJA ================= */}
      {showModalCierre && cajaParaCerrar && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modalContent, maxWidth: '450px', borderRadius: '16px', padding: '32px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
              <h2 style={{margin: 0, fontSize: '22px', color: darkMode ? '#ffffff' : '#1e3a8a', fontWeight: '800'}}>Cierre de Caja</h2>
              <button style={styles.modalClose} onClick={() => setShowModalCierre(false)}>✖</button>
            </div>

            <div style={{ background: darkMode ? '#0f172a' : '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '24px', border: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                <span style={{ color: colores.subtitulo }}>Cajero:</span>
                <span style={{ fontWeight: 600 }}>{cajaParaCerrar.usuarios?.nombre || 'Usuario'} {cajaParaCerrar.usuarios?.apellido || ''}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                <span style={{ color: colores.subtitulo }}>Monto Inicial:</span>
                <span style={{ fontWeight: 600 }}>${Number(cajaParaCerrar.monto_apertura || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                <span style={{ color: colores.subtitulo }}>Ventas Registradas:</span>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>{ventasCajaCerrar.length} transacciones</span>
              </div>
              <div style={{ borderTop: `1px dashed ${colores.borde}`, margin: '12px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>Total Vendido:</span>
                <span style={{ fontSize: '24px', fontWeight: 900, color: '#10b981' }}>${totalVendidoCaja.toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={procesarCierreCaja} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{...labelStyle(darkMode), fontWeight: '700'}}>Monto Físico en Caja (Efectivo/Tarjetas) $</label>
                <input 
                  type="number" step="0.01" 
                  style={{...inputStyle(darkMode), padding: '12px', fontSize: '16px'}} 
                  value={formCierre.monto_cierre} 
                  onChange={(e) => setFormCierre(prev => ({ ...prev, monto_cierre: e.target.value }))} 
                  required autoFocus
                />
              </div>

              <div>
                <label style={{...labelStyle(darkMode), fontWeight: '700'}}>Observaciones (Faltantes/Sobrantes)</label>
                <input 
                  style={{...inputStyle(darkMode), padding: '12px'}} 
                  value={formCierre.observacion} 
                  onChange={(e) => setFormCierre(prev => ({ ...prev, observacion: e.target.value }))} 
                  placeholder="Opcional..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" style={{...buttonSoftStyle(darkMode), flex: 1, padding: '14px', borderRadius: '10px', fontWeight: 'bold'}} onClick={imprimirResumenCaja}>
                  🖨️ Imprimir
                </button>
                <button type="submit" style={{...styles.dangerBtn, flex: 1, padding: '14px', fontSize: '15px', borderRadius: '10px'}} disabled={guardandoCaja}>
                  {guardandoCaja ? 'Cerrando...' : 'Confirmar Cierre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONSULTAS Y STOCK (Arreglado y mejorado) */}
      {showModalConsultas && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modalContent, maxWidth: '1000px', padding: '32px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
              <h2 style={{margin: 0, fontSize: '26px', fontWeight: 900}}>Consultas y Movimientos</h2>
              <button style={styles.modalClose} onClick={() => { setShowModalConsultas(false); setTabActiva('inicio'); }}>✖</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              
              {/* Columna Izquierda: Cajas */}
              <div>
                <h3 style={{marginTop: 0, fontSize: '18px', borderBottom: `2px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, paddingBottom: '10px'}}>Control de Cajas Abiertas</h3>
                <div style={{...styles.tableWrap, maxHeight: '350px', overflowY: 'auto'}}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Ubicación</th>
                        <th style={styles.th}>Apertura</th>
                        <th style={styles.th}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cajas.length === 0 ? (
                        <tr><td colSpan="3" style={{...styles.td, textAlign: 'center', padding: '20px', color: colores.subtitulo}}>No hay cajas abiertas</td></tr>
                      ) : (
                        cajas.map(c => (
                          <tr key={c.id}>
                            <td style={styles.td}><strong>{c.ubicaciones?.nombre || 'General'}</strong><br/><span style={{fontSize: '12px', color: colores.subtitulo}}>{c.usuarios?.nombre || c.usuarios?.username}</span></td>
                            <td style={styles.td}>${Number(c.monto_apertura||0).toFixed(2)}<br/><span style={{fontSize: '12px', color: colores.subtitulo}}>{new Date(c.fecha_apertura).toLocaleTimeString()}</span></td>
                            <td style={styles.td}>
                              <button style={styles.dangerBtn} onClick={() => { setShowModalConsultas(false); iniciarCierreCaja(c); }}>Cerrar</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Columna Derecha: Últimas Ventas */}
              <div>
                <h3 style={{marginTop: 0, fontSize: '18px', borderBottom: `2px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, paddingBottom: '10px'}}>Últimas Ventas</h3>
                <div style={{...styles.tableWrap, maxHeight: '350px', overflowY: 'auto'}}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Ticket</th>
                        <th style={styles.th}>Total</th>
                        <th style={styles.th}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventas.length === 0 ? (
                        <tr><td colSpan="3" style={{...styles.td, textAlign: 'center', padding: '20px', color: colores.subtitulo}}>No hay ventas recientes</td></tr>
                      ) : (
                        ventas.slice(0, 15).map(v => (
                          <tr key={v.id}>
                            <td style={styles.td}><strong>{v.numero}</strong><br/><span style={{fontSize: '12px', color: colores.subtitulo}}>{new Date(v.fecha).toLocaleTimeString()}</span></td>
                            <td style={styles.td}>${Number(v.total).toFixed(2)}</td>
                            <td style={styles.td}>
                              <span style={{padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 'bold', background: v.estado === 'pagada' ? '#dcfce7' : (v.estado === 'anulada' ? '#fef2f2' : '#fef3c7'), color: v.estado === 'pagada' ? '#166534' : (v.estado === 'anulada' ? '#991b1b' : '#92400e')}}>
                                {v.estado.toUpperCase()}
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

            {/* Fila Inferior: Stock Completo */}
            <div style={{ marginTop: '30px' }}>
              <h3 style={{fontSize: '18px', borderBottom: `2px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, paddingBottom: '10px'}}>Inventario Actual en Sucursal</h3>
              <div style={{...styles.tableWrap, maxHeight: '250px', overflowY: 'auto'}}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Producto</th>
                      <th style={styles.th}>Lote / Categoría</th>
                      <th style={styles.th}>Cantidad Físico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.length === 0 ? (
                      <tr><td colSpan="3" style={{...styles.td, textAlign: 'center', padding: '20px', color: colores.subtitulo}}>El stock está vacío en esta ubicación</td></tr>
                    ) : (
                      stock.map(s => (
                        <tr key={s.id}>
                          <td style={styles.td}><strong>{s.productos?.nombre}</strong><br/><span style={{fontSize: '12px', color: colores.subtitulo}}>{s.productos?.codigo}</span></td>
                          <td style={styles.td}>{s.lotes?.numero_lote || 'N/A'}<br/><span style={{fontSize: '12px', color: colores.subtitulo}}>{s.productos?.categorias_productos?.nombre || 'General'}</span></td>
                          <td style={styles.td}>
                            <span style={{ color: s.cantidad < 10 ? '#ef4444' : '#10b981', fontWeight: '900', fontSize: '16px' }}>
                              {s.cantidad} unds.
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
        </div>
      )}

    </div>
  );
};

export default Farmacia;