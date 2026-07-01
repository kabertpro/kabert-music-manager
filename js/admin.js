// ============================================================
// KABERT MUSIC MANAGER — Panel de Administración
// Kabert Studio · LMKE
// ============================================================

function renderAdminView(view) {
  const map = {
    dashboard: renderDashboardAgenda,
    estudiantes: renderEstudiantesView,
    pagos: renderPagosView,
    especialidades: renderEspecialidadesView,
    configuracion: renderConfiguracionView
  };
  (map[view] || renderDashboardAgenda)();
}

function nombreEspecialidad(id) {
  return state.especialidades.find(e => e.id === id)?.nombre || "—";
}

function iniciales(nombre) {
  return nombre.split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

// ================= DASHBOARD / AGENDA DEL DÍA =================
async function renderDashboardAgenda() {
  const el = document.getElementById("adminContent");
  el.innerHTML = `<div class="empty-state">Cargando agenda…</div>`;

  const hoyISO = toISODate(new Date());
  const { data: eventos, error } = await supabase
    .from("eventos_calendario")
    .select("*, estudiantes(*)")
    .eq("fecha", hoyISO)
    .order("hora_inicio", { ascending: true });

  if (error) {
    el.innerHTML = `<div class="empty-state">No se pudo cargar la agenda. Revisa la configuración de Supabase.</div>`;
    return;
  }

  const activos = (eventos || []).filter(ev => ev.estudiantes && ev.estudiantes.estado === "activo");

  const resumenAsistio = activos.filter(e => e.estado === "asistio").length;
  const resumenCobrar = activos.filter(e => debeCobrarHoy(e.estudiantes, hoyISO)).length;

  el.innerHTML = `
    <div class="grid grid-3" style="margin-bottom:22px">
      <div class="card stat-card"><span class="label">Clases hoy</span><span class="value">${activos.length}</span></div>
      <div class="card stat-card"><span class="label">Asistencias registradas</span><span class="value celeste">${resumenAsistio}</span></div>
      <div class="card stat-card"><span class="label">Mensualidades a cobrar</span><span class="value warning">${resumenCobrar}</span></div>
    </div>
    <div class="staff-divider"><div class="lines"><i></i><i></i><i></i><i></i><i></i></div><span class="label">Agenda de hoy · ${formatDateLong(hoyISO)}</span></div>
    <div class="agenda-list" id="agendaList"></div>
  `;

  const list = document.getElementById("agendaList");
  if (activos.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="ic">🎵</div>No hay clases programadas para hoy.</div>`;
    return;
  }

  list.innerHTML = activos.map(ev => {
    const est = ev.estudiantes;
    const cobrar = debeCobrarHoy(est, hoyISO);
    return `
      <div class="agenda-card estado-${ev.estado}" data-evento-id="${ev.id}">
        <div class="avatar">${est.foto_url ? `<img src="${escapeHtml(est.foto_url)}" alt="">` : iniciales(est.nombre_completo)}</div>
        <div class="agenda-info">
          <div class="name">${escapeHtml(est.nombre_completo)} <span class="mono" style="color:var(--muted-2);font-size:11px">${escapeHtml(est.codigo)}</span></div>
          <div class="meta">${escapeHtml(nombreEspecialidad(est.especialidad_id))} · ${ev.hora_inicio?.slice(0,5) || "—"}${ev.hora_fin ? " - " + ev.hora_fin.slice(0,5) : ""}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span class="badge badge-neutral">${etiquetaEstado(ev.estado)}</span>
          ${cobrar ? `<span class="badge badge-cobrar">💰 Cobrar Mensualidad</span>` : ""}
        </div>
        <div class="agenda-actions">
          <button class="action-btn ${ev.estado === 'asistio' ? 'done' : ''}" title="Asistió" data-accion="asistio">✅</button>
          <button class="action-btn ${ev.estado === 'permiso' ? 'done' : ''}" title="Permiso" data-accion="permiso">🟡</button>
          <button class="action-btn ${ev.estado === 'falta' ? 'done' : ''}" title="Falta" data-accion="falta">❌</button>
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll(".agenda-card").forEach(card => {
    const eventoId = card.dataset.eventoId;
    const evento = activos.find(e => e.id === eventoId);
    card.querySelectorAll(".action-btn").forEach(btn => {
      btn.addEventListener("click", () => manejarAccionAgenda(evento, btn.dataset.accion));
    });
  });
}

function etiquetaEstado(estado) {
  return { programada: "Programada", asistio: "Asistió", permiso: "Permiso", falta: "Falta", reposicion: "Reposición" }[estado] || estado;
}

async function manejarAccionAgenda(evento, accion) {
  try {
    if (accion === "asistio") {
      await registrarAsistencia(evento, evento.estudiantes);
      toast("Asistencia registrada.", "success");
      renderDashboardAgenda();
    } else if (accion === "falta") {
      await registrarFalta(evento, evento.estudiantes);
      toast("Falta registrada.", "success");
      renderDashboardAgenda();
    } else if (accion === "permiso") {
      openModal({
        title: "Registrar permiso",
        bodyHtml: `<p style="margin-top:0">¿Esta clase será repuesta?</p>
          <p style="color:var(--muted);font-size:13px">Si eliges "Sí", se creará automáticamente una clase de reposición y se recalculará la próxima mensualidad respetando el horario real del estudiante.</p>`,
        footerHtml: `
          <button class="btn btn-ghost" id="permisoNo">No reponer</button>
          <button class="btn btn-primary" id="permisoSi">Sí, reponer</button>`,
        onMount: () => {
          document.getElementById("permisoNo").addEventListener("click", async () => {
            await registrarPermiso(evento, evento.estudiantes, false);
            closeModal(); toast("Permiso registrado.", "success"); renderDashboardAgenda();
          });
          document.getElementById("permisoSi").addEventListener("click", async () => {
            await registrarPermiso(evento, evento.estudiantes, true);
            closeModal(); toast("Permiso y reposición registrados.", "success"); renderDashboardAgenda();
          });
        }
      });
      await extenderCalendarioSiNecesario(evento.estudiantes);
    }
  } catch (err) {
    console.error(err);
    toast("Ocurrió un error al registrar la acción.", "error");
  }
}

// ================= ESTUDIANTES =================
async function renderEstudiantesView() {
  const el = document.getElementById("adminContent");
  el.innerHTML = `
    <div class="section-head">
      <input class="search-input" id="buscarEstudiante" placeholder="Buscar por nombre o código…" />
      <button class="btn btn-primary" id="nuevoEstudianteBtn">+ Nuevo estudiante</button>
    </div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Estudiante</th><th>Código</th><th>Especialidad</th><th>Horario</th><th>Estado</th><th></th></tr></thead>
      <tbody id="estudiantesTbody"><tr><td colspan="6" class="empty-state">Cargando…</td></tr></tbody>
    </table></div>
  `;

  document.getElementById("nuevoEstudianteBtn").addEventListener("click", () => abrirModalEstudiante());
  document.getElementById("buscarEstudiante").addEventListener("input", (e) => cargarTablaEstudiantes(e.target.value));

  await cargarTablaEstudiantes("");
}

async function cargarTablaEstudiantes(filtro) {
  const tbody = document.getElementById("estudiantesTbody");
  let query = supabaseClient.from("estudiantes").select("*").order("nombre_completo");
  const { data, error } = await query;
  if (error) { tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Error al cargar estudiantes.</td></tr>`; return; }

  const filtrados = (data || []).filter(e =>
    !filtro || e.nombre_completo.toLowerCase().includes(filtro.toLowerCase()) || e.codigo.toLowerCase().includes(filtro.toLowerCase())
  );

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Sin estudiantes registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(e => `
    <tr data-id="${e.id}">
      <td style="display:flex;align-items:center;gap:10px">
        <div class="avatar" style="width:32px;height:32px;font-size:12px">${e.foto_url ? `<img src="${escapeHtml(e.foto_url)}">` : iniciales(e.nombre_completo)}</div>
        ${escapeHtml(e.nombre_completo)}
      </td>
      <td class="mono">${escapeHtml(e.codigo)}</td>
      <td>${escapeHtml(nombreEspecialidad(e.especialidad_id))}</td>
      <td style="font-size:12.5px;color:var(--muted)">${(e.dias_clase || []).map(d => DIAS_SEMANA_LABEL[normalizarDia(d)] || d).join(" y ")}</td>
      <td><span class="status-pill status-${e.estado}">${e.estado === "activo" ? "Activo" : "Baja"}</span></td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-ghost btn-sm" data-accion="ver">Ver</button>
        <button class="btn btn-ghost btn-sm" data-accion="editar">Editar</button>
        <button class="btn ${e.estado === 'activo' ? 'btn-danger' : 'btn-primary'} btn-sm" data-accion="toggle">${e.estado === "activo" ? "Dar de baja" : "Reactivar"}</button>
      </td>
    </tr>`).join("");

  tbody.querySelectorAll("tr").forEach(tr => {
    const est = filtrados.find(f => f.id === tr.dataset.id);
    tr.querySelector('[data-accion="ver"]').addEventListener("click", () => verEstudiante(est));
    tr.querySelector('[data-accion="editar"]').addEventListener("click", () => abrirModalEstudiante(est));
    tr.querySelector('[data-accion="toggle"]').addEventListener("click", () => toggleEstadoEstudiante(est));
  });
}

async function toggleEstadoEstudiante(est) {
  const nuevoEstado = est.estado === "activo" ? "baja" : "activo";
  await supabaseClient.from("estudiantes").update({ estado: nuevoEstado }).eq("id", est.id);
  await registrarHistorial(est.id, nuevoEstado === "baja" ? "baja" : "reactivacion",
    nuevoEstado === "baja" ? "Estudiante dado de baja" : "Estudiante reactivado");
  toast(nuevoEstado === "baja" ? "Estudiante dado de baja." : "Estudiante reactivado.", "success");
  cargarTablaEstudiantes(document.getElementById("buscarEstudiante").value);
}

async function verEstudiante(est) {
  const { data: historial } = await supabaseClient.from("historial").select("*").eq("estudiante_id", est.id).order("fecha", { ascending: false }).limit(30);
  openModal({
    title: est.nombre_completo,
    bodyHtml: `
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:18px">
        <div class="profile-photo-lg">${est.foto_url ? `<img src="${escapeHtml(est.foto_url)}">` : iniciales(est.nombre_completo)}</div>
        <div>
          <div class="mono" style="color:var(--celeste);font-size:13px">${escapeHtml(est.codigo)}</div>
          <div style="color:var(--muted);font-size:13px">${escapeHtml(nombreEspecialidad(est.especialidad_id))}</div>
          <div style="color:var(--muted);font-size:12.5px">${(est.dias_clase||[]).join(" y ")} · ${est.hora_inicio?.slice(0,5)||""} - ${est.hora_fin?.slice(0,5)||""}</div>
        </div>
      </div>
      <div class="staff-divider"><div class="lines"><i></i><i></i><i></i><i></i><i></i></div><span class="label">Historial</span></div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto">
        ${(historial || []).map(h => `
          <div style="border-left:2px solid var(--border);padding-left:10px">
            <div style="font-size:13px">${escapeHtml(h.descripcion)}</div>
            <div style="font-size:11px;color:var(--muted-2)">${new Date(h.fecha).toLocaleString("es-BO")}</div>
          </div>`).join("") || `<span style="color:var(--muted)">Sin eventos registrados.</span>`}
      </div>
    `
  });
}

function abrirModalEstudiante(est = null) {
  const editar = !!est;
  const diasSel = est?.dias_clase || [];
  openModal({
    title: editar ? "Editar estudiante" : "Nuevo estudiante",
    bodyHtml: `
      <div class="field"><label>Nombre completo</label><input id="fNombre" value="${est ? escapeHtml(est.nombre_completo) : ""}" required /></div>
      <div class="form-row">
        <div class="field"><label>Especialidad</label>
          <select id="fEspecialidad">${state.especialidades.map(e => `<option value="${e.id}" ${est?.especialidad_id === e.id ? "selected" : ""}>${escapeHtml(e.nombre)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Fecha de ingreso</label><input type="date" id="fFechaIngreso" value="${est?.fecha_ingreso || toISODate(new Date())}" /></div>
      </div>
      <div class="field"><label>Días de clase (máx. 2)</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${["lunes","martes","miercoles","jueves","viernes","sabado"].map(d => `
            <label style="display:flex;align-items:center;gap:5px;font-size:12.5px;background:var(--bg-soft);border:1px solid var(--border);padding:6px 10px;border-radius:8px">
              <input type="checkbox" class="fDia" value="${d}" ${diasSel.map(normalizarDia).includes(d) ? "checked" : ""}/> ${DIAS_SEMANA_LABEL[d]}
            </label>`).join("")}
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>Hora inicio</label><input type="time" id="fHoraInicio" value="${est?.hora_inicio?.slice(0,5) || "16:00"}" /></div>
        <div class="field"><label>Hora fin</label><input type="time" id="fHoraFin" value="${est?.hora_fin?.slice(0,5) || "17:00"}" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Teléfono</label><input id="fTelefono" value="${est ? escapeHtml(est.telefono || "") : ""}" /></div>
        <div class="field"><label>Correo</label><input type="email" id="fCorreo" value="${est ? escapeHtml(est.correo || "") : ""}" /></div>
      </div>
      <div class="field"><label>Foto (URL, opcional)</label><input id="fFoto" value="${est ? escapeHtml(est.foto_url || "") : ""}" /></div>
      <div class="form-row">
        <div class="field"><label>Usuario</label><input id="fUsuario" value="${est ? escapeHtml(est.usuario) : ""}" required /></div>
        <div class="field"><label>Contraseña</label><input id="fPassword" value="${est ? escapeHtml(est.password) : ""}" required /></div>
      </div>
      <div class="field"><label>Monto mensual (${state.configuracion?.moneda || "Bs"})</label><input type="number" step="0.01" id="fMonto" value="${est?.monto_mensual ?? ""}" /></div>
      <div class="error-msg" id="fError"></div>
    `,
    footerHtml: `<button class="btn btn-ghost" id="cancelarForm">Cancelar</button><button class="btn btn-primary" id="guardarForm">${editar ? "Guardar cambios" : "Registrar estudiante"}</button>`,
    onMount: () => {
      document.getElementById("cancelarForm").addEventListener("click", closeModal);
      document.querySelectorAll(".fDia").forEach(cb => {
        cb.addEventListener("change", () => {
          const marcados = [...document.querySelectorAll(".fDia:checked")];
          if (marcados.length > 2) cb.checked = false;
        });
      });
      document.getElementById("guardarForm").addEventListener("click", () => guardarEstudiante(est));
    }
  });
}

async function guardarEstudiante(est) {
  const errEl = document.getElementById("fError");
  const nombre = document.getElementById("fNombre").value.trim();
  const dias = [...document.querySelectorAll(".fDia:checked")].map(c => c.value);
  const payload = {
    nombre_completo: nombre,
    especialidad_id: document.getElementById("fEspecialidad").value,
    fecha_ingreso: document.getElementById("fFechaIngreso").value,
    dias_clase: dias,
    hora_inicio: document.getElementById("fHoraInicio").value,
    hora_fin: document.getElementById("fHoraFin").value,
    telefono: document.getElementById("fTelefono").value.trim(),
    correo: document.getElementById("fCorreo").value.trim(),
    foto_url: document.getElementById("fFoto").value.trim(),
    usuario: document.getElementById("fUsuario").value.trim(),
    password: document.getElementById("fPassword").value,
    monto_mensual: Number(document.getElementById("fMonto").value || 0)
  };

  if (!nombre || dias.length === 0 || !payload.usuario || !payload.password) {
    errEl.textContent = "Completa nombre, al menos un día de clase, usuario y contraseña.";
    return;
  }

  try {
    if (est) {
      await supabaseClient.from("estudiantes").update(payload).eq("id", est.id).select();
    } else {
      payload.codigo = await generarCodigoUnico(nombre);
      payload.fecha_inicio_mensualidad = payload.fecha_ingreso;
      const { data: nuevo, error } = await supabaseClient.from("estudiantes").insert(payload).select().single();
      if (error) throw error;
      await generarCalendarioInicial(nuevo);
      await registrarHistorial(nuevo.id, "alta", "Estudiante registrado en el sistema");
    }
    closeModal();
    toast(est ? "Estudiante actualizado." : "Estudiante registrado.", "success");
    cargarTablaEstudiantes("");
  } catch (err) {
    console.error(err);
    errEl.textContent = "Error al guardar. Verifica que el usuario no esté repetido.";
  }
}

async function generarCodigoUnico(nombre) {
  const base = generarIniciales(nombre);
  let candidato = base;
  let n = 1;
  while (true) {
    const { data } = await supabaseClient.from("estudiantes").select("id").eq("codigo", candidato).maybeSingle();
    if (!data) return candidato;
    n++;
    candidato = `${base}${n}`;
  }
}

// ================= PAGOS =================
async function renderPagosView() {
  const el = document.getElementById("adminContent");
  el.innerHTML = `<div class="empty-state">Cargando pagos…</div>`;

  const hoyISO = toISODate(new Date());
  const { data: estudiantes } = await supabaseClient.from("estudiantes").select("*").eq("estado", "activo").order("nombre_completo");
  const pendientes = (estudiantes || []).filter(e => e.saldo_pendiente > 0 || debeCobrarHoy(e, hoyISO));

  const { data: pagos } = await supabaseClient.from("pagos").select("*, estudiantes(nombre_completo,codigo)").order("fecha", { ascending: false }).limit(40);

  el.innerHTML = `
    <div class="section-head"><h3>Mensualidades pendientes</h3></div>
    <div class="agenda-list" style="margin-bottom:30px" id="pendientesList">
      ${pendientes.length === 0 ? `<div class="empty-state">No hay mensualidades pendientes de cobro hoy.</div>` : pendientes.map(e => `
        <div class="agenda-card" data-id="${e.id}">
          <div class="avatar">${e.foto_url ? `<img src="${escapeHtml(e.foto_url)}">` : iniciales(e.nombre_completo)}</div>
          <div class="agenda-info">
            <div class="name">${escapeHtml(e.nombre_completo)} <span class="mono" style="color:var(--muted-2);font-size:11px">${escapeHtml(e.codigo)}</span></div>
            <div class="meta">${escapeHtml(nombreEspecialidad(e.especialidad_id))} · Adeuda ${state.configuracion?.moneda || "Bs"} ${(e.saldo_pendiente > 0 ? e.saldo_pendiente : e.monto_mensual).toFixed(2)}</div>
          </div>
          <span class="badge badge-cobrar">💰 Cobrar</span>
          <button class="btn btn-primary btn-sm" data-accion="pagar">Registrar pago</button>
        </div>`).join("")}
    </div>
    <div class="section-head"><h3>Historial de pagos</h3></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Recibo</th><th>Estudiante</th><th>Fecha</th><th>Monto</th><th>Tipo</th><th>Saldo</th><th></th></tr></thead>
      <tbody>
        ${(pagos || []).map(p => `
          <tr data-id="${p.id}">
            <td class="mono">${escapeHtml(p.numero_recibo)}</td>
            <td>${escapeHtml(p.estudiantes?.nombre_completo || "—")}</td>
            <td>${formatDateShort(p.fecha)}</td>
            <td>${state.configuracion?.moneda || "Bs"} ${Number(p.monto).toFixed(2)}</td>
            <td>${p.tipo === "completo" ? "Completo" : "Parcial"}</td>
            <td>${state.configuracion?.moneda || "Bs"} ${Number(p.saldo_pendiente).toFixed(2)}</td>
            <td><button class="btn btn-ghost btn-sm" data-accion="pdf">PDF</button></td>
          </tr>`).join("") || `<tr><td colspan="7" class="empty-state">Sin pagos registrados.</td></tr>`}
      </tbody>
    </table></div>
  `;

  document.querySelectorAll('#pendientesList [data-accion="pagar"]').forEach(btn => {
    const card = btn.closest(".agenda-card");
    const est = pendientes.find(e => e.id === card.dataset.id);
    btn.addEventListener("click", () => abrirModalPago(est));
  });

  document.querySelectorAll('[data-accion="pdf"]').forEach(btn => {
    const tr = btn.closest("tr");
    const pago = pagos.find(p => p.id === tr.dataset.id);
    btn.addEventListener("click", async () => {
      const { data: est } = await supabaseClient.from("estudiantes").select("*").eq("id", pago.estudiante_id).maybeSingle();
      generarReciboPDF(pago, est || { nombre_completo: pago.estudiantes?.nombre_completo, codigo: pago.estudiantes?.codigo }, nombreEspecialidad(est?.especialidad_id), state.configuracion);
    });
  });
}

function abrirModalPago(est) {
  const deuda = est.saldo_pendiente > 0 ? est.saldo_pendiente : Number(est.monto_mensual || 0);
  openModal({
    title: `Registrar pago — ${est.nombre_completo}`,
    bodyHtml: `
      <div class="field"><label>Monto adeudado</label><input value="${state.configuracion?.moneda || "Bs"} ${deuda.toFixed(2)}" disabled /></div>
      <div class="field"><label>Monto a pagar</label><input type="number" step="0.01" id="pMonto" value="${deuda.toFixed(2)}" /></div>
      <div class="field"><label>Tipo de pago</label>
        <select id="pTipo"><option value="completo">Completo</option><option value="parcial">Parcial</option></select>
      </div>
      <div class="field"><label>Observaciones</label><textarea id="pObs" rows="2"></textarea></div>
      <div class="error-msg" id="pError"></div>
    `,
    footerHtml: `<button class="btn btn-ghost" id="cancelarPago">Cancelar</button><button class="btn btn-primary" id="confirmarPago">Registrar y generar recibo</button>`,
    onMount: () => {
      document.getElementById("cancelarPago").addEventListener("click", closeModal);
      document.getElementById("confirmarPago").addEventListener("click", async () => {
        const monto = Number(document.getElementById("pMonto").value);
        const tipo = document.getElementById("pTipo").value;
        const obs = document.getElementById("pObs").value.trim();
        if (!monto || monto <= 0) { document.getElementById("pError").textContent = "Ingresa un monto válido."; return; }
        try {
          const pago = await registrarPago(est, monto, tipo, obs);
          closeModal();
          toast("Pago registrado.", "success");
          generarReciboPDF(pago, est, nombreEspecialidad(est.especialidad_id), state.configuracion);
          renderPagosView();
        } catch (err) {
          console.error(err);
          document.getElementById("pError").textContent = "Error al registrar el pago.";
        }
      });
    }
  });
}

// ================= ESPECIALIDADES =================
async function renderEspecialidadesView() {
  const el = document.getElementById("adminContent");
  el.innerHTML = `
    <div class="section-head">
      <h3>Especialidades</h3>
      <button class="btn btn-primary" id="nuevaEspBtn">+ Nueva especialidad</button>
    </div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Nombre</th><th>Estado</th><th></th></tr></thead>
      <tbody id="espTbody"></tbody>
    </table></div>
  `;
  document.getElementById("nuevaEspBtn").addEventListener("click", () => {
    const nombre = prompt("Nombre de la nueva especialidad:");
    if (nombre?.trim()) crearEspecialidad(nombre.trim());
  });
  pintarEspecialidades();
}

async function pintarEspecialidades() {
  const { data } = await supabaseClient.from("especialidades").select("*").order("nombre");
  state.especialidades = data || [];
  document.getElementById("espTbody").innerHTML = state.especialidades.map(e => `
    <tr data-id="${e.id}">
      <td>${escapeHtml(e.nombre)}</td>
      <td><span class="status-pill ${e.activo ? "status-activo" : "status-baja"}">${e.activo ? "Activa" : "Inactiva"}</span></td>
      <td style="text-align:right"><button class="btn btn-ghost btn-sm" data-accion="toggle">${e.activo ? "Desactivar" : "Activar"}</button></td>
    </tr>`).join("") || `<tr><td colspan="3" class="empty-state">Sin especialidades registradas.</td></tr>`;

  document.querySelectorAll('#espTbody [data-accion="toggle"]').forEach(btn => {
    const tr = btn.closest("tr");
    const esp = state.especialidades.find(e => e.id === tr.dataset.id);
    btn.addEventListener("click", async () => {
      await supabaseClient.from("especialidades").update({ activo: !esp.activo }).eq("id", esp.id);
      pintarEspecialidades();
    });
  });
}

async function crearEspecialidad(nombre) {
  const { error } = await supabaseClient.from("especialidades").insert({ nombre });
  if (error) { toast("No se pudo crear (¿nombre repetido?).", "error"); return; }
  toast("Especialidad creada.", "success");
  pintarEspecialidades();
}

// ================= CONFIGURACIÓN =================
async function renderConfiguracionView() {
  const el = document.getElementById("adminContent");
  const c = state.configuracion || {};
  el.innerHTML = `
    <div class="card" style="max-width:480px">
      <div class="field"><label>Nombre de la institución</label><input id="cNombre" value="${escapeHtml(c.nombre_institucion || "")}" /></div>
      <div class="field"><label>Subtítulo</label><input id="cSubtitulo" value="${escapeHtml(c.subtitulo || "")}" /></div>
      <div class="field"><label>Moneda</label><input id="cMoneda" value="${escapeHtml(c.moneda || "Bs")}" /></div>
      <div class="field"><label>Logo (URL, opcional)</label><input id="cLogo" value="${escapeHtml(c.logo_url || "")}" /></div>
      <button class="btn btn-primary" id="guardarConfigBtn">Guardar configuración</button>
      <div class="error-msg" id="cError"></div>
    </div>
  `;
  document.getElementById("guardarConfigBtn").addEventListener("click", async () => {
    const payload = {
      nombre_institucion: document.getElementById("cNombre").value.trim(),
      subtitulo: document.getElementById("cSubtitulo").value.trim(),
      moneda: document.getElementById("cMoneda").value.trim() || "Bs",
      logo_url: document.getElementById("cLogo").value.trim()
    };
    const { error } = await supabaseClient.from("configuracion").update(payload).eq("id", 1);
    if (error) { document.getElementById("cError").textContent = "Error al guardar."; return; }
    state.configuracion = { ...c, ...payload };
    toast("Configuración guardada.", "success");
  });
}
