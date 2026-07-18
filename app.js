// =========================================================
// 1. CONFIGURACIÓN DE SUPABASE Y ROLES
// =========================================================
const SUPABASE_URL = 'https://iamemtvpoguqveskpaaa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbWVtdHZwb2d1cXZlc2twYWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzY3MjIsImV4cCI6MjA5ODc1MjcyMn0.vdQTiZkCTsI61V1FbuLXMzJfbnz3n6LwGQ_E_GPmsXo';
const CORREO_ADMIN_GOD = 'adminsup@hr.com'; 

const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage }
});

let emailUsuarioActual = "Desconocido";

// =========================================================
// 2. REFERENCIAS GLOBALES
// =========================================================
const loginContainer = document.getElementById('login-container');
const kioscoContainer = document.getElementById('kiosco-container');
const adminContainer = document.getElementById('admin-container');
const statusMsg = document.getElementById('status-msg');
const pinInput = document.getElementById('pin-input');
const bloqueIngreso = document.getElementById('bloque-ingreso');
const bloqueConfirmacion = document.getElementById('bloque-confirmacion');
let docentePendiente = null;

// =========================================================
// 3. SISTEMA DE BITÁCORA (LOGS SILENCIOSOS)
// =========================================================
async function registrarLog(accion) {
    if (emailUsuarioActual === "Desconocido") return;
    try {
        await clienteSupabase.from('registro_logs').insert([
            { usuario: emailUsuarioActual, accion: accion }
        ]);
    } catch (err) { console.error("Error guardando log", err); }
}

async function cargarAuditoria() {
    const tbody = document.getElementById('tabla-logs-body');
    tbody.innerHTML = "<tr><td colspan='3' style='padding:20px; text-align:center;'>Cargando bitácora...</td></tr>";
    
    // Limpiamos el buscador de logs cada vez que se recarga la tabla
    document.getElementById('buscador-logs').value = "";
    
    const { data, error } = await clienteSupabase.from('registro_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200); // Trae los últimos 200 registros
        
    if (error) { tbody.innerHTML = "<tr><td colspan='3' style='color:red;'>Error al conectar con la base de datos de auditoría.</td></tr>"; return; }
    if (data.length === 0) { tbody.innerHTML = "<tr><td colspan='3'>No hay registros de actividad.</td></tr>"; return; }

    let html = "";
    data.forEach(log => {
        const fecha = new Date(log.created_at);
        const formatFecha = `${fecha.toLocaleDateString('es-SV')} - ${fecha.toLocaleTimeString('es-SV', { hour12: true })}`;
        html += `<tr>
            <td style="text-align: left; padding-left: 15px; color: var(--slate-500); width: 170px;">${formatFecha}</td>
            <td style="text-align: left; font-weight: bold; color: var(--slate-800); width: 220px;">${log.usuario}</td>
            <td style="text-align: left;">${log.accion}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

// Filtro en tiempo real para los logs por usuario
document.getElementById('buscador-logs').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#tabla-logs-body tr').forEach(fila => {
        if (fila.cells.length < 3) return; // Ignora la fila de "Cargando" si existe
        const usuario = fila.cells[1].textContent.toLowerCase();
        fila.classList.toggle('hidden', !usuario.includes(term));
    });
});

// =========================================================
// 4. CONTROL DE SESIÓN Y TIEMPO DE INACTIVIDAD (15 MIN)
// =========================================================
const TIEMPO_EXPIRACION_MINUTOS = 15;
function actualizarActividad() { localStorage.setItem('ultima_actividad', Date.now()); }

function evaluarRolYMostrar(sessionEmail) {
    emailUsuarioActual = sessionEmail;
    if (emailUsuarioActual === CORREO_ADMIN_GOD) {
        document.getElementById('tab-logs').style.display = 'block';
    } else {
        document.getElementById('tab-logs').style.display = 'none';
    }
}

async function verificarSesionInicial() {
    const { data: { session } } = await clienteSupabase.auth.getSession();
    
    if (session) {
        evaluarRolYMostrar(session.user.email);
        const ultimaActividad = localStorage.getItem('ultima_actividad');
        const ahora = Date.now();
        
        if (ultimaActividad) {
            const minutosPasados = (ahora - parseInt(ultimaActividad)) / (1000 * 60);
            if (minutosPasados > TIEMPO_EXPIRACION_MINUTOS) {
                await clienteSupabase.auth.signOut();
                localStorage.removeItem('ultima_actividad');
                mostrarLogin();
                mostrarAlerta(document.getElementById('login-msg'), "La sesión caducó por inactividad.", "#ef4444", "white");
                return;
            }
        }
        
        actualizarActividad();
        const vistaGuardada = localStorage.getItem('vista_actual');
        if (vistaGuardada === 'admin') irAlAdminPanel(); else mostrarKiosco();
    } else {
        mostrarLogin();
    }
}
verificarSesionInicial();

clienteSupabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        actualizarActividad();
        evaluarRolYMostrar(session.user.email);
        const vista = localStorage.getItem('vista_actual');
        if (vista === 'admin') irAlAdminPanel(); else mostrarKiosco();
    } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('ultima_actividad'); localStorage.removeItem('vista_actual');
        emailUsuarioActual = "Desconocido";
        document.getElementById('tab-logs').style.display = 'none';
        mostrarLogin();
    }
});

document.addEventListener('click', () => { if (loginContainer.classList.contains('hidden')) actualizarActividad(); });

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginMsg = document.getElementById('login-msg');
    loginMsg.textContent = "Verificando credenciales...";
    
    const { error } = await clienteSupabase.auth.signInWithPassword({ email, password });
    if (error) loginMsg.textContent = "Error: " + error.message; 
    else { loginMsg.textContent = ""; localStorage.setItem('vista_actual', 'admin'); registrarLog("Inició sesión en el sistema."); }
});
document.getElementById('btn-logout').addEventListener('click', async () => { registrarLog("Cerró sesión manualmente."); await clienteSupabase.auth.signOut(); });

// Funciones UI Generales
function resetearKioscoUI() { docentePendiente = null; pinInput.value = ""; bloqueConfirmacion.classList.add('hidden'); bloqueIngreso.classList.remove('hidden'); pinInput.focus(); }
function mostrarKiosco() { loginContainer.classList.add('hidden'); adminContainer.classList.add('hidden'); kioscoContainer.classList.remove('hidden'); resetearKioscoUI(); }
function mostrarLogin() { loginContainer.classList.remove('hidden'); kioscoContainer.classList.add('hidden'); adminContainer.classList.add('hidden'); }
function mostrarAlerta(el, msg, bg, txt) { el.textContent = msg; el.style.backgroundColor = bg; el.style.color = txt; setTimeout(() => el.textContent="", 3500); }

// =========================================================
// 5. LÓGICA DEL KIOSCO 
// =========================================================
document.getElementById('btn-marcar').addEventListener('click', verificarPIN);
pinInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') verificarPIN(); });

async function verificarPIN() {
    const pin = pinInput.value.trim();
    if (pin.length !== 3) { mostrarAlerta(statusMsg, "El código debe tener 3 dígitos (ej. 001).", "#ef4444", "white"); pinInput.focus(); return; }

    const ahora = new Date();
    const fechaLocal = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    
    if (ahora.getDay() !== 6) { mostrarAlerta(statusMsg, "El kiosco solo registra asistencias los sábados.", "#ef4444", "white"); pinInput.value = ""; pinInput.focus(); return; }
    if (ahora.getHours() < 6 || ahora.getHours() >= 13) { mostrarAlerta(statusMsg, "Horario finalizado (6 AM - 1 PM).", "#ef4444", "white"); pinInput.value = ""; pinInput.focus(); return; }

    const { data: diaSusp } = await clienteSupabase.from('dias_suspendidos').select('fecha').eq('fecha', fechaLocal);
    if (diaSusp && diaSusp.length > 0) { mostrarAlerta(statusMsg, "Las clases están suspendidas el día de hoy.", "#f59e0b", "white"); pinInput.value = ""; pinInput.focus(); return; }

    const { data: docente, error } = await clienteSupabase.from('docentes').select('id, nombres, apellidos, estado_activo').eq('pin', parseInt(pin, 10)).single();
    if (error || !docente) { mostrarAlerta(statusMsg, "Código no encontrado.", "#ef4444", "white"); pinInput.value = ""; pinInput.focus(); return; }
    if (!docente.estado_activo) { mostrarAlerta(statusMsg, "Usuario inactivo. Consulte coordinación.", "#f59e0b", "white"); pinInput.value = ""; pinInput.focus(); return; }

    docentePendiente = docente;
    document.getElementById('nombre-confirmacion').textContent = `${docente.nombres} ${docente.apellidos}`;
    bloqueIngreso.classList.add('hidden'); bloqueConfirmacion.classList.remove('hidden');
}

document.getElementById('btn-si').addEventListener('click', async () => {
    if (!docentePendiente) return;
    const ahora = new Date();
    const fechaLocal = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const horaAmigable = ahora.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: true });

    const { error } = await clienteSupabase.from('asistencias').insert([{ docente_id: docentePendiente.id, estado: 'asistio', fecha: fechaLocal, hora: ahora.toTimeString().split(' ')[0] }]);

    if (error) {
        if (error.code === '23505') mostrarAlerta(statusMsg, `Ya hay un registro para hoy.`, "#f59e0b", "white");
        else mostrarAlerta(statusMsg, "Error del servidor.", "#ef4444", "white");
        resetearKioscoUI();
    } else {
        bloqueConfirmacion.classList.add('hidden');
        document.getElementById('exito-nombre').textContent = `${docentePendiente.nombres}`;
        document.getElementById('exito-hora').textContent = `Hora de entrada: ${horaAmigable}`;
        document.getElementById('tarjeta-exito').classList.remove('hidden');
        
        registrarLog(`Validó PIN y marcó asistencia para el docente: ${docentePendiente.nombres} ${docentePendiente.apellidos}`);
        
        setTimeout(() => { document.getElementById('tarjeta-exito').classList.add('hidden'); resetearKioscoUI(); }, 3500);
    }
});

document.getElementById('btn-no').addEventListener('click', () => { mostrarAlerta(statusMsg, "Cancelado.", "#f59e0b", "white"); resetearKioscoUI(); });

// =========================================================
// 6. NAVEGACIÓN Y OPERATORIA DEL PANEL
// =========================================================
const secNuevo = document.getElementById('sec-nuevo'); 
const secReporte = document.getElementById('sec-reporte');
const secLogs = document.getElementById('sec-logs');

const tabNuevo = document.getElementById('tab-nuevo'); 
const tabReporte = document.getElementById('tab-reporte');
const tabLogs = document.getElementById('tab-logs');

function irAlAdminPanel() {
    // AQUÍ ESTABA EL ERROR DE LA IMAGEN: Ahora obligamos a esconder el login siempre
    loginContainer.classList.add('hidden'); 
    kioscoContainer.classList.add('hidden'); 
    adminContainer.classList.remove('hidden'); 
    
    secNuevo.classList.add('hidden'); secLogs.classList.add('hidden'); secReporte.classList.remove('hidden'); 
    tabNuevo.classList.remove('active-tab'); tabLogs.classList.remove('active-tab'); tabReporte.classList.add('active-tab'); 
    document.getElementById('admin-msg').innerHTML = ""; generarReporte();
    localStorage.setItem('vista_actual', 'admin');
}

document.getElementById('btn-ir-admin').addEventListener('click', irAlAdminPanel);
document.getElementById('btn-volver-kiosco').addEventListener('click', () => { localStorage.setItem('vista_actual', 'kiosco'); mostrarKiosco(); });

tabReporte.addEventListener('click', () => { secNuevo.classList.add('hidden'); secLogs.classList.add('hidden'); secReporte.classList.remove('hidden'); tabNuevo.classList.remove('active-tab'); tabLogs.classList.remove('active-tab'); tabReporte.classList.add('active-tab'); generarReporte(); });
tabNuevo.addEventListener('click', () => { secReporte.classList.add('hidden'); secLogs.classList.add('hidden'); secNuevo.classList.remove('hidden'); tabReporte.classList.remove('active-tab'); tabLogs.classList.remove('active-tab'); tabNuevo.classList.add('active-tab'); document.getElementById('nuevo-nombres').value = ""; document.getElementById('nuevo-apellidos').value = ""; document.getElementById('admin-msg').innerHTML = ""; });

// Eventos de la pestaña de LOGS
tabLogs.addEventListener('click', () => {
    secReporte.classList.add('hidden'); secNuevo.classList.add('hidden'); secLogs.classList.remove('hidden');
    tabReporte.classList.remove('active-tab'); tabNuevo.classList.remove('active-tab'); tabLogs.classList.add('active-tab');
    cargarAuditoria();
});
document.getElementById('btn-recargar-logs').addEventListener('click', cargarAuditoria);


document.getElementById('btn-guardar-docente').addEventListener('click', async () => {
    const inputN = document.getElementById('nuevo-nombres'); const inputA = document.getElementById('nuevo-apellidos'); const msg = document.getElementById('admin-msg');
    if (!inputN.value.trim() || !inputA.value.trim()) { msg.innerHTML = "<span style='color:red;'>Complete ambos campos.</span>"; return; }
    
    msg.innerHTML = "<span style='color:var(--brand-blue);'>Generando código correlativo...</span>";
    
    const { data: maxPinData } = await clienteSupabase.from('docentes').select('pin').order('pin', { ascending: false }).limit(1);
    let nuevoPin = 1; if (maxPinData && maxPinData.length > 0 && maxPinData[0].pin) nuevoPin = parseInt(maxPinData[0].pin, 10) + 1; 

    const pinFormateado = String(nuevoPin).padStart(3, '0');
    const { error } = await clienteSupabase.from('docentes').insert([{ nombres: inputN.value.trim(), apellidos: inputA.value.trim(), pin: nuevoPin, estado_activo: true }]);
    
    if (error) msg.innerHTML = "<span style='color:red;'>Error al guardar.</span>"; 
    else { 
        msg.innerHTML = `Registro exitoso. Código Asignado: <span style="font-size:24px; color:#10b981; display:block; margin-top:5px; font-weight:bold;">${pinFormateado}</span>`;
        registrarLog(`Registró un nuevo docente: ${inputN.value.trim()} ${inputA.value.trim()} (Se le asignó el PIN: ${pinFormateado})`);
        inputN.value = ""; inputA.value = ""; 
    }
});

const modalEdicion = document.getElementById('modal-edicion');
const editId = document.getElementById('edit-id'); const editNombres = document.getElementById('edit-nombres'); const editApellidos = document.getElementById('edit-apellidos');

window.abrirModalEdicion = function(id, nombres, apellidos, estadoActivo) { 
    editId.value = id; editNombres.value = nombres; editApellidos.value = apellidos; 
    const radios = document.getElementsByName('edit-estado-radio');
    for (let radio of radios) { radio.checked = (radio.value === (estadoActivo ? "true" : "false")); }
    modalEdicion.classList.remove('hidden'); 
};
document.getElementById('btn-cerrar-modal').addEventListener('click', () => modalEdicion.classList.add('hidden'));

document.getElementById('btn-guardar-edicion').addEventListener('click', async () => {
    const id = editId.value; const n = editNombres.value.trim(); const a = editApellidos.value.trim(); 
    let estado = true; const radios = document.getElementsByName('edit-estado-radio');
    for (let radio of radios) { if(radio.checked) estado = (radio.value === "true"); }
    if(!n || !a) { alert("Los campos son obligatorios."); return; }
    
    document.getElementById('btn-guardar-edicion').textContent = "Guardando...";
    const { error } = await clienteSupabase.from('docentes').update({ nombres: n, apellidos: a, estado_activo: estado }).eq('id', id);
    document.getElementById('btn-guardar-edicion').textContent = "Guardar Cambios";
    
    if(error) alert("Error de conexión."); else { 
        registrarLog(`Editó la información/estado del docente: ${n} ${a} (Nuevo estado activo: ${estado})`);
        modalEdicion.classList.add('hidden'); generarReporte(); 
    }
});

// =========================================================
// 7. GENERACIÓN DE MATRIZ DINÁMICA MEJORADA
// =========================================================
let miGrafico = null; 
function obtenerSabados() {
    const sabados = []; let fecha = new Date(2026, 6, 11); const fin = new Date(2026, 10, 30);
    while (fecha <= fin) { if (fecha.getDay() === 6) { sabados.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`); } fecha.setDate(fecha.getDate() + 7); }
    return sabados;
}

async function generarReporte() {
    const cont = document.getElementById('tabla-excel-container');
    cont.innerHTML = "<p style='padding: 20px; font-weight: 600; color: var(--slate-500);'>Cargando registros...</p>";

    const { data: docentes } = await clienteSupabase.from('docentes').select('*').order('apellidos', { ascending: true });
    const { data: asistencias } = await clienteSupabase.from('asistencias').select('*');
    const { data: diasSusp } = await clienteSupabase.from('dias_suspendidos').select('fecha');
    
    if (!docentes) { cont.innerHTML = "<p style='color:red;'>Error de conexión.</p>"; return; }

    const arrayDiasSuspendidos = diasSusp ? diasSusp.map(d => d.fecha) : [];
    const fechas = obtenerSabados();
    
    const ahoraLocal = new Date();
    const hoyStr = `${ahoraLocal.getFullYear()}-${String(ahoraLocal.getMonth() + 1).padStart(2, '0')}-${String(ahoraLocal.getDate()).padStart(2, '0')}`;
    const horaActual = ahoraLocal.getHours();
    
    let sabadoObjetivo = fechas[fechas.length - 1]; 
    for (let i = 0; i < fechas.length; i++) { if (fechas[i] >= hoyStr) { sabadoObjetivo = fechas[i]; break; } }

    let gA = 0, gP = 0, gF = 0;

    let html = `<table class="matrix-table" id="tabla-exportar"><thead><tr>
        <th class="col-fija fix-1">N°</th>
        <th class="col-fija fix-2">Docente</th>
        <th class="col-fija fix-3">CÓDIGO</th>
        <th class="col-fija fix-4">A</th>
        <th class="col-fija fix-5">P</th>
        <th class="col-fija fix-6">F</th>
        <th class="col-fija fix-7"></th>`;
    
    fechas.forEach(f => {
        const d = f.split('-'); const dateObj = new Date(d[0], d[1]-1, d[2]);
        const mes = dateObj.toLocaleString('es-ES', {month: 'short'}).substring(0,3).toUpperCase();
        const isSuspendido = arrayDiasSuspendidos.includes(f);
        const btnToggle = isSuspendido 
            ? `<button onclick="toggleDiaSuspendido('${f}', true)" class="btn-reactivar" title="Reactivar sábado">✅ React.</button>`
            : `<button onclick="toggleDiaSuspendido('${f}', false)" class="btn-suspender" title="Suspender sábado">🚫 Susp.</button>`;

        html += `<th class="${f === sabadoObjetivo ? 'col-actual' : ''}"><div class="date-header"><span class="mes">${mes}</span><span class="dia">${d[2]}</span></div>${btnToggle}</th>`;
    });
    html += `</tr></thead><tbody>`;

    docentes.forEach((doc, i) => {
        let a = 0, p = 0, f = 0;
        const inact = doc.estado_activo === false ? "fila-inactiva" : "";
        const badgeInactivo = doc.estado_activo === false ? `<span class="badge-inactivo">INACTIVO</span>` : "";
        const nombreCompleto = `${doc.apellidos}, ${doc.nombres}`;
        const pinMostrar = String(doc.pin).padStart(3, '0');

        let celdasFechas = "";
        fechas.forEach(fecha => {
            const isSuspendido = arrayDiasSuspendidos.includes(fecha);
            const reg = asistencias.find(x => x.docente_id === doc.id && x.fecha === fecha);
            
            let val = 'pendiente', cls = 's';
            
            if (reg) {
                if (reg.estado === 'asistio') { val = 'asistio'; cls = 'a'; if(!isSuspendido) a++; }
                else if (reg.estado === 'permiso') { val = 'permiso'; cls = 'p'; if(!isSuspendido) p++; }
                else if (reg.estado === 'falta') { val = 'falta'; cls = 'f'; if(!isSuspendido) f++; }
            } else { 
                if (fecha < hoyStr || (fecha === hoyStr && horaActual >= 13)) { val = 'falta'; cls = 'f'; if(!isSuspendido) f++; } 
                else { val = 'pendiente'; cls = 's'; }
            }

            if (isSuspendido) { celdasFechas += `<td class="${fecha === sabadoObjetivo ? 'celda-actual' : ''}"><span class="badge-suspendida">-</span></td>`; } 
            else {
                celdasFechas += `<td class="${fecha === sabadoObjetivo ? 'celda-actual' : ''}">
                    <select class="select-asistencia ${cls}" data-fecha="${fecha}" onchange="cambiarEstadoCelda(${doc.id}, '${nombreCompleto}', '${fecha}', this.value, this)" ${!doc.estado_activo ? 'disabled' : ''}>
                        <option value="pendiente" ${val === 'pendiente' ? 'selected' : ''}>-</option>
                        <option value="asistio" ${val === 'asistio' ? 'selected' : ''}>A</option>
                        <option value="permiso" ${val === 'permiso' ? 'selected' : ''}>P</option>
                        <option value="falta" ${val === 'falta' ? 'selected' : ''}>F</option>
                    </select>
                </td>`;
            }
        });

        gA += a; gP += p; gF += f;
        const btnEditar = `<button onclick="abrirModalEdicion(${doc.id}, '${doc.nombres}', '${doc.apellidos}', ${doc.estado_activo})" class="btn-manage" title="Ajustes">⚙️</button>`;

        html += `<tr class="${inact}">
            <td class="col-fija fix-1">${i + 1}</td>
            <td class="col-fija fix-2" title="${nombreCompleto}"><div style="display: flex; justify-content: space-between; align-items: center; width: 100%;"><span style="overflow: hidden; text-overflow: ellipsis;">${nombreCompleto}</span>${badgeInactivo}</div></td>
            <td class="col-fija fix-3">${pinMostrar}</td>
            <td class="col-fija fix-4 val-a">${a}</td>
            <td class="col-fija fix-5 val-p">${p}</td>
            <td class="col-fija fix-6 val-f">${f}</td>
            <td class="col-fija fix-7">${btnEditar}</td>
            ${celdasFechas}
        </tr>`;
    });

    html += `</tbody><tfoot><tr>
        <th class="col-fija fix-1 footer-fixed"></th><th class="col-fija fix-2 footer-fixed"></th><th class="col-fija fix-3 footer-fixed"></th>
        <th class="col-fija fix-4 footer-fixed"></th><th class="col-fija fix-5 footer-fixed"></th><th class="col-fija fix-6 footer-fixed"></th>
        <th class="col-fija fix-7 footer-fixed" style="text-align: right; padding-right: 10px; color: var(--slate-600); font-size: 10px;">TOTALES:</th>`;
    
    fechas.forEach(fecha => {
        const isSuspendido = arrayDiasSuspendidos.includes(fecha);
        if (isSuspendido) html += `<td class="celda-totales" data-footer-fecha="${fecha}"><div style="color: var(--slate-400); text-align: center;">-</div></td>`;
        else html += `<td class="celda-totales" data-footer-fecha="${fecha}"></td>`; 
    });
    
    html += `</tr></tfoot></table>`; cont.innerHTML = html; actualizarTotalesDOM();
    setTimeout(() => { const col = document.querySelector('.col-actual'); if (col) col.scrollIntoView({ behavior: 'smooth', inline: 'center' }); }, 300);
}

// =========================================================
// 8. ARQUITECTURA DE "UI OPTIMISTA"
// =========================================================
window.cambiarEstadoCelda = async function(id, nombreDocente, fecha, estado, selectElement) {
    let cls = 's';
    if (estado === 'asistio') cls = 'a'; else if (estado === 'permiso') cls = 'p'; else if (estado === 'falta') cls = 'f';
    
    selectElement.className = `select-asistencia ${cls}`; actualizarTotalesDOM();

    await clienteSupabase.from('asistencias').delete().eq('docente_id', id).eq('fecha', fecha);
    if (estado !== 'pendiente') await clienteSupabase.from('asistencias').insert([{ docente_id: id, fecha: fecha, estado: estado, hora: "13:00:00" }]);
    
    registrarLog(`Forzó en matriz el estado a '${estado.toUpperCase()}' para el docente: ${nombreDocente}, en la fecha: ${fecha}`);
};

function actualizarTotalesDOM() {
    let globalA = 0, globalP = 0, globalF = 0;
    document.querySelectorAll('#tabla-exportar tbody tr').forEach(fila => {
        let a = 0, p = 0, f = 0;
        fila.querySelectorAll('.select-asistencia').forEach(sel => { if (sel.value === 'asistio') a++; else if (sel.value === 'permiso') p++; else if (sel.value === 'falta') f++; });
        const cA = fila.querySelector('.val-a'); if(cA) cA.textContent = a;
        const cP = fila.querySelector('.val-p'); if(cP) cP.textContent = p;
        const cF = fila.querySelector('.val-f'); if(cF) cF.textContent = f;
        globalA += a; globalP += p; globalF += f;
    });

    const fechas = obtenerSabados();
    fechas.forEach(fecha => {
        const selects = document.querySelectorAll(`.select-asistencia[data-fecha="${fecha}"]`);
        const cell = document.querySelector(`td[data-footer-fecha="${fecha}"]`);
        if (selects.length > 0 && cell) {
            let a = 0, p = 0, f = 0;
            selects.forEach(sel => { if (sel.value === 'asistio') a++; else if (sel.value === 'permiso') p++; else if (sel.value === 'falta') f++; });
            cell.innerHTML = `<div class="mini-card-totales"><span class="m-badge a">A: ${a}</span><span class="m-badge p">P: ${p}</span><span class="m-badge f">F: ${f}</span></div>`;
        }
    });
    dibujarGrafica(globalA, globalP, globalF);
}

// =========================================================
// 9. MODAL DE CONFIRMACIÓN 
// =========================================================
const modalConfirm = document.getElementById('modal-confirmacion');
const btnConfirmOk = document.getElementById('btn-confirm-ok');
const btnConfirmCancelar = document.getElementById('btn-confirm-cancelar');
let confirmCallback = null;

function abrirModalConfirmacion(titulo, mensaje, callback) {
    document.getElementById('modal-confirm-titulo').textContent = titulo;
    document.getElementById('modal-confirm-mensaje').textContent = mensaje;
    confirmCallback = callback; modalConfirm.classList.remove('hidden');
}

btnConfirmCancelar.addEventListener('click', () => { modalConfirm.classList.add('hidden'); confirmCallback = null; });
btnConfirmOk.addEventListener('click', () => { modalConfirm.classList.add('hidden'); if (confirmCallback) confirmCallback(); });

window.toggleDiaSuspendido = function(fecha, isSuspended) {
    if (isSuspended) {
        abrirModalConfirmacion( `¿Reactivar el ${fecha}?`, `Se quitará el bloqueo del calendario.`, async () => {
            document.getElementById('tabla-excel-container').innerHTML = "<p style='padding: 20px; color: #10b981;'>Reactivando día...</p>";
            await clienteSupabase.from('dias_suspendidos').delete().eq('fecha', fecha);
            registrarLog(`Reactivó las clases del día sábado: ${fecha}`);
            generarReporte();
        });
    } else {
        abrirModalConfirmacion( `¿Suspender el ${fecha}?`, `Se deshabilitará el Kiosco ese día.`, async () => {
            document.getElementById('tabla-excel-container').innerHTML = "<p style='padding: 20px; color: #f59e0b;'>Suspendiendo día...</p>";
            await clienteSupabase.from('dias_suspendidos').insert([{ fecha: fecha }]);
            registrarLog(`Suspendió (inmovilizó) las clases del día sábado: ${fecha}`);
            generarReporte();
        });
    }
};

// =========================================================
// 10. BUSCADOR, GRÁFICA Y EXPORTACIÓN COMPLETA
// =========================================================
document.getElementById('buscador-docente').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#tabla-exportar tbody tr').forEach(fila => { 
        const nombre = fila.querySelector('.fix-2')?.textContent.toLowerCase() || '';
        const pin = fila.querySelector('.fix-3')?.textContent.toLowerCase() || '';
        fila.classList.toggle('hidden', !(nombre.includes(term) || pin.includes(term))); 
    });
});

function dibujarGrafica(a, p, f) {
    const ctx = document.getElementById('grafica-asistencia').getContext('2d');
    if (miGrafico) miGrafico.destroy();
    miGrafico = new Chart(ctx, { type: 'doughnut', data: { labels: ['Asistencias', 'Permisos', 'Faltas'], datasets: [{ data: [a, p, f], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'] }] }, options: { plugins: { legend: { position: 'bottom' } } } });
}

document.getElementById('btn-exportar-csv').addEventListener('click', () => {
    const tabla = document.getElementById('tabla-exportar'); 
    if (!tabla) return alert("Por favor, espere a que la tabla cargue primero.");
    
    registrarLog("Exportó la Matriz General a Excel (.xlsx)");

    let dataMatriz = [];
    tabla.querySelectorAll("thead tr, tbody tr").forEach(fila => {
        let arrayFila = [];
        fila.querySelectorAll("td, th").forEach((c, i) => {
            if (i === 6) return; 
            if (fila.closest('thead')) { arrayFila.push(c.innerText.replace(/🚫 Susp\./g, '').replace(/✅ React\./g, '').replace(/\n/g, ' ').trim()); return; }
            
            const sel = c.querySelector('select'); const badgeSuspendida = c.querySelector('.badge-suspendida');
            let valorCelda = '';
            if (sel) { valorCelda = sel.value === 'asistio' ? 'A' : (sel.value === 'permiso' ? 'P' : (sel.value === 'falta' ? 'F' : '-')); } 
            else if (badgeSuspendida) { valorCelda = '-'; } else { valorCelda = c.innerText.replace(/\n/g, '').trim(); }
            
            if (i === 1) valorCelda = valorCelda.replace("INACTIVO", "").trim();
            arrayFila.push(valorCelda);
        });
        dataMatriz.push(arrayFila);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataMatriz); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.setAttribute("download", "Matriz_Asistencias.xlsx");
    document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
});