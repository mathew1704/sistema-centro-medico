import { supabase } from '../lib/supabaseClient';

const normalizar = (value = '') => String(value ?? '').trim().toLowerCase();

/* 1. BUSCADOR DIRECTO (SIN VISTAS SQL) */
export async function buscarOrdenLaboratorio(filtroTexto = '') {
  let query = supabase
    .from('facturas')
    .select('*, pacientes(*)')
    .eq('tipo_orden', 'laboratorio') 
    .order('fecha', { ascending: false })
    .limit(100);

  const { data: facturas, error } = await query;
  if (error) throw new Error(error.message);

  let resultado = facturas.map(f => {
    const p = f.pacientes || {};
    const nombreManual = `${f.nombre_paciente_manual || ''} ${f.apellido_paciente_manual || ''}`.trim();
    return {
      factura_id: f.id,
      numero_factura: f.numero,
      codigo_qr: f.codigo_barra || `QR-${f.numero}`,
      paciente_id: f.paciente_id,
      paciente_nombre: p.nombre ? `${p.nombre} ${p.apellido}` : (nombreManual || 'Paciente Manual'),
      cedula: p.cedula || f.cedula_paciente_manual || 'N/A',
      record: p.record || f.record_paciente_manual || 'N/A',
      telefono: f.telefono_paciente_manual || 'N/A',
      fecha_nacimiento: p.fecha_nacimiento || 'N/A',
      fecha: f.fecha,
      estado: f.estado
    };
  });

  if (filtroTexto) {
    const t = normalizar(filtroTexto);
    resultado = resultado.filter(r => 
      normalizar(r.numero_factura).includes(t) ||
      normalizar(r.paciente_nombre).includes(t) ||
      normalizar(r.cedula).includes(t) ||
      normalizar(r.codigo_qr).includes(t)
    );
  }
  return resultado;
}

/* 2. OBTENER DETALLES (SIN FILTROS ESTRICTOS, TRAE TODO LO DE LA FACTURA) */
export async function listarDetalleLaboratorio(facturaId) {
  const { data: detFac, error: errFac } = await supabase
    .from('detalle_factura')
    .select('*')
    .eq('factura_id', facturaId);
    
  if (errFac) throw new Error(errFac.message);

  // MODO SALVAVIDAS: Si la factura llegó a laboratorio, mostramos TODOS sus ítems.
  // Ya no filtramos por "tipo_item" para evitar que queden ocultos si el catálogo está mal configurado.
  const labItemsFacturados = detFac || [];

  if (labItemsFacturados.length === 0) return [];

  let { data: sol } = await supabase.from('laboratorio_solicitudes').select('*').eq('factura_id', facturaId).maybeSingle();
  
  if (!sol) {
    const { data: newSol, error: errSol } = await supabase.from('laboratorio_solicitudes').insert({ 
      factura_id: facturaId, 
      estado: 'pendiente',
      codigo: 'LAB-' + Date.now() 
    }).select().single();
    if (errSol) throw new Error(errSol.message);
    sol = newSol;
  }

  let { data: ld, error: errLd } = await supabase
    .from('laboratorio_detalle')
    .select('*, laboratorio_resultados(*)')
    .eq('solicitud_id', sol.id);
    
  if (errLd) throw new Error(errLd.message);

  let finalItems = [...(ld || [])];

  for (const df of labItemsFacturados) {
    if (!finalItems.find(x => x.detalle_factura_id === df.id)) {
      const { data: newLd } = await supabase.from('laboratorio_detalle').insert({
        solicitud_id: sol.id,
        factura_id: facturaId,
        detalle_factura_id: df.id,
        analitica_id: df.referencia_id || null,
        observacion: df.descripcion,
        realizado: false,
        precio: df.precio_unitario
      }).select('*, laboratorio_resultados(*)').single();
      
      if (newLd) finalItems.push(newLd);
    }
  }

  return finalItems.map(item => {
    const res = item.laboratorio_resultados?.[0] || null;
    return {
      id: item.id, 
      descripcion: item.observacion || 'Analítica',
      realizado: item.realizado || false,
      resultado: res?.resultado || '',
      valor_referencia: res?.valor_referencia || '',
      unidades: res?.unidades || '',
      metodo: res?.metodo || ''
    };
  });
}

/* 3. REGISTRAR TOMA DE MUESTRAS */
export async function registrarMuestrasBatch(detalleIds, usuarioId) {
  const { error } = await supabase
    .from('laboratorio_detalle')
    .update({ estado: 'muestra_tomada', realizado: true, fecha_toma_muestra: new Date().toISOString() })
    .in('id', detalleIds);
    
  if (error) throw new Error(error.message);
  return true;
}

/* 4. GUARDAR RESULTADOS */
export async function guardarResultadosBatch(resultados, usuarioId) {
  const ahora = new Date().toISOString();
  
  for (const res of resultados) {
    const { data: existing } = await supabase.from('laboratorio_resultados').select('id').eq('detalle_id', res.detalle_id).maybeSingle();

    if (existing) {
      await supabase.from('laboratorio_resultados').update({
        resultado: res.resultado, valor_referencia: res.valor_referencia, unidades: res.unidades, metodo: res.metodo, updated_at: ahora
      }).eq('id', existing.id);
    } else {
      await supabase.from('laboratorio_resultados').insert({
        detalle_id: res.detalle_id, resultado: res.resultado, valor_referencia: res.valor_referencia, unidades: res.unidades, metodo: res.metodo, registrado_por: usuarioId, fecha: ahora
      });
    }

    await supabase.from('laboratorio_detalle').update({ estado: 'completado', fecha_resultado: ahora }).eq('id', res.detalle_id);
  }
  return true;
}