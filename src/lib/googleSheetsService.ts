import type { ClinicalRecord } from '../types';

/**
 * Service to export and synchronize patient clinical records directly with Google Sheets
 * using the official Google Sheets v4 REST API and Firebase Auth OAuth Access Token.
 */

export interface GoogleSheetCreationResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

/**
 * Create a new styled Google Spreadsheet for Clinical Records and fill it with data
 */
export async function exportClinicalRecordsToGoogleSheets(
  accessToken: string,
  records: ClinicalRecord[],
  sheetTitle: string = `PsyBot - SubaTech - Historiales Clínicos (${new Date().toLocaleDateString()})`
): Promise<GoogleSheetCreationResult> {
  if (!accessToken) {
    throw new Error('Access Token no disponible. Inicie sesión con Google primero.');
  }

  // 1. Create a new Spreadsheet
  const createResp = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: sheetTitle,
      },
    }),
  });

  if (!createResp.ok) {
    const errBody = await createResp.text();
    console.error('Error creating Google Sheet:', errBody);
    throw new Error(`Error de Google Sheets API (${createResp.status}): Verifique permisos o vuelva a iniciar sesión.`);
  }

  const sheetData = await createResp.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Prepare headers and rows
  const headers = [
    'ID Expediente',
    'Nombre del Paciente',
    'Edad',
    'Género',
    'Teléfono WhatsApp',
    'Contacto de Emergencia',
    'Nivel de Riesgo',
    'Emoción Primaria',
    'Motivo de Consulta (Triage)',
    'Antecedentes Médicos / Psicológicos',
    'Hipótesis Diagnósticas',
    'Evolución y Notas Clínicas',
    'Transcripción de Conversaciones',
    'Psicólogo Asignado',
    'Enlace Directo de Acceso Psicólogo',
    'Fecha de Registro',
    'Última Actualización'
  ];

  const rows = records.map((rec) => [
    rec.id,
    rec.patientName,
    rec.age || 'No especificada',
    rec.gender || 'No especificado',
    rec.phoneNumber,
    rec.emergencyContact || 'N/A',
    rec.riskLevel,
    rec.primaryEmotion || 'N/A',
    rec.triageSummary || 'N/A',
    rec.medicalHistory || 'Sin antecedentes reportados',
    (rec.diagnosticImpressions || []).join(', '),
    rec.clinicalEvolution || 'En seguimiento',
    rec.conversationTranscript || 'Sin mensajes',
    rec.assignedPsychologist || 'Sin asignar',
    rec.accessLink,
    new Date(rec.createdAt).toLocaleString(),
    new Date(rec.lastUpdated).toLocaleString(),
  ]);

  const valueRange = {
    range: 'Sheet1!A1',
    majorDimension: 'ROWS',
    values: [headers, ...rows],
  };

  // 3. Append data to Sheet1
  const updateResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(valueRange),
    }
  );

  if (!updateResp.ok) {
    const errText = await updateResp.text();
    console.error('Error inserting values into Google Sheet:', errText);
    throw new Error('La hoja fue creada pero falló la inserción de las filas de expedientes.');
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
  };
}
