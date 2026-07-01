// ============================================================
// KABERT MUSIC MANAGER — Utilidades
// Kabert Studio · LMKE
// ============================================================

const DIAS_SEMANA = [
  "domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"
];

const DIAS_SEMANA_LABEL = {
  domingo: "Domingo", lunes: "Lunes", martes: "Martes",
  miercoles: "Miércoles", jueves: "Jueves", viernes: "Viernes", sabado: "Sábado"
};

function normalizarDia(d) {
  return d
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita tildes: miércoles -> miercoles
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateLong(iso) {
  const date = parseISODate(iso);
  return date.toLocaleDateString("es-BO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}

function formatDateShort(iso) {
  const date = parseISODate(iso);
  return date.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Devuelve la siguiente fecha (después de `fromISO`, exclusiva) en la que
 * ocurre una clase, según los días de la semana del horario del estudiante.
 * Este es el corazón del motor de calendario: nunca suma días fijos,
 * siempre respeta los días reales de clase.
 */
function siguienteFechaClase(fromISO, diasClase) {
  const diasNormalizados = diasClase.map(normalizarDia);
  let cursor = parseISODate(fromISO);
  for (let i = 1; i <= 14; i++) {
    const candidato = new Date(cursor);
    candidato.setDate(candidato.getDate() + i);
    const nombreDia = normalizarDia(DIAS_SEMANA[candidato.getDay()]);
    if (diasNormalizados.includes(nombreDia)) {
      return toISODate(candidato);
    }
  }
  return null; // el estudiante no tiene días de clase configurados
}

/**
 * Genera todas las fechas de clase entre fromISO (inclusive si coincide con
 * un día de clase) y un número de semanas hacia adelante.
 */
function generarFechasClase(fromISO, diasClase, semanas = 8) {
  const diasNormalizados = diasClase.map(normalizarDia);
  const fechas = [];
  const inicio = parseISODate(fromISO);
  const totalDias = semanas * 7;
  for (let i = 0; i <= totalDias; i++) {
    const candidato = new Date(inicio);
    candidato.setDate(candidato.getDate() + i);
    const nombreDia = normalizarDia(DIAS_SEMANA[candidato.getDay()]);
    if (diasNormalizados.includes(nombreDia)) {
      fechas.push(toISODate(candidato));
    }
  }
  return fechas;
}

/** Genera un código a partir de las iniciales del nombre, ej: "Juan Pérez Mamani" -> "JPM" */
function generarIniciales(nombreCompleto) {
  const partes = nombreCompleto.trim().split(/\s+/);
  const iniciales = partes.map(p => p[0]?.toUpperCase() || "").join("");
  return iniciales.slice(0, 4) || "EST";
}

/** Genera un número de recibo correlativo con formato KM-000123 */
function generarNumeroRecibo(consecutivo) {
  return `KM-${String(consecutivo).padStart(6, "0")}`;
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toast(mensaje, tipo = "info") {
  const el = document.getElementById("toastContainer");
  if (!el) return alert(mensaje);
  const item = document.createElement("div");
  item.className = `toast toast-${tipo}`;
  item.textContent = mensaje;
  el.appendChild(item);
  requestAnimationFrame(() => item.classList.add("show"));
  setTimeout(() => {
    item.classList.remove("show");
    setTimeout(() => item.remove(), 300);
  }, 3200);
}
