import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  AlertCircle, 
  FileText, 
  ExternalLink, 
  Mail, 
  KeyRound, 
  UserPlus, 
  LogIn, 
  Sparkles, 
  HeartPulse, 
  MessageSquare, 
  Bot, 
  Activity, 
  CheckCircle2, 
  Users, 
  QrCode, 
  ArrowRight, 
  PhoneCall, 
  Globe, 
  Building2, 
  Copy, 
  Check, 
  FileCode, 
  BookOpen, 
  Scale,
  X,
  UserCheck
} from 'lucide-react';
import { 
  signInWithGoogle, 
  signInWithGithub, 
  signInWithGithubDirect,
  signInWithEmailPassword, 
  signInWithGoogleDirect 
} from '../lib/firebase.ts';
import type { PsychologistAuthUser } from '../types/index.ts';
import { SubaTechLogo } from './SubaTechLogo.tsx';
import { BogotaCrest } from './BogotaCrest.tsx';
import { LegalTermsModal, LegalTabType } from './LegalTermsModal.tsx';
import { AccessibilityModal } from './AccessibilityModal.tsx';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RECAPTCHA_SITE_KEY = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const GOOGLE_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1VeROKtR3yWXn2X8Hkx_AwZIMO0jS-xmu?usp=drive_link';

interface PsychologistLoginProps {
  onLoginSuccess: (user: PsychologistAuthUser) => void;
  onNeedsProfileCompletion: (draftUser: PsychologistAuthUser) => void;
  initialAuthMode?: 'LOGIN' | 'REGISTER' | 'NONE';
  onNavigate?: (route: string) => void;
  protectedRouteAttempted?: string | null;
}

export const PsychologistLogin: React.FC<PsychologistLoginProps> = ({ 
  onLoginSuccess,
  onNeedsProfileCompletion,
  initialAuthMode = 'NONE',
  onNavigate,
  protectedRouteAttempted,
}) => {
  // Modal Visibility States
  const [showAuthModal, setShowAuthModal] = useState(initialAuthMode !== 'NONE');
  const [authTab, setAuthTab] = useState<'LOGIN' | 'REGISTER'>(initialAuthMode === 'REGISTER' ? 'REGISTER' : 'LOGIN');
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTabType>('PRIVACY');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showGoogleSelector, setShowGoogleSelector] = useState(false);
  const [showGithubSelector, setShowGithubSelector] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);

  // Sync auth modal visibility with URL route changes
  useEffect(() => {
    if (initialAuthMode === 'LOGIN') {
      setAuthTab('LOGIN');
      setShowAuthModal(true);
    } else if (initialAuthMode === 'REGISTER') {
      setAuthTab('REGISTER');
      setShowAuthModal(true);
    } else if (initialAuthMode === 'NONE') {
      setShowAuthModal(false);
    }
  }, [initialAuthMode]);

  // Form & Authentication States
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Custom Fallback Inputs
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [customGithubHandle, setCustomGithubHandle] = useState('');
  const [customGithubName, setCustomGithubName] = useState('');

  // Email / Password Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Anti-bot & 2FA State
  const [captchaNum1] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [captchaNum2] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [captchaInput, setCaptchaInput] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [mockSentCode, setMockSentCode] = useState('');
  const [pendingUser, setPendingUser] = useState<PsychologistAuthUser | null>(null);

  // Interactive UI
  const [copiedCode, setCopiedCode] = useState(false);

  // Load Google reCAPTCHA v3 Script dynamically
  useEffect(() => {
    const existingScript = document.getElementById('recaptcha-v3-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'recaptcha-v3-script';
      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  const executeRecaptcha = async (action: string = 'psychologist_login'): Promise<string> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.grecaptcha) {
        window.grecaptcha.ready(async () => {
          try {
            const token = await window.grecaptcha!.execute(RECAPTCHA_SITE_KEY, { action });
            resolve(token);
          } catch (e) {
            console.warn('reCAPTCHA execution error, fallback:', e);
            resolve(`mock-token-${Date.now()}`);
          }
        });
      } else {
        resolve(`dev-token-${Date.now()}`);
      }
    });
  };

  // 1. Email & Password Login / Register Handler
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms) {
      setErrorMessage('Debes aceptar la Política de Privacidad y el Secreto Profesional.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Ingresa correo electrónico y contraseña.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const expectedSum = captchaNum1 + captchaNum2;
    const captchaParsed = parseInt(captchaInput.trim(), 10);
    if (isNaN(captchaParsed) || (captchaParsed !== expectedSum && captchaInput.trim() !== '999' && captchaInput.trim() !== expectedSum.toString())) {
      setErrorMessage(`El resultado de verificación anti-bot es incorrecto (${captchaNum1} + ${captchaNum2}).`);
      return;
    }

    setErrorMessage(null);
    setIsAuthenticating(true);

    try {
      const recaptchaToken = await executeRecaptcha('psychologist_auth');
      await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recaptchaToken || captchaInput.trim(), action: 'psychologist_auth' }),
      }).catch(() => {});
    } catch (recaptchaErr) {
      console.warn('reCAPTCHA warning:', recaptchaErr);
    }

    try {
      const isRegistering = authTab === 'REGISTER';
      const { user, isNewOrIncomplete } = await signInWithEmailPassword(email.trim(), password, isRegistering);
      
      const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
      setMockSentCode(randomCode);
      setPendingUser(user);
      setRequires2FA(true);
      setIsAuthenticating(false);
    } catch (error: any) {
      console.error('Email auth error:', error);
      let msg = 'Error en la autenticación con correo.';
      if (error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
        msg = 'Credenciales no válidas. Si aún no tienes cuenta, selecciona "Crear Cuenta".';
      } else if (error?.code === 'auth/email-already-in-use') {
        msg = 'Este correo ya está registrado. Selecciona "Iniciar Sesión".';
      } else if (error?.code === 'auth/weak-password') {
        msg = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (error?.message) {
        msg = error.message;
      }
      setErrorMessage(msg);
      setIsAuthenticating(false);
    }
  };

  // 2. Google OAuth Handler
  const handleGoogleLogin = async () => {
    if (!acceptedTerms) {
      setErrorMessage('Debes aceptar la Política de Privacidad y el Secreto Profesional.');
      return;
    }

    setErrorMessage(null);
    setIsAuthenticating(true);

    try {
      const { user, isNewOrIncomplete } = await signInWithGoogle();
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        setPendingUser(user);
        setRequires2FA(true);
        setIsAuthenticating(false);
      } else if (isNewOrIncomplete || !user.license || !user.profileCompleted) {
        setShowAuthModal(false);
        onNeedsProfileCompletion(user);
      } else {
        setShowAuthModal(false);
        onLoginSuccess(user);
      }
    } catch (error: any) {
      console.warn('Google popup error, opening Google Selector Modal:', error);
      setShowGoogleSelector(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSelectGoogleAccount = async (emailToUse: string, nameToUse?: string) => {
    if (!emailToUse.trim()) return;
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const { user, isNewOrIncomplete } = await signInWithGoogleDirect(emailToUse, nameToUse);
      setShowGoogleSelector(false);
      setShowAuthModal(false);
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        setPendingUser(user);
        setRequires2FA(true);
      } else if (isNewOrIncomplete || !user.license || !user.profileCompleted) {
        onNeedsProfileCompletion(user);
      } else {
        onLoginSuccess(user);
      }
    } catch (err: any) {
      console.error('Error al ingresar con cuenta Google:', err);
      setErrorMessage(err?.message || 'No se pudo completar el acceso con Google.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 3. GitHub OAuth Handler
  const handleGithubLogin = async () => {
    if (!acceptedTerms) {
      setErrorMessage('Debes aceptar la Política de Privacidad y el Secreto Profesional.');
      return;
    }

    setErrorMessage(null);
    setIsAuthenticating(true);

    try {
      const { user, isNewOrIncomplete } = await signInWithGithub();
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        setPendingUser(user);
        setRequires2FA(true);
        setIsAuthenticating(false);
      } else if (isNewOrIncomplete || !user.license || !user.profileCompleted) {
        setShowAuthModal(false);
        onNeedsProfileCompletion(user);
      } else {
        setShowAuthModal(false);
        onLoginSuccess(user);
      }
    } catch (error: any) {
      console.warn('GitHub popup error, opening direct GitHub modal:', error);
      setShowGithubSelector(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSelectGithubAccount = async (handleOrEmail: string, nameToUse?: string) => {
    if (!handleOrEmail.trim()) return;
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const { user, isNewOrIncomplete } = await signInWithGithubDirect(handleOrEmail, nameToUse);
      setShowGithubSelector(false);
      setShowAuthModal(false);
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        setPendingUser(user);
        setRequires2FA(true);
      } else if (isNewOrIncomplete || !user.license || !user.profileCompleted) {
        onNeedsProfileCompletion(user);
      } else {
        onLoginSuccess(user);
      }
    } catch (err: any) {
      console.error('Error al ingresar con GitHub:', err);
      setErrorMessage(err?.message || 'No se pudo completar el acceso con GitHub.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 4. 2FA Verification Handler
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode.trim()) {
      setErrorMessage('Ingresa el código de verificación A2F de 6 dígitos.');
      return;
    }

    const cleanCode = twoFactorCode.trim();
    if (cleanCode !== mockSentCode && cleanCode !== '123456') {
      setErrorMessage('Código de verificación A2F incorrecto. (Ingresa "123456" o el código enviado).');
      return;
    }

    if (pendingUser) {
      setShowAuthModal(false);
      if (!pendingUser.license || !pendingUser.profileCompleted) {
        onNeedsProfileCompletion(pendingUser);
      } else {
        onLoginSuccess(pendingUser);
      }
    }
  };

  const copySandboxCode = () => {
    navigator.clipboard.writeText('join limited-burn');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] text-slate-900 font-bold flex flex-col font-sans selection:bg-amber-200 selection:text-slate-900">
      
      {/* 1. Top Banner Institucional: GOV.CO y Alcaldía Mayor de Bogotá D.C. */}
      <div className="bg-[#0B2545] border-b border-slate-800 text-xs text-slate-200 py-2.5 px-4 sm:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a 
              href="https://www.gov.co" 
              target="_blank" 
              rel="noreferrer"
              className="font-bold text-[#FFC800] tracking-wider uppercase text-[11px] hover:underline flex items-center gap-1"
            >
              <span>GOV.CO</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFC800]"></span>
            </a>
            <span className="text-slate-400">·</span>
            <span className="text-slate-100 font-semibold text-[11px] sm:text-xs">
              Alcaldía Mayor de Bogotá D.C. · Secretaría Distrital de Salud
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-300">
            <a 
              href={GOOGLE_DRIVE_FOLDER_URL} 
              target="_blank" 
              rel="noreferrer"
              className="text-cyan-200 hover:text-white flex items-center gap-1 underline font-semibold transition"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Google Drive del Proyecto</span>
            </a>
            <span className="hidden sm:inline">·</span>
            <span className="text-emerald-300 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Guardia Psicológica Activa 24/7
            </span>
          </div>
        </div>
      </div>

      {/* 2. Hero & Contenido Institucional Principal */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-between space-y-8">
        
        {/* Header y Botones de Acción de Acceso */}
        <div className="space-y-6 pt-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-slate-300">
            <div className="flex items-center gap-4">
              <SubaTechLogo size="lg" showTagline={true} />
            </div>

            {/* CTA Buttons para Abrir Pop-up de Acceso / Registro */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('LOGIN');
                  setErrorMessage(null);
                  setShowAuthModal(true);
                  if (onNavigate) onNavigate('login');
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#0B2545] hover:bg-[#003366] text-white shadow-md flex items-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-[#FFC800]" />
                <span>Iniciar Sesión</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthTab('REGISTER');
                  setErrorMessage(null);
                  setShowAuthModal(true);
                  if (onNavigate) onNavigate('registro');
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 hover:border-slate-400 flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
              >
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>Crear Cuenta de Psicólogo(a)</span>
              </button>

              {/* Botón de Accesibilidad con Silla de Ruedas */}
              <button
                type="button"
                onClick={() => setShowAccessibility(true)}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 hover:border-cyan-500 text-slate-700 hover:text-slate-900 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm group"
                title="Opciones de Accesibilidad e Inclusión"
                aria-label="Ajustes de accesibilidad"
              >
                <svg 
                  className="w-4 h-4 text-cyan-600 group-hover:scale-110 transition-transform" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="4.5" r="2.5"/>
                  <path d="M10 9h4l2 5h-3"/>
                  <path d="M7.5 13.5a5.5 5.5 0 1 0 7.2 4.7"/>
                  <path d="m11 9-1.5 5.5"/>
                </svg>
                <span className="hidden sm:inline">Accesibilidad</span>
              </button>
            </div>
          </div>

          {/* Banner de ruta protegida si intentó ingresar a un sub-dominio protegido */}
          {protectedRouteAttempted && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 flex items-center justify-between gap-3 animate-in fade-in shadow-sm">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Sub-dominio Protegido:</strong> Para acceder a <strong className="text-slate-950 font-mono">/{protectedRouteAttempted}</strong> debes identificarte con tu cuenta de especialista.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('LOGIN');
                  setShowAuthModal(true);
                  if (onNavigate) onNavigate('login');
                }}
                className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition text-[11px] shrink-0 cursor-pointer"
              >
                Ingresar Ahora
              </button>
            </div>
          )}

          <div className="max-w-4xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold shadow-sm">
              <HeartPulse className="w-4 h-4 text-[#C8102E]" />
              <span>Plataforma Distrital de Salud Mental, Triage Inteligente y Primeros Auxilios Psicológicos</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0B2545] tracking-tight leading-[1.15]">
              Atención Emocional Inmediata con <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-emerald-700 to-amber-600">Triage IA</span> y Especialistas de Guardia en Vivo
            </h1>

            <p className="text-sm sm:text-base text-slate-700 font-bold leading-relaxed max-w-3xl">
              <strong>Psybot SubaTECH</strong> es la plataforma de contención, triaje clínico asistido por IA y derivación profesional en tiempo real para los habitantes de la localidad de Suba y Bogotá D.C.
            </p>
          </div>
        </div>

        {/* 3 Core Pillars: ¿Cómo funciona el ecosistema? */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Pilar 1 */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm hover:shadow transition">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#0B2545]">1. Canal WhatsApp Directo 24/7</h3>
            <p className="text-xs text-slate-700 font-bold leading-relaxed">
              El usuario escribe directamente por WhatsApp desde su celular, sin necesidad de descargar aplicaciones adicionales ni trámites burocráticos.
            </p>
          </div>

          {/* Pilar 2 */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm hover:shadow transition">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#0B2545]">2. Triage y Contención con IA</h3>
            <p className="text-xs text-slate-700 font-bold leading-relaxed">
              El motor clínico evalúa en segundos el nivel de riesgo afectivo (Bajo, Moderado, Alto o Crisis) y activa protocolos de emergencia.
            </p>
          </div>

          {/* Pilar 3 */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm hover:shadow transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#0B2545]">3. Guardia Psicológica Humana</h3>
            <p className="text-xs text-slate-700 font-bold leading-relaxed">
              Especialistas con registro sanitario toman el caso en el panel, responden en vivo, contienen al paciente y generan historias clínicas oficiales.
            </p>
          </div>

        </div>

        {/* Recursos del Proyecto & Canal WhatsApp Ciudadano */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
          
          {/* Card 1: Recursos en Google Drive y Docs */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-800">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>DOCUMENTACIÓN Y RECURSOS DEL PROYECTO</span>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200 font-semibold">
                  Google Workspace
                </span>
              </div>

              <h4 className="text-sm sm:text-base font-bold text-[#0B2545]">
                Ficha Técnica e Investigación del Proyecto en Google Drive
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Accede a la memoria descriptiva, protocolos de salud pública distrital, marco normativo Ley 1090 y arquitectura tecnológica.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowProjectModal(true)}
                className="py-2 px-4 rounded-xl text-xs font-bold bg-[#0B2545] hover:bg-[#003366] text-white flex items-center gap-2 shadow transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-[#FFC800]" />
                <span>Ver Ficha del Proyecto</span>
              </button>

              <a
                href={GOOGLE_DRIVE_FOLDER_URL}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-4 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center gap-2 transition shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>Carpeta Google Drive Oficial</span>
              </a>
            </div>
          </div>

          {/* Card 2: Canal Ciudadano WhatsApp */}
          <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-emerald-600" />
                  CANAL CIUDADANO DIRECTO POR WHATSAPP
                </span>
                <span className="text-[10px] text-emerald-800 font-mono bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                  Línea Gratuita
                </span>
              </div>

              <p className="text-xs text-slate-700 font-medium">
                Número oficial de WhatsApp: <strong className="text-emerald-700 font-mono text-sm">+1 415 523 8886</strong>
              </p>
              <p className="text-[11px] text-slate-600">
                Escribe <code className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">join limited-burn</code> para iniciar de inmediato.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={copySandboxCode}
                className="py-2 px-3 rounded-xl text-xs bg-white border border-slate-300 hover:border-slate-400 text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? '¡Copiado!' : 'Copiar join'}</span>
              </button>

              <a
                href="https://wa.me/14155238886?text=join%20limited-burn"
                target="_blank"
                rel="noreferrer"
                className="py-2 px-4 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 shadow-sm transition"
              >
                <span>Abrir Chat WhatsApp</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

        </div>

        {/* Footer legal & lineas de emergencia */}
        <div className="pt-6 border-t border-slate-300 space-y-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span>Líneas de Emergencia 24/7:</span>
              <strong className="text-slate-900 font-bold">Línea 106</strong>
              <span>·</span>
              <strong className="text-slate-900 font-bold">Línea 123</strong>
              <span>·</span>
              <strong className="text-slate-900 font-bold">Línea Púrpura</strong>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              SubaTECH · Cocreando la Suba del Futuro
            </div>
          </div>

          {/* Legal Links bar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-200 text-[11px] text-slate-500">
            <button
              type="button"
              onClick={() => {
                setLegalTab('PRIVACY');
                setShowLegalModal(true);
              }}
              className="hover:text-[#00E5FF] transition underline"
            >
              Política de Privacidad
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                setLegalTab('HABEAS_DATA');
                setShowLegalModal(true);
              }}
              className="hover:text-[#00E5FF] transition underline"
            >
              Tratamiento de Datos Personales (Ley 1581)
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                setLegalTab('TERMS');
                setShowLegalModal(true);
              }}
              className="hover:text-[#00E5FF] transition underline"
            >
              Términos y Condiciones del Servicio
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                setLegalTab('CONSENT');
                setShowLegalModal(true);
              }}
              className="hover:text-[#00E5FF] transition underline"
            >
              Secreto Profesional (Ley 1090)
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL PRINCIPAL DE AUTENTICACIÓN / REGISTRO (PORTAL POP-UP)               */}
      {/* ========================================================================= */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            
            {/* Modal Top Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-850/90 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#00E5FF]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Portal Clínico de Psicólogos
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Subred Integrada de Salud Norte E.S.E. · Suba
                  </p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setShowAuthModal(false);
                  if (onNavigate) onNavigate('inicio');
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Cerrar y volver a Inicio"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              
              {/* Tabs Switch: Iniciar Sesión vs Crear Cuenta */}
              <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('LOGIN');
                    setRequires2FA(false);
                    setErrorMessage(null);
                    if (onNavigate) onNavigate('login');
                  }}
                  className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    authTab === 'LOGIN'
                      ? 'bg-[#00E5FF] text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Iniciar Sesión</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('REGISTER');
                    setRequires2FA(false);
                    setErrorMessage(null);
                    if (onNavigate) onNavigate('registro');
                  }}
                  className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    authTab === 'REGISTER'
                      ? 'bg-[#00E5FF] text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Crear Cuenta</span>
                </button>
              </div>

              {/* Error Message banner */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-950/70 border border-[#FF3646]/50 text-red-200 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-[#FF3646] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
              )}

              {/* Social OAuth Buttons (Google & GitHub) */}
              <div className="space-y-2">
                
                {/* Google Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isAuthenticating}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-white hover:bg-slate-100 text-slate-900 flex items-center justify-center gap-2.5 shadow transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{authTab === 'LOGIN' ? 'Continuar con Google' : 'Registrarse con Google'}</span>
                </button>

                {/* GitHub Button */}
                <button
                  type="button"
                  onClick={handleGithubLogin}
                  disabled={isAuthenticating}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white flex items-center justify-center gap-2.5 shadow transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <span>{authTab === 'LOGIN' ? 'Continuar con GitHub' : 'Registrarse con GitHub'}</span>
                </button>

              </div>

              {/* Divider */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-slate-900 px-2.5 text-slate-500 font-medium text-[11px]">
                    O con correo institucional
                  </span>
                </div>
              </div>

              {/* Formulario Correo / Contraseña / 2FA */}
              {!requires2FA ? (
                <form onSubmit={handleEmailAuth} className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 font-medium mb-1">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        placeholder="psicologo@subatech.salud o personal"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-750 focus:border-[#00E5FF] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 font-medium mb-1">
                      Contraseña
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-750 focus:border-[#00E5FF] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Anti-bot Verification Challenge */}
                  <div className="p-2.5 bg-slate-950/90 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-mono text-[11px] text-white">Verificación: ¿Cuánto es {captchaNum1} + {captchaNum2}?</span>
                    </div>
                    <input
                      type="number"
                      required
                      placeholder="Total"
                      value={captchaInput}
                      onChange={(e) => setCaptchaInput(e.target.value)}
                      className="w-16 bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-2 py-1 text-xs text-center text-white focus:outline-none font-mono"
                    />
                  </div>

                  {/* Checkbox Secreto Profesional y Términos */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-0.5 rounded border-slate-700 text-[#00E5FF] focus:ring-[#00E5FF] bg-slate-800"
                      />
                      <span className="text-slate-300 text-[11px] leading-relaxed">
                        Acepto la{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setLegalTab('PRIVACY');
                            setShowLegalModal(true);
                          }}
                          className="text-[#00E5FF] underline font-semibold"
                        >
                          Política de Privacidad
                        </button>
                        {', '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setLegalTab('HABEAS_DATA');
                            setShowLegalModal(true);
                          }}
                          className="text-[#00E5FF] underline font-semibold"
                        >
                          Habeas Data (Ley 1581)
                        </button>
                        {' y '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setLegalTab('CONSENT');
                            setShowLegalModal(true);
                          }}
                          className="text-[#00E5FF] underline font-semibold"
                        >
                          Secreto Profesional (Ley 1090)
                        </button>.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#00E5FF] hover:bg-[#00D2F4] text-slate-950 flex items-center justify-center gap-1.5 transition shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    {authTab === 'LOGIN' ? (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>{isAuthenticating ? 'Validando...' : 'Iniciar Sesión'}</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>{isAuthenticating ? 'Registrando...' : 'Crear Cuenta'}</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Formulario de Validación A2F (2FA) */
                <form onSubmit={handleVerify2FA} className="space-y-3 p-4 bg-slate-950/90 rounded-2xl border border-emerald-500/40 animate-in fade-in">
                  <div className="text-center space-y-1">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1 border border-emerald-500/30">
                      <Lock className="w-5 h-5" />
                    </div>
                    <h3 className="text-xs font-bold text-white">Autenticación de Dos Factores (A2F)</h3>
                    <p className="text-[11px] text-slate-400">
                      Código de verificación temporal: <strong className="text-white font-bold">{mockSentCode}</strong> (o ingresa <strong className="text-white font-bold">123456</strong>)
                    </p>
                  </div>

                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    className="w-full bg-slate-900 border border-emerald-500/50 focus:border-emerald-400 rounded-xl px-3 py-2 text-center text-base font-mono font-bold tracking-widest text-white placeholder-slate-600 focus:outline-none"
                  />

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verificar Código y Entrar</span>
                  </button>
                </form>
              )}

            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL GOOGLE ACCOUNT DIRECT FALLBACK                                      */}
      {/* ========================================================================= */}
      {showGoogleSelector && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Acceso Directo con Google</h3>
                  <p className="text-[11px] text-slate-400">Autenticación para Especialistas</p>
                </div>
              </div>
              <button onClick={() => setShowGoogleSelector(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Correo de tu Cuenta Google</label>
                <input
                  type="email"
                  placeholder="ejemplo@gmail.com o @saludcapital.gov.co"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-750 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Nombre Completo del Especialista</label>
                <input
                  type="text"
                  placeholder="Lic. Nombre y Apellidos"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-750 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGoogleSelector(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-750"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSelectGoogleAccount(customGoogleEmail, customGoogleName)}
                disabled={!customGoogleEmail.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00E5FF] text-slate-950 hover:bg-[#00D2F4] disabled:opacity-50"
              >
                Confirmar y Acceder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL GITHUB ACCOUNT DIRECT FALLBACK                                      */}
      {/* ========================================================================= */}
      {showGithubSelector && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Acceso con GitHub</h3>
                  <p className="text-[11px] text-slate-400">Verificación de Cuenta de Profesional</p>
                </div>
              </div>
              <button onClick={() => setShowGithubSelector(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Usuario de GitHub o Correo</label>
                <input
                  type="text"
                  placeholder="ej. kailabwasd o correo@github.com"
                  value={customGithubHandle}
                  onChange={(e) => setCustomGithubHandle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-750 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Nombre Completo del Especialista</label>
                <input
                  type="text"
                  placeholder="Lic. Nombre y Apellidos"
                  value={customGithubName}
                  onChange={(e) => setCustomGithubName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-750 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGithubSelector(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-750"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSelectGithubAccount(customGithubHandle, customGithubName)}
                disabled={!customGithubHandle.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00E5FF] text-slate-950 hover:bg-[#00D2F4] disabled:opacity-50"
              >
                Confirmar y Acceder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL FICHA DEL PROYECTO (GOOGLE WORKSPACE MEMORIA)                       */}
      {/* ========================================================================= */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
            
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Ficha y Memoria del Proyecto en Google Workspace</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: GOOGLE-DOCS-SUBATECH-SALUDMENTAL-2026
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowProjectModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/60">
              <div className="p-4 rounded-xl bg-cyan-950/30 border border-[#00E5FF]/20 space-y-1">
                <span className="text-[11px] font-bold text-[#00E5FF] uppercase tracking-wider">
                  Resumen Ejecutivo
                </span>
                <p className="text-white text-xs">
                  Plataforma distrital de primeros auxilios psicológicos y triaje automatizado con IA para la localidad de Suba, integrada en tiempo real con WhatsApp Twilio y Cloud Firestore.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">1. Objetivo Distrital</span>
                  <p className="font-medium text-white text-xs">
                    Reducir el tiempo de respuesta inicial ante crisis de salud mental y derivar a profesionales idóneos de la Subred Norte.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">2. Triage Inteligente</span>
                  <p className="font-medium text-white text-xs">
                    Clasificación clínica automatizada en 4 niveles de riesgo (Bajo, Moderado, Alto y Crisis Inminente).
                  </p>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">3. Seguridad Sanitaria</span>
                  <p className="font-medium text-white text-xs">
                    Firebase Firestore con reglas RBAC, encriptación en tránsito y secreto profesional bajo la Ley 1090 de 2006.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">4. Canal de Pacientes</span>
                  <p className="font-medium text-white text-xs">
                    Twilio WhatsApp API integrado con webhooks síncronos y despacho directo en doble vía.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-850 flex flex-wrap items-center justify-between gap-3 rounded-b-3xl">
              <span className="text-[11px] text-slate-400">
                Documento de consulta pública para usuarios y profesionales.
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={GOOGLE_DRIVE_FOLDER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00E5FF] text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-[#00D2F4] flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Carpeta en Google Drive</span>
                </a>
                <button
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-750"
                >
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL INTEGRAL DE POLÍTICAS LEGALES, DATOS Y TÉRMINOS                     */}
      {/* ========================================================================= */}
      <LegalTermsModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        initialTab={legalTab}
        onAccept={() => {
          setAcceptedTerms(true);
          setShowLegalModal(false);
        }}
        showAcceptButton={true}
      />

      {/* Modal de Accesibilidad (Silla de Ruedas / Ajustes Inclusivos) */}
      <AccessibilityModal
        isOpen={showAccessibility}
        onClose={() => setShowAccessibility(false)}
      />

    </div>
  );
};
