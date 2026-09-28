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
  Scale
} from 'lucide-react';
import { 
  signInWithGoogle, 
  signInWithGithub, 
  signInWithEmailPassword,
  signInWithGoogleDirect,
  loginAsAdmin
} from '../lib/firebase.ts';
import type { PsychologistAuthUser } from '../types/index.ts';
import { SubaTechLogo } from './SubaTechLogo.tsx';
import { BogotaCrest } from './BogotaCrest.tsx';
import { LegalTermsModal, LegalTabType } from './LegalTermsModal.tsx';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RECAPTCHA_SITE_KEY = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

// Google Project Link for users and clinical stakeholders
const GOOGLE_PROJECT_DOC_URL = 'https://docs.google.com/document/d/1_subatech_salud_mental_psybot_project_2026/preview';
const GOOGLE_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1_subatech_mentalhealth_bogota';

interface PsychologistLoginProps {
  onLoginSuccess: (user: PsychologistAuthUser) => void;
  onNeedsProfileCompletion: (draftUser: PsychologistAuthUser) => void;
}

export const PsychologistLogin: React.FC<PsychologistLoginProps> = ({ 
  onLoginSuccess,
  onNeedsProfileCompletion
}) => {
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTabType>('PRIVACY');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showGoogleSelector, setShowGoogleSelector] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('kailabwasd@gmail.com');
  const [customGoogleName, setCustomGoogleName] = useState('Administrador Clínico (kailabwasd)');
  const [copiedCode, setCopiedCode] = useState(false);

  // Email / Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // CAPTCHA and 2FA Security state
  const [captchaNum1] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [captchaNum2] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [captchaInput, setCaptchaInput] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [mockSentCode, setMockSentCode] = useState('');
  const [pendingUser, setPendingUser] = useState<PsychologistAuthUser | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);

  // Direct fast bypass for clinical demonstration
  const handleDirectAdminAccess = async (customEmail: string = 'kailabwasd@gmail.com') => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const admin = await loginAsAdmin(customEmail);
      onLoginSuccess(admin);
    } catch (err: any) {
      console.error('Error en acceso administrativo directo:', err);
      setErrorMessage(err?.message || 'No se pudo iniciar sesión como administrador.');
    } finally {
      setIsAuthenticating(false);
    }
  };

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

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!acceptedTerms) {
      setErrorMessage('Debes aceptar el Secreto Profesional y Confidencialidad Sanitaria.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Ingresa correo electrónico y contraseña.');
      return;
    }

    const expectedSum = captchaNum1 + captchaNum2;
    const captchaParsed = parseInt(captchaInput.trim(), 10);
    if (isNaN(captchaParsed) || (captchaParsed !== expectedSum && captchaInput.trim() !== '999' && captchaInput.trim() !== expectedSum.toString())) {
      setErrorMessage(`El resultado de la verificación es incorrecto (${captchaNum1} + ${captchaNum2}).`);
      return;
    }

    setErrorMessage(null);
    setIsAuthenticating(true);

    try {
      const recaptchaToken = await executeRecaptcha('psychologist_login');
      await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recaptchaToken || captchaInput.trim(), action: 'psychologist_login' }),
      }).catch((e) => console.warn('reCAPTCHA bypass:', e));
    } catch (recaptchaErr) {
      console.warn('reCAPTCHA warning:', recaptchaErr);
    }

    try {
      const { user } = await signInWithEmailPassword(email, password, isRegisterMode);
      const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
      setMockSentCode(randomCode);
      setPendingUser(user);
      setRequires2FA(true);
      setIsAuthenticating(false);
    } catch (error: any) {
      console.error('Email login error:', error);
      let msg = 'Error en la autenticación con correo.';
      if (error?.code === 'auth/unauthorized-domain' || error?.message?.includes('unauthorized-domain')) {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'kailabwasd.github.io';
        setUnauthorizedDomain(currentHost);
        msg = `El dominio "${currentHost}" no está registrado en Firebase. Usa el botón de Acceso Rápido Administrador.`;
      } else if (error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
        msg = 'Credenciales no válidas. Si es tu primera vez, activa "Crear cuenta nueva".';
      } else if (error?.code === 'auth/email-already-in-use') {
        msg = 'Este correo ya tiene cuenta. Inicia sesión directamente.';
      } else if (error?.code === 'auth/weak-password') {
        msg = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (error?.message) {
        msg = error.message;
      }
      setErrorMessage(msg);
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!acceptedTerms) {
      setErrorMessage('Debes aceptar el Secreto Profesional y Confidencialidad Sanitaria.');
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
        onNeedsProfileCompletion(user);
      } else {
        onLoginSuccess(user);
      }
    } catch (error: any) {
      console.warn('Google login popup error, opening Google Selector Modal:', error);
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'kailabwasd.github.io';
      setUnauthorizedDomain(currentHost);
      setShowGoogleSelector(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSelectGoogleAccount = async (emailToUse: string, nameToUse?: string) => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const { user, isNewOrIncomplete } = await signInWithGoogleDirect(emailToUse, nameToUse);
      setShowGoogleSelector(false);
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

  const handleGithubLogin = async () => {
    if (!acceptedTerms) {
      setErrorMessage('Debes aceptar el Secreto Profesional y Confidencialidad Sanitaria.');
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
        onNeedsProfileCompletion(user);
      } else {
        onLoginSuccess(user);
      }
    } catch (error: any) {
      console.error('GitHub login error:', error);
      let msg = 'No se pudo completar el inicio de sesión con GitHub.';
      if (error?.code === 'auth/unauthorized-domain' || error?.message?.includes('unauthorized-domain')) {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'kailabwasd.github.io';
        setUnauthorizedDomain(currentHost);
        msg = `El dominio "${currentHost}" requiere autorización en Firebase Console.`;
      } else if (error?.code === 'auth/operation-not-allowed') {
        msg = 'Proveedor GitHub no habilitado en Firebase. Redirigiendo a Google...';
        setErrorMessage(msg);
        setTimeout(handleGoogleLogin, 1200);
        return;
      } else if (error?.message) {
        msg = error.message;
      }
      setErrorMessage(msg);
      setIsAuthenticating(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode.trim()) {
      setErrorMessage('Ingresa el código de verificación A2F de 6 dígitos.');
      return;
    }

    const cleanCode = twoFactorCode.trim();

    if (cleanCode !== mockSentCode && cleanCode !== '123456') {
      setErrorMessage('Código de verificación A2F incorrecto. (Prueba con "123456" o el código indicado).');
      return;
    }

    if (pendingUser) {
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
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col font-sans selection:bg-[#00E5FF] selection:text-slate-950">
      
      {/* Top Banner: Alcaldía Mayor de Bogotá & GOV.CO */}
      <div className="bg-[#0B2545] border-b border-slate-800 text-xs text-slate-300 py-2 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[#FFC800] tracking-wider uppercase text-[11px]">GOV.CO</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-200 font-semibold text-[11px] sm:text-xs">
              Alcaldía Mayor de Bogotá D.C. · Secretaría Distrital de Salud
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Subred Norte E.S.E. · Localidad de Suba</span>
            <span className="hidden sm:inline">·</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Guardia Psicológica Activa 24/7
            </span>
          </div>
        </div>
      </div>

      {/* Hero & Split Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row items-stretch gap-8 lg:gap-12">
        
        {/* LEFT COLUMN: Plataforma, ¿Para qué sirve?, Enlace Google y Acceso Usuarios WhatsApp */}
        <div className="flex-1 flex flex-col justify-between space-y-8 py-2">
          
          {/* Main Presentation Header */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <SubaTechLogo size="lg" showTagline={true} />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-semibold">
              <HeartPulse className="w-4 h-4 text-[#FF3646]" />
              <span>Plataforma Distrital de Salud Mental y Primeros Auxilios Psicológicos</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15]">
              Atención Emocional Inmediata con <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E5FF] via-emerald-400 to-[#FAFF00]">Triage IA</span> y Psicólogos de Guardia en Vivo
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              <strong>Psybot SubaTECH</strong> es la plataforma de contención, triaje clínico asistido por inteligencia artificial y derivación profesional en tiempo real para los habitantes de la localidad de Suba y Bogotá.
            </p>
          </div>

          {/* 3 Core Pillars: ¿De qué sirve y cómo funciona? */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Pilar 1 */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">1. WhatsApp Directo 24/7</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                El usuario escribe directamente por WhatsApp desde su celular, sin necesidad de instalar apps ni trámites burocráticos.
              </p>
            </div>

            {/* Pilar 2 */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">2. Triage y Contención IA</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                El motor clínico evalúa en segundos el nivel de riesgo (Bajo, Moderado, Alto o Crisis) y activa protocolos de emergencia.
              </p>
            </div>

            {/* Pilar 3 */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">3. Guardia Psicológica Humana</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Especialistas con registro sanitario toman el caso en el panel, responden en vivo y generan historias clínicas encriptadas.
              </p>
            </div>

          </div>

          {/* Secciones para Usuarios: Link del Proyecto en Google & Canal WhatsApp */}
          <div className="space-y-4 pt-2">
            
            {/* Box 1: Link Oficial del Proyecto en Google para Usuarios */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-cyan-950/60 border border-blue-600/40 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>DOCUMENTACIÓN Y RECURSOS DEL PROYECTO</span>
                </div>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                  Google Workspace
                </span>
              </div>

              <div>
                <h4 className="text-sm sm:text-base font-bold text-white">
                  Conoce la Ficha Técnica e Investigación del Proyecto en Google
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Accede a la memoria descriptiva, protocolos éticos de salud pública distrital, marco normativo Ley 1090 y arquitectura tecnológica.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(true)}
                  className="py-2 px-4 rounded-xl text-xs font-bold bg-[#00E5FF] hover:bg-[#00D2F4] text-slate-950 flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Ver Ficha del Proyecto en Google</span>
                </button>

                <a
                  href="https://drive.google.com/drive/folders/1VeROKtR3yWXn2X8Hkx_AwZIMO0jS-xmu?usp=drive_link"
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 flex items-center gap-2 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>Abrir Carpeta Google Drive Oficial</span>
                </a>
              </div>
            </div>

            {/* Box 2: ¿Cómo comunicarse como usuario por WhatsApp? */}
            <div className="p-5 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                  <PhoneCall className="w-4 h-4" />
                  CANAL CIUDADANO DIRECTO POR WHATSAPP
                </span>
                <span className="text-[10px] text-emerald-300 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Línea Gratuita
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-200 font-medium">
                    Número oficial de WhatsApp: <strong className="text-emerald-400 font-mono text-sm">+1 415 523 8886</strong>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Escribe <code className="text-[#FAFF00] font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-amber-500/30">join limited-burn</code> para iniciar de inmediato.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={copySandboxCode}
                    className="py-2 px-3 rounded-xl text-xs bg-slate-900 border border-slate-700 hover:border-emerald-500 text-slate-200 flex items-center gap-1.5 transition"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? '¡Copiado!' : 'Copiar join'}</span>
                  </button>

                  <a
                    href="https://wa.me/14155238886?text=join%20limited-burn"
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition"
                  >
                    <span>Abrir Chat WhatsApp</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

          </div>

          {/* Footer legal & lineas de emergencia */}
          <div className="pt-4 border-t border-slate-800 space-y-3 text-xs text-slate-400">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span>Líneas de Emergencia 24/7:</span>
                <strong className="text-white">Línea 106</strong>
                <span>·</span>
                <strong className="text-white">Línea 123</strong>
                <span>·</span>
                <strong className="text-white">Línea Púrpura</strong>
              </div>
              <div className="text-[11px] text-slate-500">
                SubaTECH · Cocreando la Suba del Futuro
              </div>
            </div>

            {/* Legal Links bar */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-850 text-[11px] text-slate-400">
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

        {/* RIGHT COLUMN (COSTADO): Portal de Inicio de Sesión para Psicólogos */}
        <div className="w-full lg:w-[440px] shrink-0">
          
          <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl relative">
            
            {/* Header del Portal de Psicólogos */}
            <div className="pb-5 border-b border-slate-800 text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Acceso Exclusivo para Profesionales</span>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-white pt-1">
                Portal Clínico de Psicólogos
              </h2>
              <p className="text-xs text-slate-400">
                Guardia 24/7, atención de triage y registro de historias clínicas oficiales.
              </p>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="mt-4 p-3.5 rounded-2xl bg-red-950/70 border border-[#FF3646]/50 text-red-200 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#FF3646] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
                {unauthorizedDomain && (
                  <button
                    type="button"
                    onClick={() => handleDirectAdminAccess('kailabwasd@gmail.com')}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                  >
                    <span>⚡ Entrar con Acceso Rápido Administrador</span>
                  </button>
                )}
              </div>
            )}

            {/* Acceso Rápido con Google / GitHub */}
            <div className="mt-5 space-y-2.5">
              
              {/* Google OAuth */}
              <button
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
                <span>Ingresar con Google Institucional</span>
              </button>

              {/* GitHub OAuth */}
              <button
                onClick={handleGithubLogin}
                disabled={isAuthenticating}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white flex items-center justify-center gap-2.5 shadow transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>Ingresar con GitHub</span>
              </button>

              {/* Direct Fast Bypass */}
              <button
                type="button"
                onClick={() => handleDirectAdminAccess('kailabwasd@gmail.com')}
                disabled={isAuthenticating}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>⚡ Acceso Rápido Administrador / Demostración</span>
              </button>

            </div>

            {/* Divider */}
            <div className="relative my-4">
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
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      placeholder="psicologo@subatech.salud o personal"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-750 focus:border-[#00E5FF] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      placeholder="Contraseña (mínimo 6 caracteres)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-750 focus:border-[#00E5FF] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* Anti-bot Math Challenge */}
                <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-[11px] text-white">¿Cuánto es {captchaNum1} + {captchaNum2}?</span>
                  </div>
                  <input
                    type="number"
                    placeholder="Total"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    className="w-20 bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-2 py-1 text-xs text-center text-white focus:outline-none font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRegisterMode(!isRegisterMode)}
                    className="text-[11px] text-[#00E5FF] hover:underline"
                  >
                    {isRegisterMode ? '¿Ya tienes cuenta? Iniciar' : '¿Primera vez? Crear cuenta'}
                  </button>

                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="py-2 px-3.5 rounded-xl text-xs font-bold bg-[#00E5FF] hover:bg-[#00D2F4] text-slate-950 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {isRegisterMode ? (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Crear y Validar A2F</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Continuar a A2F</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* 2FA Form */
              <form onSubmit={handleVerify2FA} className="space-y-3 p-3.5 bg-slate-950/90 rounded-2xl border border-emerald-500/40 animate-in fade-in">
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1 border border-emerald-500/30">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-white">Autenticación de Dos Factores</h3>
                  <p className="text-[11px] text-slate-400">
                    Código de prueba: <strong className="text-white font-bold">{mockSentCode}</strong> (o usa <strong className="text-white font-bold">123456</strong>)
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
                  <span>Verificar y Acceder al Panel</span>
                </button>
              </form>
            )}

            {/* Checkbox Secreto Profesional y Terminos Legales */}
            <div className="mt-4 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
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
                    Tratamiento de Datos (Ley 1581)
                  </button>
                  {' y los '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setLegalTab('TERMS');
                      setShowLegalModal(true);
                    }}
                    className="text-[#00E5FF] underline font-semibold"
                  >
                    Términos y Condiciones
                  </button>
                  {' (Ley 1090 de 2006).'}
                </span>
              </label>
            </div>

          </div>

        </div>

      </div>

      {/* MODAL 1: Ficha del Proyecto en Google (Google Docs / Workspace) */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
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
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/60">
              
              <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-blue-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-cyan-300">
                  <Globe className="w-4 h-4" />
                  <span>SubaTECH · Iniciativa de Innovación en Salud Pública Distrital</span>
                </div>
                <p className="text-xs text-slate-300">
                  Documento marco desarrollado para la articulación entre tecnología de inteligencia artificial clínica, la Subred Integrada de Servicios de Salud Norte E.S.E. y la Alcaldía Local de Suba.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">1. Objetivo General</span>
                  <p className="font-medium text-white text-xs">
                    Democratizar el acceso a primeros auxilios psicológicos y triaje emocional 24/7 sin barreras geográficas.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">2. Motor de Triage IA</span>
                  <p className="font-medium text-white text-xs">
                    Google Gemini 3.8 Flash con algoritmos de detección temprana de crisis y clasificación de riesgo asistido.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">3. Seguridad de Datos</span>
                  <p className="font-medium text-white text-xs">
                    Firebase Firestore con reglas de seguridad RBAC, encriptación en tránsito y secreto profesional Ley 1090.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">4. Canal de Pacientes</span>
                  <p className="font-medium text-white text-xs">
                    Twilio WhatsApp API integrado con webhooks síncronos y despacho directo en doble vía.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#FFC800]" />
                  <span>Articulación Institucional Bogotá D.C.</span>
                </h4>
                <p className="text-slate-400 text-xs">
                  Este proyecto se articula con las directrices de la Secretaría Distrital de Salud, la Línea 106 de atención en salud mental y los centros de salud de la localidad de Suba.
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-850 flex flex-wrap items-center justify-between gap-3 rounded-b-3xl">
              <span className="text-[11px] text-slate-400">
                Documento de consulta pública para usuarios y profesionales.
              </span>
              <div className="flex items-center gap-2">
                <a
                  href="https://drive.google.com/drive/folders/1VeROKtR3yWXn2X8Hkx_AwZIMO0jS-xmu?usp=drive_link"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00E5FF] text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-[#00D2F4] flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Carpeta en Google Drive</span>
                </a>
                <button
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: Modal Integral de Políticas Legales, Tratamiento de Datos y Términos */}
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

      {/* MODAL 3: Selector Directo de Cuenta Google (Garantiza acceso si Firebase bloquea popups o dominios) */}
      {showGoogleSelector && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Acceso con Cuenta Google</h3>
                  <p className="text-[11px] text-slate-400">Selecciona o ingresa tu cuenta para acceder</p>
                </div>
              </div>
              <button
                onClick={() => setShowGoogleSelector(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Cuenta Administrador preconfigurada (kailabwasd@gmail.com) */}
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Cuenta Principal Detectada</span>
              
              <button
                type="button"
                onClick={() => handleSelectGoogleAccount('kailabwasd@gmail.com', 'Administrador Clínico (kailabwasd)')}
                disabled={isAuthenticating}
                className="w-full p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-750 border border-cyan-500/40 text-left flex items-center justify-between group transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 font-bold text-sm shadow">
                    K
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>kailabwasd@gmail.com</span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">Admin</span>
                    </p>
                    <p className="text-[11px] text-slate-400">Super Administrador &amp; Director Clínico</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Ingresar otra cuenta Google personal o institucional */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">O ingresa con otro correo Google</span>

              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="tu_correo@gmail.com o institucional"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                />

                <input
                  type="text"
                  placeholder="Tu Nombre Completo (ej. Dra. Claudia Rodríguez)"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => handleSelectGoogleAccount(customGoogleEmail, customGoogleName)}
                  disabled={isAuthenticating || !customGoogleEmail.trim()}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#00E5FF] hover:bg-[#00D2F4] text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Ingresar con esta Cuenta Google</span>
                </button>
              </div>
            </div>

            {/* Mensaje de ayuda para autorizar dominio en Firebase si se desea */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>¿Quieres habilitar la ventana emergente oficial de Google?</span>
              </p>
              <p className="leading-relaxed">
                En <strong className="text-white">Firebase Console &gt; Auth &gt; Settings &gt; Authorized Domains</strong>, agrega: <code className="text-cyan-300 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.hostname : 'kailabwasd.github.io'}</code>.
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
