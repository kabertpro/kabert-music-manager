// ============================================================
// KABERT MUSIC MANAGER — Pagos y Recibos PDF
// Kabert Studio · LMKE
// ============================================================

/** Registra un pago (completo o parcial) y actualiza el saldo del estudiante. */
async function registrarPago(estudiante, monto, tipo, observaciones) {
  const deudaActual = estudiante.saldo_pendiente > 0
    ? estudiante.saldo_pendiente
    : Number(estudiante.monto_mensual || 0);

  const nuevoSaldo = Math.max(deudaActual - Number(monto), 0);

  // Número de recibo correlativo
  const { count } = await supabaseClient
    .from("pagos")
    .select("id", { count: "exact", head: true });
  const numeroRecibo = generarNumeroRecibo((count || 0) + 1);

  const { data: pago, error } = await supabaseClient
    .from("pagos")
    .insert({
      estudiante_id: estudiante.id,
      numero_recibo: numeroRecibo,
      monto,
      tipo,
      saldo_pendiente: nuevoSaldo,
      observaciones: observaciones || null
    })
    .select()
    .single();
  if (error) throw error;

  const update = { saldo_pendiente: nuevoSaldo };

  // Si quedó saldado, avanzar la mensualidad al siguiente ciclo real
  if (nuevoSaldo === 0 && estudiante.dias_clase?.length) {
    const base = estudiante.proxima_mensualidad || toISODate(new Date());
    const siguienteCiclo = siguienteFechaClase(base, estudiante.dias_clase);
    if (siguienteCiclo) update.proxima_mensualidad = siguienteCiclo;
  }

  await supabaseClient.from("estudiantes").update(update).eq("id", estudiante.id);

  await registrarHistorial(estudiante.id, "pago",
    `Pago ${tipo === "completo" ? "completo" : "parcial"} de ${estudiante.moneda || "Bs"} ${monto} — recibo ${numeroRecibo}`);

  return { ...pago, saldo_pendiente: nuevoSaldo };
}

/** Genera y descarga un recibo PDF profesional para un pago. */
async function generarReciboPDF(pago, estudiante, especialidadNombre, config) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a5" });

  const azul = [11, 21, 38];
  const celeste = [76, 201, 240];
  const gris = [110, 120, 135];

  doc.setFillColor(...azul);
  doc.rect(0, 0, 420, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(config?.nombre_institucion || "Escuela de Música Kabert", 30, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...celeste);
  doc.text(config?.subtitulo || "Sistema de Gestión Académica", 30, 58);
  doc.setTextColor(200, 210, 220);
  doc.text("Kabert Studio · LMKE", 30, 74);

  doc.setTextColor(...gris);
  doc.setFontSize(9);
  doc.text(`Recibo N°`, 300, 40);
  doc.setTextColor(...azul);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(pago.numero_recibo, 300, 56);

  let y = 120;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const linea = (label, valor) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 30, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(valor ?? "—"), 160, y);
    y += 22;
  };

  linea("Estudiante:", estudiante.nombre_completo);
  linea("Código:", estudiante.codigo);
  linea("Especialidad:", especialidadNombre || "—");
  linea("Concepto:", "Mensualidad");
  linea("Fecha:", formatDateLong(pago.fecha));
  linea("Monto pagado:", `${config?.moneda || "Bs"} ${Number(pago.monto).toFixed(2)}`);
  linea("Saldo pendiente:", `${config?.moneda || "Bs"} ${Number(pago.saldo_pendiente).toFixed(2)}`);

  y += 10;
  doc.setDrawColor(...celeste);
  doc.setLineWidth(1);
  doc.line(30, y, 390, y);
  y += 24;

  doc.setFontSize(9);
  doc.setTextColor(...gris);
  doc.text("Documento generado automáticamente por Kabert Music Manager.", 30, y);

  doc.save(`Recibo_${pago.numero_recibo}_${estudiante.codigo}.pdf`);
}
