// ============================================================
// KABERT MUSIC MANAGER — Portal del Estudiante
// Kabert Studio · LMKE
// ============================================================

function renderStudentView(view) {
  const map = {
    perfil: renderPerfilView,
    horarios: renderHorariosView,
    historial: renderHistorialEstudianteView,
    mensualidades: renderMensualidadesEstudianteView
  };
  (map[view] || renderPerfilView)();
}

function renderPerfilView() {
  const e = state.estudiante;
  const el = document.getElementById("studentContent");
  el.innerHTML = `
    <div class="card" style="max-width:520px">
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px">
        <div class="profile-photo-lg">${e.foto_url ? `<img src="${escapeHtml(e.foto_url)}">` : iniciales(e.nombre_completo)}</div>
        <div>
          <div class="mono" style="color:var(--celeste);font-size:13px">${escapeHtml(e.codigo)}</div>
          <div style="color:var(--muted);font-size:13px">${escapeHtml(nombreEspecialidad(e.especialidad_id))}</div>
        </div>
      </div>
      <div class="field"><label>Nombre completo</label><input id="pNombre" value="${escapeHtml(e.nombre_completo)}" /></div>
      <div class="field"><label>Teléfono</label><input id="pTelefono" value="${escapeHtml(e.telefono || "")}" /></div>
      <div class="field"><label>Correo</label><input type="email" id="pCorreo" value="${escapeHtml(e.correo || "")}" /></div>
      <div class="field"><label>Fotografía (URL)</label><input id="pFoto" value="${escapeHtml(e.foto_url || "")}" /></div>
      <div class="field"><label>Nueva contraseña (opcional)</label><input type="password" id="pPassword" placeholder="Dejar en blanco para no cambiar" /></div>
      <button class="btn btn-primary" id="guardarPerfilBtn">Guardar cambios</button>
      <div class="error-msg" id="pError"></div>
    </div>
  `;
  document.getElementById("guardarPerfilBtn").addEventListener("click", async () => {
    const payload = {
      nombre_completo: document.getElementById("pNombre").value.trim(),
      telefono: document.getElementById("pTelefono").value.trim(),
      correo: document.getElementById("pCorreo").value.trim(),
      foto_url: document.getElementById("pFoto").value.trim()
    };
    const nuevaPass = document.getElementById("pPassword").value;
    if (nuevaPass) payload.password = nuevaPass;
    const { error } = await supabaseClient.from("estudiantes").update(payload).eq("id", e.id);
    if (error) { document.getElementById("pError").textContent = "Error al guardar los cambios."; return; }
    state.estudiante = { ...e, ...payload };
    toast("Perfil actualizado.", "success");
    renderPerfilView();
  });
}

async function renderHorariosView() {
  const e = state.estudiante;
  const el = document.getElementById("studentContent");
  el.innerHTML = `<div class="empty-state">Cargando horarios…</div>`;

  const hoyISO = toISODate(new Date());
  const { data: eventos } = await supabase
    .from("eventos_calendario")
    .select("*")
    .eq("estudiante_id", e.id)
    .gte("fecha", hoyISO)
    .order("fecha", { ascending: true })
    .limit(12);

  el.innerHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="label" style="color:var(--muted);font-size:12px;font-weight:600;text-transform:uppercase">Horario fijo</div>
      <div style="font-size:16px;margin-top:6px">${(e.dias_clase || []).map(d => DIAS_SEMANA_LABEL[normalizarDia(d)] || d).join(" y ")}</div>
      <div style="color:var(--muted);font-size:13px;margin-top:2px">${e.hora_inicio?.slice(0,5) || "—"} — ${e.hora_fin?.slice(0,5) || "—"}</div>
    </div>
    <div class="staff-divider"><div class="lines"><i></i><i></i><i></i><i></i><i></i></div><span class="label">Próximas clases</span></div>
    <div class="agenda-list">
      ${(eventos || []).map(ev => `
        <div class="agenda-card estado-${ev.estado}">
          <div class="agenda-info">
            <div class="name">${formatDateLong(ev.fecha)}</div>
            <div class="meta">${ev.hora_inicio?.slice(0,5) || ""} ${ev.hora_fin ? "— " + ev.hora_fin.slice(0,5) : ""}</div>
          </div>
          <span class="badge badge-neutral">${etiquetaEstado(ev.estado)}</span>
        </div>`).join("") || `<div class="empty-state">No hay clases futuras programadas.</div>`}
    </div>
  `;
}

async function renderHistorialEstudianteView() {
  const e = state.estudiante;
  const el = document.getElementById("studentContent");
  el.innerHTML = `<div class="empty-state">Cargando historial…</div>`;
  const { data: historial } = await supabaseClient.from("historial").select("*").eq("estudiante_id", e.id).order("fecha", { ascending: false });

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${(historial || []).map(h => `
        <div class="card" style="padding:14px 16px">
          <div style="font-size:13.5px">${escapeHtml(h.descripcion)}</div>
          <div style="font-size:11.5px;color:var(--muted-2);margin-top:4px">${new Date(h.fecha).toLocaleString("es-BO")}</div>
        </div>`).join("") || `<div class="empty-state">Aún no hay eventos en tu historial.</div>`}
    </div>
  `;
}

async function renderMensualidadesEstudianteView() {
  const e = state.estudiante;
  const el = document.getElementById("studentContent");
  el.innerHTML = `<div class="empty-state">Cargando mensualidades…</div>`;

  const { data: pagos } = await supabaseClient.from("pagos").select("*").eq("estudiante_id", e.id).order("fecha", { ascending: false });

  const deuda = e.saldo_pendiente > 0 ? e.saldo_pendiente : 0;

  el.innerHTML = `
    <div class="grid grid-2" style="margin-bottom:22px">
      <div class="card stat-card"><span class="label">Próxima mensualidad</span><span class="value">${e.proxima_mensualidad ? formatDateShort(e.proxima_mensualidad) : "—"}</span></div>
      <div class="card stat-card"><span class="label">Saldo pendiente</span><span class="value ${deuda > 0 ? "warning" : "celeste"}">${state.configuracion?.moneda || "Bs"} ${deuda.toFixed(2)}</span></div>
    </div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Recibo</th><th>Fecha</th><th>Monto</th><th>Tipo</th><th></th></tr></thead>
      <tbody>
        ${(pagos || []).map(p => `
          <tr data-id="${p.id}">
            <td class="mono">${escapeHtml(p.numero_recibo)}</td>
            <td>${formatDateShort(p.fecha)}</td>
            <td>${state.configuracion?.moneda || "Bs"} ${Number(p.monto).toFixed(2)}</td>
            <td>${p.tipo === "completo" ? "Completo" : "Parcial"}</td>
            <td><button class="btn btn-ghost btn-sm" data-accion="pdf">PDF</button></td>
          </tr>`).join("") || `<tr><td colspan="5" class="empty-state">Aún no tienes pagos registrados.</td></tr>`}
      </tbody>
    </table></div>
  `;

  document.querySelectorAll('[data-accion="pdf"]').forEach(btn => {
    const tr = btn.closest("tr");
    const pago = pagos.find(p => p.id === tr.dataset.id);
    btn.addEventListener("click", () => generarReciboPDF(pago, e, nombreEspecialidad(e.especialidad_id), state.configuracion));
  });
}
