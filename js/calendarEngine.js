// ============================================================
// KABERT MUSIC MANAGER — Motor de Calendario
// Kabert Studio · LMKE
//
// Todo el sistema depende de este módulo. Ninguna mensualidad
// se calcula sumando días de calendario: siempre se avanza
// respetando únicamente los días reales de clase del estudiante.
// ============================================================

const SEMANAS_CALENDARIO = 12; // horizonte de generación de eventos

/** Crea el calendario inicial de un estudiante recién registrado. */
async function generarCalendarioInicial(estudiante) {
  const fechas = generarFechasClase(
    estudiante.fecha_inicio_mensualidad || estudiante.fecha_ingreso,
    estudiante.dias_clase,
    SEMANAS_CALENDARIO
  );

  if (fechas.length === 0) return;

  const eventos = fechas.map(fecha => ({
    estudiante_id: estudiante.id,
    fecha,
    hora_inicio: estudiante.hora_inicio,
    hora_fin: estudiante.hora_fin,
    estado: "programada"
  }));

  const { error } = await supabase.from("eventos_calendario").insert(eventos);
  if (error) throw error;

  // La primera fecha de clase es también la primera fecha de cobro
  const proxima = fechas[0];
  await supabase
    .from("estudiantes")
    .update({ proxima_mensualidad: proxima })
    .eq("id", estudiante.id);
}

/** Extiende el calendario si quedan pocos eventos futuros programados. */
async function extenderCalendarioSiNecesario(estudiante) {
  const hoyISO = toISODate(new Date());
  const { data: futuros } = await supabase
    .from("eventos_calendario")
    .select("fecha")
    .eq("estudiante_id", estudiante.id)
    .gte("fecha", hoyISO)
    .order("fecha", { ascending: false })
    .limit(1);

  const ultimaFecha = futuros?.[0]?.fecha;
  if (!ultimaFecha) return;

  const restantes = generarFechasClase(hoyISO, estudiante.dias_clase, 3).length;
  if (restantes > 4) return; // aún hay suficiente margen

  const nuevasFechas = generarFechasClase(ultimaFecha, estudiante.dias_clase, SEMANAS_CALENDARIO)
    .filter(f => f !== ultimaFecha);

  if (nuevasFechas.length === 0) return;

  const eventos = nuevasFechas.map(fecha => ({
    estudiante_id: estudiante.id,
    fecha,
    hora_inicio: estudiante.hora_inicio,
    hora_fin: estudiante.hora_fin,
    estado: "programada"
  }));
  await supabase.from("eventos_calendario").insert(eventos);
}

/** Marca una clase como "Asistió". No afecta la mensualidad. */
async function registrarAsistencia(evento, estudiante) {
  await supabase
    .from("eventos_calendario")
    .update({ estado: "asistio" })
    .eq("id", evento.id);

  await registrarHistorial(estudiante.id, "asistencia",
    `Asistió a clase del ${formatDateShort(evento.fecha)}`);
}

/** Marca una clase como "Falta". No genera reposición ni modifica la mensualidad. */
async function registrarFalta(evento, estudiante) {
  await supabase
    .from("eventos_calendario")
    .update({ estado: "falta" })
    .eq("id", evento.id);

  await registrarHistorial(estudiante.id, "falta",
    `Falta sin permiso el ${formatDateShort(evento.fecha)}`);
}

/**
 * Marca una clase como "Permiso". Si conReposicion es true:
 *  1) crea automáticamente una clase de reposición en el siguiente
 *     día válido según el horario del estudiante,
 *  2) recalcula la próxima fecha de mensualidad desplazándola
 *     exactamente una clase dentro del horario real (nunca días fijos).
 */
async function registrarPermiso(evento, estudiante, conReposicion) {
  await supabase
    .from("eventos_calendario")
    .update({ estado: "permiso" })
    .eq("id", evento.id);

  await registrarHistorial(estudiante.id, "permiso",
    `Permiso registrado para la clase del ${formatDateShort(evento.fecha)}` +
    (conReposicion ? " (con reposición)" : " (sin reposición)"));

  if (!conReposicion) return;

  // 1) Buscar la última fecha ya programada para no chocar con otro evento
  const { data: futuros } = await supabase
    .from("eventos_calendario")
    .select("fecha")
    .eq("estudiante_id", estudiante.id)
    .order("fecha", { ascending: false })
    .limit(1);

  const baseFecha = futuros?.[0]?.fecha || evento.fecha;
  const fechaReposicion = siguienteFechaClase(baseFecha, estudiante.dias_clase);
  if (!fechaReposicion) return;

  await supabase.from("eventos_calendario").insert({
    estudiante_id: estudiante.id,
    fecha: fechaReposicion,
    hora_inicio: estudiante.hora_inicio,
    hora_fin: estudiante.hora_fin,
    estado: "reposicion",
    es_reposicion_de: evento.id
  });

  await registrarHistorial(estudiante.id, "reposicion",
    `Reposición creada automáticamente para el ${formatDateShort(fechaReposicion)}`);

  // 2) Recalcular la próxima mensualidad: se desplaza UNA clase real
  const proximaActual = estudiante.proxima_mensualidad || evento.fecha;
  const nuevaProxima = siguienteFechaClase(proximaActual, estudiante.dias_clase);
  if (nuevaProxima) {
    await supabase
      .from("estudiantes")
      .update({ proxima_mensualidad: nuevaProxima })
      .eq("id", estudiante.id);
  }
}

async function registrarHistorial(estudianteId, tipo, descripcion) {
  await supabase.from("historial").insert({
    estudiante_id: estudianteId,
    tipo,
    descripcion
  });
}

/** Devuelve true si hoy corresponde cobrar la mensualidad del estudiante. */
function debeCobrarHoy(estudiante, hoyISO) {
  return estudiante.proxima_mensualidad && estudiante.proxima_mensualidad === hoyISO;
}
