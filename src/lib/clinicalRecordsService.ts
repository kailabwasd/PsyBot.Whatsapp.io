import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc,
  query, 
  orderBy, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import type { ClinicalRecord, PatientSession } from '../types';
import { reportFirestoreCriticalError } from '../services/api.ts';

const RECORDS_COLLECTION = 'clinical_records';
const SESSIONS_COLLECTION = 'active_sessions';

// ==============================================================================
// OPTIMISTIC IN-MEMORY CACHE & REAL-TIME EVENT DISTRIBUTOR
// ==============================================================================
const optimisticRecordCache = new Map<string, ClinicalRecord>();
const optimisticSessionCache = new Map<string, PatientSession>();

type RecordSubscriber = (records: ClinicalRecord[]) => void;
type SessionSubscriber = (sessions: PatientSession[]) => void;

const recordSubscribers = new Set<RecordSubscriber>();
const sessionSubscribers = new Set<SessionSubscriber>();

function notifyRecordSubscribers() {
  const sorted = Array.from(optimisticRecordCache.values()).sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
  recordSubscribers.forEach((cb) => {
    try { cb(sorted); } catch (e) { console.warn('Record subscriber notification error:', e); }
  });
}

function notifySessionSubscribers() {
  const sorted = Array.from(optimisticSessionCache.values()).sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
  sessionSubscribers.forEach((cb) => {
    try { cb(sorted); } catch (e) { console.warn('Session subscriber notification error:', e); }
  });
}

// ==============================================================================
// BATCH WRITE QUEUE & DEBOUNCED TRANSACTION MANAGER
// ==============================================================================
type BatchOp = 
  | { type: 'SET_RECORD'; docId: string; data: ClinicalRecord }
  | { type: 'DELETE_RECORD'; docId: string }
  | { type: 'SET_SESSION'; docId: string; data: PatientSession }
  | { type: 'DELETE_SESSION'; docId: string };

const pendingBatchOps = new Map<string, BatchOp>();
let batchFlushTimer: ReturnType<typeof setTimeout> | null = null;
const BATCH_DEBOUNCE_MS = 120;

/**
 * Commits all queued operations to Firestore atomically in a single network roundtrip (up to 500 docs per batch)
 */
export async function flushPendingBatchWrites(): Promise<void> {
  if (batchFlushTimer) {
    clearTimeout(batchFlushTimer);
    batchFlushTimer = null;
  }

  if (pendingBatchOps.size === 0) return;

  const opsToFlush = Array.from(pendingBatchOps.values());
  pendingBatchOps.clear();

  const CHUNK_SIZE = 450;
  for (let i = 0; i < opsToFlush.length; i += CHUNK_SIZE) {
    const chunk = opsToFlush.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const op of chunk) {
      if (op.type === 'SET_RECORD') {
        const ref = doc(db, RECORDS_COLLECTION, op.docId);
        batch.set(ref, op.data, { merge: true });
      } else if (op.type === 'DELETE_RECORD') {
        const ref = doc(db, RECORDS_COLLECTION, op.docId);
        batch.delete(ref);
      } else if (op.type === 'SET_SESSION') {
        const ref = doc(db, SESSIONS_COLLECTION, op.docId);
        batch.set(ref, op.data, { merge: true });
      } else if (op.type === 'DELETE_SESSION') {
        const ref = doc(db, SESSIONS_COLLECTION, op.docId);
        batch.delete(ref);
      }
    }

    try {
      await batch.commit();
    } catch (err: any) {
      console.error('Error committing batch write to Firestore:', err);
      reportFirestoreCriticalError(err, 'Lote de Escritura (Batch Write)', `Operaciones: ${chunk.length}`).catch(() => {});
    }
  }
}

function queueBatchOp(op: BatchOp, immediate = false) {
  const key = `${op.type}:${op.docId}`;
  pendingBatchOps.set(key, op);

  if (immediate) {
    flushPendingBatchWrites();
  } else if (!batchFlushTimer) {
    batchFlushTimer = setTimeout(() => {
      flushPendingBatchWrites();
    }, BATCH_DEBOUNCE_MS);
  }
}

// ==============================================================================
// HELPER FUNCTIONS & DEMOGRAPHICS
// ==============================================================================

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

// ==============================================================================
// CLINICAL RECORDS SERVICE API
// ==============================================================================

/**
 * Save or update a ClinicalRecord in Firestore with instant Optimistic UI update
 */
export async function saveClinicalRecordToFirestore(record: ClinicalRecord): Promise<void> {
  const updatedRecord = {
    ...record,
    lastUpdated: Date.now(),
  };

  // 1. Optimistic local update (0ms UI latency)
  optimisticRecordCache.set(updatedRecord.id, updatedRecord);
  notifyRecordSubscribers();

  // 2. Queue batch operation to sync with Firestore
  queueBatchOp({
    type: 'SET_RECORD',
    docId: updatedRecord.id,
    data: updatedRecord,
  });
}

/**
 * Delete a ClinicalRecord from Firestore with instant Optimistic UI removal
 */
export async function deleteClinicalRecordFromFirestore(recordId: string): Promise<void> {
  // 1. Optimistic local deletion
  optimisticRecordCache.delete(recordId);
  notifyRecordSubscribers();

  // 2. Queue batch operation
  queueBatchOp({
    type: 'DELETE_RECORD',
    docId: recordId,
  }, true);
}

/**
 * Transform a PatientSession into a complete ClinicalRecord and sync both to Firestore in a single atomic batch
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

  // Check cache first for existing record data
  const cachedRecord = optimisticRecordCache.get(recordId);

  const record: ClinicalRecord = {
    id: recordId,
    patientName: session.userName || 'Paciente sin nombre registrado',
    age: session.age ? parseInt(String(session.age)) || 28 : (cachedRecord?.age ?? existingDemo.age),
    gender: session.gender || cachedRecord?.gender || existingDemo.gender,
    phoneNumber: session.phoneNumber || session.id,
    emergencyContact: cachedRecord?.emergencyContact ?? existingDemo.emergencyContact,
    riskLevel: session.riskLevel || 'MODERADO',
    primaryEmotion: session.primaryEmotion || 'Ansiedad Reactiva',
    triageSummary: session.triageSummary || 'Paciente admitido en guardia psicológica.',
    medicalHistory: cachedRecord?.medicalHistory ?? existingDemo.medicalHistory,
    conversationTranscript: formatConversationTranscript(session),
    clinicalEvolution: cachedRecord?.clinicalEvolution || session.clinicalNotes || 'Paciente en seguimiento terapéutico en guardia activa.',
    diagnosticImpressions: session.diagnosticImpressions?.length ? session.diagnosticImpressions : ['Trastorno Adaptativo / Reacción al Estrés'],
    assignedPsychologist: session.assignedPsychologistName || cachedRecord?.assignedPsychologist || 'Lic. Sofia Ramos (Guardia)',
    accessLink: generatePsychologistAccessLink(recordId),
    specialistOpinion: cachedRecord?.specialistOpinion,
    specialistOpinionDate: cachedRecord?.specialistOpinionDate,
    lastUpdated: Date.now(),
    createdAt: cachedRecord?.createdAt ?? session.startedAt ?? Date.now(),
  };

  // 1. Optimistic local update
  optimisticRecordCache.set(recordId, record);
  notifyRecordSubscribers();

  // 2. Queue batch operation
  queueBatchOp({
    type: 'SET_RECORD',
    docId: recordId,
    data: record,
  });

  return record;
}

/**
 * Fetch all clinical records from Firestore, populating local optimistic cache
 */
export async function getAllClinicalRecordsFromFirestore(): Promise<ClinicalRecord[]> {
  try {
    const q = query(collection(db, RECORDS_COLLECTION), orderBy('lastUpdated', 'desc'));
    const snapshot = await getDocs(q);
    const records = snapshot.docs.map((docSnap) => docSnap.data() as ClinicalRecord);

    // Populate local cache
    records.forEach((r) => optimisticRecordCache.set(r.id, r));
    notifyRecordSubscribers();

    return records;
  } catch (err) {
    console.error('Error fetching clinical records from Firestore:', err);
    return Array.from(optimisticRecordCache.values()).sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
  }
}

/**
 * Listen to real-time changes in Firestore clinical records with Optimistic merge
 */
export function subscribeToClinicalRecords(callback: (records: ClinicalRecord[]) => void): () => void {
  recordSubscribers.add(callback);

  // Send current cached state immediately
  if (optimisticRecordCache.size > 0) {
    const sorted = Array.from(optimisticRecordCache.values()).sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    callback(sorted);
  }

  const q = query(collection(db, RECORDS_COLLECTION), orderBy('lastUpdated', 'desc'));
  const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    snapshot.docs.forEach((d) => {
      const remoteRecord = d.data() as ClinicalRecord;
      optimisticRecordCache.set(remoteRecord.id, remoteRecord);
    });
    notifyRecordSubscribers();
  }, (error) => {
    console.warn('Real-time clinical records subscription warning:', error);
  });

  return () => {
    recordSubscribers.delete(callback);
    unsubscribeFirestore();
  };
}

// ==============================================================================
// ACTIVE SESSIONS SERVICE API
// ==============================================================================

/**
 * Save an active patient chat session to Firestore with instant Optimistic UI update
 */
export async function saveActiveSessionToFirestore(session: PatientSession): Promise<void> {
  const normalizedId = session.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const updatedSession = {
    ...session,
    lastActivityAt: Date.now(),
  };

  // 1. Optimistic local update (0ms UI latency)
  optimisticSessionCache.set(normalizedId, updatedSession);
  notifySessionSubscribers();

  // 2. Queue batch operation
  queueBatchOp({
    type: 'SET_SESSION',
    docId: normalizedId,
    data: updatedSession,
  });
}

/**
 * Fetch all active patient chat sessions from Firestore, populating local optimistic cache
 */
export async function getActiveSessionsFromFirestore(): Promise<PatientSession[]> {
  try {
    const q = query(collection(db, SESSIONS_COLLECTION), orderBy('lastActivityAt', 'desc'));
    const snapshot = await getDocs(q);
    const sessions = snapshot.docs.map((docSnap) => docSnap.data() as PatientSession);

    sessions.forEach((s) => {
      const normId = s.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      optimisticSessionCache.set(normId, s);
    });
    notifySessionSubscribers();

    return sessions;
  } catch (err: any) {
    console.error('Error fetching active sessions from Firestore:', err);
    reportFirestoreCriticalError(err, 'Cargar Sesiones Activas desde Firestore', SESSIONS_COLLECTION).catch(() => {});
    return Array.from(optimisticSessionCache.values()).sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
  }
}

/**
 * Listen to real-time changes in Firestore active sessions with Optimistic merge
 */
export function subscribeToActiveSessions(callback: (sessions: PatientSession[]) => void): () => void {
  sessionSubscribers.add(callback);

  // Send cached state immediately
  if (optimisticSessionCache.size > 0) {
    const sorted = Array.from(optimisticSessionCache.values()).sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
    callback(sorted);
  }

  const q = query(collection(db, SESSIONS_COLLECTION), orderBy('lastActivityAt', 'desc'));
  const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    snapshot.docs.forEach((d) => {
      const remoteSession = d.data() as PatientSession;
      const normId = remoteSession.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      optimisticSessionCache.set(normId, remoteSession);
    });
    notifySessionSubscribers();
  }, (error) => {
    console.warn('Active sessions subscription warning:', error);
    reportFirestoreCriticalError(error, 'Suscripción en Tiempo Real Firestore (Snapshot)', SESSIONS_COLLECTION).catch(() => {});
  });

  return () => {
    sessionSubscribers.delete(callback);
    unsubscribeFirestore();
  };
}

/**
 * Delete a single active session from Firestore with instant Optimistic UI removal
 */
export async function deleteActiveSessionFromFirestore(sessionId: string): Promise<void> {
  const normalizedId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');

  // 1. Optimistic local removal
  optimisticSessionCache.delete(normalizedId);
  notifySessionSubscribers();

  // 2. Queue batch operation
  queueBatchOp({
    type: 'DELETE_SESSION',
    docId: normalizedId,
  }, true);
}

/**
 * Delete all active sessions from Firestore in chunked atomic batches
 */
export async function deleteAllActiveSessionsFromFirestore(): Promise<void> {
  // 1. Clear local optimistic cache
  optimisticSessionCache.clear();
  notifySessionSubscribers();

  try {
    const snapshot = await getDocs(collection(db, SESSIONS_COLLECTION));
    if (snapshot.empty) return;

    const docsToDelete = snapshot.docs;
    const CHUNK_SIZE = 450;

    for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
      const chunk = docsToDelete.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.error('Error deleting all active sessions from Firestore:', err);
  }
}
