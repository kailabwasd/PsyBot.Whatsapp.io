import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc,
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from './firebase';
import type { ClinicalRecord, PatientSession } from '../types';

const RECORDS_COLLECTION = 'clinical_records';

/**
 * Format patient messages into an intelligible conversation transcript for clinical records
 */
export function formatConversationTranscript(session: PatientSession): string {
  if (!session.messages || session.messages.length === 0) {
    return 'Sin conversaciones registradas hasta el momento.';
  }

  return session.messages
    .map((m) => {
      const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let author = 'Desconocido';
      if (m.sender === 'user') author = `[Paciente] ${session.userName || 'Usuario'}`;
      else if (m.sender === 'bot') author = '[Sistema / Guardia]';
      else if (m.sender === 'psychologist') author = `[Psicólogo/a] ${m.psychologistName || 'Especialista'}`;
      else if (m.sender === 'system') author = '[Aviso del Sistema]';

      return `[${timeStr}] ${author}: ${m.text}`;
    })
    .join('\n');
}

/**
 * Generate a unique, direct secure access link for psychologists to view this specific patient's clinical file
 */
export function generatePsychologistAccessLink(recordId: string): string {
  const origin = window.location.origin;
  return `${origin}?tab=RECORDS&recordId=${encodeURIComponent(recordId)}`;
}

/**
 * Initial demographic mapping based on clinical patient profile
 */
const DEFAULT_DEMOGRAPHICS: Record<string, { age: number; gender: string; emergencyContact: string; medicalHistory: string }> = {
  'Carlos Morales': {
    age: 34,
    gender: 'Masculino',
    emergencyContact: 'Elena Morales (Hermana) - +52 55 9182 3049',
    medicalHistory: 'Episodio depresivo mayor previo (2022) tratado con psicoterapia cognitivo-conductual. Sin alergias medicamentosas.',
  },
  'Valeria Domínguez': {
    age: 26,
    gender: 'Femenino',
    emergencyContact: 'Roberto Domínguez (Padre) - +54 9 11 8765 4321',
    medicalHistory: 'Crisis de angustia previas durante época universitaria. Descarte cardiológico orgánico normal.',
  },
  'Mateo Herrera': {
    age: 41,
    gender: 'Masculino',
    emergencyContact: 'Sofía Álvarez (Esposa) - +56 9 7654 3210',
    medicalHistory: 'Hipertensión arterial controlada con Enalapril 10mg. Sobrecarga laboral crónica (Burnout).',
  },
  'Lucía Navarro': {
    age: 29,
    gender: 'Femenino',
    emergencyContact: 'Mariana Navarro (Madre) - +57 312 987 6543',
    medicalHistory: 'Duelo no resuelto de 4 meses de evolución. Dificultad para mantener rutinas de autocuidado.',
  }
};

/**
 * Save or update a ClinicalRecord in Firestore
 */
export async function saveClinicalRecordToFirestore(record: ClinicalRecord): Promise<void> {
  const docRef = doc(db, RECORDS_COLLECTION, record.id);
  await setDoc(docRef, {
    ...record,
    lastUpdated: Date.now(),
  }, { merge: true });
}

/**
 * Delete a ClinicalRecord from Firestore
 */
export async function deleteClinicalRecordFromFirestore(recordId: string): Promise<void> {
  const docRef = doc(db, RECORDS_COLLECTION, recordId);
  await deleteDoc(docRef);
}

/**
 * Transform a PatientSession into a complete ClinicalRecord and sync to Firestore
 */
export async function syncSessionToFirestoreClinicalRecord(session: PatientSession): Promise<ClinicalRecord> {
  const normalizedId = session.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const recordId = `CR-${normalizedId}`;
  
  const existingDemo = DEFAULT_DEMOGRAPHICS[session.userName] || {
    age: 28,
    gender: 'No especificado',
    emergencyContact: 'Contacto primario registrado en WhatsApp',
    medicalHistory: 'Ingreso primario a la Guardia Psicológica. Sin antecedentes psiquiátricos mayores reportados.',
  };

  const docRef = doc(db, RECORDS_COLLECTION, recordId);
  const existingDoc = await getDoc(docRef);
  const existingData = existingDoc.exists() ? (existingDoc.data() as Partial<ClinicalRecord>) : null;

  const record: ClinicalRecord = {
    id: recordId,
    patientName: session.userName || 'Paciente sin nombre registrado',
    age: session.age ? parseInt(String(session.age)) || 28 : (existingData?.age ?? existingDemo.age),
    gender: session.gender || existingData?.gender || existingDemo.gender,
    phoneNumber: session.phoneNumber || session.id,
    emergencyContact: existingData?.emergencyContact ?? existingDemo.emergencyContact,
    riskLevel: session.riskLevel || 'MODERADO',
    primaryEmotion: session.primaryEmotion || 'Ansiedad Reactiva',
    triageSummary: session.triageSummary || 'Paciente admitido en guardia psicológica.',
    medicalHistory: existingData?.medicalHistory ?? existingDemo.medicalHistory,
    conversationTranscript: formatConversationTranscript(session),
    clinicalEvolution: existingData?.clinicalEvolution || session.clinicalNotes || 'Paciente en seguimiento terapéutico en guardia activa.',
    diagnosticImpressions: session.diagnosticImpressions?.length ? session.diagnosticImpressions : ['Trastorno Adaptativo / Reacción al Estrés'],
    assignedPsychologist: session.assignedPsychologistName || existingData?.assignedPsychologist || 'Lic. Sofia Ramos (Guardia)',
    accessLink: generatePsychologistAccessLink(recordId),
    lastUpdated: Date.now(),
    createdAt: existingData?.createdAt ?? session.startedAt ?? Date.now(),
  };

  await setDoc(docRef, record, { merge: true });
  return record;
}

/**
 * Fetch all clinical records from Firestore
 */
export async function getAllClinicalRecordsFromFirestore(): Promise<ClinicalRecord[]> {
  try {
    const q = query(collection(db, RECORDS_COLLECTION), orderBy('lastUpdated', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as ClinicalRecord);
  } catch (err) {
    console.error('Error fetching clinical records from Firestore:', err);
    return [];
  }
}

/**
 * Listen to real-time changes in Firestore clinical records
 */
export function subscribeToClinicalRecords(callback: (records: ClinicalRecord[]) => void): () => void {
  const q = query(collection(db, RECORDS_COLLECTION), orderBy('lastUpdated', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map((d) => d.data() as ClinicalRecord);
    callback(records);
  }, (error) => {
    console.warn('Real-time subscription warning:', error);
  });
}

const SESSIONS_COLLECTION = 'active_sessions';

/**
 * Save an active patient chat session to Firestore
 */
export async function saveActiveSessionToFirestore(session: PatientSession): Promise<void> {
  try {
    const normalizedId = session.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, SESSIONS_COLLECTION, normalizedId);
    await setDoc(docRef, {
      ...session,
      lastActivityAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Error saving active session to Firestore:', err);
  }
}

/**
 * Fetch all active patient chat sessions from Firestore
 */
export async function getActiveSessionsFromFirestore(): Promise<PatientSession[]> {
  try {
    const q = query(collection(db, SESSIONS_COLLECTION), orderBy('lastActivityAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as PatientSession);
  } catch (err) {
    console.error('Error fetching active sessions from Firestore:', err);
    return [];
  }
}

/**
 * Listen to real-time changes in Firestore active sessions
 */
export function subscribeToActiveSessions(callback: (sessions: PatientSession[]) => void): () => void {
  const q = query(collection(db, SESSIONS_COLLECTION), orderBy('lastActivityAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const sessions = snapshot.docs.map((d) => d.data() as PatientSession);
    callback(sessions);
  }, (error) => {
    console.warn('Active sessions subscription warning:', error);
  });
}
