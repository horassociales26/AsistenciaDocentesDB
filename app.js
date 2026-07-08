// =========================================================
// 1. CONFIGURACIÓN DE SUPABASE (CON PERSISTENCIA FORZADA)
// =========================================================
const SUPABASE_URL = 'https://iamemtvpoguqveskpaaa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbWVtdHZwb2d1cXZlc2twYWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzY3MjIsImV4cCI6MjA5ODc1MjcyMn0.vdQTiZkCTsI61V1FbuLXMzJfbnz3n6LwGQ_E_GPmsXo';

// Forzamos explícitamente el uso de localStorage para evitar bloqueos en GitHub Pages
const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: window.localStorage 
    }
});

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
// 3. UTILIDADES (Cargadas al inicio para evitar errores)
// =========================================================
function resetearKioscoUI() { 
    docentePendiente = null; 
    pinInput.value = ""; 
    bloqueConfirmacion.classList.add('hidden'); 
    bloqueIngreso.classList.remove('hidden'); 
    pinInput.focus(); 
}

function mostrarKiosco() { 
    loginContainer.classList.add('hidden'); 
    adminContainer.classList.add('hidden'); 
    kioscoContainer.classList.remove('hidden'); 
    resetearKioscoUI(); 
}

function mostrarLogin() { 
    loginContainer.classList.remove('hidden'); 
    kioscoContainer.classList.add('hidden'); 
    adminContainer.classList.add('hidden'); 
}

function mostrarAlerta(el, msg, bg, txt) { 
    el.textContent = msg; 
    el.style.backgroundColor = bg; 
    el.style.color = txt; 
    setTimeout(() => el.textContent="", 3500); 
}

// =========================================================
// 4. CONTROL DE SESIÓN EN TIEMPO REAL (NUEVO)
// =========================================================
// Este observador reemplaza a la función checkSession(). 
// Se ejecuta automáticamente al abrir o recargar la página.
clienteSupabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        mostrarKiosco();
    } else {
        mostrarLogin();
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginMsg = document.getElementById('login-msg');
    loginMsg.textContent = "Verificando credenciales...";
    
    const { error } = await clienteSupabase.auth.signInWithPassword({ email, password });
    if (error) loginMsg.textContent = "Error: " + error.message; 
    else { loginMsg.textContent = ""; } // El onAuthStateChange hará el cambio visual automáticamente
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await clienteSupabase.auth.signOut(); 
    // El onAuthStateChange hará el cambio al login automáticamente
});

// =========================================================
// 5. LÓGICA DEL KIOSCO 
// =========================================================
document.getElementById('btn-marcar').addEventListener('click', verificarPIN);
pinInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') verificarPIN(); });

async function verificarPIN() {
    const pin = pinInput.value.trim();
    if (pin.length !== 3) { mostrarAlerta(statusMsg, "El PIN debe tener 3 dígitos.", "#ef4444", "white"); pinInput.focus(); return; }

    const ahora = new Date();
    const fechaLocal = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    
    if (ahora.getDay() !== 6) { mostrarAlerta(statusMsg, "El kiosco solo registra asistencias los sábados.", "#ef4444", "white"); pinInput.value = ""; pinInput.focus(); return; }
    if (ahora.getHours() < 6 || ahora.getHours() >= 13) { mostrarAlerta(statusMsg, "Horario finalizado (6 AM - 1 PM).", "#ef4444", "white"); pinInput.value = ""; pinInput.focus(); return; }

    const { data: diaSusp } = await clienteSupabase.from('dias_suspendidos').select('fecha').eq('fecha', fechaLocal);
    if (diaSusp && diaSusp.length > 0) { 
        mostrarAlerta(statusMsg, "Las clases están suspendidas el día de hoy.", "#f59e0b", "white"); 
        pinInput.value = ""; pinInput.focus(); return; 
    }

    const { data: docente, error } = await clienteSupabase.from('docentes').select('id, nombres, apellidos, estado_activo').eq('pin', parseInt(pin)).single();

    if (error || !docente) { mostrarAlerta(statusMsg, "PIN no encontrado.", "#ef4444", "white"); pinInput.value = ""; pinInput.focus(); return; }
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
        setTimeout(() => { document.getElementById('tarjeta-exito').classList.add('hidden'); resetearKioscoUI(); }, 3500);
    }
});

document.getElementById('btn-no').addEventListener('click', () => { mostrarAlerta(statusMsg, "Cancelado.", "#f59e0b", "white"); resetearKioscoUI(); });

// =========================================================
// 6. NAVEGACIÓN Y OPERATORIA DEL PANEL
// =========================================================
const secNuevo = document.getElementById('sec-nuevo'); const secReporte = document.getElementById('sec-reporte');
const tabNuevo = document.getElementById('tab-nuevo'); const tabReporte = document.getElementById('tab-reporte');

document.getElementById('btn-ir-admin').addEventListener('click', () => { kioscoContainer.classList.add('hidden'); adminContainer.classList.remove('hidden'); secNuevo.classList.add('hidden'); secReporte.classList.remove('hidden'); tabNuevo.classList.remove('active-tab'); tabReporte.classList.add('active-tab'); document.getElementById('admin-msg').innerHTML = ""; generarReporte(); });
document.getElementById('btn-volver-kiosco').addEventListener('click', mostrarKiosco);
tabReporte.addEventListener('click', () => { secNuevo.classList.add('hidden'); secReporte.classList.remove('hidden'); tabNuevo.classList.remove('active-tab'); tabReporte.classList.add('active-tab'); generarReporte(); });
tabNuevo.addEventListener('click', () => { secReporte.classList.add('hidden'); secNuevo.classList.remove('hidden'); tabReporte.classList.remove('active-tab'); tabNuevo.classList.add('active-tab'); document.getElementById('nuevo-nombres').value = ""; document.getElementById('nuevo-apellidos').value = ""; document.getElementById('admin-msg').innerHTML = ""; });

document.getElementById('btn-guardar-docente').addEventListener('click', async () => {
    const inputN = document.getElementById('nuevo-nombres'); const inputA = document.getElementById('nuevo-apellidos'); const msg = document.getElementById('admin-msg');
    if (!inputN.value.trim() || !inputA.value.trim()) { msg.innerHTML = "<span style='color:red;'>Complete ambos campos.</span>"; return; }
    
    msg.innerHTML = "<span style='color:var(--brand-blue);'>Generando código...</span>";
    let pinUnico = false; let nuevoPin = 0;
    while (!pinUnico) { nuevoPin = Math.floor(Math.random() * 900) + 100; const { data } = await clienteSupabase.from('docentes').select('id').eq('pin', nuevoPin); if (data && data.length === 0) pinUnico = true; }

    const { error } = await clienteSupabase.from('docentes').insert([{ nombres: inputN.value.trim(), apellidos: inputA.value.trim(), pin: nuevoPin, estado_activo: true }]);
    if (error) msg.innerHTML = "<span style='color:red;'>Error al guardar.</span>"; else { msg.innerHTML = `Registro exitoso. PIN Asignado: <span style="font-size:24px; color:#10b981; display:block; margin-top:5px; font-weight:bold;">${nuevoPin}</span>`; inputN.value = ""; inputA.value = ""; }
});

const modalEdicion = document.getElementById('modal-edicion');
const editId = document.getElementById('edit-id'); const editNombres = document.getElementById('edit-nombres'); const editApellidos = document.getElementById('edit-apellidos'); const editEstado = document.getElementById('edit-estado');

window.abrirModalEdicion = function(id, nombres, apellidos, estadoActivo) { editId.value = id; editNombres.value = nombres; editApellidos.value = apellidos; editEstado.value = estadoActivo ? "true" : "false"; modalEdicion.classList.remove('hidden'); };
document.getElementById('btn-cerrar-modal').addEventListener('click', () => modalEdicion.classList.add('hidden'));

document.getElementById('btn-guardar-edicion').addEventListener('click', async () => {
    const id = editId.value; const n = editNombres.value.trim(); const a = editApellidos.value.trim(); const estado = editEstado.value === "true";
    if(!n || !a) { alert("Los campos son obligatorios."); return; }
    document.getElementById('btn-guardar-edicion').textContent = "Guardando...";
    const { error } = await clienteSupabase.from('docentes').update({ nombres: n, apellidos: a, estado_activo: estado }).eq('id', id);
    document.getElementById('btn-guardar-edicion').textContent = "Guardar Cambios";
    if(error) alert("Error de conexión."); else { modalEdicion.classList.add('hidden'); generarReporte(); }
});

document.getElementById('btn-eliminar-docente').addEventListener('click', async () => {
    abrirModalConfirmacion("¿Eliminar docente?", `¿Desea eliminar a este docente y todo su historial de forma permanente?`, async () => {
        document.getElementById('btn-eliminar-docente').textContent = "Borrando...";
        await clienteSupabase.from('asistencias').delete().eq('docente_id', editId.value);
        await clienteSupabase.from('docentes').delete().eq('id', editId.value);
        document.getElementById('btn-eliminar-docente').textContent = "Eliminar";
        modalEdicion.classList.add('hidden'); generarReporte();
    });
});

// =========================================================
// 7. GENERACIÓN DE MATRIZ DINÁMICA
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
    cont.innerHTML = "<p style='padding: 20px; font-weight: 600; color: var(--slate-500);'>Cargando registros...</p>";

    const { data: docentes } = await clienteSupabase.from('docentes').select('*').order('apellidos', { ascending: true });
    const { data: asistencias } = await clienteSupabase.from('asistencias').select('*');
    const { data: diasSusp } = await clienteSupabase.from('dias_suspendidos').select('fecha');
    
    if (!docentes) { cont.innerHTML = "<p style='color:red;'>Error de conexión.</p>"; return; }

    const arrayDiasSuspendidos = diasSusp ? diasSusp.map(d => d.fecha) : [];
    const fechas = obtenerSabados();
    const hoyStr = new Date().toISOString().split('T')[0];
    
    let sabadoObjetivo = fechas[fechas.length - 1]; 
    for (let i = 0; i < fechas.length; i++) { if (fechas[i] >= hoyStr) { sabadoObjetivo = fechas[i]; break; } }

    let gA = 0, gP = 0, gF = 0;

    let html = `<table class="matrix-table" id="tabla-exportar"><thead><tr>
        <th class="col-fija fix-1">N°</th>
        <th class="col-fija fix-2">Docente</th>
        <th class="col-fija fix-3">PIN</th>
        <th class="col-fija fix-4">A</th>
        <th class="col-fija fix-5">P</th>
        <th class="col-fija fix-6">F</th>
        <th class="col-fija fix-7"></th>`;
    
    fechas.forEach(f => {
        const d = f.split('-');
        const dateObj = new Date(d[0], d[1]-1, d[2]);
        const mes = dateObj.toLocaleString('es-ES', {month: 'short'}).substring(0,3).toUpperCase();
        const isSuspendido = arrayDiasSuspendidos.includes(f);
        
        const btnToggle = isSuspendido 
            ? `<button onclick="toggleDiaSuspendido('${f}', true)" class="btn-reactivar" title="Reactivar sábado">✅ React.</button>`
            : `<button onclick="toggleDiaSuspendido('${f}', false)" class="btn-suspender" title="Suspender sábado">🚫 Susp.</button>`;

        html += `<th class="${f === sabadoObjetivo ? 'col-actual' : ''}">
            <div class="date-header"><span class="mes">${mes}</span><span class="dia">${d[2]}</span></div>
            ${btnToggle}
        </th>`;
    });
    html += `</tr></thead><tbody>`;

    docentes.forEach((doc, i) => {
        let a = 0, p = 0, f = 0;
        const inact = doc.estado_activo === false ? "fila-inactiva" : "";
        const badgeInactivo = doc.estado_activo === false ? `<span class="badge-inactivo">INACTIVO</span>` : "";
        const nombreCompleto = `${doc.apellidos}, ${doc.nombres}`;

        let celdasFechas = "";
        fechas.forEach(fecha => {
            const isSuspendido = arrayDiasSuspendidos.includes(fecha);
            const reg = asistencias.find(x => x.docente_id === doc.id && x.fecha === fecha);
            let val = 'falta', cls = 'f';
            
            if (reg) {
                if (reg.estado === 'asistio') { val = 'asistio'; cls = 'a'; if(!isSuspendido) a++; }
                else if (reg.estado === 'permiso') { val = 'permiso'; cls = 'p'; if(!isSuspendido) p++; }
            } else { 
                if(!isSuspendido) f++; 
            }

            if (isSuspendido) {
                celdasFechas += `<td class="${fecha === sabadoObjetivo ? 'celda-actual' : ''}"><span class="badge-suspendida">-</span></td>`;
            } else {
                celdasFechas += `<td class="${fecha === sabadoObjetivo ? 'celda-actual' : ''}">
                    <select class="select-asistencia ${cls}" data-fecha="${fecha}" onchange="cambiarEstadoCelda(${doc.id}, '${fecha}', this.value, this)" ${!doc.estado_activo ? 'disabled' : ''}>
                        <option value="asistio" ${val === 'asistio' ? 'selected' : ''}>A</option>
                        <option value="permiso" ${val === 'permiso' ? 'selected' : ''}>P</option>
                        <option value="falta" ${val === 'falta' ? 'selected' : ''}>F</option>
                    </select>
                </td>`;
            }
        });

        gA += a; gP += p; gF += f;
        const btnEditar = `<button onclick="abrirModalEdicion(${doc.id}, '${doc.nombres}', '${doc.apellidos}', ${doc.estado_activo})" class="btn-manage" title="Ajustes">⚙️ Ajustes</button>`;

        html += `<tr class="${inact}">
            <td class="col-fija fix-1">${i + 1}</td>
            <td class="col-fija fix-2" title="${nombreCompleto}"><div style="display: flex; justify-content: space-between; align-items: center; width: 100%;"><span style="overflow: hidden; text-overflow: ellipsis;">${nombreCompleto}</span>${badgeInactivo}</div></td>
            <td class="col-fija fix-3">${doc.pin}</td>
            <td class="col-fija fix-4 val-a">${a}</td>
            <td class="col-fija fix-5 val-p">${p}</td>
            <td class="col-fija fix-6 val-f">${f}</td>
            <td class="col-fija fix-7">${btnEditar}</td>
            ${celdasFechas}
        </tr>`;
    });

    html += `</tbody><tfoot><tr>
        <th class="col-fija fix-1 footer-fixed"></th>
        <th class="col-fija fix-2 footer-fixed"></th>
        <th class="col-fija fix-3 footer-fixed"></th>
        <th class="col-fija fix-4 footer-fixed"></th>
        <th class="col-fija fix-5 footer-fixed"></th>
        <th class="col-fija fix-6 footer-fixed"></th>
        <th class="col-fija fix-7 footer-fixed" style="text-align: right; padding-right: 10px; color: var(--slate-600); font-size: 10px;">TOTALES:</th>`;
    
    fechas.forEach(fecha => {
        const isSuspendido = arrayDiasSuspendidos.includes(fecha);
        if (isSuspendido) {
            html += `<td class="celda-totales" data-footer-fecha="${fecha}"><div style="color: var(--slate-400); text-align: center;">-</div></td>`;
        } else {
            html += `<td class="celda-totales" data-footer-fecha="${fecha}"></td>`; 
        }
    });
    
    html += `</tr></tfoot></table>`; 
    cont.innerHTML = html;
    
    actualizarTotalesDOM();

    setTimeout(() => { const col = document.querySelector('.col-actual'); if (col) col.scrollIntoView({ behavior: 'smooth', inline: 'center' }); }, 300);
}

// =========================================================
// 8. ARQUITECTURA DE "UI OPTIMISTA" (FLUJO SILENCIOSO)
// =========================================================
window.cambiarEstadoCelda = async function(id, fecha, estado, selectElement) {
    const cls = estado === 'asistio' ? 'a' : (estado === 'permiso' ? 'p' : 'f');
    selectElement.className = `select-asistencia ${cls}`;

    actualizarTotalesDOM();

    await clienteSupabase.from('asistencias').delete().eq('docente_id', id).eq('fecha', fecha);
    if (estado !== 'falta') {
        await clienteSupabase.from('asistencias').insert([{ docente_id: id, fecha: fecha, estado: estado, hora: "13:00:00" }]);
    }
};

function actualizarTotalesDOM() {
    let globalA = 0, globalP = 0, globalF = 0;
    
    document.querySelectorAll('#tabla-exportar tbody tr').forEach(fila => {
        let a = 0, p = 0, f = 0;
        fila.querySelectorAll('.select-asistencia').forEach(sel => {
            if (sel.value === 'asistio') a++;
            else if (sel.value === 'permiso') p++;
            else if (sel.value === 'falta') f++;
        });
        
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
            selects.forEach(sel => {
                if (sel.value === 'asistio') a++;
                else if (sel.value === 'permiso') p++;
                else if (sel.value === 'falta') f++;
            });
            cell.innerHTML = `<div class="mini-card-totales"><span class="m-badge a">A: ${a}</span><span class="m-badge p">P: ${p}</span><span class="m-badge f">F: ${f}</span></div>`;
        }
    });

    dibujarGrafica(globalA, globalP, globalF);
}

// =========================================================
// 9. MODAL MODERNO DE CONFIRMACIÓN 
// =========================================================
const modalConfirm = document.getElementById('modal-confirmacion');
const btnConfirmOk = document.getElementById('btn-confirm-ok');
const btnConfirmCancelar = document.getElementById('btn-confirm-cancelar');
let confirmCallback = null;

function abrirModalConfirmacion(titulo, mensaje, callback) {
    document.getElementById('modal-confirm-titulo').textContent = titulo;
    document.getElementById('modal-confirm-mensaje').textContent = mensaje;
    confirmCallback = callback;
    modalConfirm.classList.remove('hidden');
}

btnConfirmCancelar.addEventListener('click', () => { modalConfirm.classList.add('hidden'); confirmCallback = null; });
btnConfirmOk.addEventListener('click', () => { 
    modalConfirm.classList.add('hidden'); 
    if (confirmCallback) confirmCallback(); 
});

window.toggleDiaSuspendido = function(fecha, isSuspended) {
    if (isSuspended) {
        abrirModalConfirmacion(
            `¿Reactivar el ${fecha}?`, 
            `Se quitará el bloqueo del calendario y se restaurarán los estados guardados sin alterar el historial.`, 
            async () => {
                document.getElementById('tabla-excel-container').innerHTML = "<p style='padding: 20px; color: #10b981;'>Reactivando día...</p>";
                await clienteSupabase.from('dias_suspendidos').delete().eq('fecha', fecha);
                generarReporte();
            }
        );
    } else {
        abrirModalConfirmacion(
            `¿Suspender el ${fecha}?`, 
            `Se deshabilitará el Kiosco ese día y se inmovilizarán las celdas. Los datos originales se conservarán protegidos.`, 
            async () => {
                document.getElementById('tabla-excel-container').innerHTML = "<p style='padding: 20px; color: #f59e0b;'>Suspendiendo día...</p>";
                await clienteSupabase.from('dias_suspendidos').insert([{ fecha: fecha }]);
                generarReporte();
            }
        );
    }
};

// =========================================================
// 10. BUSCADOR, GRÁFICA Y EXPORTACIÓN COMPLETA
// =========================================================
document.getElementById('buscador-docente').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#tabla-exportar tbody tr').forEach(fila => { fila.classList.toggle('hidden', !fila.innerText.toLowerCase().includes(term)); });
});

function dibujarGrafica(a, p, f) {
    const ctx = document.getElementById('grafica-asistencia').getContext('2d');
    if (miGrafico) miGrafico.destroy();
    miGrafico = new Chart(ctx, { type: 'doughnut', data: { labels: ['Asistencias', 'Permisos', 'Faltas'], datasets: [{ data: [a, p, f], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'] }] }, options: { plugins: { legend: { position: 'bottom' } } } });
}

document.getElementById('btn-exportar-csv').addEventListener('click', () => {
    const tabla = document.getElementById('tabla-exportar'); 
    if (!tabla) return alert("Por favor, espere a que la tabla cargue primero.");
    
    let dataMatriz = [];
    tabla.querySelectorAll("thead tr, tbody tr").forEach(fila => {
        let arrayFila = [];
        fila.querySelectorAll("td, th").forEach((c, i) => {
            if (i === 6) return; 
            if (fila.closest('thead')) { arrayFila.push(c.innerText.replace(/🚫 Susp\./g, '').replace(/✅ React\./g, '').replace(/\n/g, ' ').trim()); return; }
            
            const sel = c.querySelector('select');
            const badgeSuspendida = c.querySelector('.badge-suspendida');
            
            let valorCelda = '';
            if (sel) { valorCelda = sel.value === 'asistio' ? 'A' : sel.value === 'permiso' ? 'P' : 'F'; } 
            else if (badgeSuspendida) { valorCelda = '-'; } 
            else { valorCelda = c.innerText.replace(/\n/g, '').trim(); }
            
            if (i === 1) valorCelda = valorCelda.replace("INACTIVO", "").trim();
            arrayFila.push(valorCelda);
        });
        dataMatriz.push(arrayFila);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataMatriz);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.setAttribute("download", "Matriz_Asistencias.xlsx");
    document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
});