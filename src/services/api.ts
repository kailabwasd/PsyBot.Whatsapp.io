import type { PatientSession, RiskLevel, SystemErrorLog } from '../types/index.ts';

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

// Helper: Sleep for given milliseconds
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Attempts to refresh Twilio connection tokens from the backend or local cache
 */
export async function refreshTwilioConnectionTokens(): Promise<boolean> {
  const base = getApiBaseUrl();
  try {
    console.log('[Twilio Backoff] Refreshing Twilio connection tokens before retry...');
    const res = await fetch(`${base}/api/twilio/config`);
    if (res.ok) {
      const config = await res.json();
      console.log('[Twilio Backoff] Twilio tokens refreshed successfully. Account:', config.accountSid);
      return Boolean(config.hasAuthToken);
    }
    return false;
  } catch (err) {
    console.warn('[Twilio Backoff] Failed to refresh Twilio tokens:', err);
    return false;
  }
}

/**
 * Executes an async operation with exponential backoff and automatic token refresh on 401 Unauthorized
 */
export async function executeWithExponentialBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    serviceName?: string;
    onDefinitiveError?: (error: any) => Promise<void> | void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const serviceName = options.serviceName ?? 'TWILIO';

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (err: any) {
      lastError = err;
      const is401Unauthorized = 
        err?.status === 401 ||
        err?.statusCode === 401 ||
        err?.errorCode === 20003 ||
        String(err?.message || '').includes('401') ||
        String(err?.message || '').includes('20003') ||
        String(err?.message || '').toLowerCase().includes('unauthorized');

      const isLastAttempt = attempt === maxRetries;

      console.warn(
        `[${serviceName} Backoff] Attempt ${attempt + 1}/${maxRetries + 1} failed.`,
        is401Unauthorized ? '(401 Unauthorized detected)' : '',
        err?.message || err
      );

      if (isLastAttempt) {
        break;
      }

      // If error is 401, attempt to refresh tokens before the next backoff retry
      if (is401Unauthorized) {
        console.log(`[${serviceName} Backoff] Triggering token refresh due to 401 Unauthorized...`);
        await refreshTwilioConnectionTokens();
      }

      // Calculate exponential backoff delay with jitter (e.g. 1s -> 2s -> 4s)
      const delayMs = initialDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
      console.log(`[${serviceName} Backoff] Waiting ${delayMs}ms before retry ${attempt + 2}...`);
      await sleep(delayMs);
    }
  }

  // If all retries failed, log the definitive error
  console.error(`[${serviceName} Backoff] All ${maxRetries + 1} attempts exhausted. Marking error as definitive.`);
  
  if (options.onDefinitiveError) {
    try {
      await options.onDefinitiveError(lastError);
    } catch (logErr) {
      console.warn('Error executing onDefinitiveError handler:', logErr);
    }
  }

  throw lastError;
}

export async function claimSession(
  sessionId: string,
  psychologistId: string,
  psychologistName: string
): Promise<PatientSession> {
  const base = getApiBaseUrl();
  return executeWithExponentialBackoff(async () => {
    const res = await fetch(`${base}/api/sessions/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, psychologistId, psychologistName }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => 'Error');
      const err: any = new Error(`Failed to claim session: ${errText}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return data.session;
  }, { serviceName: 'TWILIO_CLAIM', maxRetries: 2 });
}

export async function sendPsychologistMessage(
  sessionId: string,
  text: string,
  psychologistName: string
): Promise<PatientSession> {
  const base = getApiBaseUrl();
  return executeWithExponentialBackoff(async () => {
    const res = await fetch(`${base}/api/sessions/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, text, psychologistName }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err: any = new Error(errData.error || `Error ${res.status}: Fallo al despachar mensaje`);
      err.status = res.status;
      err.errorCode = errData.errorCode;
      throw err;
    }
    const data = await res.json();
    return data.session;
  }, { 
    serviceName: 'TWILIO_MESSAGE', 
    maxRetries: 3, 
    initialDelayMs: 1000,
    onDefinitiveError: async (err) => {
      try {
        await fetch(`${base}/api/admin/error-logs/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'TWILIO',
            title: 'Error Definitivo tras Reintentos (Exponential Backoff)',
            details: `Fallaron todos los reintentos al enviar mensaje a la sesión ${sessionId}: ${err?.message}`,
            errorCode: err?.errorCode || err?.status || 500,
            suggestion: 'Revisa las credenciales de Twilio en Railway y verifica el saldo de tu cuenta.',
          }),
        });
      } catch {}
    }
  });
}

export async function sendDirectTwilioWhatsApp(params: {
  phoneNumber: string;
  sessionId?: string;
  text: string;
  psychologistName: string;
}): Promise<{ success: boolean; twilioSid?: string; error?: string; session?: PatientSession; message?: any }> {
  const base = getApiBaseUrl();
  return executeWithExponentialBackoff(async () => {
    const res = await fetch(`${base}/api/twilio/send-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      const err: any = new Error(data.error || `Error ${res.status}: Fallo de despacho Twilio`);
      err.status = res.status;
      err.errorCode = data.errorCode;
      throw err;
    }
    return data;
  }, { 
    serviceName: 'TWILIO_DIRECT', 
    maxRetries: 3, 
    initialDelayMs: 1000 
  });
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

export async function deleteSession(sessionId: string): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete session');
}

export async function clearAllSessions(): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/sessions/clear-all`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to clear all sessions');
}

export async function checkHealth(): Promise<{ status: string; geminiConfigured: boolean; sessionsCount: number }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchSystemErrorLogs(): Promise<SystemErrorLog[]> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/admin/error-logs`);
    if (!res.ok) throw new Error('Failed to fetch error logs');
    const data = await res.json();
    return data.logs || [];
  } catch (e) {
    console.warn('Could not fetch error logs from backend:', e);
    return [];
  }
}

export async function clearSystemErrorLogs(): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/error-logs/clear`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clear error logs');
}

export async function fetchTwilioConfig(): Promise<{
  accountSid: string;
  whatsappNumber: string;
  hasAuthToken: boolean;
  webhookUrl: string;
  errorLogsCount?: number;
}> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/twilio/config`);
  if (!res.ok) throw new Error('Failed to fetch Twilio config');
  return res.json();
}

export async function updateTwilioConfig(config: {
  accountSid?: string;
  authToken?: string;
  whatsappNumber?: string;
}): Promise<{ success: boolean; message: string; accountSid: string; whatsappNumber: string; hasAuthToken: boolean }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/twilio/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update Twilio credentials');
  return res.json();
}

export async function testTwilioConnection(params: {
  toPhone?: string;
  phoneNumber?: string;
  testMessage?: string;
  accountSid?: string;
  authToken?: string;
  whatsappNumber?: string;
}): Promise<{ success: boolean; message?: string; error?: string; errorCode?: number; sid?: string; suggestion?: string }> {
  const base = getApiBaseUrl();
  return executeWithExponentialBackoff(async () => {
    const res = await fetch(`${base}/api/twilio/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      const err: any = new Error(data.error || `Error ${res.status}: Fallo de prueba Twilio`);
      err.status = res.status;
      err.errorCode = data.errorCode;
      err.data = data;
      // If 401 Unauthorized, throw so the backoff can refresh and retry
      if (res.status === 401 || data.errorCode === 20003) {
        throw err;
      }
      return data;
    }
    return data;
  }, { 
    serviceName: 'TWILIO_TEST', 
    maxRetries: 2, 
    initialDelayMs: 800 
  }).catch((err) => {
    return err.data || {
      success: false,
      error: err.message || 'Error de conexión con Twilio tras reintentos.',
      errorCode: err.errorCode || err.status || 500,
      suggestion: 'Verifica tu TWILIO_AUTH_TOKEN en Railway y en la consola de Twilio.'
    };
  });
}
