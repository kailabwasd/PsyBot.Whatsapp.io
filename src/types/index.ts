export type RiskLevel = 'BAJO' | 'MODERADO' | 'ALTO' | 'CRISIS';

export type SessionState = 
  | 'ASKING_NAME'
  | 'MENU_SELECTION'
  | 'AI_MODE'
  | 'WAITING_PSYCHOLOGIST'
  | 'HUMAN_MODE'
  | 'CRISIS_ALERT'
  | 'RESOLVED';

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

export interface PatientSession {
  id: string; // phone number e.g. "whatsapp:+5215512345678" or identifier
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
  sentimentScore: number; // -1.0 to 1.0
  isSimulated?: boolean;
  termsAccepted?: boolean;
}

export interface PsychologistProfile {
  id: string;
  name: string;
  role: string;
  license: string;
  avatar: string;
  specialty: string;
  activeCasesCount: number;
}

export interface PsychologistPermissions {
  lectura: boolean;
  escritura: boolean;
  administrativo: boolean;
}

export interface PsychologistAuthUser {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string;
  provider: 'google.com' | 'github.com' | 'email' | 'demo' | string;
  role: string;
  license: string; // Registro Sanitario obligatorio
  specialty: string;
  institution?: string;
  phone?: string;
  termsAccepted: boolean;
  profileCompleted: boolean;
  twoFactorSecret?: string;
  twoFactorEnabled?: boolean;
  isAdmin?: boolean;
  permissions?: PsychologistPermissions;
  uniqueUserId?: string; // Unique numerical user ID e.g. SUB-1042
  createdAt?: number;
  lastLoginAt?: number;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  webhookUrl: string;
  isConfigured: boolean;
}

export interface ClinicalRecord {
  id: string; // e.g. "CR-525541908231" or normalized id
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
  lastUpdated: number;
  createdAt: number;
}
