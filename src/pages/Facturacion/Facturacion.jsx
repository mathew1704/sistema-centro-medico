import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  anularFactura,
  aplicarAnticipoAFactura,
  buscarCatalogoFacturacion,
  buscarLaboratorioPorNumeroFactura,
  buscarPacientesFacturacion,
  crearFactura,
  generarNumeroFactura,
  listarAnticiposPaciente,
  listarDetalleFactura,
  listarDetalleLaboratorioSolicitud,
  listarEmergenciasPendientesPaciente,
  listarFacturas,
  listarInternamientosPendientesPaciente,
  listarLaboratoriosPendientesPaciente,
  listarPagosFactura,
  listarPendientesFacturacion,
  marcarFacturaComoImpresa,
  obtenerDetalleConsolidadoEmergencia,
  obtenerDetalleConsolidadoInternamiento,
  obtenerFacturaCompleta,
  registrarPagoFactura,
} from '../../services/facturacionService';
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
  textareaStyle,
} from '../../styles/uiTheme';

const modeloFactura = {
  paciente_id: '', tipo_factura: 'clinica', origen_principal: 'manual', tipo_orden: '', medico_id: '',
  ars_id: '', descuento: 0, impuestos: 0, cobertura_total: 0, porcentaje_cobertura: 0,
  numero_autorizacion: '', monto_pagado: '', metodo_pago: 'efectivo', referencia_pago: '',
  observacion_pago: '', ncf: '', tipo_comprobante: '', requiere_deposito: false, deposito_requerido: 0,
  deposito_aplicado: 0, permite_pago_cuotas: true, observacion: '', nombre_paciente_manual: '',
  apellido_paciente_manual: '', cedula_paciente_manual: '', telefono_paciente_manual: '',
  direccion_paciente_manual: '', record_paciente_manual: '', laboratorio_solicitud_id: '', numero: '',
};

function nombrePacienteFactura(f) {
  if (f?.pacientes) return `${f.pacientes.nombre || ''} ${f.pacientes.apellido || ''}`.trim();
  return `${f?.nombre_paciente_manual || ''} ${f?.apellido_paciente_manual || ''}`.trim() || '-';
}

function subtotalItem(item) {
  return Number(item.cantidad || 0) * Number(item.precio_unitario || 0);
}

// ==========================================
// ESTILOS DE IMPRESIÓN 
// ==========================================
const PrintStyles = () => (
  <style>
    {`
      @media print {
        body * { visibility: hidden; }
        #seccion-impresion-factura, #seccion-impresion-factura * { visibility: visible; }
        #seccion-impresion-factura { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; background: white; color: black; font-family: 'Courier New', Courier, monospace; }
        .hide-on-print { display: none !important; }
      }
      @media screen { #seccion-impresion-factura { display: none; } }
    `}
  </style>
);

const Facturacion = ({ darkMode = false }) => {
  const { usuario } = useAuth();
  const colores = getUiColors(darkMode);

  const safePageWrapperStyle = typeof pageWrapperStyle === 'function' ? pageWrapperStyle(darkMode) : pageWrapperStyle;
  const safeInputStyle = typeof inputStyle === 'function' ? inputStyle(darkMode) : inputStyle;
  const safeSelectStyle = typeof selectStyle === 'function' ? selectStyle(darkMode) : selectStyle;

  const [pantalla, setPantalla] = useState('inicio');

  const [pendientes, setPendientes] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [detalleFactura, setDetalleFactura] = useState([]);
  
  const [busquedaPendiente, setBusquedaPendiente] = useState('');
  const [busquedaPaciente, setBusquedaPaciente] = useState('');
  const [filtroFactura, setFiltroFactura] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const [formFactura, setFormFactura] = useState(modeloFactura);
  const [items, setItems] = useState([]);
  const [emergenciaIds, setEmergenciaIds] = useState([]);
  const [internamientoIds, setInternamientoIds] = useState([]);
  const [laboratorioSolicitudId, setLaboratorioSolicitudId] = useState('');
  const [aplicacionesAnticipo, setAplicacionesAnticipo] = useState([]);

  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);

  const [guardandoFactura, setGuardandoFactura] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [modalCatalogoAbierto, setModalCatalogoAbierto] = useState(false);
  const [busquedaCatalogo, setBusquedaCatalogo] = useState('');
  const [resultadosCatalogo, setResultadosCatalogo] = useState([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);

  const pacienteSeleccionado = useMemo(() => pacientes.find((p) => p.id === formFactura.paciente_id) || null, [pacientes, formFactura.paciente_id]);

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + subtotalItem(item), 0), [items]);
  const totalCoberturaItems = useMemo(() => items.reduce((acc, item) => acc + Number(item.cobertura || 0), 0), [items]);
  const totalBruto = subtotal;
  const totalNeto = Math.max(totalBruto - totalCoberturaItems, 0);
  const totalDiferencia = totalNeto;

  const totalPagadas = useMemo(() => facturas.filter((f) => f.estado === 'pagada').length, [facturas]);
  const totalPendientes = useMemo(() => facturas.filter((f) => f.estado === 'pendiente' || f.estado === 'parcial').length, [facturas]);
  const totalPendientesFacturar = useMemo(() => pendientes.filter((p) => p.pendiente_facturar).length, [pendientes]);

  useEffect(() => { cargarInicial(); }, []);
  useEffect(() => { cargarPacientes(busquedaPaciente); }, [busquedaPaciente]);
  
  useEffect(() => {
    if (pacienteSeleccionado) {
      setFormFactura((prev) => ({
        ...prev, ars_id: pacienteSeleccionado.aseguradora_id || '', porcentaje_cobertura: prev.porcentaje_cobertura || 0,
        nombre_paciente_manual: '', apellido_paciente_manual: '', cedula_paciente_manual: '',
      }));
    }
  }, [pacienteSeleccionado]);

  async function cargarInicial() {
    setCargando(true); setError('');
    try {
      const [respPendientes, respPacientes, respFacturas] = await Promise.all([
        listarPendientesFacturacion(), buscarPacientesFacturacion(), listarFacturas()
      ]);
      setPendientes(respPendientes); setPacientes(respPacientes); setFacturas(respFacturas);
    } catch (err) {
      setError(err.message || 'Error al cargar datos iniciales.');
    } finally {
      setCargando(false);
    }
  }

  async function cargarPendientes() {
    try { setPendientes(await listarPendientesFacturacion(busquedaPendiente)); } catch (err) { setError(err.message); }
  }

  async function cargarPacientes(filtro) {
    try { setPacientes(await buscarPacientesFacturacion(filtro)); } catch (err) {}
  }

  function limpiarFactura() {
    setFormFactura(modeloFactura); setItems([]); setEmergenciaIds([]); setInternamientoIds([]);
    setLaboratorioSolicitudId(''); setAplicacionesAnticipo([]); setError(''); setMensaje('');
    setBusquedaCatalogo(''); setResultadosCatalogo([]); setModalCatalogoAbierto(false);
  }

  function volverAInicio() { limpiarFactura(); setFacturaSeleccionada(null); setPantalla('inicio'); }

  async function nuevaFacturaDirecta() {
    limpiarFactura();
    try {
      const numero = await generarNumeroFactura('clinica');
      setFormFactura({ ...modeloFactura, numero, origen_principal: 'manual', tipo_factura: 'clinica' });
    } catch {}
    setPantalla('editor');
  }

  async function abrirPendiente(item) {
    limpiarFactura();
    try {
      const numero = await generarNumeroFactura(item.origen || 'clinica');
      setFormFactura({ ...modeloFactura, numero, paciente_id: item.paciente_id || '', origen_principal: item.origen || 'manual', tipo_factura: 'clinica', tipo_orden: item.origen, medico_id: item.medico_id || '', ars_id: item.ars_id || '' });
      if (item.origen === 'emergencia') await toggleEmergencia({ id: item.referencia_id, medico_id: item.medico_id }, true);
      if (item.origen === 'internamiento') await toggleInternamiento({ id: item.referencia_id, medico_id: item.medico_id }, true);
      if (item.origen === 'laboratorio') { setLaboratorioSolicitudId(item.referencia_id); setFormFactura(prev => ({...prev, laboratorio_solicitud_id: item.referencia_id})); }
      setPantalla('editor');
    } catch (err) { setError(err.message); }
  }

  function cambiarFormFactura(campo, valor) { setFormFactura((prev) => ({ ...prev, [campo]: valor })); }

  function aplicarCoberturaGlobal() {
    const val = Number(formFactura.porcentaje_cobertura) || 0;
    const porcentaje = Math.min(100, Math.max(0, val));
    
    setItems((prev) => prev.map(it => {
      const monto = it.cantidad * it.precio_unitario;
      const cobertura_calculada = (monto * porcentaje) / 100;
      return { ...it, porcentaje_cobertura: porcentaje, cobertura: cobertura_calculada };
    }));
    setMensaje(`Cobertura del ${porcentaje}% aplicada a todos los servicios.`);
  }

  async function buscarEnCatalogoFacturacion(textoBusqueda = '') {
    setBusquedaCatalogo(textoBusqueda);
    if (!textoBusqueda.trim()) { setResultadosCatalogo([]); return; }
    setCargandoCatalogo(true);
    try { setResultadosCatalogo(await buscarCatalogoFacturacion(textoBusqueda)); } 
    catch (err) { setResultadosCatalogo([]); } 
    finally { setCargandoCatalogo(false); }
  }

  function abrirModalCatalogo() { setModalCatalogoAbierto(true); if (!busquedaCatalogo.trim()) buscarEnCatalogoFacturacion(''); }
  function cerrarModalCatalogo() { setModalCatalogoAbierto(false); }

  function agregarItemDesdeCatalogo(item) {
    const porcentaje = Number(formFactura.porcentaje_cobertura || item.porcentaje_cobertura_default || 0);
    const precio = Number(item.precio || 0);
    setItems((prev) => [...prev, {
        tipo_item: item.tipo_item || 'servicio', descripcion: item.descripcion || 'Ítem', cantidad: 1, precio_unitario: precio, referencia_id: item.id || '',
        cobertura: precio * (porcentaje / 100), porcentaje_cobertura: porcentaje, departamento: item.departamento || 'General', area_origen: item.area_origen || 'General', origen_modulo: 'catalogo'
    }]);
    setModalCatalogoAbierto(false); setMensaje('Ítem agregado.');
  }

  function quitarItem(index) { setItems((prev) => prev.filter((_, i) => i !== index)); }

  async function toggleEmergencia(emergencia, forzarAgregar = false) {
    if (emergenciaIds.includes(emergencia.id) && !forzarAgregar) {
      setEmergenciaIds((prev) => prev.filter((id) => id !== emergencia.id));
      setItems((prev) => prev.filter((i) => !(i.origen_modulo === 'emergencias' && i.referencia_id === emergencia.id)));
      return;
    }
    try {
      const detalles = await obtenerDetalleConsolidadoEmergencia(emergencia.id);
      setEmergenciaIds((prev) => [...prev, emergencia.id]);
      setItems((prev) => [...prev, ...(detalles || [])]);
    } catch (err) { setError(err.message); }
  }

  async function toggleInternamiento(internamiento, forzarAgregar = false) {
    if (internamientoIds.includes(internamiento.id) && !forzarAgregar) {
      setInternamientoIds((prev) => prev.filter((id) => id !== internamiento.id));
      setItems((prev) => prev.filter((i) => !(i.origen_modulo === 'internamientos' && i.referencia_id === internamiento.id)));
      return;
    }
    try {
      const detalles = await obtenerDetalleConsolidadoInternamiento(internamiento.id);
      setInternamientoIds((prev) => [...prev, internamiento.id]);
      setItems((prev) => [...prev, ...(detalles || [])]);
    } catch (err) { setError(err.message); }
  }

  async function guardarFactura(e) {
    e.preventDefault(); setGuardandoFactura(true); setError(''); setMensaje('');
    try {
      const f = await crearFactura({ ...formFactura, items, usuario_id: usuario?.id || null, emergencia_ids: emergenciaIds, internamiento_ids: internamientoIds, laboratorio_solicitud_id: laboratorioSolicitudId || null, anticipo_aplicaciones: aplicacionesAnticipo });
      await cargarInicial(); setMensaje('Factura registrada correctamente.'); await abrirFactura(f.id);
    } catch (err) { setError(err.message); } finally { setGuardandoFactura(false); }
  }

  async function abrirFactura(id) {
    try {
      const data = await obtenerFacturaCompleta(id);
      setFacturaSeleccionada(data.factura); setDetalleFactura(data.detalle || []);
      setPantalla('factura');
    } catch (err) { setError(err.message); }
  }

  async function buscarFacturasLista() {
    setCargando(true);
    try { setFacturas(await listarFacturas({ filtro: filtroFactura, tipo_factura: filtroTipo, estado: filtroEstado })); } 
    catch (err) { setError(err.message); } finally { setCargando(false); }
  }

  function imprimirFacturaActual() { window.print(); }

  function claseEstado(estado) {
    const n = (estado || '').toLowerCase();
    if (n === 'pagada') return css.badgeActive;
    if (n === 'parcial') return { ...css.badgeActive, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' };
    if (n === 'anulada') return { ...css.badgeActive, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' };
    return { ...css.badgeActive, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
  }

  const css = {
    tableBtnEdit: { background: '#ffffff', color: '#004085', border: '1px solid #d1e0f0', padding: '6px 14px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'inline-block' },
    tableBtnDelete: { background: '#fce8e8', color: '#c82333', border: '1px solid #f5c2c7', padding: '6px 14px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'inline-block' },
    badgeActive: { display: 'inline-flex', alignItems: 'center', background: '#e6f7ef', color: '#007a5e', border: '1px solid #c3e6cb', padding: '4px 12px', borderRadius: '20px', fontWeight: '800', fontSize: '12px' },
    topLayout: { display: 'flex', gap: '15px', alignItems: 'flex-start', marginBottom: '20px' },
    headerBanner: { flex: 1, background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)', borderRadius: '16px', padding: '24px 30px', color: '#fff', boxShadow: '0 4px 14px rgba(37,99,235,0.15)' },
    headerChip: { background: 'rgba(255,255,255,0.2)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', marginBottom: '12px' },
    headerTitle: { margin: '0 0 6px 0', fontSize: '32px', fontWeight: '900' },
    headerSubtitle: { margin: 0, fontSize: '14px', fontWeight: '500', opacity: 0.95 },
    tabContainer: { display: 'flex', gap: '10px' },
    tabBtn: (active) => ({ padding: '12px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#1e3a8a', border: active ? 'none' : '1px solid #bfdbfe', boxShadow: active ? '0 4px 10px rgba(37,99,235,0.2)' : 'none', transition: 'all 0.2s' }),
    metricsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' },
    metricCard: { background: '#fff', borderRadius: '16px', padding: '20px', border: `1px solid #e5e7eb`, position: 'relative', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' },
    metricIconWrapper: (bg) => ({ background: bg, width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '15px' }),
    metricGhost: { position: 'absolute', right: '10px', top: '10px', fontSize: '65px', opacity: 0.03, pointerEvents: 'none' },
    metricTitle: { fontSize: '13px', color: '#64748b', fontWeight: '800', marginBottom: '6px' },
    metricValue: { fontSize: '28px', fontWeight: '900', color: '#1e3a8a' }, 
    searchBox: { background: '#fff', borderRadius: '16px', padding: '20px', border: `1px solid #e5e7eb`, marginBottom: '20px' },
    searchTitle: { margin: '0 0 15px 0', fontSize: '18px', color: '#1e3a8a', fontWeight: '900' },
    searchFlex: { display: 'flex', gap: '10px' },
    inputRounded: { ...safeInputStyle, borderRadius: '8px', padding: '12px 15px', border: `1px solid #e5e7eb` },
    btnBlue: { background: '#2563eb', color: '#fff', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer' },
    tableWrapper: { overflowX: 'auto', borderRadius: '8px', border: `1px solid #e5e7eb`, marginTop: '15px' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' },
    th: { padding: '12px 15px', background: '#f8fafc', color: '#64748b', fontWeight: 'bold', borderBottom: `1px solid #e5e7eb` },
    td: { padding: '12px 15px', color: '#334155', borderBottom: `1px solid #e5e7eb` },
    ordenGrid: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: '15px', alignItems: 'start' },
    box: { background: '#fff', border: `1px solid #e5e7eb`, borderRadius: '16px', padding: '20px' },
    formRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '10px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '5px', display: 'block' },
    actionBtn: (bg, color) => ({ width: '100%', padding: '12px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', background: bg, color: color, fontSize: '14px', marginBottom: '8px' }),
    totalItem: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid #e5e7eb`, fontWeight: 'bold' }
  };

  return (
    <>
      <PrintStyles />
      <div style={safePageWrapperStyle} className="hide-on-print">
        
        <div style={css.topLayout}>
          <div style={css.headerBanner}>
             <div style={css.headerChip}>🧾 Gestión de facturación</div>
             <h1 style={css.headerTitle}>Facturación</h1>
             <p style={css.headerSubtitle}>Buscador, órdenes, pagos, anticipos e impresión dentro del mismo módulo.</p>
          </div>
          <div style={css.tabContainer}>
            <button style={css.tabBtn(pantalla === 'inicio')} onClick={volverAInicio}>Inicio</button>
            <button style={css.tabBtn(pantalla === 'editor')} onClick={nuevaFacturaDirecta}>Órdenes</button>
            <button style={css.tabBtn(pantalla === 'factura')} onClick={() => setPantalla('factura')}>Factura / Pago</button>
          </div>
        </div>

        <div style={css.metricsRow}>
           <div style={css.metricCard}><div style={css.metricGhost}>📌</div><div style={css.metricIconWrapper('#fee2e2')}>📌</div><div style={css.metricTitle}>Pendientes por facturar</div><div style={css.metricValue}>{totalPendientesFacturar}</div></div>
           <div style={css.metricCard}><div style={css.metricGhost}>🧾</div><div style={css.metricIconWrapper('#f1f5f9')}>🧾</div><div style={css.metricTitle}>Total facturas</div><div style={css.metricValue}>{facturas.length}</div></div>
           <div style={css.metricCard}><div style={css.metricGhost}>✅</div><div style={css.metricIconWrapper('#dcfce7')}>✅</div><div style={css.metricTitle}>Pagadas</div><div style={css.metricValue}>{totalPagadas}</div></div>
           <div style={css.metricCard}><div style={css.metricGhost}>⏳</div><div style={css.metricIconWrapper('#ffedd5')}>⏳</div><div style={css.metricTitle}>Pendientes / parciales</div><div style={css.metricValue}>{totalPendientes}</div></div>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>{error}</div>}
        {mensaje && <div style={{ background: '#ecfdf5', color: '#059669', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>{mensaje}</div>}

        {pantalla === 'inicio' && (
          <div>
            <div style={css.searchBox}>
              <h3 style={css.searchTitle}>Pendientes de facturación</h3>
              <div style={css.searchFlex}>
                 <input style={{...css.inputRounded, flex: 1}} placeholder="Buscar por paciente, cédula, récord, origen o descripción" value={busquedaPendiente} onChange={(e) => setBusquedaPendiente(e.target.value)} />
                 <button style={css.btnBlue} onClick={cargarPendientes}>Buscar</button>
              </div>
              <div style={css.tableWrapper}>
                <table style={css.table}>
                  <thead>
                    <tr><th style={css.th}>Origen</th><th style={css.th}>Paciente</th><th style={css.th}>Descripción</th><th style={css.th}>ARS</th><th style={css.th}>Fecha</th><th style={css.th}>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {pendientes.length === 0 ? (
                      <tr><td colSpan="6" style={{...css.td, textAlign: 'center', padding: '20px'}}>No hay pendientes para mostrar.</td></tr>
                    ) : (
                      pendientes.map(p => (
                        <tr key={`${p.origen}-${p.referencia_id}`}>
                          <td style={css.td}>{p.origen.toUpperCase()}</td>
                          <td style={css.td}><strong>{p.nombre} {p.apellido}</strong> <br/><span style={{fontSize:'11px', color:'#64748b'}}>Céd: {p.cedula}</span></td>
                          <td style={css.td}>{p.descripcion}</td>
                          <td style={css.td}>{p.ars_nombre || 'PRIVADO'}</td>
                          <td style={css.td}>{new Date(p.fecha_origen).toLocaleString()}</td>
                          <td style={css.td}><button style={css.tableBtnEdit} onClick={() => abrirPendiente(p)}>Facturar</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={css.searchBox}>
              <h3 style={css.searchTitle}>Buscar facturas</h3>
              <div style={css.searchFlex}>
                 <input style={{...css.inputRounded, flex: 2}} placeholder="Buscar por número, paciente o cédula" value={filtroFactura} onChange={(e) => setFiltroFactura(e.target.value)} />
                 <select style={{...css.inputRounded, flex: 1}} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                    <option value="">Todos los tipos</option><option value="clinica">Clínica</option><option value="farmacia">Farmacia</option>
                 </select>
                 <select style={{...css.inputRounded, flex: 1}} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                    <option value="">Todos los estados</option><option value="pendiente">Pendiente</option><option value="pagada">Pagada</option><option value="anulada">Anulada</option>
                 </select>
                 <button style={css.btnBlue} onClick={buscarFacturasLista}>Buscar</button>
              </div>
              <div style={css.tableWrapper}>
                <table style={css.table}>
                  <thead>
                    <tr><th style={css.th}>Número</th><th style={css.th}>Paciente</th><th style={css.th}>Origen</th><th style={css.th}>Fecha</th><th style={css.th}>Total neto</th><th style={css.th}>Saldo</th><th style={css.th}>Estado</th><th style={css.th}>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {facturas.length === 0 ? (
                      <tr><td colSpan="8" style={{...css.td, textAlign: 'center', padding: '20px'}}>No hay facturas para mostrar.</td></tr>
                    ) : (
                      facturas.map(f => (
                        <tr key={f.id}>
                          <td style={css.td}><strong>{f.numero}</strong></td>
                          <td style={css.td}>{nombrePacienteFactura(f)}</td>
                          <td style={css.td}>{f.origen_principal}</td>
                          <td style={css.td}>{new Date(f.fecha).toLocaleDateString()}</td>
                          <td style={css.td}>RD$ {Number(f.total_neto).toFixed(2)}</td>
                          <td style={css.td}>RD$ {Number(f.saldo).toFixed(2)}</td>
                          <td style={css.td}><span style={claseEstado(f.estado)}>{f.estado.toUpperCase()}</span></td>
                          <td style={css.td}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button style={css.tableBtnEdit} onClick={() => abrirFactura(f.id)}>Ver</button>
                              {f.estado !== 'anulada' && <button style={css.tableBtnDelete} onClick={() => alert("Función de anular no activada aquí directamente")}>Anular</button>}
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
        )}

        {pantalla === 'editor' && (
          <div style={{ marginTop: '20px' }}>
            <div style={css.ordenGrid}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={css.box}>
                  <h3 style={css.searchTitle}>Datos del paciente / orden [{formFactura.numero || 'NUEVA'}]</h3>
                  
                  {/* AQUÍ ESTÁ EL SELECTOR PARA ENVIAR A LABORATORIO */}
                  <div style={{...css.formRow, gridTemplateColumns: '1fr 1fr'}}>
                     <div>
                       <label style={css.label}>DESTINO (OBLIGATORIO PARA LABORATORIO):</label>
                       <select style={css.inputRounded} value={formFactura.tipo_orden} onChange={(e) => cambiarFormFactura('tipo_orden', e.target.value)}>
                          <option value="">Consulta / Clínica</option>
                          <option value="laboratorio">Laboratorio Clínico</option>
                       </select>
                     </div>
                     <div>
                       <label style={css.label}>Buscar Paciente Existente:</label>
                       <select style={css.inputRounded} value={formFactura.paciente_id} onChange={(e) => cambiarFormFactura('paciente_id', e.target.value)}>
                          <option value="">-- Seleccione un paciente o ingrese manual --</option>
                          {pacientes.map(p => <option key={p.id} value={p.id}>{p.cedula} | {p.nombre_completo}</option>)}
                       </select>
                     </div>
                  </div>

                  <div style={css.formRow}>
                    <div><label style={css.label}>Cédula</label><input style={css.inputRounded} value={pacienteSeleccionado?.cedula || formFactura.cedula_paciente_manual} onChange={e => cambiarFormFactura('cedula_paciente_manual', e.target.value)} disabled={!!pacienteSeleccionado} /></div>
                    <div><label style={css.label}>Nombres</label><input style={css.inputRounded} value={pacienteSeleccionado?.nombre || formFactura.nombre_paciente_manual} onChange={e => cambiarFormFactura('nombre_paciente_manual', e.target.value)} disabled={!!pacienteSeleccionado} /></div>
                    <div><label style={css.label}>Apellidos</label><input style={css.inputRounded} value={pacienteSeleccionado?.apellido || formFactura.apellido_paciente_manual} onChange={e => cambiarFormFactura('apellido_paciente_manual', e.target.value)} disabled={!!pacienteSeleccionado} /></div>
                  </div>
                  <div style={css.formRow}>
                    <div><label style={css.label}>ARS / Aseguradora</label><input style={css.inputRounded} value={pacienteSeleccionado?.aseguradora_nombre || 'PRIVADO'} disabled /></div>
                    <div><label style={css.label}>Autorización</label><input style={css.inputRounded} value={formFactura.numero_autorizacion} onChange={e => cambiarFormFactura('numero_autorizacion', e.target.value)} /></div>
                    <div><label style={css.label}>Médico Referencia</label><input style={css.inputRounded} value={formFactura.medico_id} onChange={e => cambiarFormFactura('medico_id', e.target.value)} /></div>
                  </div>
                </div>

                <div style={css.box}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{...css.searchTitle, margin: 0}}>Detalle de Servicios</h3>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <span style={{fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginRight: '8px'}}>% Cobertura Global:</span>
                      <input 
                        type="number" min="0" max="100" 
                        style={{width: '60px', padding: '6px', textAlign: 'center', borderRadius: '6px', border: '1px solid #cbd5e1'}}
                        value={formFactura.porcentaje_cobertura || ''}
                        onChange={(e) => cambiarFormFactura('porcentaje_cobertura', e.target.value)} placeholder="0"
                      />
                      <button style={{...css.tableBtnEdit, marginLeft: '8px', padding: '6px 10px'}} onClick={aplicarCoberturaGlobal}>Aplicar</button>
                    </div>
                    <button style={css.btnBlue} onClick={abrirModalCatalogo}>🔍 Buscar Catálogo [F12]</button>
                  </div>
                  
                  <div style={css.tableWrapper}>
                    <table style={css.table}>
                      <thead>
                        <tr>
                          <th style={css.th}>Código</th><th style={css.th}>Descripción Servicio</th><th style={{...css.th, textAlign:'center'}}>Cant.</th>
                          <th style={{...css.th, textAlign:'right'}}>Precio</th><th style={{...css.th, textAlign:'center'}}>% Cob</th><th style={{...css.th, textAlign:'right'}}>Cob RD$</th>
                          <th style={{...css.th, textAlign:'right'}}>Dif</th><th style={{...css.th, textAlign:'right'}}>Monto</th><th style={{...css.th, textAlign:'center'}}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr><td colSpan="9" style={{...css.td, textAlign:'center', padding:'20px'}}>No hay servicios. Busca en el catálogo.</td></tr>
                        ) : (
                          items.map((it, idx) => {
                            const monto = subtotalItem(it);
                            const dif = monto - (it.cobertura || 0);
                            return (
                              <tr key={idx}>
                                <td style={css.td}>{it.referencia_id?.slice(0,6) || '-'}</td>
                                <td style={{...css.td, fontWeight: 'bold'}}>{it.descripcion}</td>
                                <td style={{...css.td, textAlign:'center'}}>
                                  <input type="number" min="1" style={{width:'50px', padding:'4px', textAlign:'center', borderRadius:'4px', border:`1px solid #e5e7eb`}} value={it.cantidad} 
                                    onChange={(e) => {
                                      const val = Number(e.target.value); const newItems = [...items]; newItems[idx].cantidad = val;
                                      newItems[idx].cobertura = (val * newItems[idx].precio_unitario * newItems[idx].porcentaje_cobertura) / 100;
                                      setItems(newItems);
                                    }} />
                                </td>
                                <td style={{...css.td, textAlign:'right'}}>{it.precio_unitario.toFixed(2)}</td>
                                <td style={{...css.td, textAlign:'center'}}>
                                  <input type="number" min="0" max="100" style={{width:'55px', padding:'4px', textAlign:'center', borderRadius:'4px', border:`1px solid #e5e7eb`, color: '#007a5e', fontWeight: 'bold'}} value={it.porcentaje_cobertura || 0} 
                                    onChange={(e) => {
                                      let val = Number(e.target.value); if(val > 100) val = 100; if(val < 0) val = 0;
                                      const newItems = [...items]; newItems[idx].porcentaje_cobertura = val;
                                      newItems[idx].cobertura = (newItems[idx].cantidad * newItems[idx].precio_unitario * val) / 100;
                                      setItems(newItems);
                                    }} />
                                </td>
                                <td style={{...css.td, textAlign:'right', color: '#007a5e'}}>{Number(it.cobertura).toFixed(2)}</td>
                                <td style={{...css.td, textAlign:'right', color: '#dc2626'}}>{dif.toFixed(2)}</td>
                                <td style={{...css.td, textAlign:'right', fontWeight: 'bold'}}>{monto.toFixed(2)}</td>
                                <td style={{...css.td, textAlign:'center'}}><button style={css.tableBtnDelete} onClick={() => quitarItem(idx)}>Quitar</button></td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div style={css.box}>
                <h3 style={css.searchTitle}>Totales</h3>
                <div style={css.totalItem}><span style={{color: '#64748b'}}>Total Bruto</span><span style={{fontSize:'18px'}}>RD$ {totalBruto.toFixed(2)}</span></div>
                <div style={css.totalItem}><span style={{color: '#64748b'}}>Cobertura Total</span><span style={{fontSize:'18px', color:'#007a5e'}}>RD$ {totalCoberturaItems.toFixed(2)}</span></div>
                <div style={css.totalItem}><span style={{color: '#64748b'}}>Diferencia</span><span style={{fontSize:'18px', color:'#dc2626'}}>RD$ {totalDiferencia.toFixed(2)}</span></div>

                <div style={{background: '#eff6ff', padding: '15px', borderRadius: '8px', textAlign: 'center', marginTop: '10px', marginBottom: '20px'}}>
                  <div style={{fontSize: '13px', fontWeight: 'bold', color: '#1e3a8a'}}>TOTAL NETO A PAGAR</div>
                  <div style={{fontSize: '26px', fontWeight: '900', color: '#0f172a'}}>RD$ {totalNeto.toFixed(2)}</div>
                </div>

                <div>
                  <button style={css.actionBtn('#2563eb', '#fff')} onClick={guardarFactura} disabled={guardandoFactura || items.length === 0}>{guardandoFactura ? 'Guardando...' : 'Salvar Orden [F10]'}</button>
                  <button style={css.actionBtn('#f1f5f9', '#475569')} onClick={() => setItems([])}>Borrar Líneas [F3]</button>
                  <button style={css.actionBtn('#fce8e8', '#c82333')} onClick={limpiarFactura}>Cancelar / Limpiar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {modalCatalogoAbierto && pantalla === 'editor' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={cerrarModalCatalogo}>
            <div style={{ width: '900px', maxHeight: '80vh', background: '#fff', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ padding: '20px', borderBottom: `1px solid #e5e7eb`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#1e3a8a' }}>Catálogo General</h3>
                <button onClick={cerrarModalCatalogo} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✖</button>
              </div>
              <div style={{ padding: '20px' }}>
                <input style={{...css.inputRounded, width: '100%', borderColor: '#2563eb'}} placeholder="Escribe para buscar..." value={busquedaCatalogo} onChange={(e) => buscarEnCatalogoFacturacion(e.target.value)} autoFocus />
              </div>
              <div style={{ padding: '0 20px 20px', overflowY: 'auto' }}>
                <table style={css.table}>
                  <thead><tr><th style={css.th}>Tipo</th><th style={css.th}>Código</th><th style={css.th}>Descripción</th><th style={css.th}>Precio</th><th style={css.th}>Acciones</th></tr></thead>
                  <tbody>
                    {cargandoCatalogo ? (<tr><td colSpan="5" style={css.td}>Buscando...</td></tr>) : resultadosCatalogo.length === 0 ? (<tr><td colSpan="5" style={css.td}>Sin resultados.</td></tr>) : (
                      resultadosCatalogo.map((item, i) => (
                        <tr key={i}>
                          <td style={css.td}>{item.tipo.toUpperCase()}</td>
                          <td style={css.td}>{item.codigo_mostrar}</td>
                          <td style={css.td}>{item.descripcion}</td>
                          <td style={css.td}>RD$ {item.precio.toFixed(2)}</td>
                          <td style={css.td}><button style={css.tableBtnEdit} onClick={() => agregarItemDesdeCatalogo(item)}>Agregar</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {pantalla === 'factura' && facturaSeleccionada && (
           <div style={css.box}>
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
               <div>
                 <h2 style={css.searchTitle}>Documento No. {facturaSeleccionada.numero}</h2>
                 <p style={{margin:0, color: '#64748b'}}>Paciente: {nombrePacienteFactura(facturaSeleccionada)}</p>
               </div>
               <div style={{ textAlign: 'center', background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                 <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${facturaSeleccionada.numero}`} alt="QR" style={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                 <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Escanea en Lab</div>
               </div>
               <div style={{textAlign:'right'}}>
                 <h1 style={{margin:0, color: '#0f172a'}}>Total Neto: RD$ {Number(facturaSeleccionada.total_neto).toFixed(2)}</h1>
                 <h3 style={{margin:0, color: '#dc2626'}}>Saldo Pendiente: RD$ {Number(facturaSeleccionada.saldo).toFixed(2)}</h3>
               </div>
             </div>
             <button style={css.btnBlue} onClick={imprimirFacturaActual}>🖨️ Imprimir Factura</button>
           </div>
        )}
      </div>

      {facturaSeleccionada && (
        <div id="seccion-impresion-factura">
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '15px' }}>
             <h2 style={{ margin: '0 0 5px 0' }}>CENTRO MÉDICO CLÍNICO</h2>
             <p style={{ margin: 0, fontSize: '12px' }}>RNC: 123456789 | Tel: 809-555-0000</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '15px' }}>
            <div><p style={{margin:'2px 0'}}><strong>Paciente:</strong> {nombrePacienteFactura(facturaSeleccionada)}</p><p style={{margin:'2px 0'}}><strong>Cédula:</strong> {facturaSeleccionada.pacientes?.cedula || '-'}</p></div>
            <div style={{ textAlign: 'center' }}><img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${facturaSeleccionada.numero}`} alt="QR" /></div>
            <div style={{ textAlign: 'right' }}><p style={{margin:'2px 0'}}><strong>Factura No:</strong> {facturaSeleccionada.numero}</p><p style={{margin:'2px 0'}}><strong>Fecha:</strong> {new Date(facturaSeleccionada.fecha).toLocaleString()}</p></div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
            <thead><tr style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000' }}><th style={{ padding: '4px', textAlign: 'left' }}>Descripción</th><th style={{ padding: '4px', textAlign: 'center' }}>Cant</th><th style={{ padding: '4px', textAlign: 'right' }}>Precio</th><th style={{ padding: '4px', textAlign: 'right' }}>Importe</th></tr></thead>
            <tbody>
              {(detalleFactura.length > 0 ? detalleFactura : items).map((d, idx) => (
                <tr key={idx}><td style={{ padding: '4px' }}>{d.descripcion}</td><td style={{ padding: '4px', textAlign: 'center' }}>{d.cantidad}</td><td style={{ padding: '4px', textAlign: 'right' }}>{Number(d.precio_unitario).toFixed(2)}</td><td style={{ padding: '4px', textAlign: 'right' }}>{(d.cantidad * d.precio_unitario).toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '14px' }}>
            <div style={{ width: '250px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Subtotal:</span> <span>RD$ {(facturaSeleccionada.subtotal || totalBruto).toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Cobertura:</span> <span>RD$ {(facturaSeleccionada.cobertura_total || totalCoberturaItems).toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid #000', fontWeight: 'bold' }}><span>Total Neto:</span> <span>RD$ {(facturaSeleccionada.total_neto || totalNeto).toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default Facturacion;