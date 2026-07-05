// =========================================================
// 1. CONFIGURACIÓN DE SUPABASE
// =========================================================
const SUPABASE_URL = 'https://iamemtvpoguqveskpaaa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbWVtdHZwb2d1cXZlc2twYWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzY3MjIsImV4cCI6MjA5ODc1MjcyMn0.vdQTiZkCTsI61V1FbuLXMzJfbnz3n6LwGQ_E_GPmsXo';
const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================================================
// 2. REFERENCIAS DEL DOM 
// =========================================================
const loginContainer = document.getElementById('login-container');
const kioscoContainer = document.getElementById('kiosco-container');
const adminContainer = document.getElementById('admin-container');
const statusMsg = document.getElementById('status-msg');

// =========================================================
// 3. SISTEMA DE SESIÓN (LOGIN / LOGOUT)
// =========================================================
async function checkSession() {
    const { data: { session } } = await clienteSupabase.auth.getSession();
    if (session) mostrarKiosco(); else mostrarLogin();
}

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginMsg = document.getElementById('login-msg');
    loginMsg.textContent = "Verificando credenciales...";
    const { data, error } = await clienteSupabase.auth.signInWithPassword({ email, password });
    if (error) loginMsg.textContent = "Error: " + error.message; else { loginMsg.textContent = ""; mostrarKiosco(); }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await clienteSupabase.auth.signOut();
    mostrarLogin();
});

// =========================================================
// 4. LÓGICA DEL KIOSCO (CON CONFIRMACIÓN "SÍ/NO")
// =========================================================
const pinInput = document.getElementById('pin-input');
const bloqueIngreso = document.getElementById('bloque-ingreso');
const bloqueConfirmacion = document.getElementById('bloque-confirmacion');
const nombreConfirmacion = document.getElementById('nombre-confirmacion');
let docentePendiente = null;

document.getElementById('btn-marcar').addEventListener('click', verificarPIN);
pinInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') verificarPIN(); });

async function verificarPIN() {
    const pinDigitado = pinInput.value.trim();

    if (pinDigitado.length !== 3) {
        mostrarAlerta(statusMsg, "El PIN debe tener 3 dígitos.", "red", "white");
        pinInput.focus(); return;
    }

    if (new Date().getDay() !== 6) {
        mostrarAlerta(statusMsg, "❌ Solo se puede marcar los días sábado.", "red", "white");
        pinInput.value = ""; pinInput.focus(); return;
    }

    const { data: docente, error: errorBusqueda } = await clienteSupabase
        .from('docentes').select('id, nombres, apellidos').eq('pin', parseInt(pinDigitado)).single();

    if (errorBusqueda || !docente) {
        mostrarAlerta(statusMsg, "❌ PIN Incorrecto.", "red", "white");
        pinInput.value = ""; pinInput.focus(); return;
    }

    docentePendiente = docente;
    nombreConfirmacion.textContent = `¿${docente.nombres} ${docente.apellidos}?`;
    bloqueIngreso.classList.add('hidden');
    bloqueConfirmacion.classList.remove('hidden');
}

document.getElementById('btn-si').addEventListener('click', async () => {
    if (!docentePendiente) return;

    const { error: errorAsistencia } = await clienteSupabase
        .from('asistencias').insert([{ docente_id: docentePendiente.id, estado: 'asistio' }]);

    if (errorAsistencia) {
        if (errorAsistencia.code === '23505') { 
            mostrarAlerta(statusMsg, `⚠️ Ya hay un registro de hoy para ${docentePendiente.nombres}.`, "#f39c12", "white");
        } else {
            mostrarAlerta(statusMsg, "❌ Error al guardar.", "red", "white");
        }
    } else {
        mostrarAlerta(statusMsg, `✅ ¡Asistencia confirmada, ${docentePendiente.nombres}!`, "#27ae60", "white");
    }
    resetearKioscoUI();
});

document.getElementById('btn-no').addEventListener('click', () => {
    mostrarAlerta(statusMsg, "Operación cancelada. Intente de nuevo.", "#f39c12", "white");
    resetearKioscoUI();
});

function resetearKioscoUI() {
    docentePendiente = null; pinInput.value = "";
    bloqueConfirmacion.classList.add('hidden'); bloqueIngreso.classList.remove('hidden');
    pinInput.focus();
}

// =========================================================
// 5. PANEL DE ADMINISTRADOR
// =========================================================
const secNuevo = document.getElementById('sec-nuevo');
const secPermiso = document.getElementById('sec-permiso');
const secReporte = document.getElementById('sec-reporte');

const tabNuevo = document.getElementById('tab-nuevo');
const tabPermiso = document.getElementById('tab-permiso');
const tabReporte = document.getElementById('tab-reporte');

document.getElementById('btn-ir-admin').addEventListener('click', () => {
    kioscoContainer.classList.add('hidden');
    adminContainer.classList.remove('hidden');
    cambiarPestana(secNuevo, tabNuevo);
});

document.getElementById('btn-volver-kiosco').addEventListener('click', mostrarKiosco);

tabNuevo.addEventListener('click', () => cambiarPestana(secNuevo, tabNuevo));
tabPermiso.addEventListener('click', () => cambiarPestana(secPermiso, tabPermiso));
tabReporte.addEventListener('click', () => {
    cambiarPestana(secReporte, tabReporte);
    generarReporte();
});

function cambiarPestana(seccionActiva, tabActiva) {
    secNuevo.classList.add('hidden'); secPermiso.classList.add('hidden'); secReporte.classList.add('hidden');
    tabNuevo.className = 'btn-tab'; tabPermiso.className = 'btn-tab'; tabReporte.className = 'btn-tab';
    seccionActiva.classList.remove('hidden'); tabActiva.className = 'btn-tab active-tab';
}

// =========================================================
// 6. GESTIÓN (CRUD)
// =========================================================
document.getElementById('btn-guardar-docente').addEventListener('click', async () => {
    const inputNombres = document.getElementById('nuevo-nombres');
    const inputApellidos = document.getElementById('nuevo-apellidos');
    const adminMsg = document.getElementById('admin-msg');
    
    const nombres = inputNombres.value.trim(); const apellidos = inputApellidos.value.trim();
    if (!nombres || !apellidos) { adminMsg.innerHTML = "<span style='color:red;'>Completa ambos campos.</span>"; return; }
    
    adminMsg.innerHTML = "<span style='color:blue;'>Generando PIN único...</span>";
    let pinUnico = false; let nuevoPin = 0;
    while (!pinUnico) {
        nuevoPin = Math.floor(Math.random() * 900) + 100;
        const { data } = await clienteSupabase.from('docentes').select('id').eq('pin', nuevoPin);
        if (data && data.length === 0) pinUnico = true;
    }

    const { error: errInsert } = await clienteSupabase.from('docentes').insert([{ nombres, apellidos, pin: nuevoPin }]);
    if (errInsert) {
        adminMsg.innerHTML = "<span style='color:red;'>Error al guardar.</span>";
    } else {
        adminMsg.innerHTML = `✅ ¡Guardado!<br>PIN para <b>${nombres}</b>:<br><span style="font-size: 32px; color: #27ae60; display: block; margin-top: 10px;">${nuevoPin}</span>`;
        inputNombres.value = ""; inputApellidos.value = "";
    }
});

window.editarDocente = async function(id, nombresAct, apellidosAct) {
    const nuevosNombres = prompt("Editar Nombres:", nombresAct);
    if (nuevosNombres === null || nuevosNombres.trim() === "") return;
    
    const nuevosApellidos = prompt("Editar Apellidos:", apellidosAct);
    if (nuevosApellidos === null || nuevosApellidos.trim() === "") return;

    const { error } = await clienteSupabase.from('docentes')
        .update({ nombres: nuevosNombres.trim(), apellidos: nuevosApellidos.trim() }).eq('id', id);
    if (error) alert("Error al actualizar."); else generarReporte();
};

window.borrarDocente = async function(id, nombre) {
    const confirmacion = confirm(`⚠️ ¿Eliminar a ${nombre} y todo su historial de asistencias?`);
    if (!confirmacion) return;

    await clienteSupabase.from('asistencias').delete().eq('docente_id', id);
    const { error } = await clienteSupabase.from('docentes').delete().eq('id', id);
    if (error) alert("Error al eliminar."); else generarReporte();
};

// =========================================================
// 7. REGISTRO DE PERMISOS
// =========================================================
document.getElementById('btn-marcar-permiso').addEventListener('click', async () => {
    const pin = document.getElementById('pin-permiso').value.trim();
    const fecha = document.getElementById('fecha-permiso').value;
    const msg = document.getElementById('permiso-msg');
    
    if (pin.length !== 3) { mostrarAlerta(msg, "PIN debe tener 3 dígitos.", "transparent", "red"); return; }
    if (!fecha) { mostrarAlerta(msg, "Selecciona una fecha.", "transparent", "red"); return; }

    const [year, month, day] = fecha.split('-');
    if (new Date(year, month - 1, day).getDay() !== 6) { mostrarAlerta(msg, "❌ La fecha DEBE ser un sábado.", "transparent", "red"); return; }

    const { data: doc, error: errBusq } = await clienteSupabase.from('docentes').select('*').eq('pin', parseInt(pin)).single();
    if (errBusq || !doc) { mostrarAlerta(msg, "❌ PIN no existe.", "transparent", "red"); return; }

    const { error: errPerm } = await clienteSupabase.from('asistencias').insert([{ docente_id: doc.id, estado: 'permiso', fecha: fecha }]);
    if (errPerm) {
        if (errPerm.code === '23505') mostrarAlerta(msg, `⚠️ ${doc.nombres} ya tiene registro ese día.`, "#f39c12", "white");
        else mostrarAlerta(msg, "❌ Error de servidor.", "red", "white");
    } else {
        mostrarAlerta(msg, `✅ Permiso de ${doc.nombres} guardado para el ${day}/${month}.`, "#f39c12", "white");
        document.getElementById('pin-permiso').value = ""; document.getElementById('fecha-permiso').value = "";
    }
});

// =========================================================
// 8. REPORTES, MATRIZ EXCEL Y GRÁFICAS
// =========================================================
let miGrafico = null; 

async function generarReporte() {
    const tablaContainer = document.getElementById('tabla-excel-container');
    tablaContainer.innerHTML = "<p style='padding: 20px; font-weight: bold; color: #3498db;'>🔄 Cargando...</p>";

    const { data: docentes } = await clienteSupabase.from('docentes').select('*').order('apellidos', { ascending: true });
    const { data: asistencias } = await clienteSupabase.from('asistencias').select('*').order('fecha', { ascending: true });

    if (!docentes || !asistencias) { tablaContainer.innerHTML = "<p style='color: red;'>Error al cargar.</p>"; return; }

    const fechasUnicas = [...new Set(asistencias.map(a => a.fecha))];
    let globalAsis = 0; let globalPerm = 0; let globalFaltas = 0;

    let htmlTabla = `<table class="report-table" id="tabla-exportar">
                        <thead><tr>
                            <th>N°</th>
                            <th style="text-align: left;">Apellidos</th>
                            <th style="text-align: left;">Nombres</th>
                            <th>PIN</th>
                            <th>⚙️</th>`;
    fechasUnicas.forEach(f => { const p = f.split('-'); htmlTabla += `<th>${p[2]}/${p[1]}</th>`; });
    htmlTabla += `<th class="col-total">✅ Asist.</th><th class="col-total">⚠️ Perm.</th><th class="col-total">❌ Faltas</th></tr></thead><tbody>`;

    docentes.forEach((docente, index) => {
        let asis = 0; let perm = 0; let falta = 0;
        
        htmlTabla += `<tr>
                        <td>${index + 1}</td>
                        <td style="text-align: left;">${docente.apellidos}</td>
                        <td style="text-align: left;">${docente.nombres}</td>
                        <td>${docente.pin}</td>
                        <td>
                            <button onclick="editarDocente(${docente.id}, '${docente.nombres}', '${docente.apellidos}')" class="btn-primary btn-action" title="Editar">✏️</button>
                            <button onclick="borrarDocente(${docente.id}, '${docente.nombres}')" class="btn-danger btn-action" title="Eliminar">🗑️</button>
                        </td>`;

        fechasUnicas.forEach(fecha => {
            const registro = asistencias.find(a => a.docente_id === docente.id && a.fecha === fecha);
            if (registro) {
                if (registro.estado === 'asistio') { htmlTabla += `<td class="status-asistio">V</td>`; asis++; globalAsis++; } 
                else if (registro.estado === 'permiso') { htmlTabla += `<td class="status-permiso">P</td>`; perm++; globalPerm++; }
            } else { htmlTabla += `<td class="status-falta">F</td>`; falta++; globalFaltas++; }
        });
        htmlTabla += `<td class="col-total">${asis}</td><td class="col-total">${perm}</td><td class="col-total" style="color: #c0392b;">${falta}</td></tr>`;
    });

    htmlTabla += `</tbody></table>`;
    tablaContainer.innerHTML = htmlTabla;
    renderizarGrafica(globalAsis, globalPerm, globalFaltas);
}

function renderizarGrafica(asis, perm, faltas) {
    const ctx = document.getElementById('grafica-asistencia').getContext('2d');
    if (miGrafico) miGrafico.destroy();
    miGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Asistencias', 'Permisos', 'Faltas'], datasets: [{ data: [asis, perm, faltas], backgroundColor: ['#2ecc71', '#f39c12', '#e74c3c'], hoverOffset: 4 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Resumen Global' } } }
    });
}

// EXPORTAR A EXCEL (Ignorando la columna de acciones)
document.getElementById('btn-exportar-csv').addEventListener('click', () => {
    const tabla = document.getElementById('tabla-exportar');
    if (!tabla) return alert("Genera el reporte primero.");
    let csv = "data:text/csv;charset=utf-8,";
    
    tabla.querySelectorAll("tr").forEach(fila => {
        let arrayFila = [];
        fila.querySelectorAll("td, th").forEach((col, i) => {
            if (i === 4) return; // Índice 4 es la columna ⚙️ (Acciones). La omitimos.
            arrayFila.push(`"${col.innerText.replace(/(\r\n|\n|\r)/gm, "").trim()}"`);
        });
        csv += arrayFila.join(",") + "\r\n";
    });
    
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv)); link.setAttribute("download", "Reporte_Asistencia.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
});

// =========================================================
// 9. UTILIDADES
// =========================================================
function mostrarKiosco() {
    loginContainer.classList.add('hidden'); adminContainer.classList.add('hidden');
    kioscoContainer.classList.remove('hidden'); resetearKioscoUI();
}
function mostrarLogin() {
    loginContainer.classList.remove('hidden'); kioscoContainer.classList.add('hidden'); adminContainer.classList.add('hidden');
}
function mostrarAlerta(el, msg, bg, text) {
    el.textContent = msg; el.style.backgroundColor = bg; el.style.color = text;
    setTimeout(() => { el.textContent = ""; el.style.backgroundColor = "transparent"; }, 3500);
}

checkSession();