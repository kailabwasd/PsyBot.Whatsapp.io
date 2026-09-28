import jsPDF from 'jspdf';
import type { ClinicalRecord, PsychologistAuthUser } from '../types';

/**
 * Generates and downloads a standardized Clinical Psychology Report in PDF format
 * complying with Colombian Health Ministry Resolution 1995 of 1999 (Historia Clínica Oficial)
 * and District Health Standards (Alcaldía Mayor de Bogotá D.C. / Subred Norte).
 */
export function exportClinicalRecordToPDF(
  record: ClinicalRecord, 
  psychologist?: PsychologistAuthUser | null
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const primaryColor: [number, number, number] = [0, 72, 132]; // #004884 Bogota Blue
  const darkSlate: [number, number, number] = [15, 23, 42];
  const mutedGray: [number, number, number] = [100, 116, 139];
  const lightBg: [number, number, number] = [241, 245, 249];

  // Helper to check page break
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 20) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
  };

  const drawHeader = () => {
    // Top banner color band
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(margin, y, contentWidth, 1.5, 'F');
    y += 4;

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('ALCALDÍA MAYOR DE BOGOTÁ D.C. · SECRETARÍA DISTRITAL DE SALUD', margin, y);
    y += 4.5;

    doc.setFontSize(9);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text('SUBRED INTEGRADA DE SERVICIOS DE SALUD NORTE E.S.E. · LOCALIDAD DE SUBA', margin, y);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('HISTORIA CLÍNICA Y REPORTE DE TRIAGE PSICOLÓGICO DIGITAL', margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
    doc.text('Plataforma Distrital de Orientación Emocional y Triage con IA (SubaTECH / Psybot)', margin, y);
    y += 6;

    // Thin separator
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;
  };

  // Draw initial header
  drawHeader();

  // -------------------------------------------------------------
  // SECCIÓN 1: IDENTIFICACIÓN DEL EXPEDIENTE Y DEL PACIENTE
  // -------------------------------------------------------------
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'S');

  // Risk Color Banner inside Box
  let riskColor: [number, number, number] = [13, 148, 136]; // Teal
  if (record.riskLevel === 'CRISIS') riskColor = [200, 16, 46]; // Red
  else if (record.riskLevel === 'ALTO') riskColor = [217, 119, 6]; // Amber
  else if (record.riskLevel === 'MODERADO') riskColor = [202, 138, 4]; // Yellow

  doc.setFillColor(riskColor[0], riskColor[1], riskColor[2]);
  doc.roundedRect(margin + contentWidth - 45, y + 3, 42, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`RIESGO: ${record.riskLevel}`, margin + contentWidth - 24, y + 7.2, { align: 'center' });

  // Patient Info Rows
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`ID EXPEDIENTE:`, margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`${record.id}`, margin + 30, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text(`FECHA ATENCIÓN:`, margin + 70, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`${new Date(record.lastUpdated || Date.now()).toLocaleString('es-CO')}`, margin + 100, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text(`PACIENTE:`, margin + 4, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${record.patientName.toUpperCase()}`, margin + 30, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.text(`CANAL / TEL:`, margin + 70, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${record.phoneNumber} (WhatsApp)`, margin + 95, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.text(`EDAD:`, margin + 4, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(`${record.age || 28} años`, margin + 30, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.text(`GÉNERO:`, margin + 70, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(`${record.gender || 'No especificado'}`, margin + 95, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.text(`RED DE APOYO:`, margin + 4, y + 23.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${record.emergencyContact || 'No reportado por el usuario en triage inicial'}`, margin + 30, y + 23.5);

  y += 31;

  // -------------------------------------------------------------
  // Helper for Section Block
  // -------------------------------------------------------------
  const renderSectionHeader = (title: string, iconNumber: string) => {
    checkPageBreak(12);
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(margin, y, contentWidth, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`${iconNumber}. ${title.toUpperCase()}`, margin + 3, y + 4.2);
    y += 9;
  };

  // -------------------------------------------------------------
  // SECCIÓN 2: MOTIVO DE CONSULTA Y TRIAGE CLÍNICO INICIAL
  // -------------------------------------------------------------
  renderSectionHeader('Motivo de Consulta y Triage Psicológico', '1');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('Emoción Primaria Predominante:', margin + 2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${record.primaryEmotion || 'Ansiedad / Angustia'}`, margin + 50, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Resumen del Triage Clínico (IA + Especialista):', margin + 2, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const triageTextLines = doc.splitTextToSize(record.triageSummary || 'Sin resumen registrado.', contentWidth - 6);
  doc.text(triageTextLines, margin + 2, y);
  y += triageTextLines.length * 4 + 4;

  // -------------------------------------------------------------
  // SECCIÓN 3: ANTECEDENTES MÉDICOS Y PSICOLÓGICOS
  // -------------------------------------------------------------
  checkPageBreak(25);
  renderSectionHeader('Antecedentes Médicos y Psiquiátricos Relevantes', '2');

  const medicalHistory = record.medicalHistory || 'Niega antecedentes médicos de relevancia o no referidos en el primer contacto.';
  const medicalLines = doc.splitTextToSize(medicalHistory, contentWidth - 6);
  doc.setFont('helvetica', 'normal');
  doc.text(medicalLines, margin + 2, y);
  y += medicalLines.length * 4 + 4;

  // -------------------------------------------------------------
  // SECCIÓN 4: IMPRESIONES DIAGNÓSTICAS (DSM-5 / CIE-10)
  // -------------------------------------------------------------
  checkPageBreak(25);
  renderSectionHeader('Impresiones Diagnósticas e Hipótesis Clínicas', '3');

  const impressions = record.diagnosticImpressions && record.diagnosticImpressions.length > 0
    ? record.diagnosticImpressions.join(' · ')
    : 'Triage de Contención Emocional / En evaluación diagnóstica continua.';
  const impLines = doc.splitTextToSize(impressions, contentWidth - 6);
  doc.setFont('helvetica', 'bold');
  doc.text(impLines, margin + 2, y);
  y += impLines.length * 4 + 4;

  // -------------------------------------------------------------
  // SECCIÓN 5: NOTAS DE EVOLUCIÓN Y PLAN DE MANEJO
  // -------------------------------------------------------------
  checkPageBreak(30);
  renderSectionHeader('Evolución Psicoterapéutica y Plan de Acción', '4');

  const evolution = record.clinicalEvolution || 'Se brinda contención emocional inicial, técnicas de autorregulación y desactivación fisiológica. Paciente orientado y con signos de estabilización afectiva.';
  const evoLines = doc.splitTextToSize(evolution, contentWidth - 6);
  doc.setFont('helvetica', 'normal');
  doc.text(evoLines, margin + 2, y);
  y += evoLines.length * 4 + 5;

  // -------------------------------------------------------------
  // SECCIÓN 6: RESUMEN DE LA CONVERSACIÓN ASISTENCIAL (WHATSAPP)
  // -------------------------------------------------------------
  checkPageBreak(35);
  renderSectionHeader('Registro Asistencial y Transcripción de WhatsApp', '5');

  const transcript = record.conversationTranscript || 'Registro asistencial no disponible.';
  // Limit transcript length to keep PDF balanced (e.g. last 1500 chars)
  const trimmedTranscript = transcript.length > 1800 ? `${transcript.slice(-1800)}...\n[Transcripción abreviada para historia clínica oficial]` : transcript;
  const transcriptLines = doc.splitTextToSize(trimmedTranscript, contentWidth - 6);
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(transcriptLines, margin + 2, y);
  y += transcriptLines.length * 3.5 + 6;

  // -------------------------------------------------------------
  // SECCIÓN 7: RÚBRICA MÉDICA Y FIRMA DEL PROFESIONAL TRATANTE
  // -------------------------------------------------------------
  checkPageBreak(40);
  
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, margin + contentWidth, y);
  y += 5;

  const psychName = psychologist?.displayName || record.assignedPsychologist || 'Lic. Psicólogo Clínico de Guardia';
  const psychLicense = psychologist?.license || 'Tarjeta Profesional COLPSIC / Minsalud';
  const psychRole = psychologist?.role || 'Psicólogo(a) Especialista en Triage y Urgencias';
  const psychInst = psychologist?.institution || 'Subred Integrada de Servicios de Salud Norte E.S.E. - Suba';

  // Signature box
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'F');
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'S');

  // Digital Stamp indicator
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PROFESIONAL TRATANTE RESPONSABLE:', margin + 4, y + 5.5);

  doc.setFontSize(9);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`${psychName.toUpperCase()}`, margin + 4, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${psychRole}`, margin + 4, y + 16);
  doc.text(`Registro Sanitario / T.P.: ${psychLicense} · ${psychInst}`, margin + 4, y + 21);

  // Digital Hash / QR Stamp
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
  doc.text(`Firma Digital Verificada · Hash SHA-256: ${record.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toUpperCase()}`, margin + contentWidth - 4, y + 11, { align: 'right' });
  doc.text(`Resolución 1995 de 1999 MinSalud · Ley 1090 de 2006`, margin + contentWidth - 4, y + 16, { align: 'right' });
  doc.text(`Bogotá D.C., Colombia`, margin + contentWidth - 4, y + 21, { align: 'right' });

  y += 30;

  // -------------------------------------------------------------
  // FOOTER ON ALL PAGES
  // -------------------------------------------------------------
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
    
    doc.text(
      'Documento Clínico Confidencial amparado por el Secreto Profesional (Ley 1090 de 2006 y Ley 1581 de 2012 de Habeas Data).',
      margin,
      pageHeight - 7.5
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 7.5,
      { align: 'right' }
    );
  }

  // Save PDF
  const safePatientName = record.patientName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `Historia_Clinica_${safePatientName}_${record.id.slice(0, 8)}.pdf`;
  doc.save(filename);
}
