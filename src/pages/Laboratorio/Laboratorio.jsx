import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as LabService from '../../services/laboratorioService';
import {
  buttonPrimaryStyle,
  buttonSoftStyle,
  cardStyle,
  getUiColors,
  inputStyle,
  pageWrapperStyle,
} from '../../styles/uiTheme';

const PrintStyles = () => (
  <style>
    {`
      @media print {
        body * { visibility: hidden; }
        #impresion-resultados, #impresion-resultados * { visibility: visible; }
        #impresion-resultados { 
          position: absolute; 
          left: 0; 
          top: 0; 
          width: 100%; 
          margin: 0; 
          padding: 20px; 
          background: white; 
          color: black; 
          font-family: monospace; /* Estilo ticket/reporte médico */
        }
        .hide-on-print { display: none !important; }
      }
      @media screen { #impresion-resultados { display: none; } }
    `}
  </style>
);

const Laboratorio = ({ darkMode = false }) => {
  const { usuario } = useAuth();
  const colores = getUiColors(darkMode);

  const [vista, setVista] = useState('inicio'); 
  const [ordenes, setOrdenes] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [ordenActiva, setOrdenActiva] = useState(null);
  const [detalles, setDetalles] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [resultadosForm, setResultadosForm] = useState({});
  const [mensajeExito, setMensajeExito] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar(t = '') {
    try {
      const res = await LabService.buscarOrdenLaboratorio(t); 
      setOrdenes(res);
    } catch (err) { alert(err.message); }
  }

  async function abrirRegistro(orden) {
    try {
      const data = await LabService.listarDetalleLaboratorio(orden.factura_id);
      setOrdenActiva(orden); 
      setDetalles(data); 
      setSeleccionados([]); 
      setVista('registro');
    } catch (err) { alert(err.message); }
  }

  async function abrirResultados(orden) {
    try {
      const data = await LabService.listarDetalleLaboratorio(orden.factura_id);
      setOrdenActiva(orden); 
      setDetalles(data); 
      
      const formInicial = {};
      data.forEach(d => {
        formInicial[d.id] = {
          resultado: d.resultado || '',
          valor_referencia: d.valor_referencia || '',
          unidades: d.unidades || '',
          metodo: d.metodo || ''
        };
      });
      setResultadosForm(formInicial);
      
      setVista('resultados');
    } catch (err) { alert(err.message); }
  }

  async function procesarRegistro() {
    if (seleccionados.length === 0) return alert("Seleccione al menos una analítica.");
    try {
      await LabService.registrarMuestrasBatch(seleccionados, usuario?.id);
      setMensajeExito(`Paciente: ${ordenActiva?.paciente_nombre || 'N/A'} - MUESTRAS REGISTRADAS.`);
      setVista('inicio'); cargar();
      setTimeout(() => setMensajeExito(''), 4000);
    } catch (err) { alert(err.message); }
  }

  async function procesarGuardadoResultados() {
    const payload = detalles.map(d => ({ detalle_id: d.id, ...resultadosForm[d.id] })).filter(r => r.resultado);
    if (payload.length === 0) return alert("Ingrese al menos un resultado.");
    try {
      await LabService.guardarResultadosBatch(payload, usuario?.id);
      alert("✅ Resultados guardados con éxito.");
      setVista('inicio'); cargar();
    } catch (err) { alert(err.message); }
  }

  const css = {
    hero: { background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)', padding: '30px', borderRadius: '12px', color: '#fff', marginBottom: '20px' },
    infoBox: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', background: colores.cardSoft, padding: '20px', borderRadius: '12px', marginBottom: '20px' },
    lbl: { fontSize: '11px', color: '#64748b', fontWeight: 'bold' }
  };

  return (
    <>
      <PrintStyles />
      <div style={pageWrapperStyle(darkMode)} className="hide-on-print">
        
        <div style={css.hero}>
          <h1 style={{ margin: '0 0 5px 0' }}>Laboratorio Clínico</h1>
          <p style={{ margin: 0, opacity: 0.9 }}>Búsqueda de todas las facturas del sistema, registro de muestras y resultados.</p>
        </div>

        {mensajeExito && (
          <div style={{ background: '#dcfce7', color: '#166534', padding: '15px', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold', textAlign: 'center', border: '1px solid #bbf7d0' }}>
            ✅ {mensajeExito}
          </div>
        )}

        {/* --- VISTA 1: INICIO --- */}
        {vista === 'inicio' && (
          <div style={cardStyle(darkMode)}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
              <input style={{ ...inputStyle(darkMode), flex: 1, height: '50px', fontSize: '16px' }} placeholder="Escanee QR, Factura o Nombre de Paciente..." value={filtro} onChange={e => { setFiltro(e.target.value); cargar(e.target.value); }} autoFocus />
              <button style={{ ...buttonPrimaryStyle, width: '150px' }} onClick={() => cargar(filtro)}>Buscar</button>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', color: colores.texto }}>
              <thead>
                <tr style={{ textAlign: 'left', background: colores.cardSoft, borderBottom: `2px solid ${colores.borde}` }}>
                  <th style={{ padding: '15px' }}>FACTURA / QR</th>
                  <th style={{ padding: '15px' }}>PACIENTE</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.length === 0 ? <tr><td colSpan="3" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Cargando facturas...</td></tr> : 
                  ordenes.map((o, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${colores.borde}` }}>
                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{o.numero_factura}</div>
                      <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 'bold' }}>{o.codigo_qr}</div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: 'bold' }}>{o.paciente_nombre || 'N/A'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Cédula: {o.cedula || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button style={{ ...buttonSoftStyle(darkMode), background: '#f1f5f9', color: '#334155', fontWeight: 'bold' }} onClick={() => abrirRegistro(o)}>
                          Registrar Analíticas
                        </button>
                        <button style={{ ...buttonPrimaryStyle, fontWeight: 'bold' }} onClick={() => abrirResultados(o)}>
                          Cargar Resultados
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- VISTA 2: REGISTRO (TACHAR) --- */}
        {vista === 'registro' && ordenActiva && (
          <div style={cardStyle(darkMode)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#1e3a8a' }}>Registrar Analíticas</h2>
              <button onClick={() => setVista('inicio')} style={buttonSoftStyle(darkMode)}>Volver</button>
            </div>
            
            <div style={css.infoBox}>
              <div><div style={css.lbl}>Paciente</div><strong>{ordenActiva?.paciente_nombre || 'N/A'}</strong></div>
              <div><div style={css.lbl}>Cédula</div><strong>{ordenActiva?.cedula || 'N/A'}</strong></div>
              <div><div style={css.lbl}>Nacimiento</div><strong>{ordenActiva?.fecha_nacimiento || 'N/A'}</strong></div>
              <div><div style={css.lbl}>Teléfono</div><strong>{ordenActiva?.telefono || 'N/A'}</strong></div>
              <div><div style={css.lbl}>Factura</div><strong>{ordenActiva?.numero_factura || 'N/A'}</strong></div>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', color: colores.texto }}>
              <thead>
                <tr style={{ textAlign: 'left', background: colores.cardSoft }}>
                  <th style={{ padding: '15px' }}>Detalle de Factura (Analítica)</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>¿Realizada?</th>
                </tr>
              </thead>
              <tbody>
                {detalles.length === 0 ? (
                   <tr><td colSpan="2" style={{ padding: '20px', textAlign: 'center', color: 'red' }}>No se encontraron analíticas para esta factura.</td></tr>
                ) : (
                  detalles.map(d => (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${colores.borde}` }}>
                      <td style={{ padding: '15px', fontWeight: 'bold', fontSize: '15px' }}>{d.descripcion || 'N/A'}</td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          style={{ transform: 'scale(1.8)', cursor: 'pointer' }} 
                          checked={seleccionados.includes(d.id) || d.realizado} 
                          disabled={d.realizado} 
                          onChange={(e) => { 
                            if (e.target.checked) setSeleccionados([...seleccionados, d.id]); 
                            else setSeleccionados(seleccionados.filter(id => id !== d.id)); 
                          }} 
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            <button style={{ ...buttonPrimaryStyle, width: '100%', marginTop: '30px', height: '55px', fontSize: '16px' }} onClick={procesarRegistro}>
              Registrar Analíticas
            </button>
          </div>
        )}

        {/* --- VISTA 3: CARGA RESULTADOS E IMPRIMIR --- */}
        {vista === 'resultados' && ordenActiva && (
          <div style={cardStyle(darkMode)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: '0 0 5px 0', color: '#1e3a8a' }}>Cargar Resultados</h2>
              <button onClick={() => setVista('inicio')} style={buttonSoftStyle(darkMode)}>Volver</button>
            </div>
            
            <div style={css.infoBox}>
              <div><div style={css.lbl}>Paciente</div><strong>{ordenActiva?.paciente_nombre || 'N/A'}</strong></div>
              <div><div style={css.lbl}>Factura</div><strong>{ordenActiva?.numero_factura || 'N/A'}</strong></div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: colores.texto }}>
                <thead>
                  <tr style={{ textAlign: 'left', background: colores.cardSoft, borderBottom: `2px solid ${colores.borde}`, fontSize: '13px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px' }}>DETERMINACIÓN</th>
                    <th style={{ padding: '12px' }}>MÉTODO</th>
                    <th style={{ padding: '12px' }}>RESULTADO</th>
                    <th style={{ padding: '12px' }}>INTERVALO DE REF.</th>
                    <th style={{ padding: '12px' }}>UNIDADES</th>
                  </tr>
                </thead>
                <tbody>
                  {detalles.length === 0 ? (
                     <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'red' }}>No se encontraron analíticas para esta factura.</td></tr>
                  ) : (
                    detalles.map(d => (
                      <tr key={d.id} style={{ borderBottom: `1px solid ${colores.borde}` }}>
                        <td style={{ padding: '12px', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>
                          {d.descripcion || 'N/A'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input 
                            style={{ ...inputStyle(darkMode), width: '100%' }} 
                            placeholder="Ej. Citom. de Flujo" 
                            value={resultadosForm[d.id]?.metodo || ''} 
                            onChange={(e) => setResultadosForm(prev => ({...prev, [d.id]: {...(prev[d.id]||{}), metodo: e.target.value}}))} 
                          />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input 
                            style={{ ...inputStyle(darkMode), width: '100%', fontWeight: 'bold' }} 
                            placeholder="Ej. 16.0" 
                            value={resultadosForm[d.id]?.resultado || ''} 
                            onChange={(e) => setResultadosForm(prev => ({...prev, [d.id]: {...(prev[d.id]||{}), resultado: e.target.value}}))} 
                          />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input 
                            style={{ ...inputStyle(darkMode), width: '100%' }} 
                            placeholder="Ej. 14.0 - 18.0" 
                            value={resultadosForm[d.id]?.valor_referencia || ''} 
                            onChange={(e) => setResultadosForm(prev => ({...prev, [d.id]: {...(prev[d.id]||{}), valor_referencia: e.target.value}}))} 
                          />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input 
                            style={{ ...inputStyle(darkMode), width: '100px' }} 
                            placeholder="Ej. g/dL" 
                            value={resultadosForm[d.id]?.unidades || ''} 
                            onChange={(e) => setResultadosForm(prev => ({...prev, [d.id]: {...(prev[d.id]||{}), unidades: e.target.value}}))} 
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
              <button style={{ ...buttonPrimaryStyle, flex: 1, height: '55px', fontSize: '16px' }} onClick={procesarGuardadoResultados}>Guardar Resultados</button>
              <button style={{ ...buttonSoftStyle(darkMode), background: '#1e293b', color: 'white', flex: 1, height: '55px', fontSize: '16px' }} onClick={() => window.print()}>🖨️ Imprimir Resultados</button>
            </div>
          </div>
        )}
      </div>

      {/* --- FORMATO IMPRESIÓN (ESTILO LABORATORIO PROFESIONAL) --- */}
      {vista === 'resultados' && ordenActiva && (
        <div id="impresion-resultados">
          
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px' }}>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', textTransform: 'uppercase' }}>INFORME DE RESULTADO(S)</h2>
              <p style={{ margin: '2px 0' }}>No. {ordenActiva?.numero_factura || 'N/A'}</p>
              <p style={{ margin: '2px 0' }}>Fact. {ordenActiva?.fecha ? new Date(ordenActiva.fecha).toLocaleDateString() : 'N/A'}</p>
              
              <div style={{ marginTop: '15px' }}>
                <p style={{ margin: '2px 0', textTransform: 'uppercase' }}>Sr(a) <strong>{ordenActiva?.paciente_nombre || 'N/A'}</strong></p>
                <p style={{ margin: '2px 0', textTransform: 'uppercase' }}>C/ {ordenActiva?.direccion || 'N/A'}</p>
                <p style={{ margin: '2px 0' }}>Privado</p>
                <p style={{ margin: '2px 0' }}>Dr(a) PRIVADO</p>
              </div>
            </div>
            
            <div style={{ fontSize: '12px', textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginBottom: '10px' }}>
                 <h1 style={{ margin: 0, color: '#16a34a', fontSize: '28px', fontStyle: 'italic' }}>CENTRO MÉDICO</h1>
              </div>
              
              <table style={{ marginLeft: 'auto', textAlign: 'left' }}>
                <tbody>
                  <tr><td style={{ paddingRight: '10px' }}>Ced/Pas</td><td>{ordenActiva?.cedula || 'N/A'}</td></tr>
                  <tr><td style={{ paddingRight: '10px' }}>Fec Nac</td><td>{ordenActiva?.fecha_nacimiento || 'N/A'}</td></tr>
                  <tr><td style={{ paddingRight: '10px' }}>Tel.</td><td>{ordenActiva?.telefono || 'N/A'}</td></tr>
                </tbody>
              </table>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${ordenActiva?.numero_factura || ''}`} alt="QR" style={{ marginTop: '10px' }} />
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
                <th style={{ padding: '8px 0', textAlign: 'left' }}>DETERMINACION</th>
                <th style={{ padding: '8px 0', textAlign: 'left' }}>METODO</th>
                <th style={{ padding: '8px 0', textAlign: 'left' }}>RESULTADO</th>
                <th style={{ padding: '8px 0', textAlign: 'left' }}>INTERVALO DE REFERENCIA</th>
                <th style={{ padding: '8px 0', textAlign: 'left' }}>UNIDADES</th>
              </tr>
            </thead>
            <tbody>
              {detalles.map(d => {
                const res = resultadosForm[d.id] || d;
                return (
                  <tr key={d.id}>
                    <td style={{ padding: '8px 0', fontWeight: 'bold', textTransform: 'uppercase' }}>{d.descripcion || 'N/A'}</td>
                    <td style={{ padding: '8px 0' }}>{res.metodo || ''}</td>
                    <td style={{ padding: '8px 0', fontSize: '14px', fontWeight: 'bold' }}>{res.resultado || ''}</td>
                    <td style={{ padding: '8px 0' }}>{res.valor_referencia || ''}</td>
                    <td style={{ padding: '8px 0' }}>{res.unidades || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: '100px', fontSize: '11px' }}>
            <p style={{ textAlign: 'center' }}>*** U.d.A. ***</p>
            <div style={{ borderBottom: '1px solid #000', width: '250px', marginBottom: '5px' }}></div>
            <p style={{ margin: 0, fontWeight: 'bold' }}>RESULTADOS FUERA DE INTERVALO DE REFERENCIA ↑ ó ↓</p>
            <p style={{ margin: 0 }}>AUTORIZADO POR **</p>
          </div>
        </div>
      )}
    </>
  );
};
export default Laboratorio;