// ============================================================
// KABERT MUSIC MANAGER — Controlador principal
// Kabert Studio · LMKE
// ============================================================

const ADMIN_PASSWORD = "kabert2026";

const state = {
  modo: null,        // "admin" | "estudiante"
  estudiante: null,  // sesión del estudiante logueado
  especialidades: [],
  configuracion: null
};

// ---------------- Splash ----------------
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    document.getElementById("splashScreen").remove();
    mostrarPantalla("studentAuthScreen");
  }, 2600);

  wireAuthScreens();
  wireSidebarToggles();
});

function mostrarPantalla(id) {
  ["studentAuthScreen", "adminAuthScreen", "adminApp", "studentApp"].forEach(s => {
    document.getElementById(s).classList.toggle("hidden", s !== id);
  });
}

// ---------------- Auth wiring ----------------
function wireAuthScreens() {
  document.getElementById("adminTriggerBtn").addEventListener("click", () => {
    mostrarPantalla("adminAuthScreen");
    document.getElementById("adminPass").value = "";
    document.getElementById("adminLoginError").textContent = "";
  });

  document.getElementById("backToStudentLogin").addEventListener("click", () => {
    mostrarPantalla("studentAuthScreen");
  });

  document.getElementById("adminLoginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const pass = document.getElementById("adminPass").value;
    if (pass === ADMIN_PASSWORD) {
      entrarComoAdmin();
    } else {
      document.getElementById("adminLoginError").textContent = "Contraseña incorrecta.";
    }
  });

  document.getElementById("studentLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = document.getElementById("studentUser").value.trim();
    const pass = document.getElementById("studentPass").value;
    const errEl = document.getElementById("studentLoginError");
    errEl.textContent = "";
    try {
      const { data, error } = await supabaseClient
        .from("estudiantes")
        .select("*")
        .eq("usuario", usuario)
        .eq("password", pass)
        .eq("estado", "activo")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        errEl.textContent = "Usuario, contraseña incorrectos o cuenta dada de baja.";
        return;
      }
      state.estudiante = data;
      entrarComoEstudiante();
    } catch (err) {
      console.error(err);
      errEl.textContent = "No se pudo conectar. Verifica la configuración de Supabase.";
    }
  });

  document.getElementById("adminLogoutBtn").addEventListener("click", () => {
    state.modo = null;
    mostrarPantalla("studentAuthScreen");
  });

  document.getElementById("studentLogoutBtn").addEventListener("click", () => {
    state.modo = null;
    state.estudiante = null;
    mostrarPantalla("studentAuthScreen");
  });
}

async function entrarComoAdmin() {
  state.modo = "admin";
  mostrarPantalla("adminApp");
  await cargarDatosBase();
  document.getElementById("adminDateChip").textContent = formatDateLong(toISODate(new Date()));
  setAdminView("dashboard");
}

async function entrarComoEstudiante() {
  state.modo = "estudiante";
  mostrarPantalla("studentApp");
  await cargarDatosBase();
  document.getElementById("studentDateChip").textContent = formatDateLong(toISODate(new Date()));
  setStudentView("perfil");
}

async function cargarDatosBase() {
  const [{ data: esp }, { data: config }] = await Promise.all([
    supabaseClient.from("especialidades").select("*").order("nombre"),
    supabaseClient.from("configuracion").select("*").eq("id", 1).maybeSingle()
  ]);
  state.especialidades = esp || [];
  state.configuracion = config || { nombre_institucion: "Escuela de Música Kabert" };
}

// ---------------- Sidebar navigation ----------------
function wireSidebarToggles() {
  document.querySelectorAll("#adminSidebar .nav-item").forEach(btn => {
    btn.addEventListener("click", () => setAdminView(btn.dataset.view));
  });
  document.querySelectorAll("#studentSidebar .nav-item").forEach(btn => {
    btn.addEventListener("click", () => setStudentView(btn.dataset.view));
  });

  const toggle = (sidebarId, scrimId, btnId) => {
    const sidebar = document.getElementById(sidebarId);
    const scrim = document.getElementById(scrimId);
    const open = () => { sidebar.classList.add("open"); scrim.classList.remove("hidden"); };
    const close = () => { sidebar.classList.remove("open"); scrim.classList.add("hidden"); };
    document.getElementById(btnId)?.addEventListener("click", open);
    scrim.addEventListener("click", close);
    return close;
  };
  const closeAdmin = toggle("adminSidebar", "sidebarScrim", "adminMenuBtn");
  const closeStudent = toggle("studentSidebar", "sidebarScrimStudent", "studentMenuBtn");
  document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => { closeAdmin(); closeStudent(); }));
}

function setAdminView(view) {
  document.querySelectorAll("#adminSidebar .nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  const titles = {
    dashboard: "Agenda del Día", estudiantes: "Estudiantes", pagos: "Pagos",
    especialidades: "Especialidades", configuracion: "Configuración"
  };
  document.getElementById("adminViewTitle").textContent = titles[view] || "";
  renderAdminView(view);
}

function setStudentView(view) {
  document.querySelectorAll("#studentSidebar .nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  const titles = { perfil: "Mi Perfil", horarios: "Horarios", historial: "Historial", mensualidades: "Mensualidades" };
  document.getElementById("studentViewTitle").textContent = titles[view] || "";
  renderStudentView(view);
}

// ---------------- Modal helper ----------------
function openModal({ title, bodyHtml, footerHtml, onMount }) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${escapeHtml(title)}</h3>
          <button class="modal-close" id="modalCloseBtn">✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ""}
      </div>
    </div>`;
  document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  if (onMount) onMount(root);
}

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}
