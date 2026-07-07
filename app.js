// =========================================================
// 1. CONFIGURACIÓN DE SUPABASE
// =========================================================
const SUPABASE_URL = 'https://iamemtvpoguqveskpaaa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbWVtdHZwb2d1cXZlc2twYWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzY3MjIsImV4cCI6MjA5ODc1MjcyMn0.vdQTiZkCTsI61V1FbuLXMzJfbnz3n6LwGQ_E_GPmsXo';
const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================================================
// 2. REFERENCIAS Y CONTROL DE SESIÓN
// =========================================================
const loginContainer = document.getElementById('login-container');
const kioscoContainer = document.getElementById('kiosco-container');
const adminContainer = document.getElementById('admin-container');
const statusMsg = document.getElementById('status-msg');

async function checkSession() {
    const { data: { session } } = await clienteSupabase.auth.getSession();
    if (session) mostrarKiosco(); else mostrarLogin();
}

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginMsg = document.getElementById('login-msg');
    loginMsg.textContent = "Verificando credenciales...";
    const { error } = await clienteSupabase.auth.signInWithPassword({ email, password });
    if (error) loginMsg.textContent = "Error: " + error.message; 
    else { loginMsg.textContent = ""; mostrarKiosco(); }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await clienteSupabase.auth.signOut(); mostrarLogin();
});

// =========================================================
// 3. LÓGICA DEL KIOSCO (ASISTENCIA AUTOMÁTICA)
// =========================================================
const pinInput = document.getElementById('pin-input');
const bloqueIngreso = document.getElementById('bloque-ingreso');
const bloqueConfirmacion = document.getElementById('bloque-confirmacion');
let docentePendiente = null;

document.getElementById('btn-marcar').addEventListener('click', verificarPIN);
pinInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') verificarPIN(); });

async function verificarPIN() {
    const pin = pinInput.value.trim();
    if (pin.length !== 3) { mostrarAlerta(statusMsg, "El PIN debe tener 3 dígitos.", "#e74c3c", "white"); pinInput.focus(); return; }
    if (new Date().getDay() !== 6) { mostrarAlerta(statusMsg, "El sistema solo registra asistencias los días sábado.", "#e74c3c", "white"); pinInput.value = ""; return; }

    const { data: docente, error } = await clienteSupabase
        .from('docentes').select('id, nombres, apellidos, estado_activo').eq('pin', parseInt(pin)).single();

    if (error || !docente) { mostrarAlerta(statusMsg, "PIN no encontrado.", "#e74c3c", "white"); pinInput.value = ""; pinInput.focus(); return; }
    if (!docente.estado_activo) { mostrarAlerta(statusMsg, "Su usuario está inactivo. Consulte a coordinación.", "#f39c12", "white"); pinInput.value = ""; return; }

    docentePendiente = docente;
    document.getElementById('nombre-confirmacion').textContent = `${docente.nombres} ${docente.apellidos}`;
    bloqueIngreso.classList.add('hidden'); bloqueConfirmacion.classList.remove('hidden');
}

document.getElementById('btn-si').addEventListener('click', async () => {
    if (!docentePendiente) return;
    const ahora = new Date();
    const fechaLocal = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const horaAmigable = ahora.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: true });

    const { error } = await clienteSupabase.from('asistencias')
        .insert([{ docente_id: docentePendiente.id, estado: 'asistio', fecha: fechaLocal, hora: ahora.toTimeString().split(' ')[0] }]);

    if (error) {
        if (error.code === '23505') mostrarAlerta(statusMsg, `Ya hay un registro guardado para hoy.`, "#f39c12", "white");
        else mostrarAlerta(statusMsg, "Error del servidor.", "#e74c3c", "white");
        resetearKioscoUI();
    } else {
        bloqueConfirmacion.classList.add('hidden');
        document.getElementById('exito-nombre').textContent = `${docentePendiente.nombres}`;
        document.getElementById('exito-hora').textContent = `Hora de entrada: ${horaAmigable}`;
        document.getElementById('tarjeta-exito').classList.remove('hidden');
        setTimeout(() => { document.getElementById('tarjeta-exito').classList.add('hidden'); resetearKioscoUI(); }, 3500);
    }
});

document.getElementById('btn-no').addEventListener('click', () => { mostrarAlerta(statusMsg, "Operación cancelada.", "#f39c12", "white"); resetearKioscoUI(); });

function resetearKioscoUI() { docentePendiente = null; pinInput.value = ""; bloqueConfirmacion.classList.add('hidden'); bloqueIngreso.classList.remove('hidden'); pinInput.focus(); }

// =========================================================
// 4. PANEL DE ADMINISTRADOR (NAVEGACIÓN)
// =========================================================
const secNuevo = document.getElementById('sec-nuevo'); const secReporte = document.getElementById('sec-reporte');
const tabNuevo = document.getElementById('tab-nuevo'); const tabReporte = document.getElementById('tab-reporte');

document.getElementById('btn-ir-admin').addEventListener('click', () => { 
    kioscoContainer.classList.add('hidden'); 
    adminContainer.classList.remove('hidden'); 
    secNuevo.classList.add('hidden'); 
    secReporte.classList.remove('hidden'); 
    tabNuevo.classList.remove('active-tab'); 
    tabReporte.classList.add('active-tab');
    document.getElementById('admin-msg').innerHTML = ""; 
    generarReporte(); 
});

document.getElementById('btn-volver-kiosco').addEventListener('click', mostrarKiosco);

tabReporte.addEventListener('click', () => { 
    secNuevo.classList.add('hidden'); 
    secReporte.classList.remove('hidden'); 
    tabNuevo.classList.remove('active-tab'); 
    tabReporte.classList.add('active-tab'); 
    generarReporte(); 
});

tabNuevo.addEventListener('click', () => { 
    secReporte.classList.add('hidden'); 
    secNuevo.classList.remove('hidden'); 
    tabReporte.classList.remove('active-tab'); 
    tabNuevo.classList.add('active-tab'); 
    document.getElementById('nuevo-nombres').value = "";
    document.getElementById('nuevo-apellidos').value = "";
    document.getElementById('admin-msg').innerHTML = "";
});

// =========================================================
// 5. GESTIÓN DE DOCENTES (NUEVO REGISTRO Y MODAL)
// =========================================================
document.getElementById('btn-guardar-docente').addEventListener('click', async () => {
    const inputN = document.getElementById('nuevo-nombres'); const inputA = document.getElementById('nuevo-apellidos');
    const msg = document.getElementById('admin-msg');
    
    if (!inputN.value.trim() || !inputA.value.trim()) { msg.innerHTML = "<span style='color:red;'>Complete ambos campos.</span>"; return; }
    msg.innerHTML = "<span style='color:blue;'>Generando código...</span>";
    
    let pinUnico = false; let nuevoPin = 0;
    while (!pinUnico) {
        nuevoPin = Math.floor(Math.random() * 900) + 100;
        const { data } = await clienteSupabase.from('docentes').select('id').eq('pin', nuevoPin);
        if (data && data.length === 0) pinUnico = true;
    }

    const { error } = await clienteSupabase.from('docentes').insert([{ nombres: inputN.value.trim(), apellidos: inputA.value.trim(), pin: nuevoPin, estado_activo: true }]);
    if (error) msg.innerHTML = "<span style='color:red;'>Error al guardar.</span>";
    else { msg.innerHTML = `Registro exitoso. PIN Asignado: <span style="font-size:24px; color:#2ecc71; display:block; margin-top:5px;">${nuevoPin}</span>`; inputN.value = ""; inputA.value = ""; }
});

// --- Lógica de la Tarjeta Modal ---
const modalEdicion = document.getElementById('modal-edicion');
const editId = document.getElementById('edit-id');
const editNombres = document.getElementById('edit-nombres');
const editApellidos = document.getElementById('edit-apellidos');
const editEstado = document.getElementById('edit-estado');

window.abrirModalEdicion = function(id, nombres, apellidos, estadoActivo) {
    editId.value = id;
    editNombres.value = nombres;
    editApellidos.value = apellidos;
    editEstado.value = estadoActivo ? "true" : "false";
    modalEdicion.classList.remove('hidden');
};

document.getElementById('btn-cerrar-modal').addEventListener('click', () => modalEdicion.classList.add('hidden'));

document.getElementById('btn-guardar-edicion').addEventListener('click', async () => {
    const id = editId.value;
    const n = editNombres.value.trim();
    const a = editApellidos.value.trim();
    const estado = editEstado.value === "true";
    
    if(!n || !a) { alert("Los campos de nombre y apellido son obligatorios."); return; }
    
    const btnGuardar = document.getElementById('btn-guardar-edicion');
    btnGuardar.textContent = "Guardando...";
    
    const { error } = await clienteSupabase.from('docentes').update({ nombres: n, apellidos: a, estado_activo: estado }).eq('id', id);
    
    btnGuardar.textContent = "Guardar Cambios";
    if(error) alert("Error de conexión al actualizar.");
    else { modalEdicion.classList.add('hidden'); generarReporte(); }
});

document.getElementById('btn-eliminar-docente').addEventListener('click', async () => {
    const id = editId.value;
    const n = editNombres.value;
    const a = editApellidos.value;
    
    if(!confirm(`ATENCIÓN: ¿Está seguro de que desea eliminar permanentemente a ${n} ${a}?\n\nEsta acción borrará todo su historial de asistencia y no se puede deshacer.`)) return;

    const btnEliminar = document.getElementById('btn-eliminar-docente');
    btnEliminar.textContent = "Borrando...";
    
    await clienteSupabase.from('asistencias').delete().eq('docente_id', id);
    const { error } = await clienteSupabase.from('docentes').delete().eq('id', id);
    
    btnEliminar.textContent = "Eliminar";
    if(error) alert("Error al intentar eliminar.");
    else { modalEdicion.classList.add('hidden'); generarReporte(); }
});

// =========================================================
// 6. MATRIZ GENERAL Y GENERACIÓN DE TABLA
// =========================================================
let miGrafico = null; 
function obtenerSabados() {
    const sabados = []; let fecha = new Date(2026, 6, 11); const fin = new Date(2026, 10, 30);
    while (fecha <= fin) {
        if (fecha.getDay() === 6) {
            const y = fecha.getFullYear(); const m = String(fecha.getMonth() + 1).padStart(2, '0'); const d = String(fecha.getDate()).padStart(2, '0');
            sabados.push(`${y}-${m}-${d}`);
        }
        fecha.setDate(fecha.getDate() + 7);
    }
    return sabados;
}

async function generarReporte() {
    const cont = document.getElementById('tabla-excel-container');
    cont.innerHTML = "<p style='padding: 20px; font-weight: bold; color: #3498db;'>Sincronizando datos...</p>";

    const { data: docentes } = await clienteSupabase.from('docentes').select('*').order('apellidos', { ascending: true });
    const { data: asistencias } = await clienteSupabase.from('asistencias').select('*');
    if (!docentes) { cont.innerHTML = "<p style='color:red;'>Error al cargar los datos del servidor.</p>"; return; }

    const fechas = obtenerSabados();
    const hoyStr = new Date().toISOString().split('T')[0];
    let gA = 0, gP = 0, gF = 0;

    let html = `<table class="matrix-table" id="tabla-exportar"><thead><tr>
        <th class="col-fija fix-1">N°</th>
        <th class="col-fija fix-2">Docente</th>
        <th class="col-fija fix-3">PIN</th>
        <th class="col-fija fix-4">Asist.</th>
        <th class="col-fija fix-5">Perm.</th>
        <th class="col-fija fix-6">Faltas</th>
        <th class="col-fija fix-7">Acciones</th>`;
    
    fechas.forEach(f => {
        const d = f.split('-');
        html += `<th class="${f === hoyStr ? 'col-actual' : ''}">${d[2]}/${d[1]}</th>`;
    });
    html += `</tr></thead><tbody>`;

    docentes.forEach((doc, i) => {
        let a = 0, p = 0, f = 0;
        const inact = doc.estado_activo === false ? "fila-inactiva" : "";
        const badgeInactivo = doc.estado_activo === false ? `<span class="badge-inactivo">INACTIVO</span>` : "";
        const nombreCompleto = `${doc.apellidos}, ${doc.nombres}`;

        let celdasFechas = "";
        fechas.forEach(fecha => {
            const reg = asistencias.find(x => x.docente_id === doc.id && x.fecha === fecha);
            let val = 'falta', cls = 'f';
            
            if (reg) {
                if (reg.estado === 'asistio') { a++; gA++; val = 'asistio'; cls = 'a'; }
                else if (reg.estado === 'permiso') { p++; gP++; val = 'permiso'; cls = 'p'; }
            } else { f++; gF++; }

            celdasFechas += `<td class="${fecha === hoyStr ? 'celda-actual' : ''}">
                <select class="select-asistencia ${cls}" onchange="cambiarEstadoCelda(${doc.id}, '${fecha}', this.value)" ${!doc.estado_activo ? 'disabled' : ''}>
                    <option value="asistio" ${val === 'asistio' ? 'selected' : ''}>A</option>
                    <option value="permiso" ${val === 'permiso' ? 'selected' : ''}>P</option>
                    <option value="falta" ${val === 'falta' ? 'selected' : ''}>F</option>
                </select>
            </td>`;
        });

        const btnEditar = `<button onclick="abrirModalEdicion(${doc.id}, '${doc.nombres}', '${doc.apellidos}', ${doc.estado_activo})" class="btn-manage">Ajustes</button>`;

        html += `<tr class="${inact}">
            <td class="col-fija fix-1">${i + 1}</td>
            <td class="col-fija fix-2" title="${nombreCompleto}">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nombreCompleto}</span>
                    ${badgeInactivo}
                </div>
            </td>
            <td class="col-fija fix-3">${doc.pin}</td>
            <td class="col-fija fix-4">${a}</td>
            <td class="col-fija fix-5">${p}</td>
            <td class="col-fija fix-6">${f}</td>
            <td class="col-fija fix-7" style="display:flex; justify-content:center; align-items:center; border:none; padding-top: 12px;">${btnEditar}</td>
            ${celdasFechas}
        </tr>`;
    });

    html += `</tbody></table>`; cont.innerHTML = html;
    dibujarGrafica(gA, gP, gF);

    setTimeout(() => { const col = document.querySelector('.col-actual'); if (col) col.scrollIntoView({ behavior: 'smooth', inline: 'center' }); }, 300);
}

window.cambiarEstadoCelda = async function(id, fecha, estado) {
    await clienteSupabase.from('asistencias').delete().eq('docente_id', id).eq('fecha', fecha);
    if (estado !== 'falta') await clienteSupabase.from('asistencias').insert([{ docente_id: id, fecha: fecha, estado: estado, hora: "13:00:00" }]);
    generarReporte();
};

document.getElementById('buscador-docente').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#tabla-exportar tbody tr').forEach(fila => {
        fila.classList.toggle('hidden', !fila.innerText.toLowerCase().includes(term));
    });
});

function dibujarGrafica(a, p, f) {
    const ctx = document.getElementById('grafica-asistencia').getContext('2d');
    if (miGrafico) miGrafico.destroy();
    miGrafico = new Chart(ctx, { type: 'doughnut', data: { labels: ['Asistencias', 'Permisos', 'Faltas'], datasets: [{ data: [a, p, f], backgroundColor: ['#2ecc71', '#f39c12', '#e74c3c'] }] }, options: { plugins: { legend: { position: 'bottom' } } } });
}

// =========================================================
// 8. EXPORTACIÓN NATIVA A EXCEL (.xlsx)
// =========================================================
document.getElementById('btn-exportar-csv').addEventListener('click', () => {
    const tabla = document.getElementById('tabla-exportar'); 
    if (!tabla) return alert("Por favor, espere a que la tabla cargue primero.");
    
    let dataMatriz = [];

    tabla.querySelectorAll("tr").forEach(fila => {
        let arrayFila = [];
        fila.querySelectorAll("td, th").forEach((c, i) => {
            if (i === 6) return; // Omitir la columna de "Acciones"
            
            const sel = c.querySelector('select');
            let valorCelda = sel ? (sel.value === 'asistio' ? 'A' : sel.value === 'permiso' ? 'P' : 'F') : c.innerText.replace(/\n/g, '').trim();
            if (i === 1) valorCelda = valorCelda.replace("INACTIVO", "").trim();
            
            arrayFila.push(valorCelda);
        });
        dataMatriz.push(arrayFila);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataMatriz);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Asistencias");

    // SheetJS maneja la exportación de forma nativa y estable
    XLSX.writeFile(wb, "Matriz_Asistencias.xlsx");
});

// =========================================================
// 9. UTILIDADES
// =========================================================
function mostrarKiosco() { loginContainer.classList.add('hidden'); adminContainer.classList.add('hidden'); kioscoContainer.classList.remove('hidden'); resetearKioscoUI(); }
function mostrarLogin() { loginContainer.classList.remove('hidden'); kioscoContainer.classList.add('hidden'); adminContainer.classList.add('hidden'); }
function mostrarAlerta(el, msg, bg, txt) { el.textContent = msg; el.style.backgroundColor = bg; el.style.color = txt; setTimeout(() => el.textContent="", 3500); }

checkSession();