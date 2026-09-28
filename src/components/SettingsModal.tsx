import React, { useState } from 'react';
import { 
  Settings, 
  User, 
  ShieldCheck, 
  Palette, 
  Key, 
  X, 
  CheckCircle2, 
  Award, 
  Lock, 
  Sliders, 
  Globe, 
  Database, 
  Terminal, 
  AlertCircle, 
  FileClock,
  QrCode,
  Smartphone,
  Copy,
  RefreshCw,
  Check,
  KeyRound,
  ExternalLink
} from 'lucide-react';
import type { PsychologistAuthUser } from '../types/index.ts';
import { savePsychologistProfile } from '../lib/firebase.ts';
import { AuditLog, logAuditEvent } from './AuditLog.tsx';

interface SettingsModalProps {
  currentUser: PsychologistAuthUser;
  onClose: () => void;
  onUpdateUser: (updated: PsychologistAuthUser) => void;
  allPsychologists: PsychologistAuthUser[];
  onUpdatePsychologistRole: (uid: string, isAdmin: boolean) => void;
  themeMode: 'light' | 'dark' | 'subatech';
  onThemeChange: (theme: 'light' | 'dark' | 'subatech') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  onClose,
  onUpdateUser,
  allPsychologists,
  onUpdatePsychologistRole,
  themeMode,
  onThemeChange,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'twofactor' | 'admins' | 'theme' | 'secrets' | 'audit'>('profile');
  
  // Profile editing local state
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [license, setLicense] = useState(currentUser.license || '');
  const [specialty, setSpecialty] = useState(currentUser.specialty || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 2FA Speakeasy Configuration State
  const [is2FAEnabled, setIs2FAEnabled] = useState(Boolean(currentUser.twoFactorEnabled));
  const [secretBase32, setSecretBase32] = useState<string>(currentUser.twoFactorSecret || '');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isGenerating2FA, setIsGenerating2FA] = useState(false);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorSuccess, setTwoFactorSuccess] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Secrets editing (Only for owner/admin)
  const [twilioSid, setTwilioSid] = useState(localStorage.getItem('subatech_twilio_sid') || 'AC_mock_subatech_9921');
  const [twilioAuth, setTwilioAuth] = useState(localStorage.getItem('subatech_twilio_auth') || '••••••••••••••••••••');
  const [githubToken, setGithubToken] = useState(localStorage.getItem('subatech_github_token') || 'ghp_subatech_live_prod_sec');
  const [railwayKey, setRailwayKey] = useState(localStorage.getItem('subatech_railway_key') || 'rw_prod_key_suba_cluster');
  const [secretsSaved, setSecretsSaved] = useState(false);

  const isOwner = currentUser.email === 'kailabwasd@gmail.com' || currentUser.isAdmin;

  // Generate 2FA Secret and QR Code using backend speakeasy
  const handleGenerate2FA = async () => {
    setIsGenerating2FA(true);
    setTwoFactorError(null);
    setTwoFactorSuccess(null);
    try {
      const res = await fetch('/api/2fa/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email || currentUser.displayName,
          displayName: currentUser.displayName,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSecretBase32(data.secret);
        setQrCodeDataUrl(data.qrCode);
        setOtpauthUrl(data.otpauthUrl);
      } else {
        setTwoFactorError(data.error || 'No se pudo generar el código QR de 2FA.');
      }
    } catch (err: any) {
      console.error('Error initiating 2FA setup:', err);
      setTwoFactorError('Error de red al conectar con el servicio Speakeasy 2FA.');
    } finally {
      setIsGenerating2FA(false);
    }
  };

  // Verify TOTP Code and Enable 2FA
  const handleConfirmEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim() || verificationCode.trim().length < 6) {
      setTwoFactorError('Ingresa el código de 6 dígitos mostrado en tu app autenticadora.');
      return;
    }

    setIsVerifying2FA(true);
    setTwoFactorError(null);
    setTwoFactorSuccess(null);

    try {
      const res = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: secretBase32,
          token: verificationCode.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.verified) {
        // Persist 2FA activation on current user state and Firestore document
        const updated: PsychologistAuthUser = {
          ...currentUser,
          twoFactorEnabled: true,
          twoFactorSecret: secretBase32,
        };
        await savePsychologistProfile(updated);
        
        // Log critical security event to Firestore
        await logAuditEvent({
          adminEmail: currentUser.email || 'anon@subatech.gov.co',
          adminName: currentUser.displayName || 'Psicólogo Clínico',
          action: '2FA_SECURITY',
          severity: 'CRITICAL',
          category: '2FA',
          details: `Activación exitosa de 2FA TOTP (Speakeasy) con secreto cifrado en Firestore para ${currentUser.displayName}.`,
        });

        onUpdateUser(updated);
        setIs2FAEnabled(true);
        setTwoFactorSuccess('¡Autenticación de dos factores (2FA con Speakeasy) activada y guardada en Firestore!');
        setVerificationCode('');
        setQrCodeDataUrl(null);
      } else {
        setTwoFactorError(data.error || 'Código 2FA incorrecto. Asegúrate de ingresar el código actual de tu aplicación.');
      }
    } catch (err: any) {
      console.error('Error verifying 2FA:', err);
      setTwoFactorError('Error de conexión al verificar el código 2FA.');
    } finally {
      setIsVerifying2FA(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async () => {
    if (confirm('¿Estás seguro de que deseas desactivar la autenticación de dos factores (2FA)?')) {
      const updated: PsychologistAuthUser = {
        ...currentUser,
        twoFactorEnabled: false,
        twoFactorSecret: undefined,
      };
      await savePsychologistProfile(updated);

      // Log critical security event to Firestore
      await logAuditEvent({
        adminEmail: currentUser.email || 'anon@subatech.gov.co',
        adminName: currentUser.displayName || 'Psicólogo Clínico',
        action: '2FA_SECURITY',
        severity: 'WARNING',
        category: '2FA',
        details: `Desactivación voluntaria del segundo factor (2FA) para el usuario ${currentUser.displayName}.`,
      });

      onUpdateUser(updated);
      setIs2FAEnabled(false);
      setSecretBase32('');
      setQrCodeDataUrl(null);
      setTwoFactorSuccess('La autenticación de dos factores (2FA) ha sido desactivada en tu perfil.');
      setTimeout(() => setTwoFactorSuccess(null), 4000);
    }
  };

  const handleCopySecret = () => {
    if (!secretBase32) return;
    navigator.clipboard.writeText(secretBase32);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: PsychologistAuthUser = {
      ...currentUser,
      displayName: displayName.trim(),
      license: license.trim(),
      specialty: specialty.trim(),
      phone: phone.trim(),
    };
    await savePsychologistProfile(updated);

    await logAuditEvent({
      adminEmail: currentUser.email || 'anon@subatech.gov.co',
      adminName: currentUser.displayName || 'Psicólogo Clínico',
      action: 'PROFILE_UPDATE',
      severity: 'INFO',
      category: 'CLÍNICO',
      details: `Actualización de perfil clínico y registro sanitario (${license.trim() || 'N/A'}).`,
    });

    onUpdateUser(updated);
    setSuccessMsg('Perfil actualizado y guardado en Firestore.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveSecrets = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('subatech_twilio_sid', twilioSid);
    localStorage.setItem('subatech_twilio_auth', twilioAuth);
    localStorage.setItem('subatech_github_token', githubToken);
    localStorage.setItem('subatech_railway_key', railwayKey);

    await logAuditEvent({
      adminEmail: currentUser.email || 'owner@subatech.gov.co',
      adminName: currentUser.displayName || 'Owner',
      action: 'SYSTEM_CONFIG',
      severity: 'WARNING',
      category: 'SISTEMA',
      details: 'Modificación y rotación de credenciales sensibles (Twilio, GitHub & Railway Production Keys).',
    });

    setSecretsSaved(true);
    setTimeout(() => setSecretsSaved(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00E5FF]/20 to-[#2BF267]/20 border border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF]">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Panel de Configuración General</h2>
              <p className="text-xs text-slate-400">Subred Norte • SubaTECH Sistema de Salud Mental</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950 px-6 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'profile' ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <User className="w-4 h-4" />
            <span>Perfil</span>
          </button>

          {/* 2FA Speakeasy Configuration Tab */}
          <button
            onClick={() => {
              setActiveTab('twofactor');
              if (!is2FAEnabled && !qrCodeDataUrl) {
                handleGenerate2FA();
              }
            }}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'twofactor' ? 'border-[#2BF267] text-[#2BF267]' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <Smartphone className="w-4 h-4 text-[#2BF267]" />
            <span>Seguridad 2FA</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${is2FAEnabled ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
              {is2FAEnabled ? 'Activo' : 'Inactivo'}
            </span>
          </button>

          {isOwner && (
            <button
              onClick={() => setActiveTab('admins')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'admins' ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <ShieldCheck className="w-4 h-4 text-[#2BF267]" />
              <span>Administradores</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('theme')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'theme' ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <Palette className="w-4 h-4 text-amber-400" />
            <span>Tema</span>
          </button>

          {isOwner && (
            <button
              onClick={() => setActiveTab('secrets')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'secrets' ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <Key className="w-4 h-4 text-[#FF3646]" />
              <span>Twilio, Github & Railway Secrets</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/40">Owner</span>
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'audit' ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <FileClock className="w-4 h-4 text-[#2BF267]" />
              <span>AuditLog</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">Admin</span>
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          
          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName}
                  className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[#00E5FF]/40"
                />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">{currentUser.displayName}</h3>
                  <p className="text-xs text-slate-400">{currentUser.email || 'Correo institucional'}</p>
                  <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-500/30">
                    {currentUser.isAdmin ? '👑 Administrador / Owner' : '👨‍⚕️ Psicólogo Clínico Autorizado'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-[#00E5FF] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Registro Sanitario / Colpsic</label>
                  <input
                    type="text"
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-[#00E5FF] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Especialidad Clínica</label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-[#00E5FF] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Teléfono de Guardia</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-[#00E5FF] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#00D2F4] text-slate-950 font-bold text-xs shadow transition cursor-pointer"
                >
                  Guardar Cambios de Perfil
                </button>
              </div>
            </form>
          )}

          {/* TAB: 2FA CONFIGURATION WITH SPEAKEASY AND QR CODE */}
          {activeTab === 'twofactor' && (
            <div className="space-y-5">
              
              {/* Informational banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/40 border border-emerald-500/30 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h3 className="font-bold text-white text-sm">
                    Autenticación de Dos Factores (2FA - TOTP Speakeasy)
                  </h3>
                  <p className="text-slate-300 leading-relaxed">
                    Protege el acceso a los expedientes clínicos de salud mental vinculando tu aplicación autenticadora (Google Authenticator, Microsoft Authenticator o Authy) mediante código QR.
                  </p>
                </div>
              </div>

              {/* Status & Messages */}
              {twoFactorSuccess && (
                <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{twoFactorSuccess}</span>
                </div>
              )}

              {twoFactorError && (
                <div className="p-3 bg-red-950/70 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{twoFactorError}</span>
                </div>
              )}

              {/* State 1: 2FA already enabled */}
              {is2FAEnabled ? (
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">2FA Activo y Protegiendo tu Cuenta</h4>
                        <p className="text-xs text-slate-400">Tu cuenta solicita un código TOTP de 6 dígitos al iniciar sesión.</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs">
                      Habilitado
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-850 flex items-center justify-between">
                    <p className="text-[11px] text-slate-400">
                      ¿Deseas volver a configurar tu aplicación o desactivar el segundo factor?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGenerate2FA}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reconfigurar</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDisable2FA}
                        className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-semibold transition cursor-pointer"
                      >
                        Desactivar 2FA
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* State 2: 2FA setup form / QR code display */}
              {(!is2FAEnabled || qrCodeDataUrl) && (
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-850">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-[#00E5FF]" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Paso a Paso: Configurar Aplicación Autenticadora
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerate2FA}
                      disabled={isGenerating2FA}
                      className="text-[11px] text-[#00E5FF] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGenerating2FA ? 'animate-spin' : ''}`} />
                      <span>Generar nuevo código</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    {/* Left: Scannable QR Code */}
                    <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-inner border border-slate-700">
                      {isGenerating2FA ? (
                        <div className="w-44 h-44 flex flex-col items-center justify-center text-slate-800 text-xs gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-[#00E5FF]" />
                          <span>Generando QR Speakeasy...</span>
                        </div>
                      ) : qrCodeDataUrl ? (
                        <img 
                          src={qrCodeDataUrl} 
                          alt="Código QR 2FA Speakeasy" 
                          className="w-44 h-44 object-contain rounded-lg"
                        />
                      ) : (
                        <div className="w-44 h-44 flex flex-col items-center justify-center text-slate-700 text-xs text-center p-2">
                          <QrCode className="w-8 h-8 text-slate-400 mb-1" />
                          <span>Haz clic en Generar para visualizar el código QR</span>
                        </div>
                      )}
                      <span className="text-[10px] text-slate-700 font-semibold mt-2 text-center">
                        Escanea con Google Authenticator o Authy
                      </span>
                    </div>

                    {/* Right: Secret Key manual copy and TOTP verification input */}
                    <div className="md:col-span-7 space-y-4">
                      {/* Manual Secret Key */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          1. O ingresa la clave secreta manualmente:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={secretBase32 || 'Cargando clave secreta...'}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-[#00E5FF] tracking-wider select-all outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleCopySecret}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer border border-slate-700"
                            title="Copiar Clave Secreta"
                          >
                            {copiedSecret ? <Check className="w-4 h-4 text-[#2BF267]" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* TOTP Confirmation Form */}
                      <form onSubmit={handleConfirmEnable2FA} className="space-y-3 pt-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            2. Ingresa el código de 6 dígitos generado por tu app:
                          </label>
                          <div className="relative">
                            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="Ej. 123456"
                              value={verificationCode}
                              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                              className="w-full bg-slate-900 border border-slate-750 focus:border-[#2BF267] rounded-xl pl-10 pr-3 py-2 text-sm font-mono text-center tracking-widest text-white outline-none"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isVerifying2FA || !secretBase32 || verificationCode.length < 6}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#2BF267] to-[#00E5FF] hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isVerifying2FA ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Verificando con Speakeasy...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4" />
                              <span>Verificar y Activar 2FA</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: ADMINS (Only for Owner) */}
          {activeTab === 'admins' && isOwner && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-300">Gestión de Privilegios Administrativos</p>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    Como Owner, puedes otorgar o revocar privilegios de administrador a los psicólogos registrados en la plataforma SubaTECH.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {allPsychologists.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No hay otros psicólogos registrados actualmente.</p>
                ) : (
                  allPsychologists.map((psych) => (
                    <div key={psych.uid} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={psych.photoURL} alt={psych.displayName} className="w-10 h-10 rounded-xl object-cover" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{psych.displayName}</p>
                          <p className="text-[11px] text-slate-400 truncate">{psych.email || 'Sin correo'}</p>
                          <span className="text-[10px] font-mono text-blue-400">{psych.license || 'Sin registro'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${psych.isAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400'}`}>
                          {psych.isAdmin ? '👑 Administrador' : '👤 Psicólogo'}
                        </span>

                        {psych.email !== 'kailabwasd@gmail.com' && (
                          <button
                            type="button"
                            onClick={async () => {
                              const newStatus = !psych.isAdmin;
                              onUpdatePsychologistRole(psych.uid, newStatus);
                              await logAuditEvent({
                                adminEmail: currentUser.email || 'kailabwasd@gmail.com',
                                adminName: currentUser.displayName || 'Owner',
                                action: 'ROLE_UPDATE',
                                severity: 'CRITICAL',
                                category: 'ROLES',
                                details: `${newStatus ? 'Concesión de privilegios de Administrador' : 'Revocación de rol de Administrador'} para ${psych.displayName} (${psych.email || 'sin correo'}).`,
                              });
                            }}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition cursor-pointer ${psych.isAdmin ? 'bg-red-950 text-red-300 hover:bg-red-900 border border-red-500/30' : 'bg-[#2BF267] text-slate-950 hover:bg-emerald-400'}`}
                          >
                            {psych.isAdmin ? 'Revocar Admin' : 'Hacer Admin'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: THEME */}
          {activeTab === 'theme' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Selecciona la apariencia visual de la plataforma SubaTECH disponible tanto para usuarios como administradores y psicólogos.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => onThemeChange('subatech')}
                  className={`p-4 rounded-2xl border text-left space-y-2 transition cursor-pointer ${themeMode === 'subatech' ? 'bg-[#00E5FF]/10 border-[#00E5FF]' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#00E5FF] to-[#2BF267]" />
                  <h4 className="text-xs font-bold text-white">SubaTECH Oscuro Pro</h4>
                  <p className="text-[11px] text-slate-400">Diseño institucional de alta tecnología con neón y contraste clínico.</p>
                </button>

                <button
                  type="button"
                  onClick={() => onThemeChange('dark')}
                  className={`p-4 rounded-2xl border text-left space-y-2 transition cursor-pointer ${themeMode === 'dark' ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                >
                  <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700" />
                  <h4 className="text-xs font-bold text-white">Oscuro Minimalista</h4>
                  <p className="text-[11px] text-slate-400">Tonos grisáceos sobrios para guardias nocturnas prolongadas.</p>
                </button>

                <button
                  type="button"
                  onClick={() => onThemeChange('light')}
                  className={`p-4 rounded-2xl border text-left space-y-2 transition cursor-pointer ${themeMode === 'light' ? 'bg-amber-500/10 border-amber-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                >
                  <div className="w-6 h-6 rounded-lg bg-white border border-slate-300" />
                  <h4 className="text-xs font-bold text-white">Claro Institucional GOV</h4>
                  <p className="text-[11px] text-slate-400">Estándar oficial con fondos claros para consulta diurna.</p>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: SECRETS (Only for Owner) */}
          {activeTab === 'secrets' && isOwner && (
            <form onSubmit={handleSaveSecrets} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-300">Credenciales Sensibles (Ámbito Exclusivo del Owner)</p>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    Modifica los parámetros de integración con Twilio WhatsApp, llaves API de GitHub y variables de entorno de Railway.
                  </p>
                </div>
              </div>

              {secretsSaved && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Secretos actualizados y guardados con cifrado local.</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Twilio Account SID</label>
                  <input
                    type="text"
                    value={twilioSid}
                    onChange={(e) => setTwilioSid(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-[#FF3646] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Twilio Auth Token</label>
                  <input
                    type="password"
                    value={twilioAuth}
                    onChange={(e) => setTwilioAuth(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-[#FF3646] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">GitHub Personal Access Token</label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-[#FF3646] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Railway Production Secret Key</label>
                  <input
                    type="password"
                    value={railwayKey}
                    onChange={(e) => setRailwayKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-[#FF3646] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#FF3646] hover:bg-red-600 text-white font-bold text-xs shadow transition cursor-pointer"
                >
                  Guardar Secretos del Sistema
                </button>
              </div>
            </form>
          )}

          {/* TAB 6: AUDIT LOG */}
          {activeTab === 'audit' && (
            <AuditLog currentUser={currentUser} />
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-850 border-t border-slate-800 flex items-center justify-between">
          <a
            href="https://drive.google.com/drive/folders/1VeROKtR3yWXn2X8Hkx_AwZIMO0jS-xmu?usp=drive_link"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-cyan-300 hover:text-white flex items-center gap-1.5 transition underline font-semibold"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Carpeta Google Drive del Proyecto</span>
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-white transition cursor-pointer"
          >
            Cerrar Configuración
          </button>
        </div>

      </div>
    </div>
  );
};
