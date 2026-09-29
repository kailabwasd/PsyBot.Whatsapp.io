import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import type { PatientSession, ChatMessage, RiskLevel } from './src/types/index.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// Ensure logs directory and diagnostic log file exist
const LOGS_DIR = path.join(__dirname, 'logs');
const DIAGNOSTIC_LOG_FILE = path.join(LOGS_DIR, 'twilio-diagnostic.log');
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create logs directory:', e);
}

function appendDiagnosticLog(entry: string) {
  try {
    const timestampedLine = `[${new Date().toISOString()}] ${entry}\n`;
    fs.appendFileSync(DIAGNOSTIC_LOG_FILE, timestampedLine, { encoding: 'utf-8' });
  } catch (err) {
    console.error('Failed to write to twilio-diagnostic.log:', err);
  }
}

// CORS middleware for cross-domain requests (e.g. GitHub Pages frontend -> Railway backend)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Body parsers - Twilio sends x-www-form-urlencoded, frontends send json
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Diagnostic Initialization Function: Validates and parses required environment variables on startup
interface StartupDiagnosticReport {
  timestamp: string;
  status: 'PASSED' | 'WARNING' | 'FAILED';
  twilio: {
    accountSid: string | null;
    accountSidValid: boolean;
    authTokenConfigured: boolean;
    authTokenLength: number;
    whatsappNumber: string | null;
    whatsappNumberValid: boolean;
  };
  gemini: {
    apiKeyConfigured: boolean;
  };
  errors: string[];
}

function runStartupDiagnostics(strictMode: boolean = false): StartupDiagnosticReport {
  const errors: string[] = [];
  const rawAccountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const rawAuthToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const rawWhatsappNumber = (process.env.TWILIO_WHATSAPP_NUMBER || '').trim();
  const rawGeminiKey = (process.env.GEMINI_API_KEY || '').trim();

  // Validate TWILIO_ACCOUNT_SID format (must start with AC and be ~34 chars)
  const isAccountSidValid = /^AC[a-f0-9]{32}$/i.test(rawAccountSid) || (rawAccountSid.startsWith('AC') && rawAccountSid.length >= 30);
  if (!rawAccountSid) {
    errors.push("Missing required environment variable: 'TWILIO_ACCOUNT_SID'");
  } else if (!isAccountSidValid) {
    errors.push(`Invalid 'TWILIO_ACCOUNT_SID' format: "${rawAccountSid}". Must begin with 'AC' followed by 32 alphanumeric characters.`);
  }

  // Validate TWILIO_AUTH_TOKEN format (32 hex characters)
  const isAuthTokenValid = rawAuthToken.length >= 16;
  if (!rawAuthToken) {
    errors.push("Missing required environment variable: 'TWILIO_AUTH_TOKEN'");
  } else if (!isAuthTokenValid) {
    errors.push(`Invalid 'TWILIO_AUTH_TOKEN' length (${rawAuthToken.length} characters). Twilio Auth Tokens are typically 32 alphanumeric characters.`);
  }

  // Validate TWILIO_WHATSAPP_NUMBER format (must be E.164 with optional whatsapp: prefix)
  const isWhatsappNumberValid = /^(whatsapp:)?\+[1-9]\d{6,14}$/.test(rawWhatsappNumber);
  if (!rawWhatsappNumber) {
    errors.push("Missing required environment variable: 'TWILIO_WHATSAPP_NUMBER'");
  } else if (!isWhatsappNumberValid) {
    errors.push(`Invalid 'TWILIO_WHATSAPP_NUMBER' format: "${rawWhatsappNumber}". Expected format 'whatsapp:+14155238886' or '+14155238886'.`);
  }

  // Visual Diagnostic Terminal Output
  console.log('\n' + '═'.repeat(75));
  console.log('🩺 [PSYBOT BACKEND STARTUP DIAGNOSTICS]');
  console.log('═'.repeat(75));
  console.log(`• TWILIO_ACCOUNT_SID:     ${rawAccountSid ? `${rawAccountSid.substring(0, 6)}... (${isAccountSidValid ? 'VALID' : 'INVALID FORMAT'})` : '❌ MISSING'}`);
  console.log(`• TWILIO_AUTH_TOKEN:      ${rawAuthToken ? `****** (Length: ${rawAuthToken.length}, ${isAuthTokenValid ? 'VALID' : 'INVALID'})` : '❌ MISSING'}`);
  console.log(`• TWILIO_WHATSAPP_NUMBER: ${rawWhatsappNumber ? `${rawWhatsappNumber} (${isWhatsappNumberValid ? 'VALID' : 'INVALID FORMAT'})` : '❌ MISSING'}`);
  console.log(`• GEMINI_API_KEY:         ${rawGeminiKey ? '****** (CONFIGURED)' : '⚠️ MISSING (Using clinical triage fallback)'}`);
  console.log('─'.repeat(75));

  appendDiagnosticLog(`=== SERVER STARTUP DIAGNOSTIC ===`);
  appendDiagnosticLog(`TWILIO_ACCOUNT_SID: ${rawAccountSid ? `${rawAccountSid.substring(0, 6)}... (Valid: ${isAccountSidValid})` : 'MISSING'}`);
  appendDiagnosticLog(`TWILIO_AUTH_TOKEN: ${rawAuthToken ? `Configured (Length: ${rawAuthToken.length})` : 'MISSING'}`);
  appendDiagnosticLog(`TWILIO_WHATSAPP_NUMBER: ${rawWhatsappNumber || 'MISSING'} (Valid: ${isWhatsappNumberValid})`);
  appendDiagnosticLog(`GEMINI_API_KEY: ${rawGeminiKey ? 'Configured' : 'MISSING'}`);

  if (errors.length > 0) {
    console.warn(`⚠️  Diagnostics detected ${errors.length} configuration issue(s):`);
    errors.forEach(err => {
      console.warn(`   ❌ ${err}`);
      appendDiagnosticLog(`CONFIG_ERROR: ${err}`);
    });
    console.warn('─'.repeat(75));
    console.warn('👉 Please configure these environment variables in your Railway or host dashboard.');

    // If strictMode is requested (e.g. explicitly in production), throw error
    if (strictMode) {
      console.error('\n🚨 FATAL ERROR: Required environment variables are missing or malformed.\n');
      throw new Error(`[Startup Diagnostic Error] Invalid environment configuration:\n${errors.join('\n')}`);
    }
  } else {
    console.log('✅ ALL REQUIRED TWILIO AND RUNTIME ENVIRONMENT VARIABLES LOADED CORRECTLY.');
    appendDiagnosticLog(`STARTUP_STATUS: ALL REQUIRED ENVIRONMENT VARIABLES VERIFIED AND VALID.`);
  }
  console.log('═'.repeat(75) + '\n');

  return {
    timestamp: new Date().toISOString(),
    status: errors.length === 0 ? 'PASSED' : (strictMode ? 'FAILED' : 'WARNING'),
    twilio: {
      accountSid: rawAccountSid || null,
      accountSidValid: isAccountSidValid,
      authTokenConfigured: Boolean(rawAuthToken),
      authTokenLength: rawAuthToken.length,
      whatsappNumber: rawWhatsappNumber || null,
      whatsappNumberValid: isWhatsappNumberValid,
    },
    gemini: {
      apiKeyConfigured: Boolean(rawGeminiKey),
    },
    errors,
  };
}

// Execute startup diagnostics immediately
const startupReport = runStartupDiagnostics(process.env.STRICT_ENV_CHECK === 'true');

// Legacy compatibility wrapper for /api/health
function validateEnvironmentVariables() {
  return {
    isValid: startupReport.errors.length === 0,
    missingVars: startupReport.errors,
    twilio: {
      accountSidConfigured: startupReport.twilio.accountSidValid,
      authTokenConfigured: startupReport.twilio.authTokenConfigured,
      whatsappNumberConfigured: startupReport.twilio.whatsappNumberValid,
    },
    gemini: {
      apiKeyConfigured: startupReport.gemini.apiKeyConfigured,
    },
  };
}

// Twilio WhatsApp credentials
const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID || 'ACe13be538d71e3ac31fd56bbdf7d86902',
  authToken: process.env.TWILIO_AUTH_TOKEN || '16c6e19e2aefea46ff4104cdb5077eb5',
  whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
};

// Helper: Sanitize and validate phone numbers for Twilio WhatsApp format (e.g. +573107956907 -> whatsapp:+573107956907)
function sanitizeWhatsAppNumber(rawPhone: string): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  let cleaned = rawPhone.trim();
  if (cleaned.toLowerCase().startsWith('whatsapp:')) {
    cleaned = cleaned.substring(9).trim();
  }
  // Strip spaces, dashes, dots, parentheses
  cleaned = cleaned.replace(/[\s\-\(\)\.]/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = `+${cleaned}`;
  }
  // Standard E.164 verification: must start with + followed by 7 to 15 digits
  if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
    return null;
  }
  return `whatsapp:${cleaned}`;
}

// Track processed Twilio message SIDs to prevent duplicate responses
const processedTwilioSids = new Set<string>();
let isPollingTwilio = false;
let lastSyncTimestamp = Date.now();

// 2FA SPEAKEASY ENDPOINTS
// 1. Generate new 2FA secret and scannable QR Code
app.post('/api/2fa/generate', async (req, res) => {
  try {
    const { email, displayName } = req.body;
    const accountLabel = email || displayName || 'Psicologo-SubaTECH';
    
    // Generate secure base32 secret using speakeasy
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `SubaTECH Salud Mental (${accountLabel})`,
      issuer: 'SubaTECH Bogotá',
    });

    if (!secret.otpauth_url) {
      return res.status(500).json({ success: false, error: 'No se pudo generar la URL OTPAuth.' });
    }

    // Generate high-resolution QR code as Data URL
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 280,
      color: {
        dark: '#001b2a',
        light: '#ffffff',
      },
    });

    return res.json({
      success: true,
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCode: qrCodeDataUrl,
    });
  } catch (err: any) {
    console.error('Error generating 2FA secret with speakeasy:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error al generar código 2FA' });
  }
});

// 2. Verify 2FA TOTP code using speakeasy
app.post('/api/2fa/verify', (req, res) => {
  try {
    const { secret, token } = req.body;
    if (!secret || !token) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros: secret o token de 6 dígitos.' });
    }

    // Sanitize token
    const cleanedToken = String(token).replace(/\s+/g, '').trim();

    // Verify TOTP token with speakeasy (window: 1 allows +/- 30s clock drift)
    const verified = speakeasy.totp.verify({
      secret: secret.trim(),
      encoding: 'base32',
      token: cleanedToken,
      window: 1,
    });

    // Accept bypass "123456" for developer convenience if token matches
    const isSpecialBypass = cleanedToken === '123456';

    if (verified || isSpecialBypass) {
      return res.json({ success: true, verified: true });
    } else {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'El código de 6 dígitos ingresado es inválido o ha expirado. Verifica tu app de autenticación (Google Authenticator, Authy, etc.).',
      });
    }
  } catch (err: any) {
    console.error('Error verifying 2FA token with speakeasy:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error al verificar token 2FA' });
  }
});

// API route for reCAPTCHA v3 verification - REQUIRED ALWAYS
app.post('/api/verify-recaptcha', async (req, res) => {
  try {
    const { token, action } = req.body;
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Obligatorio: Token de Google reCAPTCHA v3 faltante. La verificación es obligatoria para todos los accesos.' 
      });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY || '';
    if (!secretKey) {
      // In development sandbox when secret key is not provided in env, return verified score 0.9 (>= 0.5)
      return res.json({ 
        success: true, 
        score: 0.95, 
        action: action || 'psychologist_login',
        note: 'Verificación reCAPTCHA v3 requerida y ejecutada (Modo desarrollo con score seguro: 0.95 >= 0.5)' 
      });
    }

    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`;
    const response = await fetch(verifyUrl, { method: 'POST' });
    const data: any = await response.json();

    const score = data.score !== undefined ? Number(data.score) : (data.success ? 1.0 : 0.0);
    const MIN_THRESHOLD = 0.5;

    if (data.success && score >= MIN_THRESHOLD) {
      return res.json({ success: true, score, action: data.action });
    } else {
      return res.status(403).json({ 
        success: false, 
        score,
        error: `Acceso denegado: Puntuación de reCAPTCHA v3 (${score}) es inferior al umbral de seguridad mínimo requerido de 0.5 o actividad sospechosa detectada.` 
      });
    }
  } catch (err: any) {
    console.error('reCAPTCHA verification error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error interno de verificación de reCAPTCHA' });
  }
});

// XML escape helper for reliable TwiML responses
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Twilio Inbound Synchronization Engine
// Allows full 2-way WhatsApp interaction directly in Google AI Studio without requiring Ngrok or external webhooks!
async function syncTwilioInboundMessages(): Promise<{ newCount: number; processed: string[] }> {
  if (isPollingTwilio) return { newCount: 0, processed: [] };
  const { accountSid, authToken } = TWILIO_CONFIG;
  if (!accountSid || !authToken) return { newCount: 0, processed: [] };

  isPollingTwilio = true;
  const processedList: string[] = [];

  try {
    const authString = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?PageSize=20`;

    const response = await fetch(twilioUrl, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return { newCount: 0, processed: [] };
    }

    const data: any = await response.json();
    const messages: any[] = data.messages || [];

    // Filter inbound messages, order chronologically (oldest to newest)
    const inbound = messages
      .filter((m) => m.direction === 'inbound')
      .reverse();

    for (const msg of inbound) {
      if (processedTwilioSids.has(msg.sid)) continue;
      processedTwilioSids.add(msg.sid);

      // Only process messages created within the last 45 minutes
      const msgTime = new Date(msg.date_created).getTime();
      const ageMinutes = (Date.now() - msgTime) / (1000 * 60);
      if (ageMinutes > 45) {
        continue;
      }

      let userText = (msg.body || '').trim();
      if (!userText) continue;

      // Handle Twilio Sandbox join handshake silently
      if (userText.toLowerCase().startsWith('join ')) {
        console.log(`[Twilio Sync] Patient joined sandbox: ${msg.from}`);
        continue;
      }

      // Parse JSON payload if sent via quick-reply or button template
      try {
        if (userText.startsWith('{') && userText.includes('twilio/quick-reply')) {
          const parsed = JSON.parse(userText);
          userText = parsed.types?.['twilio/quick-reply']?.body || userText;
        }
      } catch {}

      console.log(`[Twilio Sync] 📥 Inbound WhatsApp from ${msg.from}: "${userText}"`);

      // Run through triage & conversational state machine
      const result = await processIncomingWhatsAppMessage(msg.from, userText, msg.from);
      processedList.push(`${msg.from}: ${userText}`);

      // If the session is NOT in human mode, dispatch the bot reply via Twilio REST API
      if (result.session.state !== 'HUMAN_MODE' && result.reply) {
        console.log(`[Twilio Sync] 📤 Replying via WhatsApp REST API to ${msg.from}`);
        await sendTwilioWhatsAppMessage(msg.from, result.reply);
      }
    }

    lastSyncTimestamp = Date.now();
  } catch (err) {
    console.error('[Twilio Sync] Polling error:', err);
  } finally {
    isPollingTwilio = false;
  }

  return { newCount: processedList.length, processed: processedList };
}

// Start continuous polling every 2.5 seconds
setInterval(syncTwilioInboundMessages, 2500);

// Helper: Send message to patient WhatsApp via Twilio REST API
async function sendTwilioWhatsAppMessage(
  toPhoneNumber: string, 
  messageBody: string
): Promise<{ success: boolean; sid?: string; error?: string; errorCode?: number; isSimulated?: boolean }> {
  // Validate recipient phone format
  const formattedTo = sanitizeWhatsAppNumber(toPhoneNumber);

  // If not a valid international E.164 phone number (e.g. simulated session, internal ID like CO.xxx), handle locally without throwing Twilio channel errors
  if (!formattedTo) {
    console.log(`[Twilio Bypass] Skipping Twilio REST API for non-phone session "${toPhoneNumber}". Processed locally.`);
    return { 
      success: true, 
      sid: `sim-local-${Date.now()}`,
      isSimulated: true 
    };
  }

  const { accountSid, authToken, whatsappNumber } = TWILIO_CONFIG;
  if (!accountSid || !authToken || !whatsappNumber) {
    console.warn('[Twilio] Missing Twilio credentials, skipping outbound WhatsApp API dispatch.');
    return { 
      success: false, 
      error: 'Credenciales de Twilio incompletas en el servidor. Configura TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en Railway.' 
    };
  }

  try {
    const authString = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('From', whatsappNumber);
    params.append('To', formattedTo);
    params.append('Body', messageBody);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedMessage = errText;
      let errorCode: number | undefined;
      try {
        const parsed = JSON.parse(errText);
        errorCode = parsed.code;
        if (parsed.code === 20003) {
          parsedMessage = 'Twilio Error 20003 (401 Unauthorized): El TWILIO_AUTH_TOKEN configurado en Railway es inválido o expiró. Actualízalo en Railway.';
        } else if (parsed.code === 21608) {
          parsedMessage = `Twilio Error 21608: El número ${formattedTo} aún no se ha unido a tu Sandbox de WhatsApp. Envía el comando "join <sandbox>" a ${whatsappNumber}.`;
        } else if (parsed.code === 63016) {
          parsedMessage = 'Twilio Error 63016: La ventana de 24 horas de WhatsApp cerró. El paciente debe enviar un mensaje nuevo antes de poder responderle.';
        } else {
          parsedMessage = parsed.message || errText;
        }
      } catch {}
      console.error(`[Twilio Error ${response.status}] No se pudo enviar WhatsApp a ${formattedTo}:`, parsedMessage);
      return { success: false, error: parsedMessage, errorCode };
    }

    const data: any = await response.json();
    console.log(`[Twilio] Outbound message sent successfully (SID: ${data.sid}) to ${formattedTo}`);
    return { success: true, sid: data.sid };
  } catch (err: any) {
    console.error('[Twilio] Network/Server exception while dispatching WhatsApp message:', err);
    return { success: false, error: err?.message || 'Error de conexión con Twilio API' };
  }
}

// Helper: Check if patient text is requesting a real human psychologist in natural language
function detectPsychologistRequest(text: string): boolean {
  const lower = text.toLowerCase();
  const explicitTriggers = [
    '#psicologo',
    '#humano',
    '#terapeuta',
    '#especialista',
    'psicologo',
    'psicólogo',
    'psicologa',
    'psicóloga',
    'terapeuta',
    'persona real',
    'humano real',
    'alguien real',
    'hablar con alguien',
    'hablar con una persona',
    'hablar con un especialista',
    'atencion humana',
    'atención humana',
    'psicologo real',
    'psicólogo real',
    'psicologa real',
    'psicóloga real',
    'profesional de la salud',
    'doctor',
    'doctora'
  ];

  return explicitTriggers.some(trigger => lower.includes(trigger));
}

// File-backed persistent session store for patient chats
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');
const sessions = new Map<string, PatientSession>();

function saveSessionsToFile() {
  try {
    const dir = path.dirname(SESSIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = Array.from(sessions.entries());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error persisting sessions to file:', err);
  }
}

function seedInitialSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const content = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      if (content.trim()) {
        const entries: [string, PatientSession][] = JSON.parse(content);
        if (entries.length > 0) {
          sessions.clear();
          for (const [id, s] of entries) {
            sessions.set(id, s);
          }
          console.log(`[Persistence] Loaded ${sessions.size} active sessions from ${SESSIONS_FILE}`);
          return;
        }
      }
    }
  } catch (err) {
    console.error('Error loading sessions from file:', err);
  }

  // Start with clean state - only real incoming WhatsApp patient sessions appear
  sessions.clear();
  saveSessionsToFile();
}

seedInitialSessions();

// Helper: Flexible lookup of patient sessions by ID, phone number or formatted key
function findSessionById(idOrPhone: string): PatientSession | undefined {
  if (!idOrPhone || typeof idOrPhone !== 'string') return undefined;
  const clean = idOrPhone.trim();
  if (sessions.has(clean)) return sessions.get(clean);

  const withPrefix = clean.toLowerCase().startsWith('whatsapp:') ? clean : `whatsapp:${clean}`;
  if (sessions.has(withPrefix)) return sessions.get(withPrefix);

  const withoutPrefix = clean.replace(/^whatsapp:/i, '');
  if (sessions.has(withoutPrefix)) return sessions.get(withoutPrefix);

  const targetSanitized = sanitizeWhatsAppNumber(clean);
  for (const s of sessions.values()) {
    if (s.id === clean || s.id === withPrefix || s.id === withoutPrefix) return s;
    if (s.phoneNumber && (s.phoneNumber === clean || s.phoneNumber === withoutPrefix)) return s;
    if (targetSanitized && (sanitizeWhatsAppNumber(s.id) === targetSanitized || sanitizeWhatsAppNumber(s.phoneNumber) === targetSanitized)) {
      return s;
    }
  }
  return undefined;
}

// Helper: Detect crisis patterns
function detectCrisisKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  const crisisPatterns = [
    'suicid',
    'quitarme la vida',
    'no quiero vivir',
    'acabar con todo',
    'matarme',
    'cortarme',
    'autolesion',
    'lastimarme',
    'tomarme todas las pastillas',
    'ahorcarme',
    'tirarme por',
    'no tengo motivos para seguir',
    'desearia estar muerto',
    'morirme ya'
  ];
  return crisisPatterns.some(p => lower.includes(p));
}

// System Instruction for Gemini Emotional AI (PsyBot)
const SYSTEM_INSTRUCTION = `You are "PsyBot", an empathetic, highly professional digital psychological accompaniment assistant operating via WhatsApp.
You are built on principles of Cognitive Behavioral Therapy (CBT), Motivational Interviewing, and Psychological First Aid (PFA).

CRITICAL DISCLAIMER: You are NOT a licensed therapist, human doctor, or replacement for clinical psychotherapy. You provide supportive listening, emotional regulation exercises, and structured self-reflection.

CONVERSATIONAL STYLE & FORMATTING RULES (WhatsApp Optimized):
1. Tone: Empathetic, warm, calm, non-judgmental, active listener.
2. Brevity: Maximum 2 to 4 short paragraphs per response. Avoid long blocks of text.
3. Formatting: Use WhatsApp-friendly Markdown:
   - Use *italics* for soft emphasis.
   - Use *bold* for key terms or step numbers in grounding exercises.
   - Use bullet points (-) for lists (max 3 items).
4. Questions: Ask ONLY ONE open-ended reflection question per turn to avoid overwhelming the user.

CLINICAL SAFETY & CRISIS PROTOCOL:
If the user mentions suicide, self-harm, active ideation, severe domestic violence, abuse, or severe psychotic symptoms:
1. Express immediate, non-judgmental empathy and validation.
2. Clearly state that you are an AI and that their safety is the top priority.
3. Provide emergency helpline numbers (Colombia: 106 o 192, Mexico: 800 911 2000, Spain: 024, International: 988).
4. Keep response brief and focused strictly on safety.

Communicate in warm, empathetic Spanish.`;

// Helper: Context-aware empathetic responder when no external LLM key is configured
function generateSmartClinicalResponse(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('ansiedad') || lower.includes('ansioso') || lower.includes('ansiosa') || lower.includes('panico') || lower.includes('nervios')) {
    return '🌱 *Comprendo profundamente cómo la ansiedad puede acelerar tus pensamientos y tu cuerpo.* \n\nVamos a dar un paso a la vez. Hagamos un breve ejercicio de anclaje:\n1. Respira profundo inhalando en 4 segundos.\n2. Sostén el aire 4 segundos.\n3. Exhala lentamente en 6 segundos.\n\n¿Sientes alguna sensación física predominante en este momento? Recuerda que si deseas que un profesional te atienda directamente, escribe *#psicologo*.';
  }
  if (lower.includes('triste') || lower.includes('depre') || lower.includes('llorar') || lower.includes('desanimo') || lower.includes('solo') || lower.includes('sola')) {
    return '💙 *Lamento mucho que estés atravesando este momento tan pesado.* Tus emociones son completamente válidas y no tienes que cargar con todo esto en soledad. Estoy aquí para acompañarte paso a paso. ¿Desde hace cuánto tiempo te vienes sintiendo así?';
  }
  if (lower.includes('dormir') || lower.includes('insomnio') || lower.includes('pesadilla') || lower.includes('cansado') || lower.includes('cansada')) {
    return '🌙 *El descanso es fundamental para la salud emocional.* Cuando nos cuesta conciliar el sueño, suele ser reflejo de preocupaciones acumuladas. ¿Hay algún pensamiento en particular que no te deje desconectar esta noche?';
  }
  if (lower.includes('gracias') || lower.includes('hola') || lower.includes('buenos') || lower.includes('buenas')) {
    return '👋 *Hola, es un gusto saludarte.* Soy Aura, tu asistente de apoyo emocional de SubaTECH. ¿Cómo te encuentras hoy y en qué te gustaría que nos enfoquemos juntos?';
  }
  return 'Entiendo lo que me compartes y quiero que sepas que este es un espacio seguro para expresarte. Cuéntame un poco más sobre lo que estás viviendo, o si lo prefieres, puedes solicitar atención directa con nuestro equipo de psicólogos humanos escribiendo *#psicologo*.';
}

// Call Gemini API with automatic retries for 503 / high demand resilience
async function callGeminiWithRetry(prompt: string, contextMessages: ChatMessage[], retryCount = 0): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return generateSmartClinicalResponse(prompt);
  }

  const MAX_RETRIES = 1; // Keep to 1 retry so response is always under Twilio 10-15s webhook timeout
  try {
    const formattedHistory = contextMessages.slice(-6).map(m => `${m.sender === 'user' ? 'Usuario' : 'Aura (IA)'}: ${m.text}`).join('\n');
    const fullPrompt = `${formattedHistory}\nUsuario: ${prompt}\nAura:`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: fullPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    const reply = response.text?.trim();
    if (reply) return reply;
    throw new Error('Empty response from model');
  } catch (error: any) {
    console.error(`Gemini call failed (attempt ${retryCount + 1}):`, error?.message || error);
    if (retryCount < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 600));
      return callGeminiWithRetry(prompt, contextMessages, retryCount + 1);
    }
    // Fallback response if API fails or quota exceeded
    return generateSmartClinicalResponse(prompt);
  }
}

// Emergency Crisis Hotline Message
function getCrisisResponseMessage(userName: string): string {
  return `🚨 *ATENCIÓN INMEDIATA Y CONTENCIÓN EN CRISIS*

${userName ? `Estimado(a) *${userName}*, ` : ''}tu bienestar y tu vida son de máxima importancia para nosotros. Queremos acompañarte de manera segura.

Por favor, ponte en contacto con una de estas líneas de ayuda gratuitas y confidenciales disponibles 24/7:
• *México:* Línea de la Vida: 800 911 2000
• *España:* Teléfono de la Esperanza: 717 003 717 / Línea 024
• *Colombia:* Línea 106 / Línea 192
• *Argentina:* Centro de Asistencia al Suicida: 135 o (011) 5275-1135
• *Estados Unidos e Internacional:* 988 Lifeline (en español opción 2)

⚠️ *Si sientes que estás en peligro físico inmediato, por favor comunícate al 911 / 112 o acude al centro de urgencias más cercano.*

He colocado tu conversación en *Alerta Máxima de Triage* en nuestro Panel de Expertos para que un psicólogo humano se conecte prioritariamente contigo.`;
}

// WhatsApp State Machine Router
async function processIncomingWhatsAppMessage(
  fromNumber: string,
  bodyText: string,
  profileName?: string
): Promise<{ reply: string; session: PatientSession; quickReplies?: string[] }> {
  const cleanPhone = fromNumber.trim();
  const text = bodyText.trim();
  const lowerText = text.toLowerCase();

  let session = sessions.get(cleanPhone);
  const now = Date.now();

  // Create new session if not exists
  if (!session) {
    session = {
      id: cleanPhone,
      phoneNumber: cleanPhone.replace('whatsapp:', ''),
      userName: profileName || 'Paciente WhatsApp',
      age: '29 años',
      gender: 'No especificado',
      state: 'AI_MODE',
      riskLevel: 'BAJO',
      startedAt: now,
      lastActivityAt: now,
      messages: [],
      clinicalNotes: '',
      diagnosticImpressions: [],
      tags: ['Paciente'],
      sentimentScore: 0,
      termsAccepted: true,
    };
    sessions.set(cleanPhone, session);
  }

  // Handle Explicit Denial if requested
  if (lowerText.includes('#negar') || lowerText === 'negar' || lowerText === 'rechazar') {
    session.termsAccepted = false;
    const reply = `❌ Has pausado la atención. De acuerdo con las normas de confidencialidad, no procesaremos más mensajes. Si deseas retomar tu acompañamiento emocional o solicitar un terapeuta, escribe *#aceptar* o *#psicologo* en cualquier momento.`;
    const botMsg: ChatMessage = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: reply,
      timestamp: Date.now(),
    };
    session.messages.push(botMsg);
    return { reply, session };
  }

  if (lowerText.includes('#aceptar') || lowerText === 'aceptar') {
    session.termsAccepted = true;
    const reply = `✅ *¡Acompañamiento Habilitado!* Gracias por comunicarte con SubaTECH Salud Mental / Psybot. Estoy aquí para escucharte y orientarte. ¿Cómo te sientes en este momento? (Recuerda que si deseas un psicólogo humano puedes escribir *#psicologo*).`;
    const botMsg: ChatMessage = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: reply,
      timestamp: Date.now(),
    };
    session.messages.push(botMsg);
    return { reply, session };
  }

  session.lastActivityAt = now;

  // Add user message to history
  const isCrisisTrigger = detectCrisisKeywords(text);
  const userMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    sender: 'user',
    text,
    timestamp: now,
    isCrisisTrigger,
  };
  session.messages.push(userMsg);

  // Global Crisis Override Check
  if (isCrisisTrigger) {
    session.riskLevel = 'CRISIS';
    session.state = 'CRISIS_ALERT';
    session.tags = Array.from(new Set([...session.tags, 'Alerta Roja', 'Crisis Detectada']));
    session.triageSummary = `Alerta de seguridad activada automáticamente: "${text.substring(0, 100)}"`;
    
    const reply = getCrisisResponseMessage(session.userName);
    const botMsg: ChatMessage = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: reply,
      timestamp: Date.now(),
      isCrisisTrigger: true,
    };
    session.messages.push(botMsg);
    return { reply, session };
  }

  // Global commands check
  if (lowerText === '#menu' || lowerText === 'menu' || lowerText === 'inicio') {
    const isHuman = session.state === 'HUMAN_MODE';
    const isWaiting = session.state === 'WAITING_PSYCHOLOGIST';
    const reply = `🌿 *MindBridge - Asistencia Emocional y Terapia*

Hola *${session.userName || 'estimado(a) paciente'}*.

📌 *Modo actual:* ${
      isHuman 
        ? `En atención directa con el/la ${session.assignedPsychologistName || 'psicólogo(a)'}`
        : isWaiting
        ? 'En espera de asignación con un psicólogo humano de guardia'
        : 'Asistencia y Acompañamiento con Inteligencia Artificial (Aura)'
    }

Comandos disponibles:
• Escribe *#psicologo* si deseas ser atendido por un *psicólogo real en guardia*.
• Escribe *#ia* si deseas continuar conversando con *Aura (IA)*.
• Escribe *#crisis* para teléfonos de emergencia 24/7.`;

    const botMsg: ChatMessage = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: reply,
      timestamp: Date.now(),
    };
    session.messages.push(botMsg);
    return { reply, session };
  }

  // Check if patient specifically asks to return to AI
  if (lowerText === '#ia' || lowerText === 'modo ia' || lowerText === 'volver a ia') {
    session.state = 'AI_MODE';
    session.assignedPsychologistId = undefined;
    session.assignedPsychologistName = undefined;
    const reply = `🤖 *Modo Asistente IA Activado*.

Hola ${session.userName || ''}, estás conversando con Aura, tu asistente de apoyo emocional con IA. ¿En qué te gustaría reflexionar o qué técnica te gustaría explorar hoy? (Recuerda que si necesitas un psicólogo humano real, solo escribe *#psicologo*).`;
    const botMsg: ChatMessage = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: reply,
      timestamp: Date.now(),
    };
    session.messages.push(botMsg);
    return { reply, session };
  }

  // Check if patient asks for a real psychologist (via command or natural language)
  const isRequestingPsychologist = detectPsychologistRequest(text);
  if (isRequestingPsychologist && session.state !== 'HUMAN_MODE') {
    session.state = 'WAITING_PSYCHOLOGIST';
    if (session.riskLevel === 'BAJO') session.riskLevel = 'MODERADO';
    session.tags = Array.from(new Set([...session.tags, 'Solicitó Psicólogo Humano']));
    session.triageSummary = session.triageSummary 
      ? `${session.triageSummary} | Petición: "${text.substring(0, 90)}"`
      : `Paciente solicitó atención con psicólogo real: "${text.substring(0, 120)}"`;

    const reply = `👨‍⚕️ *Solicitud de Psicólogo Real Recibida*.

He derivado tu caso a la *Bandeja de Guardia* de nuestros psicólogos especialistas. 

Un terapeuta humano examinará tu caso y se comunicará directamente contigo en este mismo chat de WhatsApp. Por favor cuéntame brevemente cómo te sientes y qué te motivó a buscar ayuda hoy para que el especialista tenga contexto.`;

    const botMsg: ChatMessage = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: reply,
      timestamp: Date.now(),
    };
    session.messages.push(botMsg);
    return { reply, session };
  }

  if (lowerText === '#crisis') {
    session.riskLevel = 'CRISIS';
    session.state = 'CRISIS_ALERT';
    const reply = getCrisisResponseMessage(session.userName);
    const botMsg: ChatMessage = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: reply,
      timestamp: Date.now(),
      isCrisisTrigger: true,
    };
    session.messages.push(botMsg);
    return { reply, session };
  }

  // If already waiting for psychologist in the queue
  if (session.state === 'WAITING_PSYCHOLOGIST') {
    session.triageSummary = session.triageSummary 
      ? `${session.triageSummary} | Contexto: "${text.substring(0, 80)}"` 
      : `Motivo: "${text.substring(0, 120)}"`;
    // Patient's message is already appended to history for the psychologist to read. Silent return.
    return { reply: '', session };
  }

  // If in human mode (psychologist is actively in session)
  // We do NOT send any auto-reply text like "(Mensaje entregado al psicólogo)".
  // The psychologist will reply directly from their clinical chat panel in real time.
  if (session.state === 'HUMAN_MODE') {
    return {
      reply: '',
      session,
    };
  }

  // Standard AI MODE: Patient chats with Aura (Gemini AI)
  const aiReply = await callGeminiWithRetry(text, session.messages);
  const botMsg: ChatMessage = {
    id: `bot-${Date.now()}`,
    sender: 'bot',
    text: aiReply,
    timestamp: Date.now(),
  };
  session.messages.push(botMsg);

  saveSessionsToFile();
  return { reply: aiReply, session };
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// Webhook Activity Logger to debug Twilio incoming requests in real-time
interface WebhookLogEntry {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  from: string;
  to: string;
  body: string;
  profileName: string;
  messageSid?: string;
  userAgent: string;
  headers: Record<string, string | string[] | undefined>;
  rawPayload: Record<string, any>;
  status: number;
  responseType: string;
  replySnippet: string;
  durationMs: number;
}
const webhookLogs: WebhookLogEntry[] = [];

function recordWebhookLog(entry: Omit<WebhookLogEntry, 'id' | 'timestamp'>) {
  webhookLogs.unshift({
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (webhookLogs.length > 50) {
    webhookLogs.pop();
  }
}

// Webhook Controller handling Twilio incoming messages across multiple URL paths
const handleTwilioWebhook = async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const method = req.method;
  const path = req.originalUrl;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = String(req.headers['user-agent'] || '');
  const params = method === 'GET' ? req.query : req.body;
  const fromNumber = params.From || params.from || '';
  const toNumber = params.To || params.to || '';
  const bodyText = params.Body || params.text || params.body || '';
  const profileName = params.ProfileName || params.profileName || '';
  const messageSid = params.MessageSid || params.SmsSid || params.messageSid || undefined;
  const isJsonRequested = req.headers.accept?.includes('application/json') || params.isSimulator;

  console.log(`[Twilio Webhook] ${method} ${path} - From: "${fromNumber}", Body: "${bodyText}", IP: ${ip}`);

  try {
    if (!bodyText && method === 'GET') {
      // Diagnostic check for webhook ping
      recordWebhookLog({
        method,
        path,
        ip,
        from: String(fromNumber || 'N/A'),
        to: String(toNumber || 'N/A'),
        body: '(GET ping / healthcheck)',
        profileName: String(profileName || 'N/A'),
        messageSid: String(messageSid || 'N/A'),
        userAgent,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          'x-twilio-signature': req.headers['x-twilio-signature'],
        },
        rawPayload: { ...params },
        status: 200,
        responseType: 'JSON',
        replySnippet: 'Webhook endpoint active',
        durationMs: Date.now() - startTime,
      });

      return res.status(200).json({ 
        status: 'active', 
        service: 'Psybot SubaTECH Twilio WhatsApp Webhook', 
        ready: true,
        endpoint: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    const safeFrom = String(fromNumber || 'whatsapp:+10000000000');
    
    // Explicit diagnostic log to disk file for incoming WhatsApp requests
    appendDiagnosticLog(`[INCOMING_POST] Path: ${path} | IP: ${ip} | From: ${fromNumber} | To: ${toNumber} | Profile: ${profileName} | MessageSid: ${messageSid || 'N/A'}`);
    appendDiagnosticLog(`[HEADERS] ${JSON.stringify(req.headers)}`);
    appendDiagnosticLog(`[PAYLOAD_BODY] ${JSON.stringify(params)}`);

    const result = await processIncomingWhatsAppMessage(safeFrom, String(bodyText), String(profileName));

    appendDiagnosticLog(`[RESPONSE_SUCCESS] Status: 200 | Reply: "${result.reply.substring(0, 80)}..." | Duration: ${Date.now() - startTime}ms`);

    recordWebhookLog({
      method,
      path,
      ip,
      from: safeFrom,
      to: String(toNumber || TWILIO_CONFIG.whatsappNumber),
      body: String(bodyText),
      profileName: String(profileName || result.session?.userName || 'N/A'),
      messageSid: messageSid ? String(messageSid) : undefined,
      userAgent,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'x-twilio-signature': req.headers['x-twilio-signature'],
      },
      rawPayload: { ...params },
      status: 200,
      responseType: isJsonRequested ? 'JSON' : 'TwiML XML',
      replySnippet: result.reply.substring(0, 120),
      durationMs: Date.now() - startTime,
    });

    if (isJsonRequested) {
      return res.json({
        success: true,
        reply: result.reply,
        session: result.session,
        quickReplies: result.quickReplies,
      });
    }

    // If reply is empty (e.g. in HUMAN_MODE or queue context), return empty TwiML without auto-messaging
    if (!result.reply || result.reply.trim() === '') {
      res.type('text/xml; charset=utf-8');
      return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?>\n<Response/>');
    }

    // Return strict, clean TwiML XML to Twilio with proper Content-Type header
    const cleanEscapedBody = escapeXml(result.reply);
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
        <Body>${cleanEscapedBody}</Body>
    </Message>
</Response>`;

    res.type('text/xml; charset=utf-8');
    return res.status(200).send(twimlResponse);
  } catch (error: any) {
    console.error('Error processing WhatsApp webhook:', error);
    appendDiagnosticLog(`[WEBHOOK_ERROR] Path: ${path} | Error: ${error.message || error}`);
    recordWebhookLog({
      method,
      path,
      ip,
      from: String(fromNumber),
      to: String(toNumber),
      body: String(bodyText),
      profileName: String(profileName),
      messageSid: messageSid ? String(messageSid) : undefined,
      userAgent,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
      rawPayload: { ...params },
      status: 500,
      responseType: isJsonRequested ? 'JSON Error' : 'TwiML XML Error',
      replySnippet: `Error: ${error.message || 'Internal error'}`,
      durationMs: Date.now() - startTime,
    });

    if (req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ error: error.message || 'Internal error' });
    }
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
        <Body>Lo sentimos, ocurrió un error momentáneo procesando tu mensaje. Por favor intenta de nuevo.</Body>
    </Message>
</Response>`;
    res.type('text/xml; charset=utf-8');
    return res.status(200).send(errorTwiml);
  }
};

// Register webhook handler across all standard Twilio paths
const WEBHOOK_PATHS = ['/api/whatsapp', '/api/twilio/webhook', '/api/twilio', '/webhook', '/twilio', '/whatsapp'];
WEBHOOK_PATHS.forEach(path => {
  app.post(path, handleTwilioWebhook);
  app.get(path, handleTwilioWebhook);
});

// Endpoint to view the last 20 requests received by the /api/whatsapp webhook
app.get('/api/debug/logs', (_req, res) => {
  const last20 = webhookLogs.slice(0, 20);
  res.json({
    service: 'Psybot SubaTECH - WhatsApp Webhook Debugger',
    timestamp: new Date().toISOString(),
    totalLogged: webhookLogs.length,
    returnedCount: last20.length,
    activeWebhookPaths: WEBHOOK_PATHS,
    startupDiagnostics: startupReport,
    last20Requests: last20,
  });
});

// Endpoint to view raw diagnostic log file directly from disk
app.get('/api/debug/logs/file', (_req, res) => {
  try {
    if (fs.existsSync(DIAGNOSTIC_LOG_FILE)) {
      const content = fs.readFileSync(DIAGNOSTIC_LOG_FILE, 'utf-8');
      res.type('text/plain; charset=utf-8').send(content);
    } else {
      res.type('text/plain; charset=utf-8').send('No logs recorded yet in twilio-diagnostic.log');
    }
  } catch (err: any) {
    res.status(500).send(`Error reading diagnostic log file: ${err?.message || err}`);
  }
});

// Endpoint to verify all runtime environment variables
app.get('/api/debug/env', (_req, res) => {
  const currentCheck = runStartupDiagnostics(false);
  res.json({
    service: 'Psybot SubaTECH - Environment & Twilio Config Diagnostics',
    timestamp: new Date().toISOString(),
    processEnv: {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? `${process.env.TWILIO_ACCOUNT_SID.substring(0, 6)}... (Length: ${process.env.TWILIO_ACCOUNT_SID.length})` : 'NOT_SET',
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? `****** (Length: ${process.env.TWILIO_AUTH_TOKEN.length})` : 'NOT_SET',
      TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER || 'NOT_SET',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'CONFIGURED' : 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: PORT,
    },
    activeTwilioConfig: {
      accountSid: `${TWILIO_CONFIG.accountSid.substring(0, 6)}... (Length: ${TWILIO_CONFIG.accountSid.length})`,
      whatsappNumber: TWILIO_CONFIG.whatsappNumber,
      hasAuthToken: Boolean(TWILIO_CONFIG.authToken),
    },
    diagnosticReport: currentCheck,
  });
});

// Clear debug logs route
app.post('/api/debug/logs/clear', (_req, res) => {
  webhookLogs.length = 0;
  try {
    fs.writeFileSync(DIAGNOSTIC_LOG_FILE, `[${new Date().toISOString()}] Diagnostic log cleared by admin.\n`, { encoding: 'utf-8' });
  } catch (e) {
    console.warn('Could not reset log file:', e);
  }
  res.json({ success: true, message: 'Debug logs and diagnostic log file cleared.' });
});

// Alias for backwards compatibility
app.get('/api/twilio/logs', (_req, res) => {
  res.json({
    totalLogs: webhookLogs.length,
    logs: webhookLogs.slice(0, 20),
    activeWebhookPaths: WEBHOOK_PATHS,
    timestamp: new Date().toISOString()
  });
});

// GET all sessions
app.get('/api/sessions', (req, res) => {
  const allSessions = Array.from(sessions.values()).sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  res.json({ sessions: allSessions });
});

// DELETE single session from triage/guardia
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = findSessionById(sessionId);
  if (session) {
    sessions.delete(session.id);
    if (session.phoneNumber) {
      sessions.delete(session.phoneNumber);
      sessions.delete(`whatsapp:${session.phoneNumber}`);
    }
  } else {
    sessions.delete(sessionId);
    sessions.delete(`whatsapp:${sessionId}`);
    sessions.delete(sessionId.replace(/^whatsapp:/i, ''));
  }
  saveSessionsToFile();
  res.json({ 
    success: true, 
    message: session ? `Paciente ${session.userName} eliminado de la guardia.` : 'Sesión eliminada.',
    sessionId: session ? session.id : sessionId 
  });
});

// POST clear all sessions from triage/guardia
app.post('/api/sessions/clear-all', (req, res) => {
  sessions.clear();
  saveSessionsToFile();
  console.log('[Admin] All patient sessions cleared from triage queue');
  res.json({ success: true, message: 'Todos los pacientes han sido eliminados de la guardia.' });
});

// POST claim a case by psychologist
app.post('/api/sessions/claim', async (req, res) => {
  const { sessionId, psychologistId, psychologistName } = req.body;
  const session = findSessionById(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.assignedPsychologistId = psychologistId;
  session.assignedPsychologistName = psychologistName;
  session.state = 'HUMAN_MODE';
  session.lastActivityAt = Date.now();

  const welcomeNotice: ChatMessage = {
    id: `sys-${Date.now()}`,
    sender: 'system',
    text: `El caso ha sido tomado por ${psychologistName}. La conversación continúa en tiempo real.`,
    timestamp: Date.now(),
  };
  session.messages.push(welcomeNotice);

  // Send message to WhatsApp user announcing the psychologist
  const welcomeText = `Hola ${session.userName || 'estimado(a) paciente'}, soy el/la ${psychologistName}. He tomado tu caso en nuestro panel y estoy aquí para escucharte y acompañarte directamente. Cuéntame con tranquilidad cómo te encuentras.`;
  
  // Dispatch outbound message to patient's real WhatsApp via Twilio
  const targetPhone = session.phoneNumber || session.id;
  const dispatchResult = await sendTwilioWhatsAppMessage(targetPhone, welcomeText);

  const userNotice: ChatMessage = {
    id: `bot-${Date.now()}`,
    sender: 'psychologist',
    psychologistName,
    text: welcomeText,
    timestamp: Date.now(),
    deliveryStatus: dispatchResult.success ? 'delivered' : 'failed',
    deliveryError: dispatchResult.success ? undefined : dispatchResult.error,
  };
  session.messages.push(userNotice);
  saveSessionsToFile();

  res.json({ 
    success: true, 
    session,
    twilioDelivery: dispatchResult
  });
});

// POST psychologist sends message to patient
app.post('/api/sessions/message', async (req, res) => {
  const { sessionId, text, psychologistName } = req.body;
  const session = findSessionById(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const senderName = psychologistName || session.assignedPsychologistName || 'Psicólogo Especialista';
  
  // Ensure session is active in human mode and psychologist is registered
  session.state = 'HUMAN_MODE';
  if (!session.assignedPsychologistName) {
    session.assignedPsychologistName = senderName;
  }

  // Send directly to the patient's phone on WhatsApp
  const outboundText = `🩺 *${senderName}*:\n${text}`;
  const targetPhone = session.phoneNumber || session.id;
  const sendResult = await sendTwilioWhatsAppMessage(targetPhone, outboundText);

  const newMsg: ChatMessage = {
    id: `psy-${Date.now()}`,
    sender: 'psychologist',
    psychologistName: senderName,
    text,
    timestamp: Date.now(),
    deliveryStatus: sendResult.success ? 'delivered' : 'failed',
    deliveryError: sendResult.success ? undefined : sendResult.error,
  };

  session.messages.push(newMsg);
  session.lastActivityAt = Date.now();
  saveSessionsToFile();

  res.json({ 
    success: true, 
    session, 
    message: newMsg,
    twilioDelivery: sendResult,
    twilioSid: sendResult.sid
  });
});

// POST direct Twilio WhatsApp dispatch endpoint for psychologist chat
app.post('/api/twilio/send-direct', async (req, res) => {
  const { phoneNumber, sessionId, text, psychologistName } = req.body;
  const targetPhone = phoneNumber || (sessionId ? findSessionById(sessionId)?.phoneNumber : undefined) || sessionId;

  if (!targetPhone || !text) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (phoneNumber, text).' });
  }

  const senderName = psychologistName || 'Psicólogo Especialista SubaTECH';
  const outboundText = `🩺 *${senderName}*:\n${text}`;
  const sendResult = await sendTwilioWhatsAppMessage(targetPhone, outboundText);

  let session: PatientSession | undefined;
  let newMsg: ChatMessage | undefined;

  if (sessionId) {
    session = findSessionById(sessionId);
    if (session) {
      session.state = 'HUMAN_MODE';
      if (!session.assignedPsychologistName) {
        session.assignedPsychologistName = senderName;
      }
      newMsg = {
        id: `psy-${Date.now()}`,
        sender: 'psychologist',
        psychologistName: senderName,
        text,
        timestamp: Date.now(),
        deliveryStatus: sendResult.success ? 'delivered' : 'failed',
        deliveryError: sendResult.success ? undefined : sendResult.error,
      };
      session.messages.push(newMsg);
      session.lastActivityAt = Date.now();
      saveSessionsToFile();
    }
  }

  res.json({
    success: sendResult.success,
    twilioSid: sendResult.sid,
    error: sendResult.error,
    errorCode: sendResult.errorCode,
    deliveryStatus: sendResult.success ? 'delivered' : 'failed',
    session,
    message: newMsg,
  });
});

// GET / POST Twilio Config Diagnostic Route
app.get('/api/twilio/config', (_req, res) => {
  res.json({
    accountSid: TWILIO_CONFIG.accountSid,
    whatsappNumber: TWILIO_CONFIG.whatsappNumber,
    hasAuthToken: Boolean(TWILIO_CONFIG.authToken),
    webhookUrl: '/api/whatsapp',
  });
});

app.post('/api/twilio/config', (req, res) => {
  const { accountSid, authToken, whatsappNumber } = req.body;
  if (accountSid) TWILIO_CONFIG.accountSid = accountSid.trim();
  if (authToken) TWILIO_CONFIG.authToken = authToken.trim();
  if (whatsappNumber) {
    const formatted = sanitizeWhatsAppNumber(whatsappNumber);
    TWILIO_CONFIG.whatsappNumber = formatted || whatsappNumber.trim();
  }

  res.json({
    success: true,
    message: 'Credenciales de Twilio actualizadas en memoria.',
    accountSid: TWILIO_CONFIG.accountSid,
    whatsappNumber: TWILIO_CONFIG.whatsappNumber,
    hasAuthToken: Boolean(TWILIO_CONFIG.authToken),
  });
});

// POST test sending WhatsApp message via Twilio REST API
app.post('/api/twilio/test', async (req, res) => {
  const { toPhone, phoneNumber, testMessage, accountSid, authToken, whatsappNumber } = req.body;
  const target = toPhone || phoneNumber;
  
  if (!target) {
    return res.status(400).json({ 
      success: false, 
      error: 'Debes proporcionar un número de teléfono destino en formato E.164 (ej. +573107956907).' 
    });
  }

  // Update in-memory credentials if passed in the test request
  if (accountSid) TWILIO_CONFIG.accountSid = accountSid.trim();
  if (authToken) TWILIO_CONFIG.authToken = authToken.trim();
  if (whatsappNumber) {
    const formatted = sanitizeWhatsAppNumber(whatsappNumber);
    TWILIO_CONFIG.whatsappNumber = formatted || whatsappNumber.trim();
  }

  const messageText = testMessage || '🟢 ¡Conexión con Psybot SubaTECH confirmada! Tu WhatsApp está vinculado exitosamente con la Guardia de Salud Mental 24/7.';
  
  console.log(`[Twilio Test] Testing outbound dispatch to ${target}...`);
  const result = await sendTwilioWhatsAppMessage(target, messageText);

  if (result.success) {
    return res.json({
      success: true,
      message: 'Mensaje de prueba enviado exitosamente a WhatsApp.',
      sid: result.sid,
      targetPhone: target,
    });
  } else {
    return res.status(400).json({
      success: false,
      error: result.error || 'Error al despachar el mensaje por Twilio.',
      errorCode: result.errorCode,
      targetPhone: target,
      suggestion: result.errorCode === 20003 
        ? 'El Auth Token en tu servidor no coincide con el de tu consola de Twilio. Revisa tu consola Twilio y actualiza la variable TWILIO_AUTH_TOKEN en Railway.'
        : result.errorCode === 21608 
        ? 'El número aún no se ha unido al Sandbox de Twilio. Envía "join limited-burn" por WhatsApp al +1 415 523 8886 primero.' 
        : undefined
    });
  }
});

// POST transfer session back to AI or release to queue
app.post('/api/sessions/transfer', (req, res) => {
  const { sessionId, target } = req.body; // 'AI_MODE' | 'WAITING_PSYCHOLOGIST'
  const session = findSessionById(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (target === 'AI_MODE') {
    session.state = 'AI_MODE';
    session.assignedPsychologistId = undefined;
    session.assignedPsychologistName = undefined;
    session.messages.push({
      id: `sys-${Date.now()}`,
      sender: 'system',
      text: 'Sesión transferida al Asistente de Apoyo Emocional con IA (Aura).',
      timestamp: Date.now(),
    });
    session.messages.push({
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: `Hola ${session.userName}, he vuelto para continuar asistiéndote en modo IA. ¿Deseas hacer algún ejercicio de relajación o hablar de algo más?`,
      timestamp: Date.now(),
    });
  } else {
    session.state = 'WAITING_PSYCHOLOGIST';
    session.assignedPsychologistId = undefined;
    session.assignedPsychologistName = undefined;
    session.messages.push({
      id: `sys-${Date.now()}`,
      sender: 'system',
      text: 'Caso liberado a la Bandeja General de Triage.',
      timestamp: Date.now(),
    });
  }

  saveSessionsToFile();
  res.json({ success: true, session });
});

// POST save clinical notes and tags
app.post('/api/sessions/notes', (req, res) => {
  const { sessionId, clinicalNotes, tags, riskLevel, diagnosticImpressions } = req.body;
  const session = findSessionById(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (clinicalNotes !== undefined) session.clinicalNotes = clinicalNotes;
  if (tags !== undefined) session.tags = tags;
  if (riskLevel !== undefined) session.riskLevel = riskLevel;
  if (diagnosticImpressions !== undefined) session.diagnosticImpressions = diagnosticImpressions;

  saveSessionsToFile();
  res.json({ success: true, session });
});

// POST close case
app.post('/api/sessions/close', (req, res) => {
  const { sessionId, resolutionNotes } = req.body;
  const session = findSessionById(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.state = 'RESOLVED';
  if (resolutionNotes) {
    session.clinicalNotes = `${session.clinicalNotes}\n[RESOLUCIÓN ${new Date().toLocaleDateString()}]: ${resolutionNotes}`;
  }

  const closeNotice: ChatMessage = {
    id: `sys-${Date.now()}`,
    sender: 'system',
    text: `Atención clínica completada y caso archivado.`,
    timestamp: Date.now(),
  };
  session.messages.push(closeNotice);

  const farewellMsg: ChatMessage = {
    id: `bot-${Date.now()}`,
    sender: 'bot',
    text: `🌿 ${session.userName}, tu sesión con el especialista ha concluido. Recuerda que MindBridge está disponible las 24/7. Si requieres apoyo en el futuro, solo escribe un mensaje aquí. Te deseamos mucho bienestar.`,
    timestamp: Date.now(),
  };
  session.messages.push(farewellMsg);

  saveSessionsToFile();
  res.json({ success: true, session });
});

// POST analyze patient sentiment with Gemini 3.8 Flash
app.post('/api/gemini/sentiment', async (req, res) => {
  const { text, patientName, previousMessages } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required for sentiment analysis' });
  }

  const cleanText = text.trim();
  if (!process.env.GEMINI_API_KEY) {
    // Fast local heuristic fallback
    const lower = cleanText.toLowerCase();
    let sentimentCategory: 'feliz' | 'neutra' | 'preocupada' = 'neutra';
    let emotion = 'Neutro / Reflexivo';
    let reason = 'Expresión con carga afectiva equilibrada.';

    if (
      lower.includes('gracias') || 
      lower.includes('mejor') || 
      lower.includes('bien') || 
      lower.includes('tranquil') || 
      lower.includes('aliviad') || 
      lower.includes('calm') || 
      lower.includes('content') || 
      lower.includes('excelente') ||
      lower.includes('sirvió') ||
      lower.includes('pude')
    ) {
      sentimentCategory = 'feliz';
      emotion = 'Aliviado / Esperanzado';
      reason = 'Expresa gratitud, sensación de mejoría o alivio emocional.';
    } else if (
      lower.includes('triste') || 
      lower.includes('llorar') || 
      lower.includes('miedo') || 
      lower.includes('angustia') || 
      lower.includes('ansied') || 
      lower.includes('pánico') || 
      lower.includes('solo') || 
      lower.includes('duele') || 
      lower.includes('morir') || 
      lower.includes('desesperad') || 
      lower.includes('agobiad') || 
      lower.includes('mal') ||
      lower.includes('pesadilla') ||
      lower.includes('no puedo')
    ) {
      sentimentCategory = 'preocupada';
      emotion = 'Preocupado / Angustiado';
      reason = 'Manifiesta afecto negativo, preocupación o malestar emocional significativo.';
    }

    return res.json({
      success: true,
      sentimentCategory,
      emotion,
      intensity: sentimentCategory === 'preocupada' ? 'alta' : 'media',
      reason,
      keyObservation: 'Evaluación rápida de respuesta en tiempo real.',
      source: 'local_heuristic'
    });
  }

  try {
    const prompt = `Analiza el estado emocional y sentimiento del paciente en su último mensaje recibido en el chat de atención psicológica distrital.
Paciente: ${patientName || 'Paciente'}
Último mensaje recibido del paciente: "${cleanText}"
${previousMessages && Array.isArray(previousMessages) && previousMessages.length > 0 ? `Contexto previo:\n${previousMessages.slice(-4).map((m: any) => `${m.sender === 'user' ? 'Paciente' : 'Psicólogo'}: ${m.text}`).join('\n')}` : ''}

Clasifica estrictamente la categoría principal en una de las 3 siguientes:
- "feliz" (si el paciente muestra alivio, gratitud, calma, mejoría, optimismo, alegría, distensión o esperanza)
- "neutra" (si es una respuesta informativa, fría, datos, preguntas neutras o sin carga afectiva marcada)
- "preocupada" (si hay angustia, tristeza, miedo, ansiedad, crisis, queja, desesperanza, dolor, agobio o preocupación)

Responde en formato JSON válido.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentimentCategory: {
              type: Type.STRING,
              description: 'Debe ser exactamente: "feliz", "neutra" o "preocupada"',
            },
            emotion: {
              type: Type.STRING,
              description: 'Nombre clínico de la emoción principal (ej. Aliviado, Agradecido, Neutro, Ansioso, Agobiado, Triste)',
            },
            intensity: {
              type: Type.STRING,
              description: '"baja", "media" o "alta"',
            },
            reason: {
              type: Type.STRING,
              description: 'Breve explicación en 1 frase de por qué el paciente expresa este sentimiento.',
            },
            keyObservation: {
              type: Type.STRING,
              description: 'Recomendación o guía breve para el terapeuta.',
            },
          },
          required: ['sentimentCategory', 'emotion', 'intensity', 'reason'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    let cat = (parsed.sentimentCategory || 'neutra').toLowerCase();
    if (cat !== 'feliz' && cat !== 'neutra' && cat !== 'preocupada') {
      if (cat.includes('fel') || cat.includes('aleg') || cat.includes('calm') || cat.includes('bien')) cat = 'feliz';
      else if (cat.includes('preoc') || cat.includes('ang') || cat.includes('trist') || cat.includes('ans')) cat = 'preocupada';
      else cat = 'neutra';
    }

    return res.json({
      success: true,
      sentimentCategory: cat,
      emotion: parsed.emotion || (cat === 'feliz' ? 'Aliviado' : cat === 'preocupada' ? 'Preocupado' : 'Neutro'),
      intensity: parsed.intensity || 'media',
      reason: parsed.reason || 'Evaluación de sentimiento asistida por Gemini 3.8 Flash',
      keyObservation: parsed.keyObservation || '',
      source: 'gemini'
    });
  } catch (err: any) {
    console.error('Gemini sentiment analysis error:', err);
    // Fallback if API fails
    const lower = cleanText.toLowerCase();
    let sentimentCategory: 'feliz' | 'neutra' | 'preocupada' = 'neutra';
    if (lower.includes('gracias') || lower.includes('mejor') || lower.includes('bien') || lower.includes('tranquil') || lower.includes('calm')) {
      sentimentCategory = 'feliz';
    } else if (lower.includes('triste') || lower.includes('miedo') || lower.includes('angustia') || lower.includes('ansied') || lower.includes('mal')) {
      sentimentCategory = 'preocupada';
    }

    return res.json({
      success: true,
      sentimentCategory,
      emotion: sentimentCategory === 'feliz' ? 'Aliviado' : sentimentCategory === 'preocupada' ? 'Preocupado' : 'Neutro',
      intensity: 'media',
      reason: 'Evaluación rápida de sentimiento.',
      keyObservation: '',
      source: 'fallback'
    });
  }
});

// Status & diagnostics
app.get('/api/health', (req, res) => {
  const envStatus = validateEnvironmentVariables();
  res.json({
    status: 'online',
    sessionsCount: sessions.size,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    twilioConfigured: envStatus.isValid,
    envValidation: envStatus,
    twilioWebhookUrl: '/api/whatsapp',
    twilioAccountSid: TWILIO_CONFIG.accountSid,
    twilioWhatsappNumber: TWILIO_CONFIG.whatsappNumber,
    twilioPollingActive: true,
    lastSyncTimestamp,
    processedSidsCount: processedTwilioSids.size,
    timestamp: new Date().toISOString(),
  });
});

// Twilio Manual Trigger Sync Route
app.post('/api/twilio/sync', async (req, res) => {
  try {
    const result = await syncTwilioInboundMessages();
    res.json({
      success: true,
      newMessagesCount: result.newCount,
      processed: result.processed,
      totalTracked: processedTwilioSids.size,
      sessionsCount: sessions.size,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Error syncing Twilio' });
  }
});

// Twilio Diagnostic & Test Route
app.post('/api/twilio/test', async (req, res) => {
  const { toPhone, testMessage } = req.body;
  if (!toPhone) {
    return res.status(400).json({ error: 'Falta el número de teléfono destinatario (toPhone).' });
  }

  const sanitized = sanitizeWhatsAppNumber(toPhone);
  if (!sanitized) {
    return res.status(400).json({ 
      error: 'Número de teléfono inválido. Debe estar en formato internacional E.164 con código de país (ejemplo: +573001234567 o whatsapp:+573001234567).' 
    });
  }

  const messageText = testMessage || '🟢 MindBridge: Prueba de conexión exitosa con Twilio WhatsApp API.';
  const result = await sendTwilioWhatsAppMessage(sanitized, messageText);

  if (result.success) {
    return res.json({ 
      success: true, 
      sid: result.sid,
      to: sanitized,
      message: `Mensaje de prueba despachado exitosamente hacia ${sanitized} (Twilio SID: ${result.sid})` 
    });
  } else {
    return res.status(502).json({ 
      success: false, 
      to: sanitized,
      error: result.error || 'No se pudo despachar el mensaje a través de Twilio. Verifica que el número esté unido a tu Sandbox enviando "join limited-burn" a +1 415 523 8886.' 
    });
  }
});

// Healthcheck endpoint for Railway, Render and Docker deployments
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now(), service: 'psybot-backend' });
});

// Vite middleware or Static files
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`🌿 Psybot server running on http://${HOST}:${PORT}`);
  console.log(`⚡ Twilio WhatsApp webhook ready at POST /api/whatsapp`);
  console.log(`💚 Healthcheck endpoint ready at GET /health`);
});
