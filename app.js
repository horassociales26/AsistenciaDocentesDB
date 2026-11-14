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
let fechaObjetivoActual = null;
let docentePendiente = null;

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

// =========================================================
// 3. SINTETIZADOR DE AUDIO (FEEDBACK KIOSCO)
// =========================================================
window.miAudioCtx = window.miAudioCtx || null; 

function emitirSonido(tipo) {
    if (!window.miAudioCtx) {
        window.miAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (window.miAudioCtx.state === 'suspended') window.miAudioCtx.resume();
    
    const ahora = window.miAudioCtx.currentTime;
    if (tipo === 'exito') {
        const osc = window.miAudioCtx.createOscillator();
        const ganancia = window.miAudioCtx.createGain();
        osc.connect(ganancia); 
        ganancia.connect(window.miAudioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(784, ahora);
        ganancia.gain.setValueAtTime(0.001, ahora);
        ganancia.gain.exponentialRampToValueAtTime(0.15, ahora + 0.02);
        ganancia.gain.exponentialRampToValueAtTime(0.001, ahora + 0.22);
        osc.start(ahora);
        osc.stop(ahora + 0.25);
    } else if (tipo === 'graduacion') {
        // Fanfarria alegre ascendente: Do5 -> Mi5 -> Sol5 -> Do6
        const notas = [523.25, 659.25, 783.99, 1046.50];
        notas.forEach((freq, idx) => {
            const o = window.miAudioCtx.createOscillator();
            const g = window.miAudioCtx.createGain();
            o.type = 'triangle';
            o.frequency.setValueAtTime(freq, ahora + idx * 0.07);
            g.connect(window.miAudioCtx.destination);
            o.connect(g);
            g.gain.setValueAtTime(0.001, ahora + idx * 0.07);
            g.gain.exponentialRampToValueAtTime(0.18, ahora + idx * 0.07 + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, ahora + idx * 0.07 + 0.22);
            o.start(ahora + idx * 0.07);
            o.stop(ahora + idx * 0.07 + 0.25);
        });
    } else if (tipo === 'error') {
        const osc = window.miAudioCtx.createOscillator();
        const ganancia = window.miAudioCtx.createGain();
        osc.connect(ganancia); 
        ganancia.connect(window.miAudioCtx.destination);
        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(300, window.miAudioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, window.miAudioCtx.currentTime + 0.2);
        ganancia.gain.setValueAtTime(0.15, window.miAudioCtx.currentTime); 
        ganancia.gain.exponentialRampToValueAtTime(0.01, window.miAudioCtx.currentTime + 0.2);
        osc.start(); 
        osc.stop(window.miAudioCtx.currentTime + 0.2);
    }
}

// =========================================================
// 3.1 ANIMACIÓN FESTIVA DE SERPENTINAS Y CONFETI (GRADUACIÓN)
// =========================================================
function lanzarSerpentinas() {
    const canvasViejo = document.getElementById('canvas-serpentina');
    if (canvasViejo) canvasViejo.remove();

    const canvas = document.createElement('canvas');
    canvas.id = 'canvas-serpentina';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const width = canvas.width = window.innerWidth;
    const height = canvas.height = window.innerHeight;

    const colores = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#facc15', '#06b6d4'];
    const particulas = [];
    const NUM_CONFETI = 60;
    const NUM_SERPENTINAS = 28;

    for (let i = 0; i < NUM_CONFETI; i++) {
        const origenIzq = Math.random() < 0.5;
        particulas.push({
            tipo: 'confeti',
            x: origenIzq ? width * 0.15 + (Math.random() * 60) : width * 0.85 - (Math.random() * 60),
            y: height * 0.9,
            vx: origenIzq ? (Math.random() * 8 + 4) : -(Math.random() * 8 + 4),
            vy: -(Math.random() * 14 + 10),
            size: Math.random() * 8 + 6,
            color: colores[Math.floor(Math.random() * colores.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 12,
            oscillation: Math.random() * 2 * Math.PI,
            oscillationSpeed: Math.random() * 0.12 + 0.06,
            opacity: 1
        });
    }

    for (let i = 0; i < NUM_SERPENTINAS; i++) {
        const origenIzq = Math.random() < 0.5;
        particulas.push({
            tipo: 'serpentina',
            x: origenIzq ? width * 0.15 : width * 0.85,
            y: height * 0.9,
            vx: origenIzq ? (Math.random() * 7 + 3) : -(Math.random() * 7 + 3),
            vy: -(Math.random() * 15 + 11),
            ancho: Math.random() * 3 + 3,
            color: colores[Math.floor(Math.random() * colores.length)],
            wave: Math.random() * 10,
            waveSpeed: Math.random() * 0.14 + 0.08,
            puntos: [],
            opacity: 1
        });
    }

    const inicio = performance.now();
    const duracionMs = 2800; // 2.8 segundos (animación ligera y ágil)
    let animId = null;

    function animar(ahoraT) {
        const transcurrido = ahoraT - inicio;
        if (transcurrido > duracionMs) {
            cancelAnimationFrame(animId);
            canvas.remove();
            return;
        }

        const progreso = transcurrido / duracionMs;
        const fade = progreso > 0.65 ? (1 - progreso) / 0.35 : 1;

        ctx.clearRect(0, 0, width, height);

        particulas.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.42; // Gravedad suave
            p.vx *= 0.985; // Fricción suave del aire

            ctx.globalAlpha = Math.max(0, fade * p.opacity);

            if (p.tipo === 'confeti') {
                p.rotation += p.rotationSpeed;
                p.oscillation += p.oscillationSpeed;
                const scaleX = Math.cos(p.oscillation);

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.scale(scaleX, 1);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
                ctx.restore();
            } else if (p.tipo === 'serpentina') {
                p.wave += p.waveSpeed;
                p.puntos.push({ x: p.x, y: p.y });
                if (p.puntos.length > 9) p.puntos.shift();

                if (p.puntos.length > 1) {
                    ctx.save();
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = p.ancho;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(p.puntos[0].x, p.puntos[0].y);
                    for (let j = 1; j < p.puntos.length; j++) {
                        const waveOffsetX = Math.sin(p.wave + j) * 8;
                        ctx.lineTo(p.puntos[j].x + waveOffsetX, p.puntos[j].y);
                    }
                    ctx.stroke();
                    ctx.restore();
                }
            }
        });

        animId = requestAnimationFrame(animar);
    }

    animId = requestAnimationFrame(animar);
}
window.lanzarSerpentinas = lanzarSerpentinas;

// =========================================================
// 4. SEGURIDAD Y CONTROL DE SESIÓN (GOD MODE)
// =========================================================
const TIEMPO_EXPIRACION_MINUTOS = 15;
function actualizarActividad() { localStorage.setItem('ultima_actividad', Date.now()); }

function evaluarRolYMostrar(sessionEmail) {
    emailUsuarioActual = sessionEmail;
    if (emailUsuarioActual === CORREO_ADMIN_GOD) {
        if(document.getElementById('tab-logs')) document.getElementById('tab-logs').style.display = 'block';
        if(document.getElementById('tab-godmode')) document.getElementById('tab-godmode').style.display = 'block';
        if(document.getElementById('btn-eliminar-docente')) document.getElementById('btn-eliminar-docente').style.display = 'block'; 
    } else {
        if(document.getElementById('tab-logs')) document.getElementById('tab-logs').style.display = 'none';
        if(document.getElementById('tab-godmode')) document.getElementById('tab-godmode').style.display = 'none';
        if(document.getElementById('btn-eliminar-docente')) document.getElementById('btn-eliminar-docente').style.display = 'none'; 
    }
}

async function validarSeguridadUsuario(email) {
    const emailLimpio = email.toLowerCase().trim();
    let { data, error } = await clienteSupabase.from('estado_usuarios').select('estado_activo').eq('email', emailLimpio).maybeSingle();
    if (error) return false; // Ante la duda o error de red, bloqueamos por seguridad
    if (data) return data.estado_activo; 
    return true; 
}

async function interceptarBaneados() {
    if (emailUsuarioActual === "Desconocido") return false;
    const esActivo = await validarSeguridadUsuario(emailUsuarioActual);
    if (!esActivo) {
        await clienteSupabase.auth.signOut();
        localStorage.removeItem('ultima_actividad');
        mostrarLogin();
        mostrarAlerta(document.getElementById('login-msg'), "Acceso denegado: Tu cuenta ha sido suspendida.", "#ef4444", "white");
        return true;
    }
    return false;
}

async function verificarSesionInicial() {
    const { data: { session } } = await clienteSupabase.auth.getSession();
    
    if (session) {
        const esActivo = await validarSeguridadUsuario(session.user.email);
        if (!esActivo) {
            await clienteSupabase.auth.signOut();
            localStorage.removeItem('ultima_actividad');
            mostrarLogin();
            mostrarAlerta(document.getElementById('login-msg'), "Tu cuenta ha sido suspendida temporalmente.", "#ef4444", "white");
            return; 
        }

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

clienteSupabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
        const esActivo = await validarSeguridadUsuario(session.user.email);
        if (!esActivo) {
            await clienteSupabase.auth.signOut();
            mostrarLogin();
            mostrarAlerta(document.getElementById('login-msg'), "Cuenta suspendida.", "#ef4444", "white");
            return;
        }
        actualizarActividad();
        evaluarRolYMostrar(session.user.email);
        const vista = localStorage.getItem('vista_actual');
        if (vista === 'admin') irAlAdminPanel(); else mostrarKiosco();
    } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('ultima_actividad'); localStorage.removeItem('vista_actual');
        emailUsuarioActual = "Desconocido";
        if(document.getElementById('tab-logs')) document.getElementById('tab-logs').style.display = 'none';
        if(document.getElementById('tab-godmode')) document.getElementById('tab-godmode').style.display = 'none';
        if(document.getElementById('btn-eliminar-docente')) document.getElementById('btn-eliminar-docente').style.display = 'none';
        mostrarLogin();
    }
});

document.addEventListener('click', () => { if (!loginContainer.classList.contains('hidden')) return; actualizarActividad(); });

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginMsg = document.getElementById('login-msg');
    
    if (!email || !password) { loginMsg.textContent = "Ingrese correo y contraseña."; return; }
    loginMsg.textContent = "Revisando seguridad...";
    
    const esActivo = await validarSeguridadUsuario(email);
    if (!esActivo) { loginMsg.textContent = "Tu cuenta ha sido suspendida temporalmente."; return; }
    
    loginMsg.textContent = "Verificando credenciales...";
    const { error } = await clienteSupabase.auth.signInWithPassword({ email, password });
    
    if (error) { 
        loginMsg.textContent = "Error: " + error.message; 
    } else { 
        // Si el usuario acaba de entrar y no estaba en la tabla de God Mode, lo registramos.
        const { data } = await clienteSupabase.from('estado_usuarios').select('email').eq('email', email.toLowerCase()).maybeSingle();
        if(!data) await clienteSupabase.from('estado_usuarios').insert([{ email: email.toLowerCase(), estado_activo: true }]);

        loginMsg.textContent = ""; 
        localStorage.setItem('vista_actual', 'admin'); 
        registrarLog("Inició sesión en el sistema."); 
    }
});

document.getElementById('btn-logout').addEventListener('click', async () => { registrarLog("Cerró sesión manualmente."); await clienteSupabase.auth.signOut(); });

function resetearKioscoUI() { docentePendiente = null; pinInput.value = ""; bloqueConfirmacion.classList.add('hidden'); bloqueIngreso.classList.remove('hidden'); pinInput.focus(); }
function mostrarKiosco() { loginContainer.classList.add('hidden'); adminContainer.classList.add('hidden'); kioscoContainer.classList.remove('hidden'); resetearKioscoUI(); }
function mostrarLogin() { loginContainer.classList.remove('hidden'); kioscoContainer.classList.add('hidden'); adminContainer.classList.add('hidden'); }
function mostrarAlerta(el, msg, bg, txt) { el.textContent = msg; el.style.backgroundColor = bg; el.style.color = txt; setTimeout(() => el.textContent="", 3500); }

// =========================================================
// 5. BITÁCORA, LOGS Y CONTRASEÑA
// =========================================================
async function registrarLog(accion) {
    if (emailUsuarioActual === "Desconocido") return;
    try { await clienteSupabase.from('registro_logs').insert([{ usuario: emailUsuarioActual, accion: accion }]); } 
    catch (err) { console.error("Error log", err); }
}

async function cargarAuditoria() {
    const tbody = document.getElementById('tabla-logs-body');
    if(!tbody) return;
    tbody.innerHTML = "<tr><td colspan='3' style='padding:20px; text-align:center;'>Cargando bitácora...</td></tr>";
    document.getElementById('buscador-logs').value = "";
    
    const { data, error } = await clienteSupabase.from('registro_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) { tbody.innerHTML = "<tr><td colspan='3' style='color:red;'>Error de conexión.</td></tr>"; return; }
    if (data.length === 0) { tbody.innerHTML = "<tr><td colspan='3'>No hay registros.</td></tr>"; return; }

    let html = "";
    data.forEach(log => {
        const fecha = new Date(log.created_at);
        const formatFecha = `${fecha.toLocaleDateString('es-SV')} - ${fecha.toLocaleTimeString('es-SV', { hour12: true })}`;
        html += `<tr><td style="text-align: left; padding-left: 15px; color: var(--slate-500); width: 170px;">${formatFecha}</td><td style="text-align: left; font-weight: bold; color: var(--slate-800); width: 220px;">${log.usuario}</td><td style="text-align: left;">${log.accion}</td></tr>`;
    });
    tbody.innerHTML = html;
}

document.getElementById('buscador-logs').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#tabla-logs-body tr').forEach(fila => {
        if (fila.cells.length < 3) return;
        const usuario = fila.cells[1].textContent.toLowerCase();
        fila.classList.toggle('hidden', !usuario.includes(term));
    });
});

const modalPwd = document.getElementById('modal-pwd');
document.getElementById('btn-abrir-pwd').addEventListener('click', () => { document.getElementById('pwd-actual').value = ""; document.getElementById('pwd-nueva').value = ""; document.getElementById('pwd-msg').innerHTML = ""; modalPwd.classList.remove('hidden'); });
document.getElementById('btn-cerrar-pwd').addEventListener('click', () => modalPwd.classList.add('hidden'));

document.getElementById('btn-guardar-pwd').addEventListener('click', async () => {
    const actual = document.getElementById('pwd-actual').value; const nueva = document.getElementById('pwd-nueva').value; const msg = document.getElementById('pwd-msg');
    if (!actual || !nueva) { msg.innerHTML = "<span style='color:red;'>Complete ambos campos.</span>"; return; }
    if (nueva.length < 6) { msg.innerHTML = "<span style='color:red;'>Mínimo 6 caracteres.</span>"; return; }
    msg.innerHTML = "<span style='color:var(--brand-blue);'>Verificando...</span>"; document.getElementById('btn-guardar-pwd').disabled = true;
    
    const { error: errVerify } = await clienteSupabase.auth.signInWithPassword({ email: emailUsuarioActual, password: actual });
    if (errVerify) { msg.innerHTML = "<span style='color:red;'>Clave actual incorrecta.</span>"; document.getElementById('btn-guardar-pwd').disabled = false; return; }
    
    const { error: errUpdate } = await clienteSupabase.auth.updateUser({ password: nueva });
    document.getElementById('btn-guardar-pwd').disabled = false;
    if (errUpdate) msg.innerHTML = "<span style='color:red;'>Error al actualizar.</span>";
    else { registrarLog("Actualizó su propia contraseña."); msg.innerHTML = "<span style='color:#10b981; font-weight:bold;'>¡Éxito!</span>"; setTimeout(() => { modalPwd.classList.add('hidden'); }, 2000); }
});

// =========================================================
// 6. LÓGICA DEL KIOSCO (MARCAR ASISTENCIA)
// =========================================================
document.getElementById('btn-marcar').addEventListener('click', verificarPIN);
pinInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') verificarPIN(); });

async function verificarPIN() {
    if (await interceptarBaneados()) return;
    const pin = pinInput.value.trim();
    if (pin.length !== 3) { emitirSonido('error'); mostrarAlerta(statusMsg, "El código debe tener 3 dígitos (ej. 001).", "#ef4444", "white"); pinInput.focus(); return; }

    const ahora = new Date();
    const fechaLocal = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    
    if (ahora.getDay() !== 6) { emitirSonido('error'); mostrarAlerta(statusMsg, "Solo sábados.", "#ef4444", "white"); pinInput.value = ""; pinInput.focus(); return; }
    
    const esGraduacion = fechaLocal === '2026-11-14';
    const horaLimite = esGraduacion ? 21 : 13;
    if (ahora.getHours() < 6 || ahora.getHours() >= horaLimite) { 
        emitirSonido('error'); 
        mostrarAlerta(statusMsg, esGraduacion ? "Horario de Graduación finalizado (6 AM - 9 PM)." : "Horario finalizado (6 AM - 1 PM).", "#ef4444", "white"); 
        pinInput.value = ""; 
        pinInput.focus(); 
        return; 
    }

    const { data: diaSusp } = await clienteSupabase.from('dias_suspendidos').select('fecha').eq('fecha', fechaLocal);
    if ((diaSusp && diaSusp.length > 0) || fechaLocal === '2026-11-07') { emitirSonido('error'); mostrarAlerta(statusMsg, "Clases suspendidas (Asueto).", "#f59e0b", "white"); pinInput.value = ""; pinInput.focus(); return; }

    const { data: docente, error } = await clienteSupabase.from('docentes').select('id, nombres, apellidos, estado_activo').eq('pin', parseInt(pin, 10)).single();
    if (error || !docente) { emitirSonido('error'); mostrarAlerta(statusMsg, "Código no encontrado.", "#ef4444", "white"); pinInput.value = ""; pinInput.focus(); return; }
    if (!docente.estado_activo) { emitirSonido('error'); mostrarAlerta(statusMsg, "Usuario inactivo.", "#f59e0b", "white"); pinInput.value = ""; pinInput.focus(); return; }

    docentePendiente = docente;
    document.getElementById('nombre-confirmacion').textContent = `${docente.nombres} ${docente.apellidos}`;
    bloqueIngreso.classList.add('hidden'); bloqueConfirmacion.classList.remove('hidden');
}

document.getElementById('btn-si').addEventListener('click', async () => {
    if (!docentePendiente) return;
    const ahora = new Date();
    const fechaLocal = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const horaAmigable = ahora.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: true });

    const esGraduacion = fechaLocal === '2026-11-14';

    const { error } = await clienteSupabase.from('asistencias').insert([{ docente_id: docentePendiente.id, estado: 'asistio', fecha: fechaLocal, hora: ahora.toTimeString().split(' ')[0] }]);

    if (error) {
        emitirSonido('error');
        if (error.code === '23505') mostrarAlerta(statusMsg, `Ya hay registro para hoy.`, "#f59e0b", "white");
        else mostrarAlerta(statusMsg, "Error de servidor.", "#ef4444", "white");
        resetearKioscoUI();
    } else {
        if (esGraduacion) {
            emitirSonido('graduacion');
            lanzarSerpentinas();
        } else {
            emitirSonido('exito');
        }

        bloqueConfirmacion.classList.add('hidden');
        const elNombre = document.getElementById('exito-nombre');
        const elHora = document.getElementById('exito-hora');
        
        if (esGraduacion) {
            elNombre.innerHTML = `🎓 ¡Felicidades! ${docentePendiente.nombres} 🎓<br><span style="font-size:14px; font-weight:normal; opacity:0.95;">Asistencia de Graduación Registrada</span>`;
        } else {
            elNombre.textContent = `${docentePendiente.nombres}`;
        }
        elHora.textContent = `Entrada: ${horaAmigable}`;

        document.getElementById('tarjeta-exito').classList.remove('hidden');
        registrarLog(`Validó PIN y marcó ASISTENCIA ${esGraduacion ? '(GRADUACIÓN)' : ''}: ${docentePendiente.nombres} ${docentePendiente.apellidos}`);
        setTimeout(() => { 
            document.getElementById('tarjeta-exito').classList.add('hidden'); 
            resetearKioscoUI(); 
        }, esGraduacion ? 2800 : 3500);
    }
});

document.getElementById('btn-no').addEventListener('click', () => { mostrarAlerta(statusMsg, "Cancelado.", "#f59e0b", "white"); resetearKioscoUI(); });

// =========================================================
// 7. NAVEGACIÓN Y OPERATORIA DEL PANEL MAESTRO
// =========================================================
const secNuevo = document.getElementById('sec-nuevo'); 
const secReporte = document.getElementById('sec-reporte');
const secLogs = document.getElementById('sec-logs');
const secPermiso = document.getElementById('sec-permiso');
const secGodMode = document.getElementById('sec-godmode');

const tabNuevo = document.getElementById('tab-nuevo'); 
const tabReporte = document.getElementById('tab-reporte');
const tabLogs = document.getElementById('tab-logs');
const tabPermiso = document.getElementById('tab-permiso'); 
const tabGodMode = document.getElementById('tab-godmode');

function ocultarTodasLasSecciones() {
    if(secNuevo) secNuevo.classList.add('hidden'); 
    if(secReporte) secReporte.classList.add('hidden'); 
    if(secLogs) secLogs.classList.add('hidden'); 
    if(secPermiso) secPermiso.classList.add('hidden'); 
    if(secGodMode) secGodMode.classList.add('hidden');
    
    if(tabNuevo) tabNuevo.classList.remove('active-tab'); 
    if(tabReporte) tabReporte.classList.remove('active-tab'); 
    if(tabLogs) tabLogs.classList.remove('active-tab'); 
    if(tabPermiso) tabPermiso.classList.remove('active-tab'); 
    if(tabGodMode) tabGodMode.classList.remove('active-tab');
}

function irAlAdminPanel() {
    loginContainer.classList.add('hidden'); kioscoContainer.classList.add('hidden'); adminContainer.classList.remove('hidden'); 
    ocultarTodasLasSecciones();
    if(secReporte) secReporte.classList.remove('hidden'); 
    if(tabReporte) tabReporte.classList.add('active-tab'); 
    document.getElementById('admin-msg').innerHTML = ""; generarReporte();
    localStorage.setItem('vista_actual', 'admin');
}

document.getElementById('btn-ir-admin').addEventListener('click', irAlAdminPanel);
document.getElementById('btn-volver-kiosco').addEventListener('click', () => { localStorage.setItem('vista_actual', 'kiosco'); mostrarKiosco(); });

if(tabReporte) tabReporte.addEventListener('click', () => { ocultarTodasLasSecciones(); secReporte.classList.remove('hidden'); tabReporte.classList.add('active-tab'); generarReporte(); });
if(tabNuevo) tabNuevo.addEventListener('click', () => { ocultarTodasLasSecciones(); secNuevo.classList.remove('hidden'); tabNuevo.classList.add('active-tab'); document.getElementById('nuevo-nombres').value = ""; document.getElementById('nuevo-apellidos').value = ""; document.getElementById('admin-msg').innerHTML = ""; });
if(tabLogs) tabLogs.addEventListener('click', () => { ocultarTodasLasSecciones(); secLogs.classList.remove('hidden'); tabLogs.classList.add('active-tab'); cargarAuditoria(); });
if(tabPermiso) tabPermiso.addEventListener('click', () => { ocultarTodasLasSecciones(); secPermiso.classList.remove('hidden'); tabPermiso.classList.add('active-tab'); document.getElementById('permiso-pin').value = ""; document.getElementById('permiso-msg').innerHTML = ""; llenarFechasPermiso(); });
if(tabGodMode) tabGodMode.addEventListener('click', () => { ocultarTodasLasSecciones(); secGodMode.classList.remove('hidden'); tabGodMode.classList.add('active-tab'); cargarUsuariosGodMode(); }); 

function llenarFechasPermiso() {
    const selectFecha = document.getElementById('permiso-fecha');
    if(!selectFecha) return;
    const fechas = obtenerSabados();
    const ahoraLocal = new Date();
    const hoyStr = `${ahoraLocal.getFullYear()}-${String(ahoraLocal.getMonth() + 1).padStart(2, '0')}-${String(ahoraLocal.getDate()).padStart(2, '0')}`;
    let sabadoObjetivo = fechas[fechas.length - 1]; 
    for (let i = 0; i < fechas.length; i++) { if (fechas[i] >= hoyStr) { sabadoObjetivo = fechas[i]; break; } }
    let html = "";
    fechas.forEach(f => {
        const d = f.split('-'); const dateObj = new Date(d[0], d[1] - 1, d[2]);
        let text = dateObj.toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        text = text.charAt(0).toUpperCase() + text.slice(1);
        if (f === '2026-11-07') text += ' (Asueto / Libre)';
        else if (f === '2026-11-14') text += ' (🎓 Graduación / Clausura)';
        html += `<option value="${f}" ${f === sabadoObjetivo ? 'selected' : ''}>${text}</option>`;
    });
    selectFecha.innerHTML = html;
}

document.getElementById('btn-guardar-permiso').addEventListener('click', async () => {
    if (await interceptarBaneados()) return;
    const pinVal = document.getElementById('permiso-pin').value.trim();
    const fecha = document.getElementById('permiso-fecha').value;
    const msg = document.getElementById('permiso-msg');
    
    if (pinVal.length !== 3 || !fecha) { msg.innerHTML = "<span style='color:red;'>Complete datos.</span>"; return; }
    msg.innerHTML = "<span style='color:var(--brand-blue);'>Verificando...</span>";
    
    const { data: docente, error } = await clienteSupabase.from('docentes').select('id, nombres, apellidos, estado_activo').eq('pin', parseInt(pinVal, 10)).single();
    if (error || !docente) { msg.innerHTML = "<span style='color:red;'>PIN no encontrado.</span>"; return; }
    if (!docente.estado_activo) { msg.innerHTML = "<span style='color:red;'>Docente inactivo.</span>"; return; }
    
    await clienteSupabase.from('asistencias').delete().eq('docente_id', docente.id).eq('fecha', fecha);
    const { error: errInsert } = await clienteSupabase.from('asistencias').insert([{ docente_id: docente.id, fecha: fecha, estado: 'permiso', hora: "13:00:00" }]);
    
    if (errInsert) msg.innerHTML = "<span style='color:red;'>Error al guardar.</span>";
    else {
        msg.innerHTML = `Permiso asignado a: <span style="font-size:16px; color:#10b981; display:block; font-weight:bold;">${docente.nombres} ${docente.apellidos}</span>`;
        registrarLog(`Asignó PERMISO rápido (PIN ${pinVal}) a: ${docente.nombres} ${docente.apellidos} para: ${fecha}`);
        document.getElementById('permiso-pin').value = ""; generarReporte();
    }
});

document.getElementById('btn-guardar-docente').addEventListener('click', async () => {
    if (await interceptarBaneados()) return;
    const inputN = document.getElementById('nuevo-nombres').value.trim(); const inputA = document.getElementById('nuevo-apellidos').value.trim(); const msg = document.getElementById('admin-msg');
    if (!inputN || !inputA) { msg.innerHTML = "<span style='color:red;'>Campos requeridos.</span>"; return; }
    msg.innerHTML = "<span style='color:var(--brand-blue);'>Verificando...</span>";
    
    const { data: duplicados } = await clienteSupabase.from('docentes').select('pin').ilike('nombres', inputN).ilike('apellidos', inputA).limit(1);
    if (duplicados && duplicados.length > 0) { msg.innerHTML = `<span style="color:#ef4444; font-weight:bold;">Ya existe, PIN ${String(duplicados[0].pin).padStart(3, '0')}</span>`; return; }

    const { data: maxPinData } = await clienteSupabase.from('docentes').select('pin').order('pin', { ascending: false }).limit(1);
    let nuevoPin = 1; if (maxPinData && maxPinData.length > 0 && maxPinData[0].pin) nuevoPin = parseInt(maxPinData[0].pin, 10) + 1; 

    const { error } = await clienteSupabase.from('docentes').insert([{ nombres: inputN, apellidos: inputA, pin: nuevoPin, estado_activo: true }]);
    if (error) msg.innerHTML = "<span style='color:red;'>Error.</span>"; 
    else { 
        msg.innerHTML = `Éxito. PIN Asignado: <span style="font-size:24px; color:#10b981; display:block; font-weight:bold;">${String(nuevoPin).padStart(3, '0')}</span>`;
        registrarLog(`Registró docente: ${inputN} ${inputA} (PIN: ${String(nuevoPin).padStart(3, '0')})`);
        document.getElementById('nuevo-nombres').value = ""; document.getElementById('nuevo-apellidos').value = ""; 
    }
});

const modalEdicion = document.getElementById('modal-edicion');
const editId = document.getElementById('edit-id'); const editNombres = document.getElementById('edit-nombres'); const editApellidos = document.getElementById('edit-apellidos');

window.abrirModalEdicion = function(id, nombres, apellidos, estadoActivo) { 
    editId.value = id; editNombres.value = nombres; editApellidos.value = apellidos; 
    const radios = document.getElementsByName('edit-estado-radio');
    for (let radio of radios) radio.checked = (radio.value === (estadoActivo ? "true" : "false")); 
    modalEdicion.classList.remove('hidden'); 
};

document.getElementById('btn-cerrar-modal').addEventListener('click', () => modalEdicion.classList.add('hidden'));

document.getElementById('btn-guardar-edicion').addEventListener('click', async () => {
    if (await interceptarBaneados()) return;
    const id = editId.value; const n = editNombres.value.trim(); const a = editApellidos.value.trim(); 
    let estado = true; const radios = document.getElementsByName('edit-estado-radio');
    for (let radio of radios) if (radio.checked) estado = (radio.value === "true"); 
    if (!n || !a) { alert("Campos obligatorios."); return; }
    
    document.getElementById('btn-guardar-edicion').textContent = "Guardando...";
    const { error } = await clienteSupabase.from('docentes').update({ nombres: n, apellidos: a, estado_activo: estado }).eq('id', id);
    document.getElementById('btn-guardar-edicion').textContent = "Guardar Cambios";
    
    if (error) alert("Error de conexión."); 
    else { registrarLog(`Editó docente: ${n} ${a} (Activo: ${estado})`); modalEdicion.classList.add('hidden'); generarReporte(); }
});

document.getElementById('btn-eliminar-docente').addEventListener('click', async () => {
    if (await interceptarBaneados()) return;
    abrirModalConfirmacion("¿Eliminar?", `¿Desea eliminar este historial permanente?`, async () => {
        document.getElementById('btn-eliminar-docente').textContent = "Borrando...";
        await clienteSupabase.from('asistencias').delete().eq('docente_id', editId.value);
        await clienteSupabase.from('docentes').delete().eq('id', editId.value);
        document.getElementById('btn-eliminar-docente').textContent = "Eliminar";
        registrarLog(`Eliminó al docente: ${editNombres.value} ${editApellidos.value}`);
        modalEdicion.classList.add('hidden'); generarReporte();
    });
});

// =========================================================
// 8. MATRIZ DINÁMICA MEJORADA
// =========================================================
let miGrafico = null; 
function obtenerSabados() {
    const sabados = [];
    // Clases los sábados desde el 11 de Julio al 31 de Octubre, Asueto 7 de Noviembre y Graduación el 14 de Noviembre de 2026
    let fecha = new Date(2026, 6, 11);
    const fin = new Date(2026, 10, 14, 23, 59, 59);
    while (fecha <= fin) {
        if (fecha.getDay() === 6) {
            sabados.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`);
        }
        fecha.setDate(fecha.getDate() + 7);
    }
    return sabados;
}

async function generarReporte() {
    const cont = document.getElementById('tabla-excel-container');
    if(!cont) return;
    cont.innerHTML = "<p style='padding: 20px; font-weight: 600; color: var(--slate-500);'>Cargando registros...</p>";

    const { data: docentes } = await clienteSupabase.from('docentes').select('*').order('apellidos', { ascending: true });
    const { data: asistencias } = await clienteSupabase.from('asistencias').select('*');
    const { data: diasSusp } = await clienteSupabase.from('dias_suspendidos').select('fecha');
    if (!docentes) { cont.innerHTML = "<p style='color:red;'>Error.</p>"; return; }

    const arrayDiasSuspendidos = diasSusp ? diasSusp.map(d => d.fecha) : [];
    // Sábado 7 de Noviembre: Asueto (Día Libre) automático para que no cuente falta a nadie
    if (!arrayDiasSuspendidos.includes('2026-11-07')) {
        arrayDiasSuspendidos.push('2026-11-07');
    }

    const fechas = obtenerSabados();
    const ahoraLocal = new Date();
    const hoyStr = `${ahoraLocal.getFullYear()}-${String(ahoraLocal.getMonth() + 1).padStart(2, '0')}-${String(ahoraLocal.getDate()).padStart(2, '0')}`;
    const horaActual = ahoraLocal.getHours();
    
    let sabadoObjetivo = fechas[fechas.length - 1]; 
    for (let i = 0; i < fechas.length; i++) { if (fechas[i] >= hoyStr) { sabadoObjetivo = fechas[i]; break; } }
    fechaObjetivoActual = sabadoObjetivo; 

    let gA = 0, gP = 0, gF = 0; let dashTotalActivos = 0; 
    let html = `<table class="matrix-table" id="tabla-exportar"><thead><tr><th class="col-fija fix-1">N°</th><th class="col-fija fix-2">Docente</th><th class="col-fija fix-3">CÓDIGO</th><th class="col-fija fix-4">A</th><th class="col-fija fix-5">P</th><th class="col-fija fix-6">F</th><th class="col-fija fix-7"></th>`;
    
    fechas.forEach(f => {
        const d = f.split('-'); const dateObj = new Date(d[0], d[1]-1, d[2]);
        const mes = dateObj.toLocaleString('es-ES', {month: 'short'}).substring(0,3).toUpperCase();
        let badgeHeader = '';
        let thClase = f === sabadoObjetivo ? 'col-actual' : '';
        if (f === '2026-11-07') {
            badgeHeader = `<span class="badge-asueto" title="Asueto / Día Libre">ASUETO</span>`;
        } else if (f === '2026-11-14') {
            badgeHeader = `<span class="badge-graduacion" title="Acto de Graduación / Clausura">🎓 GRAD.</span>`;
            thClase += ' col-graduacion';
        }
        const btnToggle = arrayDiasSuspendidos.includes(f) ? `<button onclick="toggleDiaSuspendido('${f}', true)" class="btn-reactivar" title="Reactivar">✅ React.</button>` : `<button onclick="toggleDiaSuspendido('${f}', false)" class="btn-suspender" title="Suspender">🚫 Susp.</button>`;
        html += `<th class="${thClase}"><div class="date-header">${badgeHeader}<span class="mes">${mes}</span><span class="dia">${d[2]}</span></div>${btnToggle}</th>`;
    });
    html += `</tr></thead><tbody>`;

    docentes.forEach((doc, i) => {
        let a = 0, p = 0, f = 0, rachaFaltas = 0; 
        if (doc.estado_activo) dashTotalActivos++;

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

            if (fecha <= hoyStr && !isSuspendido) {
                if (val === 'falta') rachaFaltas++;
                else if (val === 'asistio' || val === 'permiso') rachaFaltas = 0; 
            }

            if (isSuspendido) {
                const titleBadge = fecha === '2026-11-07' ? 'Asueto (Día Libre)' : 'Suspendido';
                celdasFechas += `<td class="${fecha === sabadoObjetivo ? 'celda-actual' : ''}"><span class="badge-suspendida" title="${titleBadge}">-</span></td>`; 
            } else {
                celdasFechas += `<td class="${fecha === sabadoObjetivo ? 'celda-actual' : ''}"><select class="select-asistencia ${cls}" data-fecha="${fecha}" onchange="cambiarEstadoCelda(${doc.id}, '${doc.apellidos}, ${doc.nombres}', '${fecha}', this.value, this)" ${!doc.estado_activo ? 'disabled' : ''}><option value="pendiente" ${val === 'pendiente' ? 'selected' : ''}>-</option><option value="asistio" ${val === 'asistio' ? 'selected' : ''}>A</option><option value="permiso" ${val === 'permiso' ? 'selected' : ''}>P</option><option value="falta" ${val === 'falta' ? 'selected' : ''}>F</option></select></td>`;
            }
        });

        gA += a; gP += p; gF += f;
        let rowClasses = doc.estado_activo === false ? "fila-inactiva" : "";
        let badgeInactivo = doc.estado_activo === false ? `<span class="badge-inactivo">INACTIVO</span>` : "";
        let warningIcon = "";
        if (rachaFaltas >= 3 && doc.estado_activo !== false) { rowClasses += " alerta-faltas"; warningIcon = `<span class="icon-alerta" title="${rachaFaltas} faltas consecutivas">⚠️</span>`; }

        const nombreCompleto = `${doc.apellidos}, ${doc.nombres}`;
        html += `<tr class="${rowClasses}">
            <td class="col-fija fix-1">${i + 1}</td>
            <td class="col-fija fix-2" title="${nombreCompleto}"><div style="display: flex; justify-content: space-between; align-items: center; width: 100%;"><span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nombreCompleto}${warningIcon}</span>${badgeInactivo}</div></td>
            <td class="col-fija fix-3">${String(doc.pin).padStart(3, '0')}</td>
            <td class="col-fija fix-4 val-a">${a}</td><td class="col-fija fix-5 val-p">${p}</td><td class="col-fija fix-6 val-f">${f}</td>
            <td class="col-fija fix-7"><button onclick="abrirModalEdicion(${doc.id}, '${doc.nombres}', '${doc.apellidos}', ${doc.estado_activo})" class="btn-manage" title="Ajustes">⚙️</button></td>
            ${celdasFechas}
        </tr>`;
    });

    html += `</tbody><tfoot><tr>
        <th class="col-fija fix-1 footer-fixed"></th><th class="col-fija fix-2 footer-fixed"></th><th class="col-fija fix-3 footer-fixed"></th>
        <th class="col-fija fix-4 footer-fixed"></th><th class="col-fija fix-5 footer-fixed"></th><th class="col-fija fix-6 footer-fixed"></th>
        <th class="col-fija fix-7 footer-fixed" style="text-align: right; padding-right: 10px; color: var(--slate-600); font-size: 10px;">TOTALES:</th>`;
    fechas.forEach(fecha => {
        if (arrayDiasSuspendidos.includes(fecha)) html += `<td class="celda-totales" data-footer-fecha="${fecha}"><div style="color: var(--slate-400); text-align: center;">-</div></td>`;
        else html += `<td class="celda-totales" data-footer-fecha="${fecha}"></td>`; 
    });
    html += `</tr></tfoot></table>`; cont.innerHTML = html; 
    
    if(document.getElementById('dash-total')) document.getElementById('dash-total').textContent = dashTotalActivos;
    actualizarTotalesDOM();
    setTimeout(() => { const col = document.querySelector('.col-actual'); if (col) col.scrollIntoView({ behavior: 'smooth', inline: 'center' }); }, 300);
}

// =========================================================
// 9. UI OPTIMISTA Y ACTUALIZACIÓN EN VIVO
// =========================================================
window.cambiarEstadoCelda = async function(id, nombreDocente, fecha, estado, selectElement) {
    if (await interceptarBaneados()) { generarReporte(); return; }

    let cls = 's'; if (estado === 'asistio') cls = 'a'; else if (estado === 'permiso') cls = 'p'; else if (estado === 'falta') cls = 'f';
    selectElement.className = `select-asistencia ${cls}`; actualizarTotalesDOM();

    await clienteSupabase.from('asistencias').delete().eq('docente_id', id).eq('fecha', fecha);
    if (estado !== 'pendiente') await clienteSupabase.from('asistencias').insert([{ docente_id: id, fecha: fecha, estado: estado, hora: "13:00:00" }]);
    registrarLog(`Forzó estado a '${estado.toUpperCase()}' para: ${nombreDocente}, en fecha: ${fecha}`);
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

    let dashA = 0, dashP = 0, dashF = 0;
    const fechas = obtenerSabados();
    fechas.forEach(fecha => {
        const selects = document.querySelectorAll(`.select-asistencia[data-fecha="${fecha}"]`);
        const cell = document.querySelector(`td[data-footer-fecha="${fecha}"]`);
        if (selects.length > 0 && cell) {
            let a = 0, p = 0, f = 0;
            selects.forEach(sel => { 
                if (!sel.hasAttribute('disabled')) { if (sel.value === 'asistio') a++; else if (sel.value === 'permiso') p++; else if (sel.value === 'falta') f++; }
            });
            cell.innerHTML = `<div class="mini-card-totales"><span class="m-badge a">A: ${a}</span><span class="m-badge p">P: ${p}</span><span class="m-badge f">F: ${f}</span></div>`;
            if (fecha === fechaObjetivoActual) { dashA = a; dashP = p; dashF = f; }
        }
    });
    
    if(document.getElementById('dash-presentes')) document.getElementById('dash-presentes').textContent = dashA;
    if(document.getElementById('dash-permisos')) document.getElementById('dash-permisos').textContent = dashP;
    if(document.getElementById('dash-ausentes')) document.getElementById('dash-ausentes').textContent = dashF;
    dibujarGrafica(globalA, globalP, globalF);
}

// =========================================================
// 10. MODALES, SUSPENSIONES Y EXPORTACIÓN
// =========================================================
const modalConfirm = document.getElementById('modal-confirmacion');
const btnConfirmOk = document.getElementById('btn-confirm-ok');
const btnConfirmCancelar = document.getElementById('btn-confirm-cancelar');
let confirmCallback = null;

function abrirModalConfirmacion(titulo, mensaje, callback) { document.getElementById('modal-confirm-titulo').textContent = titulo; document.getElementById('modal-confirm-mensaje').textContent = mensaje; confirmCallback = callback; modalConfirm.classList.remove('hidden'); }
btnConfirmCancelar.addEventListener('click', () => { modalConfirm.classList.add('hidden'); confirmCallback = null; });
btnConfirmOk.addEventListener('click', () => { modalConfirm.classList.add('hidden'); if (confirmCallback) confirmCallback(); });

window.toggleDiaSuspendido = function(fecha, isSuspended) {
    if (isSuspended) {
        abrirModalConfirmacion( `¿Reactivar el ${fecha}?`, `Se quitará el bloqueo del calendario.`, async () => {
            document.getElementById('tabla-excel-container').innerHTML = "<p style='padding: 20px; color: #10b981;'>Reactivando...</p>";
            await clienteSupabase.from('dias_suspendidos').delete().eq('fecha', fecha);
            registrarLog(`Reactivó las clases del día sábado: ${fecha}`); generarReporte();
        });
    } else {
        abrirModalConfirmacion( `¿Suspender el ${fecha}?`, `Se deshabilitará el Kiosco ese día.`, async () => {
            document.getElementById('tabla-excel-container').innerHTML = "<p style='padding: 20px; color: #f59e0b;'>Suspendiendo...</p>";
            await clienteSupabase.from('dias_suspendidos').insert([{ fecha: fecha }]);
            registrarLog(`Suspendió las clases del día sábado: ${fecha}`); generarReporte();
        });
    }
};

document.getElementById('buscador-docente').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#tabla-exportar tbody tr').forEach(fila => { 
        const nombre = fila.querySelector('.fix-2')?.textContent.toLowerCase() || ''; const pin = fila.querySelector('.fix-3')?.textContent.toLowerCase() || '';
        fila.classList.toggle('hidden', !(nombre.includes(term) || pin.includes(term))); 
    });
});

function dibujarGrafica(a, p, f) {
    const ctx = document.getElementById('grafica-asistencia').getContext('2d');
    if (miGrafico) miGrafico.destroy();
    miGrafico = new Chart(ctx, { type: 'doughnut', data: { labels: ['Asistencias', 'Permisos', 'Faltas'], datasets: [{ data: [a, p, f], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'] }] }, options: { plugins: { legend: { position: 'bottom' } } } });
}

// =========================================================
// 10.1 EXPORTACIÓN A EXCEL CON ESTILOS PROFESIONALES (ExcelJS)
// =========================================================
function colToLetter(colIndex) {
    let temp = '';
    let letter = '';
    while (colIndex > 0) {
        temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(65 + temp) + letter;
        colIndex = Math.floor((colIndex - temp - 1) / 26);
    }
    return letter;
}

const mesesEs = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
function formatFechaHeader(fechaStr) {
    const partes = fechaStr.split('-');
    const mesIndex = parseInt(partes[1], 10) - 1;
    if (fechaStr === '2026-11-07') return '07-NOV (ASUETO)';
    if (fechaStr === '2026-11-14') return '14-NOV (GRADUACIÓN)';
    return `${partes[2]}-${mesesEs[mesIndex] || partes[1]}`;
}

async function exportarMatrizExcel() {
    const tabla = document.getElementById('tabla-exportar'); 
    if (!tabla) return alert("Por favor, espere a que la tabla cargue primero.");

    const btn = document.getElementById('btn-exportar-csv');
    const originalBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = `<span style="display:inline-block; animation:palpitar 1s infinite;">⏳</span> Generando Excel...`;
        btn.disabled = true;
    }

    try {
        registrarLog("Exportó la Matriz General a Excel con formato estilizado");

        // Si ExcelJS no estuviera disponible, usar SheetJS de respaldo
        if (typeof ExcelJS === 'undefined') {
            console.warn("ExcelJS no disponible, usando SheetJS de respaldo...");
            exportarConSheetJSFallback(tabla);
            return;
        }

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Sistema de Asistencia Docente';
        wb.lastModifiedBy = emailUsuarioActual || 'Administrador';
        wb.created = new Date();
        wb.modified = new Date();

        const ws = wb.addWorksheet('Control de Asistencia', {
            views: [
                { 
                    state: 'frozen', 
                    xSplit: 3, 
                    ySplit: 5, 
                    topLeftCell: 'D6', 
                    activePane: 'bottomRight', 
                    showGridLines: true 
                }
            ],
            properties: { defaultRowHeight: 20 }
        });

        const fechas = obtenerSabados();
        const totalCols = 6 + fechas.length; // N°, Docente, PIN, A, P, F + Sábados
        const lastColLetter = colToLetter(totalCols);

        // Paleta oficial coherente con la aplicación web
        const PALETTE = {
            navyDark: '0F172A',      // Slate 900
            navyMedium: '1E293B',    // Slate 800
            slateDark: '334155',     // Slate 700
            slateMuted: '475569',    // Slate 600
            slateLight: 'F1F5F9',    // Slate 100
            headerBg: 'F8FAFC',      // Slate 50
            borderLight: 'E2E8F0',   // Slate 200
            borderDark: 'CBD5E1',    // Slate 300

            // Estados
            badgeABg: 'DCFCE7',      // Verde suave
            badgeATxt: '15803D',     // Verde oscuro
            summaryABg: 'F0FDF4',

            badgePBg: 'FEF9C3',      // Amarillo/ámbar suave
            badgePTxt: 'A16207',     // Ámbar oscuro
            summaryPBg: 'FEFCE8',

            badgeFBg: 'FEE2E2',      // Rojo suave
            badgeFTxt: 'B91C1C',     // Rojo oscuro
            summaryFBg: 'FEF2F2',

            badgeSBg: 'F1F5F9',      // Gris suspendido/inactivo
            badgeSTxt: '94A3B8',

            inactiveTxt: '94A3B8'
        };

        const argb = (hex) => 'FF' + hex;

        const borderThin = {
            top: { style: 'thin', color: { argb: argb(PALETTE.borderLight) } },
            left: { style: 'thin', color: { argb: argb(PALETTE.borderLight) } },
            bottom: { style: 'thin', color: { argb: argb(PALETTE.borderLight) } },
            right: { style: 'thin', color: { argb: argb(PALETTE.borderLight) } }
        };

        const borderHeaderBottom = {
            top: { style: 'thin', color: { argb: argb(PALETTE.borderLight) } },
            left: { style: 'thin', color: { argb: argb(PALETTE.borderLight) } },
            bottom: { style: 'medium', color: { argb: argb(PALETTE.borderDark) } },
            right: { style: 'thin', color: { argb: argb(PALETTE.borderLight) } }
        };

        // --- FILA 1: TÍTULO PRINCIPAL ---
        ws.mergeCells(1, 1, 1, totalCols);
        const r1 = ws.getCell('A1');
        r1.value = 'SISTEMA DE CONTROL DE ASISTENCIA DOCENTE';
        r1.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.navyDark) } };
        r1.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(1).height = 32;

        // --- FILA 2: SUBTÍTULO INSTITUCIONAL Y RANGO DE FECHAS ---
        ws.mergeCells(2, 1, 2, totalCols);
        const r2 = ws.getCell('A2');
        r2.value = 'Período de Clases: Sábados del 11 de Julio al 31 de Octubre de 2026 | Asueto: 07 de Noviembre | Graduación y Clausura: 14 de Noviembre de 2026';
        r2.font = { name: 'Segoe UI', size: 10, color: { argb: 'FFCBD5E1' } };
        r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.navyMedium) } };
        r2.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(2).height = 20;

        // --- FILA 3: LEYENDA DE CONVENCIONES ---
        ws.mergeCells(3, 1, 3, totalCols);
        const r3 = ws.getCell('A3');
        r3.value = 'Leyenda:  [ A ] Asistencia  |  [ P ] Permiso  |  [ F ] Falta  |  [ - ] No Aplica / Suspendido / Asueto';
        r3.font = { name: 'Segoe UI', size: 9, bold: true, italic: true, color: { argb: argb(PALETTE.slateMuted) } };
        r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.slateLight) } };
        r3.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(3).height = 20;

        // --- FILA 4: ENCABEZADOS DE GRUPO ---
        ws.mergeCells(4, 1, 4, 3);
        const g1 = ws.getCell('A4');
        g1.value = 'INFORMACIÓN DEL DOCENTE';
        g1.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        g1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.slateDark) } };
        g1.alignment = { vertical: 'middle', horizontal: 'center' };

        ws.mergeCells(4, 4, 4, 6);
        const g2 = ws.getCell('D4');
        g2.value = 'RESUMEN';
        g2.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        g2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.navyMedium) } };
        g2.alignment = { vertical: 'middle', horizontal: 'center' };

        ws.mergeCells(4, 7, 4, totalCols);
        const g3 = ws.getCell('G4');
        g3.value = 'CONTROL DE ASISTENCIAS POR SÁBADO (CLASES, ASUETO Y GRADUACIÓN)';
        g3.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        g3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.navyDark) } };
        g3.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(4).height = 22;

        // --- FILA 5: ENCABEZADOS DE COLUMNAS ---
        const hCols = [
            { col: 1, title: 'N°', align: 'center', bg: PALETTE.headerBg, fg: PALETTE.slateDark },
            { col: 2, title: 'APELLIDOS Y NOMBRES', align: 'left', bg: PALETTE.headerBg, fg: PALETTE.slateDark },
            { col: 3, title: 'CÓDIGO', align: 'center', bg: PALETTE.headerBg, fg: PALETTE.slateDark },
            { col: 4, title: 'A', align: 'center', bg: PALETTE.badgeABg, fg: PALETTE.badgeATxt, bold: true },
            { col: 5, title: 'P', align: 'center', bg: PALETTE.badgePBg, fg: PALETTE.badgePTxt, bold: true },
            { col: 6, title: 'F', align: 'center', bg: PALETTE.badgeFBg, fg: PALETTE.badgeFTxt, bold: true }
        ];

        hCols.forEach(h => {
            const cell = ws.getCell(5, h.col);
            cell.value = h.title;
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(h.fg) } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(h.bg) } };
            cell.alignment = { vertical: 'middle', horizontal: h.align };
            cell.border = borderHeaderBottom;
        });

        fechas.forEach((f, idx) => {
            const colIndex = 7 + idx;
            const cell = ws.getCell(5, colIndex);
            cell.value = formatFechaHeader(f);
            if (f === '2026-11-07') {
                cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0284C7' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }; // Azul cielo suave asueto
            } else if (f === '2026-11-14') {
                cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB45309' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Dorado graduación
            } else {
                cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.navyDark) } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.headerBg) } };
            }
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderHeaderBottom;
        });
        ws.getRow(5).height = 26;

        // --- FILAS DE DOCENTES (DATOS) ---
        const filasDocentes = tabla.querySelectorAll('tbody tr');
        let globalTotA = 0, globalTotP = 0, globalTotF = 0;
        const totalesPorSabado = fechas.map(() => ({ a: 0, p: 0, f: 0 }));

        filasDocentes.forEach((fila, i) => {
            const rowNum = 6 + i;
            const isInactive = fila.classList.contains('fila-inactiva') || !!fila.querySelector('.badge-inactivo');
            
            // Extraer nombre limpio
            let nombreDocente = fila.querySelector('.fix-2 span')?.textContent?.replace('⚠️', '')?.trim() || '';
            if (!nombreDocente) {
                nombreDocente = fila.querySelector('.fix-2')?.innerText?.replace('INACTIVO', '')?.replace('⚠️', '')?.trim() || '';
            }
            if (isInactive) nombreDocente += ' (INACTIVO)';

            // PIN
            const pinDocente = fila.querySelector('.fix-3')?.textContent?.trim() || '';

            // Totales de la fila
            const valA = parseInt(fila.querySelector('.val-a')?.textContent || '0', 10);
            const valP = parseInt(fila.querySelector('.val-p')?.textContent || '0', 10);
            const valF = parseInt(fila.querySelector('.val-f')?.textContent || '0', 10);

            globalTotA += valA;
            globalTotP += valP;
            globalTotF += valF;

            // Col 1: N°
            const cNum = ws.getCell(rowNum, 1);
            cNum.value = i + 1;
            cNum.font = { name: 'Segoe UI', size: 10, color: { argb: argb(PALETTE.slateMuted) } };
            cNum.alignment = { vertical: 'middle', horizontal: 'center' };
            cNum.border = borderThin;

            // Col 2: Docente
            const cNom = ws.getCell(rowNum, 2);
            cNom.value = nombreDocente;
            cNom.font = { 
                name: 'Segoe UI', 
                size: 10, 
                bold: !isInactive, 
                strike: isInactive, 
                color: { argb: argb(isInactive ? PALETTE.inactiveTxt : PALETTE.navyDark) } 
            };
            cNom.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            cNom.border = borderThin;

            // Col 3: PIN (como texto para conservar ceros a la izquierda)
            const cPin = ws.getCell(rowNum, 3);
            cPin.value = pinDocente;
            cPin.numFmt = '@';
            cPin.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.slateMuted) } };
            cPin.alignment = { vertical: 'middle', horizontal: 'center' };
            cPin.border = borderThin;

            // Col 4: Asistencias (A)
            const cA = ws.getCell(rowNum, 4);
            cA.value = { formula: `COUNTIF(G${rowNum}:${lastColLetter}${rowNum},"A")`, result: valA };
            cA.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.badgeATxt) } };
            cA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.summaryABg) } };
            cA.alignment = { vertical: 'middle', horizontal: 'center' };
            cA.border = borderThin;

            // Col 5: Permisos (P)
            const cP = ws.getCell(rowNum, 5);
            cP.value = { formula: `COUNTIF(G${rowNum}:${lastColLetter}${rowNum},"P")`, result: valP };
            cP.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.badgePTxt) } };
            cP.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.summaryPBg) } };
            cP.alignment = { vertical: 'middle', horizontal: 'center' };
            cP.border = borderThin;

            // Col 6: Faltas (F)
            const cF = ws.getCell(rowNum, 6);
            cF.value = { formula: `COUNTIF(G${rowNum}:${lastColLetter}${rowNum},"F")`, result: valF };
            cF.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.badgeFTxt) } };
            cF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.summaryFBg) } };
            cF.alignment = { vertical: 'middle', horizontal: 'center' };
            cF.border = borderThin;

            // Columnas de fechas de sábados
            fechas.forEach((fecha, idx) => {
                const colIdx = 7 + idx;
                const cDate = ws.getCell(rowNum, colIdx);
                const sel = fila.querySelector(`.select-asistencia[data-fecha="${fecha}"]`);
                
                let valEstado = '-';
                if (sel) {
                    if (sel.value === 'asistio') valEstado = 'A';
                    else if (sel.value === 'permiso') valEstado = 'P';
                    else if (sel.value === 'falta') valEstado = 'F';
                }

                cDate.value = valEstado;
                cDate.alignment = { vertical: 'middle', horizontal: 'center' };
                cDate.border = borderThin;

                if (valEstado === 'A') {
                    cDate.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgeABg) } };
                    cDate.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: argb(PALETTE.badgeATxt) } };
                    totalesPorSabado[idx].a++;
                } else if (valEstado === 'P') {
                    cDate.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgePBg) } };
                    cDate.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: argb(PALETTE.badgePTxt) } };
                    totalesPorSabado[idx].p++;
                } else if (valEstado === 'F') {
                    cDate.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgeFBg) } };
                    cDate.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: argb(PALETTE.badgeFTxt) } };
                    totalesPorSabado[idx].f++;
                } else {
                    cDate.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgeSBg) } };
                    cDate.font = { name: 'Segoe UI', size: 10, color: { argb: argb(PALETTE.badgeSTxt) } };
                }
            });

            ws.getRow(rowNum).height = 20;
        });

        // --- FILAS DE TOTALES / RESUMEN INFERIOR ---
        const endDocRow = 5 + filasDocentes.length;
        const rSpacer = endDocRow + 1;
        ws.getRow(rSpacer).height = 8; // Espacio visual

        const rA = endDocRow + 2;
        const rP = endDocRow + 3;
        const rF = endDocRow + 4;
        const rPct = endDocRow + 5;

        // Fila Total Asistencias (A)
        ws.mergeCells(rA, 1, rA, 3);
        const lA = ws.getCell(rA, 1);
        lA.value = 'TOTAL ASISTENCIAS (A)';
        lA.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.badgeATxt) } };
        lA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgeABg) } };
        lA.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
        lA.border = borderThin;

        const totACol = ws.getCell(rA, 4);
        totACol.value = { formula: `SUM(D6:D${endDocRow})`, result: globalTotA };
        totACol.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: argb(PALETTE.badgeATxt) } };
        totACol.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgeABg) } };
        totACol.alignment = { vertical: 'middle', horizontal: 'center' };
        totACol.border = borderThin;

        [5, 6].forEach(c => {
            const cell = ws.getCell(rA, c);
            cell.value = '-';
            cell.font = { name: 'Segoe UI', size: 10, color: { argb: argb(PALETTE.slateMuted) } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.headerBg) } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderThin;
        });

        fechas.forEach((f, idx) => {
            const colIdx = 7 + idx;
            const colLetter = colToLetter(colIdx);
            const cell = ws.getCell(rA, colIdx);
            cell.value = { formula: `COUNTIF(${colLetter}6:${colLetter}${endDocRow},"A")`, result: totalesPorSabado[idx].a };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.badgeATxt) } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgeABg) } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderThin;
        });
        ws.getRow(rA).height = 22;

        // Fila Total Permisos (P)
        ws.mergeCells(rP, 1, rP, 3);
        const lP = ws.getCell(rP, 1);
        lP.value = 'TOTAL PERMISOS (P)';
        lP.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.badgePTxt) } };
        lP.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgePBg) } };
        lP.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
        lP.border = borderThin;

        [4, 6].forEach(c => {
            const cell = ws.getCell(rP, c);
            cell.value = '-';
            cell.font = { name: 'Segoe UI', size: 10, color: { argb: argb(PALETTE.slateMuted) } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.headerBg) } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderThin;
        });

        const totPCol = ws.getCell(rP, 5);
        totPCol.value = { formula: `SUM(E6:E${endDocRow})`, result: globalTotP };
        totPCol.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: argb(PALETTE.badgePTxt) } };
        totPCol.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgePBg) } };
        totPCol.alignment = { vertical: 'middle', horizontal: 'center' };
        totPCol.border = borderThin;

        fechas.forEach((f, idx) => {
            const colIdx = 7 + idx;
            const colLetter = colToLetter(colIdx);
            const cell = ws.getCell(rP, colIdx);
            cell.value = { formula: `COUNTIF(${colLetter}6:${colLetter}${endDocRow},"P")`, result: totalesPorSabado[idx].p };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.badgePTxt) } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgePBg) } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderThin;
        });
        ws.getRow(rP).height = 22;

        // Fila Total Faltas (F)
        ws.mergeCells(rF, 1, rF, 3);
        const lF = ws.getCell(rF, 1);
        lF.value = 'TOTAL FALTAS (F)';
        lF.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.badgeFTxt) } };
        lF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgeFBg) } };
        lF.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
        lF.border = borderThin;

        [4, 5].forEach(c => {
            const cell = ws.getCell(rF, c);
            cell.value = '-';
            cell.font = { name: 'Segoe UI', size: 10, color: { argb: argb(PALETTE.slateMuted) } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.headerBg) } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderThin;
        });

        const totFCol = ws.getCell(rF, 6);
        totFCol.value = { formula: `SUM(F6:F${endDocRow})`, result: globalTotF };
        totFCol.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: argb(PALETTE.badgeFTxt) } };
        totFCol.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgeFBg) } };
        totFCol.alignment = { vertical: 'middle', horizontal: 'center' };
        totFCol.border = borderThin;

        fechas.forEach((f, idx) => {
            const colIdx = 7 + idx;
            const colLetter = colToLetter(colIdx);
            const cell = ws.getCell(rF, colIdx);
            cell.value = { formula: `COUNTIF(${colLetter}6:${colLetter}${endDocRow},"F")`, result: totalesPorSabado[idx].f };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.badgeFTxt) } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.badgeFBg) } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderThin;
        });
        ws.getRow(rF).height = 22;

        // Fila Porcentaje Efectivo de Asistencia (%)
        ws.mergeCells(rPct, 1, rPct, 3);
        const lPct = ws.getCell(rPct, 1);
        lPct.value = 'PORCENTAJE DE ASISTENCIA (%)';
        lPct.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.navyDark) } };
        lPct.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.borderLight) } };
        lPct.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
        lPct.border = borderThin;

        const sumGlobal = globalTotA + globalTotP + globalTotF;
        const pctGlobal = sumGlobal > 0 ? (globalTotA / sumGlobal) : 0;
        const totPctCol = ws.getCell(rPct, 4);
        totPctCol.value = { formula: `IF((D${rA}+E${rP}+F${rF})>0, D${rA}/(D${rA}+E${rP}+F${rF}), 0)`, result: pctGlobal };
        totPctCol.numFmt = '0.0%';
        totPctCol.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.navyDark) } };
        totPctCol.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.borderLight) } };
        totPctCol.alignment = { vertical: 'middle', horizontal: 'center' };
        totPctCol.border = borderThin;

        [5, 6].forEach(c => {
            const cell = ws.getCell(rPct, c);
            cell.value = '-';
            cell.font = { name: 'Segoe UI', size: 10, color: { argb: argb(PALETTE.slateMuted) } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.borderLight) } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderThin;
        });

        fechas.forEach((f, idx) => {
            const colIdx = 7 + idx;
            const colLetter = colToLetter(colIdx);
            const sumDia = totalesPorSabado[idx].a + totalesPorSabado[idx].p + totalesPorSabado[idx].f;
            const pctDia = sumDia > 0 ? (totalesPorSabado[idx].a / sumDia) : 0;
            const cell = ws.getCell(rPct, colIdx);
            cell.value = { 
                formula: `IF((${colLetter}${rA}+${colLetter}${rP}+${colLetter}${rF})>0, ${colLetter}${rA}/(${colLetter}${rA}+${colLetter}${rP}+${colLetter}${rF}), 0)`, 
                result: pctDia 
            };
            cell.numFmt = '0.0%';
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: argb(PALETTE.navyDark) } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PALETTE.borderLight) } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderThin;
        });
        ws.getRow(rPct).height = 22;

        // Configuración de anchos de columna
        ws.getColumn(1).width = 6;   // N°
        ws.getColumn(2).width = 38;  // DOCENTE
        ws.getColumn(3).width = 11;  // CÓDIGO
        ws.getColumn(4).width = 8;   // A
        ws.getColumn(5).width = 8;   // P
        ws.getColumn(6).width = 8;   // F
        for (let c = 7; c <= totalCols; c++) {
            const f = fechas[c - 7];
            if (f === '2026-11-07') ws.getColumn(c).width = 16;
            else if (f === '2026-11-14') ws.getColumn(c).width = 20;
            else ws.getColumn(c).width = 11;
        }

        // Asegurar que el panel inmovilizado inicie exactamente en D6 (evita duplicación de encabezados al subir)
        ws.views = [
            { 
                state: 'frozen', 
                xSplit: 3, 
                ySplit: 5, 
                topLeftCell: 'D6', 
                activePane: 'bottomRight', 
                showGridLines: true 
            }
        ];

        // Descarga del archivo Excel
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "Control_Asistencia_Docentes_Sabados_2026.xlsx");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

    } catch (err) {
        console.error("Error al exportar a Excel:", err);
        alert("Ocurrió un error al generar el archivo Excel: " + err.message);
    } finally {
        if (btn) {
            btn.innerHTML = originalBtnHtml;
            btn.disabled = false;
        }
    }
}

// Función de respaldo en caso de que ExcelJS no cargue
function exportarConSheetJSFallback(tabla) {
    let dataMatriz = [];
    tabla.querySelectorAll("thead tr, tbody tr").forEach(fila => {
        let arrayFila = [];
        fila.querySelectorAll("td, th").forEach((c, i) => {
            if (i === 6) return; 
            if (fila.closest('thead')) { 
                arrayFila.push(c.innerText.replace(/🚫 Susp\./g, '').replace(/✅ React\./g, '').replace(/\n/g, ' ').trim()); 
                return; 
            }
            const sel = c.querySelector('select'); 
            const badgeSuspendida = c.querySelector('.badge-suspendida');
            let valorCelda = '';
            if (sel) { 
                valorCelda = sel.value === 'asistio' ? 'A' : (sel.value === 'permiso' ? 'P' : (sel.value === 'falta' ? 'F' : '-')); 
            } else if (badgeSuspendida) { 
                valorCelda = '-'; 
            } else { 
                valorCelda = c.innerText.replace(/\n/g, '').trim(); 
            }
            if (i === 1) valorCelda = valorCelda.replace("INACTIVO", "").trim();
            arrayFila.push(valorCelda);
        });
        dataMatriz.push(arrayFila);
    });
    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet(dataMatriz); 
        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, ws, "Reporte");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a"); 
        link.href = url; 
        link.setAttribute("download", "Matriz_Asistencias.xlsx");
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link); 
        window.URL.revokeObjectURL(url);
    }
}

document.getElementById('btn-exportar-csv').addEventListener('click', exportarMatrizExcel);

// =========================================================
// 11. GOD MODE (CONTROL DE ACCESOS)
// =========================================================
if(document.getElementById('btn-recargar-godmode')) {
    document.getElementById('btn-recargar-godmode').addEventListener('click', cargarUsuariosGodMode);
}

async function cargarUsuariosGodMode() {
    const tbody = document.getElementById('tabla-godmode-body');
    if(!tbody) return;
    tbody.innerHTML = "<tr><td colspan='3' style='padding:20px; text-align:center;'>Cargando base de datos de usuarios...</td></tr>";
    
    const { data: usuarios, error } = await clienteSupabase.from('estado_usuarios').select('*').order('email', { ascending: true });
    if (error) { tbody.innerHTML = "<tr><td colspan='3' style='color:red;'>Error al conectar con la base de seguridad.</td></tr>"; return; }
    if (!usuarios || usuarios.length === 0) { tbody.innerHTML = "<tr><td colspan='3'>No hay colaboradores registrados en el puente.</td></tr>"; return; }

    let html = "";
    usuarios.forEach(u => {
        const isGod = u.email === CORREO_ADMIN_GOD;
        const badge = u.estado_activo 
            ? `<span style="background:#dcfce7; color:#15803d; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:bold;">ACTIVO ✅</span>` 
            : `<span style="background:#fee2e2; color:#b91c1c; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:bold;">BLOQUEADO 🚫</span>`;
        
        let btnAccion = "";
        if (isGod) { btnAccion = `<span style="color:var(--slate-400); font-size:11px; font-weight:bold;">INTOCABLE 👑</span>`; } 
        else if (u.estado_activo) { btnAccion = `<button onclick="cambiarEstadoUsuario('${u.email}', false)" class="btn-danger" style="padding:6px 10px; font-size:11px;">Suspender Acceso</button>`; } 
        else { btnAccion = `<button onclick="cambiarEstadoUsuario('${u.email}', true)" class="btn-success" style="padding:6px 10px; font-size:11px;">Restaurar Acceso</button>`; }

        html += `<tr><td style="text-align: left; padding-left: 15px; font-weight: bold; color: var(--slate-800);">${u.email}</td><td style="text-align: center;">${badge}</td><td style="text-align: center;">${btnAccion}</td></tr>`;
    });
    tbody.innerHTML = html;
}

window.cambiarEstadoUsuario = async function(emailTarget, nuevoEstado) {
    const tbody = document.getElementById('tabla-godmode-body');
    tbody.innerHTML = "<tr><td colspan='3' style='padding:20px; text-align:center; color:#f59e0b;'>Actualizando seguridad...</td></tr>";
    await clienteSupabase.from('estado_usuarios').update({ estado_activo: nuevoEstado }).eq('email', emailTarget);
    registrarLog(`${nuevoEstado ? 'Restauró' : 'Suspendió (Bloqueo)'} el acceso al sistema del correo: ${emailTarget}`);
    cargarUsuariosGodMode();
};


