import type { PatientSession, RiskLevel } from '../types/index.ts';

export const DEFAULT_PRODUCTION_BACKEND_URL = 'https://psybot-whatsapp-production.up.railway.app';

export function getApiBaseUrl(): string {
  // 1. Custom URL configured by user in settings
  const customUrl = localStorage.getItem('subatech_backend_api_url');
  if (customUrl && customUrl.trim().length > 0) {
    return customUrl.trim().replace(/\/+$/, '');
  }

  // 2. Vite environment variable
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 3. When deployed on GitHub Pages, automatically route to live Railway backend
  if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
    return DEFAULT_PRODUCTION_BACKEND_URL;
  }

  // 4. Fallback to same-origin relative path
  return '';
}

export function setApiBaseUrl(url: string): void {
  const clean = url.trim().replace(/\/+$/, '');
  if (clean) {
    localStorage.setItem('subatech_backend_api_url', clean);
  } else {
    localStorage.removeItem('subatech_backend_api_url');
  }
}

export async function fetchSessions(): Promise<PatientSession[]> {
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/sessions`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch sessions`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return [];
    }
    const data = await res.json();
    return data.sessions || [];
  } catch (err) {
    console.warn('Waiting for backend sessions endpoint...', err);
    return [];
  }
}

export async function sendWhatsAppWebhookMessage(
  fromNumber: string,
  bodyText: string,
  profileName?: string
): Promise<{ success: boolean; reply: string; session: PatientSession; quickReplies?: string[] }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/whatsapp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      from: fromNumber,
      body: bodyText,
      profileName,
      isSimulator: true,
    }),
  });
  if (!res.ok) throw new Error('Failed to send webhook message');
  return res.json();
}

export async function claimSession(
  sessionId: string,
  psychologistId: string,
  psychologistName: string
): Promise<PatientSession> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/sessions/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, psychologistId, psychologistName }),
  });
  if (!res.ok) throw new Error('Failed to claim session');
  const data = await res.json();
  return data.session;
}

export async function sendPsychologistMessage(
  sessionId: string,
  text: string,
  psychologistName: string
): Promise<PatientSession> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/sessions/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, text, psychologistName }),
  });
  if (!res.ok) throw new Error('Failed to send psychologist message');
  const data = await res.json();
  return data.session;
}

export async function transferSession(
  sessionId: string,
  target: 'AI_MODE' | 'WAITING_PSYCHOLOGIST'
): Promise<PatientSession> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/sessions/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, target }),
  });
  if (!res.ok) throw new Error('Failed to transfer session');
  const data = await res.json();
  return data.session;
}

export async function saveClinicalNotes(
  sessionId: string,
  data: {
    clinicalNotes?: string;
    tags?: string[];
    riskLevel?: RiskLevel;
    diagnosticImpressions?: string[];
  }
): Promise<PatientSession> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/sessions/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, ...data }),
  });
  if (!res.ok) throw new Error('Failed to save clinical notes');
  const result = await res.json();
  return result.session;
}

export async function closeSession(
  sessionId: string,
  resolutionNotes: string
): Promise<PatientSession> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/sessions/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, resolutionNotes }),
  });
  if (!res.ok) throw new Error('Failed to close session');
  const data = await res.json();
  return data.session;
}

export async function simulateScenario(scenarioType: 'CRISIS' | 'PANIC' | 'ANXIETY'): Promise<PatientSession> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/simulate/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioType }),
  });
  if (!res.ok) throw new Error('Failed to simulate scenario');
  const data = await res.json();
  return data.session;
}

export async function resetSimulation(): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/simulate/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset simulation');
}

export async function checkHealth(): Promise<{ status: string; geminiConfigured: boolean; sessionsCount: number }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}
