import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  User, 
  FileText, 
  Building2, 
  Phone, 
  Mail, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Camera,
  HeartPulse,
  Lock,
  ArrowRight,
  Stethoscope,
  QrCode
} from 'lucide-react';
import { SubaTechLogo } from './SubaTechLogo.tsx';
import type { PsychologistAuthUser } from '../types/index.ts';
import { 
  savePsychologistProfile, 
  generate2FASecret, 
  verify2FAToken,
  findPsychologistByLicense 
} from '../lib/firebase.ts';

interface CreatePsychologistProfileProps {
  initialUser: PsychologistAuthUser;
  onProfileSaved: (savedUser: PsychologistAuthUser) => void;
  onCancel?: () => void;
  isEditing?: boolean;
}

const AVATAR_OPTIONS = [
  'https://images.unsplash.com/photo-1594824813576-a05e263d9061?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&auto=format&fit=crop&q=80',
];

const SPECIALTY_OPTIONS = [
  'Psicología Clínica y Triage de Crisis',
  'Psicoterapia Cognitivo-Conductual (TCC)',
  'Intervención en Urgencias Psicológicas y Suicidio',
  'Psicología de la Salud y Comunitaria',
  'Terapia de Aceptación y Compromiso (ACT)',
  'Atención Psicoemocional Infanto-Juvenil',
  'Manejo del Duelo y Trauma Complejo (EMDR)',
  'Salud Mental en Adicciones y Patología Dual',
];

const INSTITUTION_OPTIONS = [
  'Subred Integrada de Servicios de Salud Norte E.S.E.',
  'Hospital de Suba - Urgencias y Consulta Externa',
  'CAPS Rincón (Suba)',
  'CAPS Tibabuyes (Suba)',
  'CAPS Bilbao (Suba)',
  'Centro de Salud Comunitario y Escucha SubaTECH',
  'Consulta Privada / Telemedicina Acreditada',
];

export const CreatePsychologistProfile: React.FC<CreatePsychologistProfileProps> = ({
  initialUser,
  onProfileSaved,
  onCancel,
  isEditing = false,
}) => {
  const [displayName, setDisplayName] = useState(initialUser.displayName || '');
  const [email, setEmail] = useState(initialUser.email || '');
  const [license, setLicense] = useState(initialUser.license || '');
  const [specialty, setSpecialty] = useState(initialUser.specialty || SPECIALTY_OPTIONS[0]);
  const [institution, setInstitution] = useState(initialUser.institution || INSTITUTION_OPTIONS[0]);
  const [role, setRole] = useState(initialUser.role || 'Psicólogo(a) Clínico Titulado(a)');
  const [phone, setPhone] = useState(initialUser.phone || '');
  const [photoURL, setPhotoURL] = useState(initialUser.photoURL || AVATAR_OPTIONS[0]);
  const [customPhotoInput, setCustomPhotoInput] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(Boolean(initialUser.termsAccepted ?? true));
  
  // 2FA Configuration state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(Boolean(initialUser.twoFactorEnabled));
  const [twoFactorSecret, setTwoFactorSecret] = useState<string>(initialUser.twoFactorSecret || '');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [verificationToken, setVerificationToken] = useState<string>('');
  const [show2FASetupModal, setShow2FASetupModal] = useState<boolean>(false);
  const [twoFaSetupSuccess, setTwoFaSetupSuccess] = useState<boolean>(false);

  const handleStart2FASetup = async () => {
    try {
      const { secret, qrCodeUrl } = await generate2FASecret(email || initialUser.email || 'psicologo@subatech.salud');
      setTwoFactorSecret(secret);
      setQrCodeUrl(qrCodeUrl);
      setShow2FASetupModal(true);
      setTwoFaSetupSuccess(false);
      setVerificationToken('');
    } catch (err) {
      console.error('Error generating 2FA:', err);
      setErrorMessage('No se pudo generar el código QR de doble factor.');
    }
  };

  const handleVerifyAndEnable2FA = () => {
    if (!verificationToken.trim()) {
      setErrorMessage('Ingresa el código de 6 dígitos de tu aplicación autenticadora.');
      return;
    }
    const isValid = verify2FAToken(verificationToken.trim(), twoFactorSecret);
    if (!isValid) {
      setErrorMessage('Código de verificación inválido. Asegúrate de ingresar el código actual de Google Authenticator / Authy.');
      return;
    }
    setTwoFactorEnabled(true);
    setShow2FASetupModal(false);
    setTwoFaSetupSuccess(true);
    setErrorMessage(null);
  };

  const handleDisable2FA = () => {
    setTwoFactorEnabled(false);
    setTwoFactorSecret('');
    setTwoFaSetupSuccess(false);
    setErrorMessage(null);
  };

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!displayName.trim()) {
      setErrorMessage('Por favor ingresa tu Nombre y Apellidos completos.');
      return;
    }

    if (!license.trim()) {
      setErrorMessage('El Registro Sanitario / Tarjeta Profesional es OBLIGATORIO para emitir informes y atender pacientes.');
      return;
    }

    if (license.trim().length < 4) {
      setErrorMessage('La Tarjeta Profesional debe tener al menos 4 caracteres.');
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('Debes ratificar la declaración ética y de secreto profesional para continuar.');
      return;
    }

    setIsSaving(true);
    try {
      // Check in Firestore if license is already taken by another psychologist
      const existingPsychWithLicense = await findPsychologistByLicense(license.trim());
      if (existingPsychWithLicense && existingPsychWithLicense.uid !== initialUser.uid) {
        setErrorMessage(`La Tarjeta Profesional "${license.trim()}" ya se encuentra registrada por otro especialista en Firestore.`);
        setIsSaving(false);
        return;
      }
      const profileToSave: PsychologistAuthUser = {
        ...initialUser,
        displayName: displayName.trim(),
        email: email.trim() || null,
        license: license.trim(),
        specialty: specialty.trim(),
        institution: institution.trim(),
        role: role.trim(),
        phone: phone.trim(),
        photoURL: photoURL.trim(),
        termsAccepted: true,
        profileCompleted: true,
        twoFactorEnabled: twoFactorEnabled,
        twoFactorSecret: twoFactorSecret,
      };

      const saved = await savePsychologistProfile(profileToSave);
      onProfileSaved(saved);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al guardar el perfil en Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans selection:bg-[#00E5FF] selection:text-slate-950">
      
      {/* Background SubaTECH glow effects */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-[#00E5FF]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-20 w-96 h-96 bg-[#2BF267]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-[#FF3646]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="relative max-w-2xl w-full bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl animate-in fade-in duration-200">
        
        {/* Top Header Branding with SubaTECH Logo */}
        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-800">
          <SubaTechLogo size="lg" showTagline={true} />
          
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#00E5FF]/15 via-[#2BF267]/15 to-[#FF3646]/15 border border-[#00E5FF]/30 text-xs font-semibold text-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2BF267]" />
            <span>{isEditing ? 'Actualización de Perfil y Credenciales' : 'Registro de Profesional Sanitario • Habilitación'}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
            {isEditing ? 'Editar Perfil Clínico' : 'Crea tu Perfil Profesional de Psicólogo(a)'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mt-1">
            Cada profesional debe registrar su identidad y <strong className="text-white">Registro Sanitario / Colegiatura</strong> oficial para gestionar historiales clínicos y atención en tiempo real.
          </p>
        </div>

        {/* Error notice */}
        {errorMessage && (
          <div className="mt-5 p-3.5 rounded-2xl bg-red-950/70 border border-[#FF3646]/40 text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-[#FF3646] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-red-300">Revisión requerida</p>
              <p className="text-[11px] text-red-200 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          
          {/* 1. Profile Picture Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Fotografía o Avatar Clínico</span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <img
                src={photoURL}
                alt="Avatar previo"
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[#00E5FF] shadow-lg shadow-[#00E5FF]/20"
                onError={() => setPhotoURL(AVATAR_OPTIONS[0])}
              />
              
              <div className="flex-1 min-w-[200px] flex flex-wrap gap-2">
                {AVATAR_OPTIONS.map((imgUrl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setPhotoURL(imgUrl);
                      setCustomPhotoInput(false);
                    }}
                    className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition ${
                      photoURL === imgUrl ? 'border-[#00E5FF] scale-105 shadow-sm' : 'border-slate-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={imgUrl} alt={`Avatar ${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCustomPhotoInput(!customPhotoInput)}
                  className="px-2.5 py-1 text-[10px] font-semibold text-[#00E5FF] bg-[#00E5FF]/10 rounded-xl border border-[#00E5FF]/30 hover:bg-[#00E5FF]/20 transition"
                >
                  URL Externa
                </button>
              </div>
            </div>

            {customPhotoInput && (
              <input
                type="url"
                placeholder="https://ejemplo.com/mi-foto.jpg"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                className="mt-2.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
              />
            )}
          </div>

          {/* 2. Full Name & Email Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>Nombre y Apellidos Completos *</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Dra. Camila Valenzuela R."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-750 focus:border-[#00E5FF] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>Correo Institucional o de Contacto</span>
              </label>
              <input
                type="email"
                placeholder="profesional@subatech.salud o personal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-750 focus:border-[#00E5FF] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition shadow-inner"
              />
            </div>
          </div>

          {/* 3. SANITARY REGISTRY (MANDATORY FIELD HIGHLIGHTED) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-2 border-[#00E5FF]/40 shadow-lg shadow-[#00E5FF]/5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-extrabold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-[#FAFF00]" />
                <span className="text-sm">Registro Sanitario / Colegiatura Profesional *</span>
              </label>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#FF3646]/20 text-[#FF3646] border border-[#FF3646]/30">
                Campo Obligatorio
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mb-2">
              Ingresa tu número de Tarjeta Profesional Sanitaria, Registro ReTHUS o Colegiatura Oficial (ej. <span className="text-[#00E5FF] font-mono">TP-98234 Colpsic</span> o <span className="text-[#00E5FF] font-mono">ReTHUS-1029485</span>). Aparecerá rubricado en los informes clínicos y fichas de triage.
            </p>

            <input
              type="text"
              required
              placeholder="Ej. ReTHUS 1029482155 / Tarjeta Profesional 84210"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              className="w-full bg-slate-950 border-2 border-slate-700 focus:border-[#00E5FF] rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none transition"
            />
          </div>

          {/* 4. Specialty & Institution Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-[#2BF267]" />
                <span>Especialidad Clínica Principal</span>
              </label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full bg-slate-950 border border-slate-750 focus:border-[#2BF267] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition"
              >
                {SPECIALTY_OPTIONS.map((spec) => (
                  <option key={spec} value={spec} className="bg-slate-900 text-white">
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#2BF267]" />
                <span>Institución o Centro de Salud (Suba)</span>
              </label>
              <select
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full bg-slate-950 border border-slate-750 focus:border-[#2BF267] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition"
              >
                {INSTITUTION_OPTIONS.map((inst) => (
                  <option key={inst} value={inst} className="bg-slate-900 text-white">
                    {inst}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 5. Clinical Role & Emergency Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-[#FF3646]" />
                <span>Rol en la Plataforma SubaTECH</span>
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ej. Psicólogo(a) Especialista de Triage"
                className="w-full bg-slate-950 border border-slate-750 focus:border-[#FF3646] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>Teléfono de Guardia / Notificaciones</span>
              </label>
              <input
                type="tel"
                placeholder="+57 310 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-750 focus:border-[#00E5FF] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition"
              />
            </div>
          </div>

          {/* 5.5 Two-Factor Authentication (2FA) Security Configuration Section */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${twoFactorEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Autenticación de Dos Factores (A2F / TOTP)</h4>
                  <p className="text-[11px] text-slate-400">
                    {twoFactorEnabled ? 'Protección activa con Google Authenticator / Authy' : 'Protección recomendada para expedientes clínicos'}
                  </p>
                </div>
              </div>

              <div>
                {twoFactorEnabled ? (
                  <button
                    type="button"
                    onClick={handleDisable2FA}
                    className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-[11px] font-bold rounded-xl transition cursor-pointer"
                  >
                    Desactivar A2F
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStart2FASetup}
                    className="px-3.5 py-1.5 bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 border border-[#00E5FF]/50 text-[#00E5FF] text-[11px] font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Configurar A2F con QR</span>
                  </button>
                )}
              </div>
            </div>

            {twoFaSetupSuccess && !twoFactorEnabled && (
              <p className="text-[11px] text-emerald-400 font-medium">✅ A2F configurado y verificado correctamente.</p>
            )}

            {/* 2FA Setup Modal Popup */}
            {show2FASetupModal && (
              <div className="mt-3 p-4 bg-slate-900 border border-[#00E5FF]/40 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-[#00E5FF]" />
                    <span>Escanea el código QR con Google Authenticator</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShow2FASetupModal(false)}
                    className="text-slate-400 hover:text-white text-xs font-bold"
                  >
                    ✕ Cancelar
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {qrCodeUrl && (
                    <div className="bg-white p-2 rounded-xl shrink-0">
                      <img src={qrCodeUrl} alt="2FA QR Code" className="w-28 h-28 object-contain" />
                    </div>
                  )}
                  <div className="text-xs space-y-1 text-slate-300 flex-1">
                    <p className="font-semibold text-white">Instrucciones:</p>
                    <p className="text-[11px]">1. Abre Google Authenticator, Authy o 1Password en tu móvil.</p>
                    <p className="text-[11px]">2. Escanea el código QR o ingresa la clave secreta: <code className="text-[#00E5FF] font-mono select-all font-bold">{twoFactorSecret}</code></p>
                    <p className="text-[11px]">3. Ingresa el código de 6 dígitos generado a continuación:</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Ej. 482910"
                    value={verificationToken}
                    onChange={(e) => setVerificationToken(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-750 focus:border-[#00E5FF] rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-center tracking-widest text-white placeholder-slate-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyAndEnable2FA}
                    className="py-2 px-5 bg-[#2BF267] hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition cursor-pointer"
                  >
                    Verificar y Activar A2F
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 6. Ethical Agreement and Medical Confidentiality */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-[#00E5FF] focus:ring-[#00E5FF] bg-slate-800 w-4 h-4"
              />
              <span className="text-slate-300 leading-relaxed text-[11px]">
                Declaro bajo fe de juramento que la información y el <strong className="text-white">Registro Sanitario</strong> aportados son veraces y corresponden a mi persona. Me comprometo a observar las directrices del <strong className="text-[#00E5FF]">Código Deontológico de la Psicología</strong>, el secreto profesional y el tratamiento confidencial de expedientes clínicos en la plataforma <strong className="text-white">SubaTECH</strong>.
              </span>
            </label>
          </div>

          {/* 7. Action buttons */}
          <div className="pt-3 flex items-center justify-between gap-3">
            {isEditing && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="px-5 py-3 rounded-2xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition"
              >
                Cancelar
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3.5 px-6 rounded-2xl font-black text-sm text-slate-950 bg-gradient-to-r from-[#00E5FF] via-[#2BF267] to-[#00E5FF] hover:opacity-95 shadow-xl shadow-[#00E5FF]/20 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Guardando Perfil en Firestore...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                  <span>
                    {isEditing ? 'Guardar Cambios de Perfil' : 'Habilitar y Entrar al Sistema SubaTECH'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
