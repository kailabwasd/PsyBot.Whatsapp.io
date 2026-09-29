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

// Target administrator phone for critical alerts
export const DEFAULT_ADMIN_ALERT_PHONE = 'whatsapp:+573107956907';

export interface CriticalErrorAlertPayload {
  service: 'TWILIO' | 'FIRESTORE' | 'GEMINI' | 'GENERAL';
  title: string;
  details: string;
  errorCode?: number | string;
  targetPhone?: string;
  suggestion?: string;
  critical?: boolean;
}

let lastClientAlertTimestamp = 0;

/**
 * Registra un error crítico en el log centralizado del sistema y dispara automáticamente
 * una alerta vía WhatsApp al número +573107956907.
 */
export async function logAndAlertCriticalError(payload: CriticalErrorAlertPayload): Promise<{
  logged: boolean;
  alertDispatched: boolean;
  error?: string;
}> {
  const base = getApiBaseUrl();
  console.error(`🚨 [CRITICAL ${payload.service} ERROR] ${payload.title}:`, payload.details);

  // Throttle client-side alerts to max 1 every 6 seconds to prevent flood
  const now = Date.now();
  const shouldThrottle = now - lastClientAlertTimestamp < 6000;
  if (!shouldThrottle) {
    lastClientAlertTimestamp = now;
  }

  let logged = false;
  let alertDispatched = false;

  // 1. Envío al endpoint centralizado de alertas y registro
  try {
    const alertRes = await fetch(`${base}/api/admin/notifications/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: payload.service,
        title: payload.title,
        details: payload.details,
        errorCode: payload.errorCode,
        suggestion: payload.suggestion,
        phone: DEFAULT_ADMIN_ALERT_PHONE,
      }),
    });

    if (alertRes.ok) {
      const data = await alertRes.json();
      logged = true;
      alertDispatched = data.whatsappDispatched ?? true;
      console.log(`[Alert System] Error crítico registrado en log centralizado y alerta enviada a ${DEFAULT_ADMIN_ALERT_PHONE}.`);
      return { logged, alertDispatched };
    }
  } catch (err: any) {
    console.warn('[Alert System] Endpoint /api/admin/notifications/alert no disponible, usando registro alternativo...', err);
  }

  // 2. Fallback de respaldo: Registro en log de errores del sistema
  try {
    const logRes = await fetch(`${base}/api/admin/error-logs/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: payload.service,
        title: payload.title,
        details: payload.details,
        errorCode: payload.errorCode,
        suggestion: payload.suggestion || 'Revisar consola y logs de auditoría.',
        targetPhone: payload.targetPhone,
      }),
    });
    if (logRes.ok) {
      logged = true;
    }
  } catch (fallbackErr: any) {
    console.error('[Alert System] Error guardando log en fallback:', fallbackErr);
  }

  return { logged, alertDispatched };
}

/**
 * Reporta específicamente un error crítico de Twilio y dispara alerta a WhatsApp (+573107956907)
 */
export async function reportTwilioCriticalError(
  err: any,
  contextTitle: string = 'Fallo Crítico en Twilio WhatsApp',
  extraDetails?: string
): Promise<void> {
  const message = err?.message || err?.error || String(err);
  const errorCode = err?.errorCode || err?.status || err?.code;
  
  let suggestion = 'Revisa las credenciales de Twilio y los registros de consola.';
  if (errorCode === 20003 || message.includes('401') || message.includes('20003')) {
    suggestion = 'El TWILIO_AUTH_TOKEN configurado no coincide con tu consola Twilio o ha expirado. Actualízalo en Railway o en Configuración.';
  } else if (errorCode === 63007 || message.includes('63007')) {
    suggestion = 'Twilio no encontró el canal remitente. Activa el Sandbox de WhatsApp en console.twilio.com (Messaging -> Try it out).';
  } else if (errorCode === 21608 || message.includes('21608')) {
    suggestion = 'El número aún no se ha unido al Sandbox de WhatsApp. Envía el comando join al número de Twilio.';
  }

  await logAndAlertCriticalError({
    service: 'TWILIO',
    title: contextTitle,
    details: `${message}${extraDetails ? ` | ${extraDetails}` : ''}`,
    errorCode,
    suggestion,
    critical: true,
  });
}

/**
 * Reporta específicamente un error crítico de Firestore y dispara alerta a WhatsApp (+573107956907)
 */
export async function reportFirestoreCriticalError(
  err: any,
  operation: string = 'Operación de Base de Datos Firestore',
  docOrCollection?: string
): Promise<void> {
  const code = err?.code || 'FIRESTORE_ERROR';
  const message = err?.message || String(err);

  let suggestion = 'Verifica la conexión a internet y las reglas de seguridad de Firestore (firestore.rules).';
  if (String(code).includes('permission-denied') || message.includes('permission-denied')) {
    suggestion = 'Permiso denegado en Firestore. Revisa las reglas de seguridad o autenticación del usuario.';
  } else if (String(code).includes('unavailable') || message.includes('unavailable')) {
    suggestion = 'Servicio de Firestore temporalmente inaccesible o fallo de conectividad de red.';
  } else if (String(code).includes('resource-exhausted')) {
    suggestion = 'Cuota de lectura/escritura de Cloud Firestore superada.';
  }

  await logAndAlertCriticalError({
    service: 'FIRESTORE',
    title: `Fallo Crítico Firestore: ${operation}`,
    details: `Error en Firestore [${code}]: ${message}${docOrCollection ? ` | Ref: ${docOrCollection}` : ''}`,
    errorCode: code,
    suggestion,
    critical: true,
  });
}

/**
 * Envoltorio seguro para llamadas asíncronas a Firestore con captura y reporte centralizado
 */
export async function executeFirestoreSafe<T>(
  operation: () => Promise<T>,
  context: { operationName: string; targetRef?: string }
): Promise<T> {
  try {
    return await operation();
  } catch (err: any) {
    await reportFirestoreCriticalError(err, context.operationName, context.targetRef);
    throw err;
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

  // If all retries failed, log the definitive error and trigger WhatsApp alert
  console.error(`[${serviceName} Backoff] All ${maxRetries + 1} attempts exhausted. Marking error as definitive.`);
  
  if (options.onDefinitiveError) {
    try {
      await options.onDefinitiveError(lastError);
    } catch (logErr) {
      console.warn('Error executing onDefinitiveError handler:', logErr);
    }
  } else {
    const isTwilio = serviceName.toUpperCase().includes('TWILIO');
    const isFirestore = serviceName.toUpperCase().includes('FIRESTORE');
    if (isTwilio) {
      await reportTwilioCriticalError(
        lastError,
        `Fallo Crítico Definitivo en ${serviceName}`,
        `Agotados ${maxRetries + 1} intentos de reintento en backoff.`
      ).catch(() => {});
    } else if (isFirestore) {
      await reportFirestoreCriticalError(
        lastError,
        `Fallo Crítico Definitivo en ${serviceName}`,
        `Agotados ${maxRetries + 1} intentos de reintento en backoff.`
      ).catch(() => {});
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
  }, { 
    serviceName: 'TWILIO_CLAIM', 
    maxRetries: 2,
    onDefinitiveError: async (err) => {
      await reportTwilioCriticalError(
        err,
        'Fallo Crítico al Reclamar Paciente en Guardia',
        `Sesión: ${sessionId} | Psicólogo: ${psychologistName}`
      );
    }
  });
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
      await reportTwilioCriticalError(
        err,
        'Fallo Crítico al Despachar Mensaje de Psicólogo a WhatsApp',
        `Sesión: ${sessionId} | Especialista: ${psychologistName}`
      );
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
    initialDelayMs: 1000,
    onDefinitiveError: async (err) => {
      await reportTwilioCriticalError(
        err,
        'Fallo Crítico en Despacho Directo de WhatsApp',
        `Destino: ${params.phoneNumber} | Especialista: ${params.psychologistName}`
      );
    }
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
  }).catch(async (err) => {
    // Disparar reporte en log centralizado y alerta por WhatsApp al +573107956907
    await reportTwilioCriticalError(
      err,
      'Fallo Crítico en Prueba de Conexión Twilio WhatsApp',
      `Destino: ${params.toPhone || params.phoneNumber || 'N/A'}`
    ).catch(() => {});

    return err.data || {
      success: false,
      error: err.message || 'Error de conexión con Twilio tras reintentos.',
      errorCode: err.errorCode || err.status || 500,
      suggestion: 'Verifica tu TWILIO_AUTH_TOKEN en Railway y en la consola de Twilio.'
    };
  });
}

export async function verifyTwilioCredentials(
  accountSid?: string,
  authToken?: string
): Promise<{
  success: boolean;
  accountSid?: string;
  friendlyName?: string;
  status?: string;
  message?: string;
  error?: string;
  errorCode?: number;
  advice?: string;
  rawResponse?: any;
}> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/twilio/verify-credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountSid, authToken }),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    await reportTwilioCriticalError(
      { message: data.message || data.error, errorCode: data.errorCode || res.status },
      'Fallo Crítico en Verificación de Credenciales Twilio',
      `Account SID: ${accountSid ? accountSid.substring(0, 8) + '...' : 'Configurado'}`
    ).catch(() => {});
  }
  return data;
}

export interface AdminNotificationSettings {
  adminPhone: string;
  enablePeriodicUpdates: boolean;
  periodicIntervalMinutes: number;
  enableErrorAlerts: boolean;
  lastReportTimestamp?: number;
}

export async function fetchAdminNotificationConfig(): Promise<AdminNotificationSettings> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/notifications/config`);
  if (!res.ok) throw new Error('Failed to fetch admin notifications config');
  return res.json();
}

export async function updateAdminNotificationConfig(
  config: Partial<AdminNotificationSettings>
): Promise<{ success: boolean; message: string; config: AdminNotificationSettings }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/notifications/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update admin notifications config');
  return res.json();
}

export async function triggerAdminTestReport(): Promise<{ success: boolean; message?: string }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/admin/notifications/test-report`, {
    method: 'POST',
  });
  return res.json();
}


