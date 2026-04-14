import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const Dashboard = ({ darkMode = false }) => {
  const [stats, setStats] = useState({
    pacientes: 0,
    citasHoy: 0,
    emergencias: 0,
    laboratorio: 0,
    facturasPendientes: 0,
    internamientos: 0,
    farmaciasHoy: 0,
    usuariosActivos: 0,
  });

  const [actividad, setActividad] = useState([]);
  const [cargando, setCargando] = useState(true);

  const colores = useMemo(() => ({
    fondo: darkMode ? '#0b1220' : '#f4f8fc',
    card: darkMode ? '#111827' : '#ffffff',
    cardSoft: darkMode ? '#0f172a' : '#f8fbff',
    borde: darkMode ? '#1f2937' : '#e5edf8',
    texto: darkMode ? '#e5e7eb' : '#123a72',
    subtitulo: darkMode ? '#94a3b8' : '#64748b',
    sombra: darkMode
      ? '0 10px 28px rgba(0,0,0,0.34)'
      : '0 10px 28px rgba(15,23,42,0.06)',
    exito: '#059669',
    alerta: '#ea580c',
    info: '#2563eb',
    violeta: '#7c3aed',
    rosa: '#db2777',
  }), [darkMode]);

  useEffect(() => {
    cargarDashboard();
  }, []);

  async function cargarDashboard() {
    setCargando(true);

    try {
      const hoy = new Date();
      const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);

      const [
        pacientesRes,
        citasRes,
        emergenciasRes,
        laboratorioRes,
        facturasRes,
        internamientosRes,
        farmaciaRes,
        usuariosRes,
        ultimasCitas,
        ultimasEmergencias,
        ultimasFacturas,
      ] = await Promise.all([
        supabase.from('pacientes').select('*', { count: 'exact', head: true }),
        supabase
          .from('citas')
          .select('*', { count: 'exact', head: true })
          .gte('fecha', inicioHoy.toISOString())
          .lt('fecha', finHoy.toISOString()),
        supabase
          .from('emergencias')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'abierta'),
        supabase
          .from('laboratorio_solicitudes')
          .select('*', { count: 'exact', head: true })
          .in('estado', ['pendiente', 'en_proceso']),
        supabase
          .from('facturas')
          .select('*', { count: 'exact', head: true })
          .in('estado', ['pendiente', 'parcial']),
        supabase
          .from('internamientos')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'activo'),
        supabase
          .from('facturas')
          .select('*', { count: 'exact', head: true })
          .eq('tipo_factura', 'farmacia')
          .gte('fecha', inicioHoy.toISOString())
          .lt('fecha', finHoy.toISOString()),
        supabase
          .from('usuarios')
          .select('*', { count: 'exact', head: true })
          .eq('activo', true),

        supabase
          .from('citas')
          .select('id, fecha, hora, estado')
          .order('created_at', { ascending: false })
          .limit(3),

        supabase
          .from('emergencias')
          .select('id, motivo, fecha_ingreso, estado')
          .order('fecha_ingreso', { ascending: false })
          .limit(3),

        supabase
          .from('facturas')
          .select('id, numero, total, estado, fecha')
          .order('fecha', { ascending: false })
          .limit(3),
      ]);

      setStats({
        pacientes: pacientesRes.count || 0,
        citasHoy: citasRes.count || 0,
        emergencias: emergenciasRes.count || 0,
        laboratorio: laboratorioRes.count || 0,
        facturasPendientes: facturasRes.count || 0,
        internamientos: internamientosRes.count || 0,
        farmaciasHoy: farmaciaRes.count || 0,
        usuariosActivos: usuariosRes.count || 0,
      });

      const actividades = [
        ...(ultimasCitas.data || []).map((c) => ({
          tipo: 'Cita',
          texto: `Cita ${c.estado || 'registrada'} - ${c.fecha || ''} ${c.hora || ''}`,
          fecha: c.fecha || '',
          color: '#2563eb',
          icono: '📅',
        })),
        ...(ultimasEmergencias.data || []).map((e) => ({
          tipo: 'Emergencia',
          texto: `Emergencia ${e.estado || ''} - ${e.motivo || 'Sin motivo'}`,
          fecha: e.fecha_ingreso || '',
          color: '#ea580c',
          icono: '🚑',
        })),
        ...(ultimasFacturas.data || []).map((f) => ({
          tipo: 'Factura',
          texto: `Factura ${f.numero || ''} - ${Number(f.total || 0).toFixed(2)} - ${f.estado || ''}`,
          fecha: f.fecha || '',
          color: '#059669',
          icono: '🧾',
        })),
      ]
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 8);

      setActividad(actividades);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setCargando(false);
    }
  }

  const cardBase = {
    background: colores.card,
    border: `1px solid ${colores.borde}`,
    borderRadius: '22px',
    padding: '20px',
    boxShadow: colores.sombra,
  };

  const statCards = [
    { titulo: 'Pacientes', valor: stats.pacientes, color: colores.texto, icono: '🧑‍⚕️' },
    { titulo: 'Citas Hoy', valor: stats.citasHoy, color: colores.info, icono: '📅' },
    { titulo: 'Emergencias Abiertas', valor: stats.emergencias, color: colores.alerta, icono: '🚑' },
    { titulo: 'Laboratorio Pendiente', valor: stats.laboratorio, color: colores.violeta, icono: '🧪' },
    { titulo: 'Facturas Pendientes', valor: stats.facturasPendientes, color: colores.alerta, icono: '🧾' },
    { titulo: 'Internamientos Activos', valor: stats.internamientos, color: colores.info, icono: '🛏️' },
    { titulo: 'Ventas Farmacia Hoy', valor: stats.farmaciasHoy, color: colores.exito, icono: '💊' },
    { titulo: 'Usuarios Activos', valor: stats.usuariosActivos, color: colores.rosa, icono: '👥' },
  ];

  return (
    <div
      style={{
        background: colores.fondo,
        minHeight: '100%',
      }}
    >
      <div
        style={{
          ...cardBase,
          marginBottom: '22px',
          padding: '24px',
          background: darkMode
            ? 'linear-gradient(135deg, #0f172a 0%, #111827 50%, #0b1220 100%)'
            : 'linear-gradient(135deg, #0f4eb3 0%, #2563eb 45%, #38bdf8 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(circle at 15% 20%, rgba(255,255,255,0.16) 0%, transparent 20%),
              radial-gradient(circle at 88% 18%, rgba(255,255,255,0.12) 0%, transparent 16%),
              radial-gradient(circle at 70% 82%, rgba(255,255,255,0.10) 0%, transparent 18%)
            `,
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: '1.5fr .9fr',
            gap: '18px',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.14)',
                fontSize: '12px',
                fontWeight: 800,
                marginBottom: '14px',
              }}
            >
              🏥 Panel principal del sistema
            </div>

            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 900 }}>
              Dashboard CentroMed
            </h1>

            <p
              style={{
                marginTop: '10px',
                marginBottom: 0,
                color: 'rgba(255,255,255,0.90)',
                maxWidth: '700px',
                lineHeight: 1.6,
              }}
            >
              Resumen general del sistema clínico con métricas, actividad reciente y estado operativo
              de las áreas principales del centro médico.
            </p>
          </div>

          <div
            style={{
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '18px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ fontSize: '13px', opacity: 0.9 }}>Resumen rápido</div>
            <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '6px' }}>
              {stats.citasHoy + stats.emergencias + stats.internamientos}
            </div>
            <div style={{ fontSize: '13px', opacity: 0.92, marginTop: '6px', lineHeight: 1.5 }}>
              eventos clínicos activos entre citas, emergencias e internamientos.
            </div>
          </div>
        </div>
      </div>

      {cargando ? (
        <div style={{ ...cardBase, color: colores.subtitulo }}>
          Cargando dashboard...
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '18px',
              marginBottom: '22px',
            }}
          >
            {statCards.map((item, index) => (
              <div
                key={index}
                style={{
                  ...cardBase,
                  padding: '18px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-18px',
                    right: '-10px',
                    fontSize: '58px',
                    opacity: 0.08,
                  }}
                >
                  {item.icono}
                </div>

                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '16px',
                    display: 'grid',
                    placeItems: 'center',
                    background: darkMode ? '#0b1220' : '#f4f8fc',
                    border: `1px solid ${colores.borde}`,
                    fontSize: '20px',
                    marginBottom: '14px',
                  }}
                >
                  {item.icono}
                </div>

                <div style={{ color: colores.subtitulo, fontSize: '13px' }}>{item.titulo}</div>
                <div style={{ color: item.color, fontSize: '30px', fontWeight: 900, marginTop: '8px' }}>
                  {item.valor}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.35fr 1fr',
              gap: '20px',
            }}
          >
            <div style={cardBase}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ margin: 0, color: colores.texto }}>Actividad reciente</h3>
                <span
                  style={{
                    fontSize: '12px',
                    color: colores.subtitulo,
                    background: darkMode ? '#0b1220' : '#f8fbff',
                    border: `1px solid ${colores.borde}`,
                    padding: '6px 10px',
                    borderRadius: '999px',
                  }}
                >
                  Últimos movimientos
                </span>
              </div>

              {actividad.length === 0 ? (
                <p style={{ color: colores.subtitulo }}>No hay actividad reciente.</p>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {actividad.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        border: `1px solid ${colores.borde}`,
                        borderRadius: '16px',
                        padding: '14px',
                        background: colores.cardSoft,
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '14px',
                          background: `${item.color}18`,
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '18px',
                          flexShrink: 0,
                        }}
                      >
                        {item.icono}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, color: colores.texto }}>{item.tipo}</div>
                        <div style={{ color: colores.subtitulo, marginTop: '4px', lineHeight: 1.5 }}>
                          {item.texto}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
              <div style={cardBase}>
                <h3 style={{ marginTop: 0, color: colores.texto }}>Resumen rápido</h3>

                <div style={{ display: 'grid', gap: '14px' }}>
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '16px',
                      background: colores.cardSoft,
                      border: `1px solid ${colores.borde}`,
                    }}
                  >
                    <div style={{ color: colores.subtitulo, fontSize: '13px' }}>Sistema</div>
                    <div style={{ color: colores.texto, fontWeight: 800, marginTop: '4px' }}>
                      Operando con módulos conectados
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '16px',
                      background: colores.cardSoft,
                      border: `1px solid ${colores.borde}`,
                    }}
                  >
                    <div style={{ color: colores.subtitulo, fontSize: '13px' }}>Estado clínico</div>
                    <div style={{ color: colores.texto, fontWeight: 800, marginTop: '4px', lineHeight: 1.5 }}>
                      {stats.emergencias} emergencias abiertas y {stats.internamientos} internamientos activos
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '16px',
                      background: colores.cardSoft,
                      border: `1px solid ${colores.borde}`,
                    }}
                  >
                    <div style={{ color: colores.subtitulo, fontSize: '13px' }}>Estado financiero</div>
                    <div style={{ color: colores.texto, fontWeight: 800, marginTop: '4px', lineHeight: 1.5 }}>
                      {stats.facturasPendientes} facturas requieren seguimiento
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '16px',
                      background: colores.cardSoft,
                      border: `1px solid ${colores.borde}`,
                    }}
                  >
                    <div style={{ color: colores.subtitulo, fontSize: '13px' }}>Atención del día</div>
                    <div style={{ color: colores.texto, fontWeight: 800, marginTop: '4px', lineHeight: 1.5 }}>
                      {stats.citasHoy} citas hoy y {stats.farmaciasHoy} ventas de farmacia hoy
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  ...cardBase,
                  background: darkMode
                    ? 'linear-gradient(135deg, #111827 0%, #0f172a 100%)'
                    : 'linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%)',
                }}
              >
                <div style={{ color: colores.subtitulo, fontSize: '13px' }}>Vista ejecutiva</div>
                <div style={{ color: colores.texto, fontWeight: 900, fontSize: '22px', marginTop: '8px' }}>
                  Centro Médico en monitoreo
                </div>
                <div style={{ color: colores.subtitulo, marginTop: '10px', lineHeight: 1.6 }}>
                  Usa este panel para tener una vista más elegante del estado general del sistema,
                  con mejor presentación visual para demostraciones y entrega del proyecto.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;