import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  actualizarEmergencia,
  agregarInsumoEmergencia,
  buscarPacientesEmergencia,
  crearEmergencia,
  eliminarEmergencia,
  listarCamillasDisponibles,
  listarEmergencias,
  listarInsumosEmergencia,
  listarProductosEmergencia,
  listarSignosVitales,
  obtenerDetalleImpresionEmergencia,
  obtenerEmergenciaPorId,
  obtenerMedicoPorUsuario,
  prepararDatosInternamientoDesdeEmergencia,
  registrarSignosVitales,
  listarDiagnosticos,
  listarMotivosConsulta,
  listarProcesosClinicos,
} from '../../services/emergenciaService';
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

const modelo = {
  id: null,
  numero_emergencia: '',
  paciente_id: '',
  camilla_id: '',
  medico_id: '',
  motivo_id: '',
  motivo_nota: '',
  historia: '',
  diagnostico_principal_id: '',
  diagnostico_nota: '',
  tratamiento_principal_id: '',
  tratamiento_nota: '',
  estado: 'abierto',
  fecha_salida: '',
};

const modeloSignos = {
  presion: '',
  temperatura: '',
  pulso: '',
  frecuencia_respiratoria: '',
  saturacion: '',
  peso: '',
};

const modeloInsumo = {
  producto_id: '',
};

function etiquetaPaciente(p) {
  return [
    p?.record ? `Rec: ${p.record}` : null,
    `${p?.nombre || ''} ${p?.apellido || ''}`.trim(),
    p?.cedula ? `Céd: ${p.cedula}` : null,
    p?.numero_afiliado ? `Afiliado: ${p.numero_afiliado}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

function etiquetaCamilla(c) {
  return `${c?.codigo || ''}${c?.descripcion ? ` - ${c.descripcion}` : ''}`;
}

function nombreCompletoUsuario(usuario) {
  return [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ').trim() || usuario?.username || 'Usuario';
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return '';
  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();

  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  let meses = hoy.getMonth() - nacimiento.getMonth();
  let dias = hoy.getDate() - nacimiento.getDate();

  if (dias < 0) {
    meses -= 1;
    const ultimoMes = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    dias += ultimoMes.getDate();
  }

  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  return `${anios}A ${meses}M ${dias}D`;
}

function escapeHtml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatearFechaHora(fecha) {
  if (!fecha) return '';
  const f = new Date(fecha);
  return f.toLocaleString();
}

function normalizarEstado(valor) {
  const estado = (valor || '').toLowerCase().trim();
  if (estado === 'de alta' || estado === 'alta') return 'de alta';
  return 'abierto';
}

function mapearInsumosDraft(lista = []) {
  return lista.map((i) => ({
    id: i.id || null,
    producto_id: i.producto_id || i.productos?.id || '',
    cantidad: Number(i.cantidad || 1),
    productos: i.productos || null,
    fecha: i.fecha || null,
    existente: true,
  }));
}

function limpiarNumeroTexto(valor) {
  const texto = String(valor ?? '').replace(',', '.');
  return texto.replace(/[^\d.]/g, '');
}

function limpiarPresion(valor) {
  return String(valor ?? '').replace(/[^\d/]/g, '').slice(0, 7);
}

function construirHtmlImpresion({ emergencia, signos, insumos, usuarioNombre }) {
  const paciente = emergencia?.pacientes || {};
  const medico = emergencia?.medicos || null;
  const camilla = emergencia?.camillas || null;

  const seguroActivo =
    paciente?.pacientes_seguro?.find((s) => s.activo) || paciente?.pacientes_seguro?.[0] || null;

  const telefono = paciente?.pacientes_telefonos?.[0]?.telefono || '';
  const direccionObj =
    paciente?.pacientes_direcciones?.find((d) => d.principal) ||
    paciente?.pacientes_direcciones?.[0] ||
    null;

  const direccion = [
    direccionObj?.direccion,
    direccionObj?.ciudad,
    direccionObj?.provincia,
  ]
    .filter(Boolean)
    .join(', ');

  const normalize = (str) => String(str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const docs = paciente?.pacientes_documentos || [];
  
  const cedulaDoc = docs.find(d => {
    const t = normalize(d.tipo);
    return t.includes('cedula') || t.includes('identifica') || t.includes('documento') || t === 'otro';
  });

  const carnetDoc = docs.find(d => {
    const t = normalize(d.tipo);
    return t.includes('carnet') || t.includes('seguro') || t.includes('ars');
  });

  const ultimoSigno = signos?.[0] || {};

  const insumosFilas = (insumos || [])
    .map(
      (i) => `
        <tr>
          <td>${escapeHtml(i.productos?.nombre || '')}</td>
          <td>${escapeHtml(i.productos?.categorias_productos?.nombre || '')}</td>
          <td style="text-align:center;">${escapeHtml(i.cantidad || '')}</td>
        </tr>
      `
    )
    .join('');

  const firmaDoctor = medico
    ? `${medico.nombre || ''} ${medico.apellido || ''}`.trim()
    : usuarioNombre;

  const especialidad = medico?.especialidades?.nombre || 'Médico';
  const exequatur = medico?.exequatur || '';

  // Combinación de catálogos y notas
  const textoMotivo = [emergencia?.motivos_consulta?.nombre, emergencia?.motivo_nota].filter(Boolean).join(' - ');
  const textoTratamiento = [emergencia?.procesos_clinicos?.nombre, emergencia?.tratamiento_nota].filter(Boolean).join(' - ');
  const textoDiagnostico = [
    emergencia?.diagnosticos?.codigo ? `[${emergencia.diagnosticos.codigo}]` : null,
    emergencia?.diagnosticos?.nombre,
    emergencia?.diagnostico_nota
  ].filter(Boolean).join(' ');

  return `
    <html>
      <head>
        <title>Hoja de Emergencia</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; }
          .page { width: 100%; min-height: 100vh; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
          .logo-box { width: 30%; font-size: 12px; line-height: 1.4; }
          .titulo { width: 40%; text-align: center; font-weight: 700; font-size: 28px; }
          .meta-box { width: 30%; font-size: 12px; line-height: 1.5; }
          .row { display: flex; gap: 14px; margin-bottom: 6px; flex-wrap: wrap; }
          .field { flex: 1; min-width: 180px; font-size: 13px; }
          .label { font-weight: bold; margin-right: 5px; }
          .section-title { font-weight: bold; font-size: 13px; margin: 14px 0 4px; }
          .paragraph { border: 1px solid #000; min-height: 72px; padding: 8px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
          .paragraph.small { min-height: 52px; }
          .vitales { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; border: 1px solid #000; padding: 8px; font-size: 12px; margin-top: 4px; }
          .tabla { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          .tabla th, .tabla td { border: 1px solid #000; padding: 6px; vertical-align: top; }
          .tabla th { background: #efefef; text-align: left; }
          .firma { margin-top: 40px; display: flex; justify-content: flex-end; }
          .firma-box { width: 280px; text-align: center; font-size: 12px; }
          .firma-linea { border-top: 1px solid #000; padding-top: 6px; margin-top: 40px; }
          
          /* Estilos para la segunda página de documentos (Lado a lado, más pequeños) */
          .docs-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width: 100%; margin-top: 20px; align-items: start; }
          .doc-card { border: 2px solid #000; padding: 10px; width: auto; text-align: center; }
          .doc-card h3 { margin: 0 0 10px; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          .doc-image-wrap { width: 100%; height: 250px; display: flex; align-items: center; justify-content: center; background: #fafafa; border: 1px dashed #666; overflow: hidden; }
          .doc-image-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; }
          .doc-empty { color: #666; font-style: italic; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="logo-box">
              <div style="font-weight:700; font-size:20px;">CENTRO MEDICO</div>
            </div>
            <div class="titulo">Hoja de Emergencia</div>
            <div class="meta-box">
              <div><span class="label">Fecha Ingreso:</span> ${escapeHtml(formatearFechaHora(emergencia?.fecha_ingreso))}</div>
              <div><span class="label">Admisión:</span> ${escapeHtml(paciente?.record || '')}</div>
              <div><span class="label">Record:</span> ${escapeHtml(paciente?.record || '')}</div>
              <div><span class="label">Afiliado:</span> ${escapeHtml(seguroActivo?.numero_afiliado || '')}</div>
              <div><span class="label">Aseguradora:</span> ${escapeHtml(seguroActivo?.ars?.nombre || '')}</div>
            </div>
          </div>

          <div class="row">
            <div class="field"><span class="label">Nombre:</span> ${escapeHtml(`${paciente?.nombre || ''} ${paciente?.apellido || ''}`.trim())}</div>
            <div class="field"><span class="label">Cédula:</span> ${escapeHtml(paciente?.cedula || '')}</div>
            <div class="field"><span class="label">Edad:</span> ${escapeHtml(calcularEdad(paciente?.fecha_nacimiento))}</div>
            <div class="field"><span class="label">Sexo:</span> ${escapeHtml(paciente?.sexo || '')}</div>
          </div>

          <div class="row">
            <div class="field"><span class="label">Teléfono:</span> ${escapeHtml(telefono)}</div>
            <div class="field" style="flex:2;"><span class="label">Dirección:</span> ${escapeHtml(direccion)}</div>
            <div class="field"><span class="label">Camilla:</span> ${escapeHtml(camilla?.codigo || '')}</div>
          </div>

          <div class="section-title">Motivo Consulta Emergencia</div>
          <div class="paragraph small">${escapeHtml(textoMotivo)}</div>

          <div class="section-title">Historia de Enfermedad Actual</div>
          <div class="paragraph">${escapeHtml(emergencia?.historia || '')}</div>

          <div class="section-title">Signos Vitales</div>
          <div class="vitales">
            <div><strong>TA:</strong> ${escapeHtml(ultimoSigno?.presion || '')}</div>
            <div><strong>TEMP:</strong> ${escapeHtml(ultimoSigno?.temperatura || '')}</div>
            <div><strong>PULSO:</strong> ${escapeHtml(ultimoSigno?.pulso || '')}</div>
            <div><strong>FR:</strong> ${escapeHtml(ultimoSigno?.frecuencia_respiratoria || '')}</div>
            <div><strong>SATO2%:</strong> ${escapeHtml(ultimoSigno?.saturacion || '')}</div>
            <div><strong>PESO:</strong> ${escapeHtml(ultimoSigno?.peso || '')}</div>
          </div>

          <div class="section-title">Examen Físico / Tratamiento</div>
          <div class="paragraph small">${escapeHtml(textoTratamiento)}</div>

          <div class="section-title">Diagnóstico / Comentario</div>
          <div class="paragraph small">${escapeHtml(textoDiagnostico)}</div>

          <div class="section-title">Órdenes Médicas / Insumos Utilizados</div>
          <table class="tabla">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Categoría</th>
                <th style="width:90px;">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              ${
                insumos?.length
                  ? insumosFilas
                  : `<tr><td colspan="3">No hay insumos registrados.</td></tr>`
              }
            </tbody>
          </table>

          <div class="row" style="margin-top:20px;">
            <div class="field"><span class="label">Estado:</span> ${escapeHtml((normalizarEstado(emergencia?.estado_clinico || emergencia?.estado) || '').toUpperCase())}</div>
          </div>

          <div class="firma">
            <div class="firma-box">
              <div class="firma-linea">${escapeHtml(firmaDoctor)}</div>
              <div>${escapeHtml(especialidad)}</div>
              <div>${escapeHtml(exequatur ? `Exeq: ${exequatur}` : '')}</div>
            </div>
          </div>
        </div>

        <div class="page">
          <h2 style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px;">ANEXO: DOCUMENTACIÓN DEL PACIENTE</h2>
          
          <div class="docs-container">
            <div class="doc-card">
              <h3>DOCUMENTO DE IDENTIDAD (CÉDULA)</h3>
              <div class="doc-image-wrap">
                ${cedulaDoc?.url 
                  ? `<img src="${escapeHtml(cedulaDoc.url)}" alt="Cédula" />` 
                  : `<div class="doc-empty">No se encontró imagen de cédula registrada para este paciente.</div>`}
              </div>
            </div>

            <div class="doc-card">
              <h3>CARNET DE SEGURO / ARS</h3>
              <div class="doc-image-wrap">
                ${carnetDoc?.url 
                  ? `<img src="${escapeHtml(carnetDoc.url)}" alt="Carnet Seguro" />` 
                  : `<div class="doc-empty">No se encontró imagen de carnet de seguro registrada para este paciente.</div>`}
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

const Emergencia = ({ darkMode = false }) => {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const colores = getUiColors(darkMode);

  const [emergencias, setEmergencias] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [resultadosPacientes, setResultadosPacientes] = useState([]);
  const [camillas, setCamillas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [medicoActual, setMedicoActual] = useState(null);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);

  // Catálogos
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [motivosConsulta, setMotivosConsulta] = useState([]);
  const [procesosClinicos, setProcesosClinicos] = useState([]);

  // ========================================================
  // NUEVOS ESTADOS PARA AUTOCOMPLETADO
  // ========================================================
  const [busquedaMotivo, setBusquedaMotivo] = useState("");
  const [mostrarMotivos, setMostrarMotivos] = useState(false);
  const [busquedaDiagnostico, setBusquedaDiagnostico] = useState("");
  const [mostrarDiagnosticos, setMostrarDiagnosticos] = useState(false);
  const [busquedaTratamiento, setBusquedaTratamiento] = useState("");
  const [mostrarTratamientos, setMostrarTratamientos] = useState(false);

  const motivosFiltrados = useMemo(() => {
    if (!busquedaMotivo) return motivosConsulta.slice(0, 50);
    const lower = busquedaMotivo.toLowerCase();
    return motivosConsulta.filter(m => String(m.nombre).toLowerCase().includes(lower)).slice(0, 50);
  }, [busquedaMotivo, motivosConsulta]);

  const diagnosticosFiltrados = useMemo(() => {
    if (!busquedaDiagnostico) return diagnosticos.slice(0, 50);
    const lower = busquedaDiagnostico.toLowerCase();
    return diagnosticos.filter(d => 
      String(d.nombre).toLowerCase().includes(lower) || 
      String(d.codigo).toLowerCase().includes(lower)
    ).slice(0, 50);
  }, [busquedaDiagnostico, diagnosticos]);

  const tratamientosFiltrados = useMemo(() => {
    if (!busquedaTratamiento) return procesosClinicos.slice(0, 50);
    const lower = busquedaTratamiento.toLowerCase();
    return procesosClinicos.filter(p => 
      String(p.nombre).toLowerCase().includes(lower) || 
      String(p.codigo).toLowerCase().includes(lower)
    ).slice(0, 50);
  }, [busquedaTratamiento, procesosClinicos]);
  // ========================================================

  const [busquedaPaciente, setBusquedaPaciente] = useState('');
  const [filtroHistorial, setFiltroHistorial] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [pacienteHistorialId, setPacienteHistorialId] = useState('');

  const [formulario, setFormulario] = useState(modelo);
  const [signosForm, setSignosForm] = useState(modeloSignos);
  const [insumoForm, setInsumoForm] = useState(modeloInsumo);

  const [signos, setSignos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [insumosDraft, setInsumosDraft] = useState([]);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardandoInsumo, setGuardandoInsumo] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [buscandoPacientes, setBuscandoPacientes] = useState(false);

  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const totalAbiertas = useMemo(
    () =>
      emergencias.filter(
        (e) => normalizarEstado(e.estado_clinico || e.estado) === 'abierto'
      ).length,
    [emergencias]
  );

  const totalDeAlta = useMemo(
    () =>
      emergencias.filter(
        (e) => normalizarEstado(e.estado_clinico || e.estado) === 'de alta'
      ).length,
    [emergencias]
  );

  const camillasDisponibles = useMemo(
    () => camillas.filter((c) => c.disponible || c.id === formulario.camilla_id),
    [camillas, formulario.camilla_id]
  );

  const historialFiltrado = useMemo(() => {
    return emergencias || [];
  }, [emergencias]);

  useEffect(() => {
    cargarInicial();
  }, []);

  async function cargarInicial() {
    setCargando(true);
    setError('');

    try {
      const [
        listaEmergencias,
        listaPacientes,
        listaCamillas,
        listaProductos,
        medicoUsuario,
        catDiagnosticos,
        catMotivos,
        catProcesos
      ] = await Promise.all([
        listarEmergencias(),
        buscarPacientesEmergencia(),
        listarCamillasDisponibles(),
        listarProductosEmergencia(),
        obtenerMedicoPorUsuario(usuario?.id),
        listarDiagnosticos(),
        listarMotivosConsulta(),
        listarProcesosClinicos()
      ]);

      setEmergencias(listaEmergencias || []);
      setPacientes(listaPacientes || []);
      setResultadosPacientes([]);
      setCamillas(listaCamillas || []);
      setProductos(listaProductos || []);
      setMedicoActual(medicoUsuario || null);
      
      setDiagnosticos(catDiagnosticos || []);
      setMotivosConsulta(catMotivos || []);
      setProcesosClinicos(catProcesos || []);

      setFormulario((prev) => ({
        ...prev,
        medico_id: medicoUsuario?.id || '',
      }));
    } catch (err) {
      setError(err.message || 'No se pudo cargar el módulo de emergencias.');
    } finally {
      setCargando(false);
    }
  }

  async function buscarPacientesManual() {
    setBuscandoPacientes(true);
    setError('');
    setMensaje('');

    try {
      const lista = await buscarPacientesEmergencia(busquedaPaciente);
      setResultadosPacientes(lista || []);
    } catch (err) {
      setError(err.message || 'No se pudieron buscar los pacientes.');
    } finally {
      setBuscandoPacientes(false);
    }
  }

  function seleccionarPaciente(paciente) {
    setPacienteSeleccionado(paciente);
    setFormulario((prev) => ({
      ...prev,
      paciente_id: paciente.id,
    }));
    setResultadosPacientes([]);
    setMensaje('Paciente seleccionado correctamente.');
  }

  function cambiarCampo(campo, valor) {
    setFormulario((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }

  function cambiarCampoSignos(campo, valor) {
    let nuevoValor = valor;
    if (campo === 'presion') {
      nuevoValor = limpiarPresion(valor);
    } else {
      nuevoValor = limpiarNumeroTexto(valor);
    }
    setSignosForm((prev) => ({ ...prev, [campo]: nuevoValor }));
  }

  function cambiarCampoInsumo(campo, valor) {
    setInsumoForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function limpiarFormulario() {
    setFormulario({
      ...modelo,
      medico_id: medicoActual?.id || '',
    });
    setSignosForm(modeloSignos);
    setInsumoForm(modeloInsumo);
    setSignos([]);
    setInsumos([]);
    setInsumosDraft([]);
    setPacienteSeleccionado(null);
    setResultadosPacientes([]);
    setBusquedaPaciente('');
    setBusquedaMotivo('');
    setBusquedaDiagnostico('');
    setBusquedaTratamiento('');
    setError('');
    setMensaje('');
  }

  function obtenerProductoPorId(id) {
    return productos.find((p) => p.id === id) || null;
  }

  function agregarProductoDraft(e) {
    e.preventDefault();
    setError('');
    setMensaje('');

    if (!insumoForm.producto_id) {
      setError('Debe seleccionar un producto.');
      return;
    }

    setGuardandoInsumo(true);

    try {
      const existente = insumosDraft.find((i) => i.producto_id === insumoForm.producto_id);

      if (existente) {
        setInsumosDraft((prev) =>
          prev.map((i) =>
            i.producto_id === insumoForm.producto_id
              ? { ...i, cantidad: Number(i.cantidad || 0) + 1 }
              : i
          )
        );
      } else {
        const producto = obtenerProductoPorId(insumoForm.producto_id);

        setInsumosDraft((prev) => [
          ...prev,
          {
            id: null,
            producto_id: insumoForm.producto_id,
            cantidad: 1,
            productos: producto,
            fecha: new Date().toISOString(),
            existente: false,
          },
        ]);
      }

      setInsumoForm(modeloInsumo);
      setMensaje('Producto agregado a la lista.');
    } finally {
      setGuardandoInsumo(false);
    }
  }

  function cambiarCantidadInsumoDraft(index, valor) {
    const cantidad = Math.max(1, Number(valor || 1));
    setInsumosDraft((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, cantidad } : item))
    );
  }

  function quitarInsumoDraft(index) {
    setInsumosDraft((prev) => prev.filter((_, idx) => idx !== index));
    setMensaje('Insumo eliminado de la lista.');
  }

  function validarSignos() {
    const { presion, temperatura, pulso, frecuencia_respiratoria, saturacion, peso } = signosForm;

    if (presion && !/^\d{2,3}\/\d{2,3}$/.test(presion)) {
      throw new Error('La presión debe tener formato 120/80.');
    }

    const lista = [
      { campo: 'temperatura', valor: temperatura },
      { campo: 'pulso', valor: pulso },
      { campo: 'frecuencia respiratoria', valor: frecuencia_respiratoria },
      { campo: 'saturación', valor: saturacion },
      { campo: 'peso', valor: peso },
    ];

    for (const item of lista) {
      if (item.valor && Number.isNaN(Number(item.valor))) {
        throw new Error(`El campo ${item.campo} debe ser numérico.`);
      }
    }
  }

  async function guardarEmergencia(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      if (!formulario.paciente_id) {
        throw new Error('Debe seleccionar un paciente.');
      }

      if (!formulario.motivo_id && !formulario.motivo_nota?.trim()) {
        throw new Error('Debe indicar el motivo de la consulta (selección del catálogo o texto libre).');
      }

      validarSignos();

      let emergenciaId = formulario.id;
      let camillaAnterior = null;

      if (!formulario.id) {
        const creada = await crearEmergencia({
          ...formulario,
          estado: 'abierto',
          medico_id: medicoActual?.id || '',
          usuario_id: usuario?.id || null,
          creado_por: usuario?.id || null,
        });

        emergenciaId = creada?.id || creada?.data?.id || null;

        if (!emergenciaId) {
          const listaActualizada = await listarEmergencias();
          const ultima = (listaActualizada || []).find(
            (x) =>
              x.paciente_id === formulario.paciente_id ||
              x.pacientes?.id === formulario.paciente_id
          );

          emergenciaId = ultima?.id || null;
        }
      } else {
        const actual = await obtenerEmergenciaPorId(formulario.id);
        camillaAnterior = actual?.camilla_id || null;

        await actualizarEmergencia(
          formulario.id,
          {
            ...formulario,
            estado: normalizarEstado(formulario.estado),
            medico_id: medicoActual?.id || formulario.medico_id || '',
            usuario_id: usuario?.id || null,
          },
          { camilla_id: camillaAnterior }
        );

        emergenciaId = formulario.id;
      }

      if (!emergenciaId) {
        throw new Error('No se pudo obtener el ID de la emergencia guardada.');
      }

      const haySignos =
        signosForm.presion || signosForm.temperatura || signosForm.pulso ||
        signosForm.frecuencia_respiratoria || signosForm.saturacion || signosForm.peso;

      if (haySignos) {
        await registrarSignosVitales({ emergencia_id: emergenciaId, ...signosForm });
      }

      for (const item of insumosDraft) {
        await agregarInsumoEmergencia({
          emergencia_id: emergenciaId,
          producto_id: item.producto_id,
          cantidad: Number(item.cantidad || 0),
          creado_por: usuario?.id || null,
        });
      }

      const [detalle, listaSignos, listaInsumos, listaEmergencias, listaCamillas] =
        await Promise.all([
          obtenerEmergenciaPorId(emergenciaId),
          listarSignosVitales(emergenciaId),
          listarInsumosEmergencia(emergenciaId),
          listarEmergencias(),
          listarCamillasDisponibles(),
        ]);

      setFormulario({
        id: detalle.id,
        numero_emergencia: detalle.numero_emergencia || '',
        paciente_id: detalle.paciente_id || '',
        camilla_id: detalle.camilla_id || '',
        medico_id: detalle.medico_id || medicoActual?.id || '',
        motivo_id: detalle.motivo_id || '',
        motivo_nota: detalle.motivo_nota || '',
        historia: detalle.historia || '',
        diagnostico_principal_id: detalle.diagnostico_principal_id || '',
        diagnostico_nota: detalle.diagnostico_nota || '',
        tratamiento_principal_id: detalle.tratamiento_principal_id || '',
        tratamiento_nota: detalle.tratamiento_nota || '',
        estado: normalizarEstado(detalle.estado_clinico || detalle.estado),
        fecha_salida: detalle.fecha_salida || '',
      });

      setBusquedaMotivo(detalle.motivos_consulta?.nombre || "");
      setBusquedaDiagnostico(detalle.diagnosticos ? `[${detalle.diagnosticos.codigo}] ${detalle.diagnosticos.nombre}` : "");
      setBusquedaTratamiento(detalle.procesos_clinicos ? `[${detalle.procesos_clinicos.codigo}] ${detalle.procesos_clinicos.nombre}` : "");

      setPacienteSeleccionado(detalle.pacientes || pacienteSeleccionado || null);
      setSignos(listaSignos || []);
      setInsumos(listaInsumos || []);
      setInsumosDraft(mapearInsumosDraft(listaInsumos || []));
      setEmergencias(listaEmergencias || []);
      setCamillas(listaCamillas || []);
      setMensaje(formulario.id ? 'Emergencia actualizada correctamente.' : 'Emergencia registrada correctamente.');

      setSignosForm(modeloSignos);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la emergencia.');
    } finally {
      setGuardando(false);
    }
  }

  async function editarEmergencia(id) {
    setError('');
    setMensaje('');

    try {
      const data = await obtenerEmergenciaPorId(id);

      setFormulario({
        id: data.id,
        numero_emergencia: data.numero_emergencia || '',
        paciente_id: data.paciente_id || '',
        camilla_id: data.camilla_id || '',
        medico_id: data.medico_id || medicoActual?.id || '',
        motivo_id: data.motivo_id || '',
        motivo_nota: data.motivo_nota || '',
        historia: data.historia || '',
        diagnostico_principal_id: data.diagnostico_principal_id || '',
        diagnostico_nota: data.diagnostico_nota || '',
        tratamiento_principal_id: data.tratamiento_principal_id || '',
        tratamiento_nota: data.tratamiento_nota || '',
        estado: normalizarEstado(data.estado_clinico || data.estado),
        fecha_salida: data.fecha_salida || '',
      });

      setBusquedaMotivo(data.motivos_consulta?.nombre || "");
      setBusquedaDiagnostico(data.diagnosticos ? `[${data.diagnosticos.codigo}] ${data.diagnosticos.nombre}` : "");
      setBusquedaTratamiento(data.procesos_clinicos ? `[${data.procesos_clinicos.codigo}] ${data.procesos_clinicos.nombre}` : "");

      const [listaSignos, listaInsumos] = await Promise.all([
        listarSignosVitales(id),
        listarInsumosEmergencia(id),
      ]);

      setPacienteSeleccionado(data.pacientes || null);
      setSignos(listaSignos || []);
      setInsumos(listaInsumos || []);
      setInsumosDraft(mapearInsumosDraft(listaInsumos || []));
      setResultadosPacientes([]);
      setBusquedaPaciente(
        `${data.pacientes?.nombre || ''} ${data.pacientes?.apellido || ''}`.trim()
      );

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'No se pudo cargar la emergencia.');
    }
  }

  async function borrarEmergencia(id, camillaId) {
    const ok = window.confirm('¿Seguro que deseas eliminar esta emergencia?');
    if (!ok) return;

    setError('');
    setMensaje('');

    try {
      await eliminarEmergencia(id, camillaId);
      await cargarInicial();

      if (formulario.id === id) {
        limpiarFormulario();
      }

      setMensaje('Emergencia eliminada correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la emergencia.');
    }
  }

  async function buscarHistorial() {
    setCargando(true);
    setError('');

    try {
      const lista = await listarEmergencias({
        pacienteId: pacienteHistorialId,
        estado: filtroEstado,
        filtro: filtroHistorial,
      });
      setEmergencias(lista || []);
    } catch (err) {
      setError(err.message || 'No se pudo buscar el historial.');
    } finally {
      setCargando(false);
    }
  }

  function irARegistrarPaciente() {
    navigate('/pacientes');
  }

  async function internarPaciente() {
    if (!formulario.id) {
      setError('Primero debes guardar la emergencia para internar al paciente.');
      return;
    }

    try {
      const payload = await prepararDatosInternamientoDesdeEmergencia(formulario.id);

      navigate('/internamiento', {
        state: {
          desdeEmergencia: true,
          ...payload,
        },
      });
    } catch (err) {
      setError(err.message || 'No se pudo preparar el internamiento.');
    }
  }

  async function marcarDeAltaSiAplica(emergenciaId) {
    try {
      const actual = await obtenerEmergenciaPorId(emergenciaId);

      if (normalizarEstado(actual?.estado_clinico || actual?.estado) !== 'de alta') {
        await actualizarEmergencia(
          emergenciaId,
          {
            paciente_id: actual.paciente_id || '',
            camilla_id: actual.camilla_id || '',
            medico_id: actual.medico_id || '',
            motivo_id: actual.motivo_id || '',
            motivo_nota: actual.motivo_nota || '',
            historia: actual.historia || '',
            diagnostico_principal_id: actual.diagnostico_principal_id || '',
            diagnostico_nota: actual.diagnostico_nota || '',
            tratamiento_principal_id: actual.tratamiento_principal_id || '',
            tratamiento_nota: actual.tratamiento_nota || '',
            estado: 'de alta',
            fecha_salida: actual.fecha_salida || new Date().toISOString(),
            usuario_id: usuario?.id || null,
          },
          { camilla_id: actual.camilla_id || null }
        );
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function imprimirEmergencia() {
    if (!formulario.id) {
      setError('Primero debes guardar o seleccionar una emergencia para imprimir.');
      return;
    }

    setImprimiendo(true);
    setError('');
    setMensaje('');

    try {
      const detalle = await obtenerDetalleImpresionEmergencia(formulario.id);

      const html = construirHtmlImpresion({
        ...detalle,
        usuarioNombre: nombreCompletoUsuario(usuario),
      });

      const ventana = window.open('', '_blank', 'width=1000,height=900');

      if (!ventana) {
        throw new Error('El navegador bloqueó la ventana de impresión.');
      }

      ventana.document.open();
      ventana.document.write(html);
      ventana.document.close();

      // Damos un pequeño tiempo para que las imágenes (carnet/cédula) carguen
      setTimeout(() => {
        ventana.focus();
        ventana.print();

        marcarDeAltaSiAplica(formulario.id).then(async () => {
          const [detalleActualizado, listaEmergencias, listaCamillas] = await Promise.all([
            obtenerEmergenciaPorId(formulario.id),
            listarEmergencias(),
            listarCamillasDisponibles(),
          ]);

          setFormulario((prev) => ({
            ...prev,
            estado: normalizarEstado(detalleActualizado?.estado_clinico || detalleActualizado?.estado),
            fecha_salida: detalleActualizado?.fecha_salida || prev.fecha_salida,
          }));
          setEmergencias(listaEmergencias || []);
          setCamillas(listaCamillas || []);
          setMensaje('Emergencia impresa y marcada como de alta.');
        });
      }, 500);

    } catch (err) {
      setError(err.message || 'No se pudo generar la impresión.');
    } finally {
      setImprimiendo(false);
    }
  }

  function estiloEstado(nombre) {
    const n = (nombre || '').toLowerCase();
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 800,
      textTransform: 'capitalize',
      border: '1px solid transparent',
    };

    if (n === 'de alta' || n === 'alta') {
      return {
        ...base,
        background: darkMode ? 'rgba(5,150,105,0.16)' : '#ecfdf5',
        color: darkMode ? '#6ee7b7' : '#047857',
        borderColor: darkMode ? 'rgba(5,150,105,0.24)' : '#bbf7d0',
      };
    }

    return {
      ...base,
      background: darkMode ? 'rgba(234,88,12,0.14)' : '#fff7ed',
      color: darkMode ? '#fdba74' : '#c2410c',
      borderColor: darkMode ? 'rgba(234,88,12,0.22)' : '#fed7aa',
    };
  }

  const styles = {
    topBar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '18px',
      marginBottom: '22px',
      flexWrap: 'wrap',
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
    actionButtons: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      alignItems: 'stretch',
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
      position: 'relative',
      overflow: 'hidden',
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
    },
    metricValue: {
      marginTop: '8px',
      fontSize: '30px',
      fontWeight: 900,
      color: colores.texto,
      lineHeight: 1,
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
    doctorBox: {
      padding: '12px 14px',
      borderRadius: '14px',
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
      minHeight: '48px',
      display: 'flex',
      alignItems: 'center',
      color: colores.texto,
      fontWeight: 700,
      lineHeight: 1.5,
    },
    selectedPatientBox: {
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
      borderRadius: '16px',
      padding: '14px',
    },
    selectedPatientName: {
      fontWeight: 800,
      color: colores.texto,
      fontSize: '15px',
      marginBottom: '4px',
    },
    selectedPatientMeta: {
      fontSize: '13px',
      color: colores.subtitulo,
      lineHeight: 1.6,
    },
    searchPatientRow: {
      display: 'grid',
      gridTemplateColumns: '1fr auto auto',
      gap: '10px',
      alignItems: 'center',
    },
    searchInputWrap: {
      position: 'relative',
      minWidth: 0,
    },
    searchIcon: {
      position: 'absolute',
      left: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: colores.subtitulo,
      fontSize: '15px',
      pointerEvents: 'none',
    },
    searchInput: {
      ...inputStyle(darkMode),
      paddingLeft: '38px',
    },
    patientResultsWrap: {
      marginTop: '14px',
      display: 'grid',
      gap: '10px',
    },
    patientCard: {
      border: `1px solid ${colores.borde}`,
      borderRadius: '16px',
      padding: '14px',
      background: colores.card,
      display: 'flex',
      justifyContent: 'space-between',
      gap: '12px',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    patientCardName: {
      fontWeight: 800,
      color: colores.texto,
      marginBottom: '4px',
    },
    patientCardMeta: {
      fontSize: '13px',
      color: colores.subtitulo,
      lineHeight: 1.6,
    },
    estadoBox: {
      padding: '12px 14px',
      borderRadius: '14px',
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
      minHeight: '48px',
      display: 'flex',
      alignItems: 'center',
      color: colores.texto,
      fontWeight: 800,
      textTransform: 'capitalize',
    },
    saveWrap: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '20px',
      flexWrap: 'wrap',
    },
    primaryBtn: {
      ...buttonPrimaryStyle,
      height: '46px',
      borderRadius: '14px',
      boxShadow: '0 10px 22px rgba(37,99,235,0.18)',
    },
    softBtn: {
      ...buttonSoftStyle(darkMode),
      height: '46px',
      padding: '0 14px',
      borderRadius: '12px',
      fontSize: '13px',
    },
    dangerBtn: {
      height: '46px',
      padding: '0 14px',
      borderRadius: '12px',
      border: darkMode ? '1px solid rgba(220,38,38,0.25)' : '1px solid #fecaca',
      background: darkMode ? 'rgba(220,38,38,0.12)' : '#fef2f2',
      color: darkMode ? '#fca5a5' : '#dc2626',
      cursor: 'pointer',
      fontWeight: 800,
      fontSize: '13px',
    },
    smallSoftBtn: {
      ...buttonSoftStyle(darkMode),
      height: '38px',
      padding: '0 12px',
      borderRadius: '12px',
      fontSize: '13px',
    },
    smallDangerBtn: {
      height: '38px',
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
      fontWeight: 700,
      marginTop: '12px',
      fontSize: '13px',
    },
    dangerText: {
      color: darkMode ? '#fca5a5' : '#dc2626',
      fontWeight: 700,
      marginTop: '12px',
      fontSize: '13px',
    },
    searchWrap: {
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr 1fr auto',
      gap: '10px',
      marginBottom: '16px',
      minWidth: 0,
      alignItems: 'stretch',
    },
    tableWrap: {
      overflowX: 'auto',
      borderRadius: '18px',
      border: `1px solid ${colores.borde}`,
      background: colores.cardSoft,
      marginTop: '16px',
    },
    table: {
      width: '100%',
      minWidth: '1040px',
      borderCollapse: 'collapse',
    },
    th: {
      textAlign: 'left',
      padding: '14px 12px',
      fontSize: '13px',
      color: colores.subtitulo,
      borderBottom: `1px solid ${colores.borde}`,
      background: darkMode ? '#0b1220' : '#f8fbff',
      whiteSpace: 'nowrap',
    },
    td: {
      padding: '14px 12px',
      fontSize: '14px',
      borderBottom: `1px solid ${colores.borde}`,
      verticalAlign: 'top',
      color: colores.texto,
    },
    rowActions: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
    },
    mainText: {
      fontWeight: 800,
      color: colores.texto,
    },
    subText: {
      fontSize: '12px',
      color: colores.subtitulo,
      marginTop: '4px',
      lineHeight: 1.5,
    },
    productPickerWrap: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '10px',
    },
    productResults: {
      border: `1px solid ${colores.borde}`,
      borderRadius: '14px',
      background: colores.cardSoft,
      maxHeight: '220px',
      overflowY: 'auto',
    },
    productOption: {
      padding: '10px 12px',
      cursor: 'pointer',
      borderBottom: `1px solid ${colores.borde}`,
      fontSize: '13px',
      color: colores.texto,
    },
    autocompleteDropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      background: colores.cardSoft,
      border: `1px solid ${colores.borde}`,
      borderRadius: '8px',
      zIndex: 50,
      maxHeight: '220px',
      overflowY: 'auto',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      marginTop: '4px'
    },
    autocompleteOption: {
      padding: '10px 12px',
      cursor: 'pointer',
      borderBottom: `1px solid ${colores.borde}`,
      fontSize: '13px',
      color: colores.texto
    }
  };

  return (
    <div style={pageWrapperStyle(darkMode)}>
      <div style={styles.topBar} className="hide-on-print">
        <div style={styles.titleBlock}>
          <div style={styles.titleGlow} />
          <div style={styles.titleInner}>
            <div style={styles.titleChip}>🚑 Gestión clínica de emergencias</div>
            <h1 style={styles.title}>Emergencias</h1>
            <p style={styles.subtitle}>
              Registro clínico, signos vitales, insumos, impresión y seguimiento del área de emergencias.
            </p>
          </div>
        </div>

        <div style={styles.actionButtons}>
          {formulario.id ? (
            <button
              type="button"
              style={styles.softBtn}
              onClick={imprimirEmergencia}
              disabled={imprimiendo}
            >
              {imprimiendo ? 'Preparando impresión...' : 'Imprimir'}
            </button>
          ) : null}

          <button type="button" style={styles.softBtn} onClick={internarPaciente}>
            Internar
          </button>

          <button type="button" style={styles.primaryBtn} onClick={limpiarFormulario}>
            + Nueva Emergencia
          </button>
        </div>
      </div>

      <div style={styles.cardsRow} className="hide-on-print">
        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>📋</div>
          <div style={styles.metricIcon}>📋</div>
          <div style={styles.metricLabel}>Total emergencias</div>
          <div style={styles.metricValue}>{emergencias.length}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>🚨</div>
          <div style={styles.metricIcon}>🚨</div>
          <div style={styles.metricLabel}>Abiertas</div>
          <div style={{ ...styles.metricValue, color: '#c2410c' }}>{totalAbiertas}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>✅</div>
          <div style={styles.metricIcon}>✅</div>
          <div style={styles.metricLabel}>De alta</div>
          <div style={{ ...styles.metricValue, color: colores.exito }}>{totalDeAlta}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricGhost}>🛏️</div>
          <div style={styles.metricIcon}>🛏️</div>
          <div style={styles.metricLabel}>Camillas disponibles</div>
          <div style={styles.metricValue}>{camillas.filter((c) => c.disponible).length}</div>
        </div>
      </div>

      <div style={styles.stack} className="hide-on-print">
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>
              {formulario.id ? 'Editar emergencia' : 'Registro de emergencia'}
            </h3>

            <form onSubmit={guardarEmergencia}>
              <div style={styles.formGrid}>
                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Buscar paciente</label>
                  <div style={styles.searchPatientRow}>
                    <div style={styles.searchInputWrap}>
                      <span style={styles.searchIcon}>🔍</span>
                      <input
                        style={styles.searchInput}
                        value={busquedaPaciente}
                        onChange={(e) => setBusquedaPaciente(e.target.value)}
                        placeholder="Buscar por récord, nombre, apellido o cédula"
                      />
                    </div>

                    <button
                      type="button"
                      style={styles.primaryBtn}
                      onClick={buscarPacientesManual}
                      disabled={buscandoPacientes}
                    >
                      {buscandoPacientes ? 'Buscando...' : 'Buscar'}
                    </button>

                    <button type="button" style={styles.softBtn} onClick={irARegistrarPaciente}>
                      Registrar paciente
                    </button>
                  </div>

                  {resultadosPacientes.length > 0 ? (
                    <div style={styles.patientResultsWrap}>
                      {resultadosPacientes.map((p) => (
                        <div key={p.id} style={styles.patientCard}>
                          <div>
                            <div style={styles.patientCardName}>
                              {p.nombre} {p.apellido}
                            </div>
                            <div style={styles.patientCardMeta}>
                              <div><strong>Récord:</strong> {p.record || '-'}</div>
                              <div><strong>Cédula:</strong> {p.cedula || '-'}</div>
                              <div><strong>Afiliado:</strong> {p.numero_afiliado || '-'}</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            style={styles.smallSoftBtn}
                            onClick={() => seleccionarPaciente(p)}
                          >
                            Seleccionar
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {busquedaPaciente && resultadosPacientes.length === 0 && !buscandoPacientes ? (
                    <div style={{ ...styles.okText, color: colores.subtitulo }}>
                      No hay resultados para la búsqueda realizada.
                    </div>
                  ) : null}
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Paciente seleccionado</label>
                  <div style={styles.selectedPatientBox}>
                    {pacienteSeleccionado ? (
                      <>
                        <div style={styles.selectedPatientName}>
                          {pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}
                        </div>
                        <div style={styles.selectedPatientMeta}>
                          <div><strong>Récord:</strong> {pacienteSeleccionado.record || '-'}</div>
                          <div><strong>Cédula:</strong> {pacienteSeleccionado.cedula || '-'}</div>
                          <div><strong>Afiliado:</strong> {pacienteSeleccionado.numero_afiliado || '-'}</div>
                        </div>
                      </>
                    ) : (
                      <div style={styles.selectedPatientMeta}>
                        Aún no has seleccionado un paciente.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Camilla</label>
                  <select
                    style={selectStyle(darkMode)}
                    value={formulario.camilla_id}
                    onChange={(e) => cambiarCampo('camilla_id', e.target.value)}
                  >
                    <option value="">Seleccione una camilla</option>
                    {camillasDisponibles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {etiquetaCamilla(c)} {c.disponible ? '' : '(ocupada en esta emergencia)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Médico responsable</label>
                  <div style={styles.doctorBox}>
                    {medicoActual
                      ? `${medicoActual.codigo || ''} - ${medicoActual.nombre || ''} ${medicoActual.apellido || ''}`.trim()
                      : 'No hay médico vinculado a este usuario.'}
                  </div>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Estado</label>
                  <div style={styles.estadoBox}>
                    {normalizarEstado(formulario.estado || 'abierto')}
                  </div>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Fecha de salida</label>
                  <div style={styles.estadoBox}>
                    {formulario.fecha_salida
                      ? new Date(formulario.fecha_salida).toLocaleString()
                      : 'Se asigna al imprimir / dar de alta'}
                  </div>
                </div>

                {/* AUTOCOMPLETADO: MOTIVO */}
                <div style={{ ...styles.full, position: 'relative' }}>
                  <label style={labelStyle(darkMode)}>Motivo de consulta (Catálogo)</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={busquedaMotivo}
                    onChange={(e) => {
                      setBusquedaMotivo(e.target.value);
                      setMostrarMotivos(true);
                      if(e.target.value === "") cambiarCampo("motivo_id", "");
                    }}
                    onFocus={() => setMostrarMotivos(true)}
                    onBlur={() => setTimeout(() => setMostrarMotivos(false), 200)}
                    placeholder="Buscar motivo de consulta..."
                  />
                  {mostrarMotivos && (
                    <div style={styles.autocompleteDropdown}>
                      {motivosFiltrados.length === 0 ? <div style={{ padding: '10px' }}>No hay resultados</div> :
                        motivosFiltrados.map(m => (
                          <div
                            key={m.id}
                            style={styles.autocompleteOption}
                            onMouseDown={() => {
                              cambiarCampo("motivo_id", m.id);
                              setBusquedaMotivo(m.nombre);
                              setMostrarMotivos(false);
                            }}
                          >
                            {m.nombre}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Motivo de consulta (Observaciones / Texto libre)</label>
                  <textarea
                    style={textareaStyle(darkMode)}
                    value={formulario.motivo_nota}
                    onChange={(e) => cambiarCampo('motivo_nota', e.target.value)}
                  />
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Historia de la enfermedad actual</label>
                  <textarea
                    style={{ ...textareaStyle(darkMode), minHeight: '110px' }}
                    value={formulario.historia}
                    onChange={(e) => cambiarCampo('historia', e.target.value)}
                  />
                </div>

                {/* AUTOCOMPLETADO: DIAGNOSTICO */}
                <div style={{ ...styles.full, position: 'relative' }}>
                  <label style={labelStyle(darkMode)}>Diagnóstico Principal (Catálogo)</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={busquedaDiagnostico}
                    onChange={(e) => {
                      setBusquedaDiagnostico(e.target.value);
                      setMostrarDiagnosticos(true);
                      if(e.target.value === "") cambiarCampo("diagnostico_principal_id", "");
                    }}
                    onFocus={() => setMostrarDiagnosticos(true)}
                    onBlur={() => setTimeout(() => setMostrarDiagnosticos(false), 200)}
                    placeholder="Buscar diagnóstico por nombre o código..."
                  />
                  {mostrarDiagnosticos && (
                    <div style={styles.autocompleteDropdown}>
                      {diagnosticosFiltrados.length === 0 ? <div style={{ padding: '10px' }}>No hay resultados</div> :
                        diagnosticosFiltrados.map(d => (
                          <div
                            key={d.id}
                            style={styles.autocompleteOption}
                            onMouseDown={() => {
                              cambiarCampo("diagnostico_principal_id", d.id);
                              setBusquedaDiagnostico(`[${d.codigo}] ${d.nombre}`);
                              setMostrarDiagnosticos(false);
                            }}
                          >
                            <strong>[{d.codigo}]</strong> - {d.nombre}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Diagnóstico (Comentario o secundario)</label>
                  <textarea
                    style={textareaStyle(darkMode)}
                    value={formulario.diagnostico_nota}
                    onChange={(e) => cambiarCampo('diagnostico_nota', e.target.value)}
                  />
                </div>

                {/* AUTOCOMPLETADO: TRATAMIENTO */}
                <div style={{ ...styles.full, position: 'relative' }}>
                  <label style={labelStyle(darkMode)}>Procedimiento / Tratamiento (Catálogo)</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={busquedaTratamiento}
                    onChange={(e) => {
                      setBusquedaTratamiento(e.target.value);
                      setMostrarTratamientos(true);
                      if(e.target.value === "") cambiarCampo("tratamiento_principal_id", "");
                    }}
                    onFocus={() => setMostrarTratamientos(true)}
                    onBlur={() => setTimeout(() => setMostrarTratamientos(false), 200)}
                    placeholder="Buscar tratamiento o procedimiento..."
                  />
                  {mostrarTratamientos && (
                    <div style={styles.autocompleteDropdown}>
                      {tratamientosFiltrados.length === 0 ? <div style={{ padding: '10px' }}>No hay resultados</div> :
                        tratamientosFiltrados.map(p => (
                          <div
                            key={p.id}
                            style={styles.autocompleteOption}
                            onMouseDown={() => {
                              cambiarCampo("tratamiento_principal_id", p.id);
                              setBusquedaTratamiento(`[${p.codigo}] ${p.nombre}`);
                              setMostrarTratamientos(false);
                            }}
                          >
                            <strong>[{p.codigo}]</strong> - {p.nombre}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Tratamiento / Examen físico (Detalles)</label>
                  <textarea
                    style={{ ...textareaStyle(darkMode), minHeight: '100px' }}
                    value={formulario.tratamiento_nota}
                    onChange={(e) => cambiarCampo('tratamiento_nota', e.target.value)}
                  />
                </div>

                <div style={styles.full}>
                  <h3 style={{ ...styles.sectionTitle, marginTop: '8px' }}>Signos vitales</h3>
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Presión</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={signosForm.presion}
                    onChange={(e) => cambiarCampoSignos('presion', e.target.value)}
                    placeholder="120/80"
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Temperatura</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={signosForm.temperatura}
                    onChange={(e) => cambiarCampoSignos('temperatura', e.target.value)}
                    placeholder="36.5"
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Pulso</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={signosForm.pulso}
                    onChange={(e) => cambiarCampoSignos('pulso', e.target.value)}
                    placeholder="80"
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Frecuencia respiratoria</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={signosForm.frecuencia_respiratoria}
                    onChange={(e) =>
                      cambiarCampoSignos('frecuencia_respiratoria', e.target.value)
                    }
                    placeholder="18"
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Saturación</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={signosForm.saturacion}
                    onChange={(e) => cambiarCampoSignos('saturacion', e.target.value)}
                    placeholder="98"
                  />
                </div>

                <div>
                  <label style={labelStyle(darkMode)}>Peso</label>
                  <input
                    style={inputStyle(darkMode)}
                    value={signosForm.peso}
                    onChange={(e) => cambiarCampoSignos('peso', e.target.value)}
                    placeholder="70"
                  />
                </div>

                <div style={styles.full}>
                  <h3 style={{ ...styles.sectionTitle, marginTop: '8px' }}>Insumos utilizados</h3>
                </div>

                <div style={styles.full}>
                  <label style={labelStyle(darkMode)}>Producto</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
                    <select
                      style={selectStyle(darkMode)}
                      value={insumoForm.producto_id}
                      onChange={(e) => cambiarCampoInsumo('producto_id', e.target.value)}
                    >
                      <option value="">Seleccione un producto</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.codigo} - {p.nombre}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      style={styles.smallSoftBtn}
                      onClick={agregarProductoDraft}
                      disabled={guardandoInsumo}
                    >
                      {guardandoInsumo ? 'Agregando...' : 'Agregar'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Producto</th>
                      <th style={styles.th}>Categoría</th>
                      <th style={styles.th}>Cantidad</th>
                      <th style={styles.th}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insumosDraft.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={styles.td}>
                          No hay insumos agregados.
                        </td>
                      </tr>
                    ) : (
                      insumosDraft.map((item, index) => (
                        <tr key={`${item.producto_id}-${index}`}>
                          <td style={styles.td}>{item.productos?.nombre || '-'}</td>
                          <td style={styles.td}>
                            {item.productos?.categorias_productos?.nombre || '-'}
                          </td>
                          <td style={styles.td}>
                            <input
                              type="number"
                              min="1"
                              value={item.cantidad}
                              onChange={(e) => cambiarCantidadInsumoDraft(index, e.target.value)}
                              style={{ ...inputStyle(darkMode), maxWidth: '120px' }}
                            />
                          </td>
                          <td style={styles.td}>
                            <button
                              type="button"
                              style={styles.smallDangerBtn}
                              onClick={() => quitarInsumoDraft(index)}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={styles.saveWrap}>
                {formulario.id ? (
                  <button type="button" style={styles.softBtn} onClick={imprimirEmergencia}>
                    {imprimiendo ? 'Preparando impresión...' : 'Imprimir'}
                  </button>
                ) : null}

                <button type="button" style={styles.softBtn} onClick={internarPaciente}>
                  Internar
                </button>

                <button type="submit" style={styles.primaryBtn} disabled={guardando}>
                  {guardando
                    ? 'Guardando...'
                    : formulario.id
                      ? 'Actualizar emergencia'
                      : 'Registrar emergencia'}
                </button>
              </div>

              {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}
              {error ? <div style={styles.dangerText}>{error}</div> : null}
            </form>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitle}>Historial de emergencias</h3>

            <div style={styles.searchWrap}>
              <select
                style={selectStyle(darkMode)}
                value={pacienteHistorialId}
                onChange={(e) => setPacienteHistorialId(e.target.value)}
              >
                <option value="">Todos los pacientes</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {etiquetaPaciente(p)}
                  </option>
                ))}
              </select>

              <select
                style={selectStyle(darkMode)}
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="abierto">Abiertas</option>
                <option value="de alta">De alta</option>
              </select>

              <input
                style={inputStyle(darkMode)}
                value={filtroHistorial}
                onChange={(e) => setFiltroHistorial(e.target.value)}
                placeholder="Motivo, diagnóstico o historia"
              />

              <button type="button" style={styles.primaryBtn} onClick={buscarHistorial}>
                {cargando ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Paciente</th>
                    <th style={styles.th}>Camilla</th>
                    <th style={styles.th}>Motivo</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Fecha</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historialFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={styles.td}>
                        No hay emergencias registradas.
                      </td>
                    </tr>
                  ) : (
                    historialFiltrado.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          <div style={styles.mainText}>
                            {item.pacientes?.nombre || ''} {item.pacientes?.apellido || ''}
                          </div>
                          <div style={styles.subText}>
                            Récord: {item.pacientes?.record || '-'} · Cédula: {item.pacientes?.cedula || '-'}
                          </div>
                        </td>

                        <td style={styles.td}>
                          {item.camillas?.codigo || '-'}
                        </td>

                        <td style={styles.td}>
                          <div style={styles.mainText}>{item.motivos_consulta?.nombre || item.motivo_nota || '-'}</div>
                          <div style={styles.subText}>{item.diagnosticos?.nombre || item.diagnostico_nota || ''}</div>
                        </td>

                        <td style={styles.td}>
                          <span style={estiloEstado(item.estado_clinico || item.estado)}>
                            {normalizarEstado(item.estado_clinico || item.estado)}
                          </span>
                        </td>

                        <td style={styles.td}>
                          {formatearFechaHora(item.fecha_ingreso)}
                        </td>

                        <td style={styles.td}>
                          <div style={styles.rowActions}>
                            <button
                              type="button"
                              style={styles.smallSoftBtn}
                              onClick={() => editarEmergencia(item.id)}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              style={styles.smallSoftBtn}
                              onClick={() => {
                                setFormulario((prev) => ({ ...prev, id: item.id }));
                                editarEmergencia(item.id);
                              }}
                            >
                              Ver
                            </button>

                            <button
                              type="button"
                              style={styles.smallDangerBtn}
                              onClick={() => borrarEmergencia(item.id, item.camilla_id)}
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

            {mensaje ? <div style={styles.okText}>{mensaje}</div> : null}
            {error ? <div style={styles.dangerText}>{error}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Emergencia;