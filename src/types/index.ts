/**
 * Definiciones de Tipos y Modelos de Datos Centrales para Psybot - SubaTECH Salud Mental
 * 
 * Este archivo centraliza los modelos clínicos, de triage, autenticación médica,
 * registros de auditoría y configuraciones de mensajería para toda la plataforma.
 */

/**
 * Escala de riesgo clínico de triage psicológico:
 * - BAJO: Consulta general, orientación emocional leve, sin factores de riesgo agudo.
 * - MODERADO: Sintomatología ansiosa/depresiva marcada, requiere contención y cita.
 * - ALTO: Angustia severa, desesperanza marcada, requiere evaluación prioritaria en guardia.
 * - CRISIS: Ideación suicida activa, autolesión inminente o peligro para terceros. Activa protocolo rojo.
 */
export type RiskLevel = 'BAJO' | 'MODERADO' | 'ALTO' | 'CRISIS';

/**
 * Máquina de estados de la sesión del paciente en WhatsApp y la plataforma:
 * - ASKING_NAME: Etapa inicial donde el bot solicita el nombre al usuario.
 * - MENU_SELECTION: Menú interactivo de opciones y motivos de consulta.
 * - AI_MODE: Interacción de apoyo emocional guiada por el modelo de IA.
 * - WAITING_PSYCHOLOGIST: El paciente solicitó atención humana y está en la cola de guardia.
 * - HUMAN_MODE: Un psicólogo tomó el caso y chatea directamente con el paciente.
 * - CRISIS_ALERT: Se detectó una emergencia aguda; el caso está priorizado con sirena roja.
 * - RESOLVED: Caso cerrado o derivado con consentimiento informado.
 */
export type SessionState = 
  | 'ASKING_NAME'
  | 'MENU_SELECTION'
  | 'AI_MODE'
  | 'WAITING_PSYCHOLOGIST'
  | 'HUMAN_MODE'
  | 'CRISIS_ALERT'
  | 'RESOLVED';

/**
 * Mensaje individual dentro del hilo de conversación clínica
 */
export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'psychologist' | 'system';
  text: string;
  timestamp: number;
  psychologistName?: string;
  isCrisisTrigger?: boolean;
  quickReplies?: string[];
  deliveryStatus?: 'sending' | 'delivered' | 'failed';
  deliveryError?: string;
}

/**
 * Sesión activa de guardia de un paciente atendido por el bot o un especialista
 */
export interface PatientSession {
  /** Identificador único o número de teléfono normalizado e.g. "whatsapp:+573107956907" */
  id: string;
  phoneNumber: string;
  userName: string;
  age?: string;
  gender?: string;
  state: SessionState;
  riskLevel: RiskLevel;
  primaryEmotion?: string;
  triageSummary?: string;
  assignedPsychologistId?: string;
  assignedPsychologistName?: string;
  startedAt: number;
  lastActivityAt: number;
  messages: ChatMessage[];
  clinicalNotes: string;
  diagnosticImpressions: string[];
  tags: string[];
  sentimentScore: number; // Puntuación de sentimiento de -1.0 (muy negativo) a 1.0 (positivo)
  isSimulated?: boolean;
  termsAccepted?: boolean;
}

/**
 * Perfil público del especialista para asignación de guardias
 */
export interface PsychologistProfile {
  id: string;
  name: string;
  role: string;
  license: string;
  avatar: string;
  specialty: string;
  activeCasesCount: number;
}

/**
 * Matriz de control de acceso basada en roles (RBAC) para el especialista
 */
export interface PsychologistPermissions {
  lectura: boolean;
  escritura: boolean;
  administrativo: boolean;
}

/**
 * Estado de aprobación institucional del psicólogo
 */
export type UserApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Parámetros de detección de crisis y umbrales configurables en Firestore
 */
export interface CrisisAlertPreferences {
  /** Cantidad mínima de coincidencias de palabras clave para detonar la alerta roja (1 a 5) */
  alertThreshold: number;
  /** Sensibilidad del algoritmo de triage: ALTA, MODERADA o ESTRICTA */
  sensitivityLevel: 'ALTA' | 'MODERADA' | 'ESTRICTA';
  /** Modismos o palabras clave personalizadas agregadas por el especialista */
  customKeywords: string[];
  /** Categorías clínicas supervisadas activamente */
  enabledCategories: {
    suicidio: boolean;
    crimenViolencia: boolean;
    autolesion: boolean;
    amenazaInminente: boolean;
  };
  /** Nivel mínimo de riesgo para disparar la alarma acústica ('MODERADO', 'ALTO', 'CRISIS') */
  minRiskLevelAlert: RiskLevel;
  /** Activar sirena de emergencia sonora en el navegador al superar el umbral */
  soundAlertEnabled: boolean;
  /** Resaltar términos de riesgo en las transcripciones del chat */
  autoHighlightTranscripts: boolean;
}

/**
 * Usuario profesional autenticado (vía Google Auth o correo electrónico institucional)
 */
export interface PsychologistAuthUser {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string;
  provider: 'google.com' | 'email';
  role: string;
  license: string; // Número de Tarjeta Profesional / Registro de Colegiatura Médica
  specialty: string;
  institution?: string;
  phone?: string;
  termsAccepted: boolean;
  profileCompleted: boolean;
  isApproved?: boolean; // Requiere autorización de un administrador clínico
  approvalStatus?: UserApprovalStatus;
  approvedAt?: number;
  approvedBy?: string;
  rejectionReason?: string;
  twoFactorSecret?: string;
  twoFactorEnabled?: boolean;
  isAdmin?: boolean;
  permissions?: PsychologistPermissions;
  crisisAlertPreferences?: CrisisAlertPreferences;
  uniqueUserId?: string; // Código único de usuario ej. SUB-1042
  createdAt?: number;
  lastLoginAt?: number;
}

/**
 * Configuración de integración de WhatsApp Business a través de Twilio
 */
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  webhookUrl: string;
  isConfigured: boolean;
}

/**
 * Expediente clínico formal almacenado en Firestore (colección clinical_records)
 * Cumple con los estándares de confidencialidad médica y leyes de historias clínicas.
 */
export interface ClinicalRecord {
  id: string; // Identificador único (ej. "CR-525541908231")
  patientName: string;
  age: number;
  gender: string;
  phoneNumber: string;
  emergencyContact: string;
  riskLevel: RiskLevel;
  primaryEmotion: string;
  triageSummary: string;
  medicalHistory: string;
  conversationTranscript: string;
  clinicalEvolution: string;
  diagnosticImpressions: string[];
  assignedPsychologist: string;
  accessLink: string;
  specialistOpinion?: string; // Juicio profesional y concepto clínico del especialista
  specialistOpinionDate?: number;
  lastUpdated: number;
  createdAt: number;
}

/**
 * Registro de diagnóstico y errores del sistema para auditoría y resolución técnica
 */
export interface SystemErrorLog {
  id: string;
  timestamp: number;
  service: 'TWILIO' | 'GEMINI' | 'WEBHOOK' | 'FIRESTORE' | 'AUTH' | 'GENERAL';
  title: string;
  details: string;
  errorCode?: number | string;
  statusCode?: number;
  targetPhone?: string;
  suggestion?: string;
}
