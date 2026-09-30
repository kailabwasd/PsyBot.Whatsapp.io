import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  User, 
  ShieldCheck, 
  Palette, 
  X, 
  CheckCircle2, 
  Award, 
  Lock, 
  Sliders, 
  Globe, 
  Database, 
  AlertCircle, 
  FileClock,
  QrCode,
  Smartphone,
  Copy,
  RefreshCw,
  Check,
  KeyRound,
  ExternalLink,
  Eye,
  Edit3,
  Save,
  BookOpen,
  FileEdit,
  UserCheck,
  ShieldAlert,
  ChevronDown,
  Trash2,
  UserX,
  AlertTriangle,
  HeartPulse,
  Search,
  Phone,
  Users,
  Clock,
  Bug,
  Server,
  Zap,
  Send,
  Terminal,
  HelpCircle,
  Activity,
  Radio
} from 'lucide-react';
import type { PsychologistAuthUser, PsychologistPermissions, PatientSession, SystemErrorLog } from '../types/index.ts';
import { savePsychologistProfile } from '../lib/firebase.ts';
import { AuditLog, logAuditEvent } from './AuditLog.tsx';
import { 
  fetchSystemErrorLogs, 
  clearSystemErrorLogs, 
  fetchTwilioConfig, 
  updateTwilioConfig, 
  testTwilioConnection,
  verifyTwilioCredentials,
  fetchAdminNotificationConfig,
  updateAdminNotificationConfig,
  triggerAdminTestReport,
  AdminNotificationSettings
} from '../services/api.ts';
import { getStoredCrisisKeywords, saveStoredCrisisKeywords, CrisisKeywordEntry } from '../lib/crisisKeywords.ts';

interface SettingsModalProps {
  currentUser: PsychologistAuthUser;
  onClose: () => void;
  onUpdateUser: (updated: PsychologistAuthUser) => void;
  allPsychologists: PsychologistAuthUser[];
  onUpdatePsychologistRole: (
    uid: string, 
    isAdmin: boolean, 
    role?: string, 
    permissions?: PsychologistPermissions
  ) => void;
  themeMode: 'light' | 'dark' | 'subatech';
  onThemeChange: (theme: 'light' | 'dark' | 'subatech') => void;
  sessions?: PatientSession[];
  onDeleteSession?: (sessionId: string) => Promise<void>;
  onClearAllSessions?: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  onClose,
  onUpdateUser,
  allPsychologists,
  onUpdatePsychologistRole,
  themeMode,
  onThemeChange,
  sessions = [],
  onDeleteSession,
  onClearAllSessions,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'twofactor' | 'admins' | 'patients' | 'errorlogs' | 'theme' | 'audit' | 'crisiskeywords'>('profile');
  
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

  // Patient Management State
  const [patientSearch, setPatientSearch] = useState('');
  const [confirmClearAllOpen, setConfirmClearAllOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null);
  const [patientActionNotice, setPatientActionNotice] = useState<string | null>(null);

  // System & Twilio Error Logs State
  const [errorLogs, setErrorLogs] = useState<SystemErrorLog[]>([]);
  const [isLoadingErrorLogs, setIsLoadingErrorLogs] = useState(false);
  const [errorFilter, setErrorFilter] = useState<'ALL' | 'TWILIO' | 'GEMINI' | 'WEBHOOK' | 'AUTH'>('ALL');
  const [errorSearchQuery, setErrorSearchQuery] = useState('');
  const [selectedError, setSelectedError] = useState<SystemErrorLog | null>(null);
  
  // Twilio In-Memory Live Config State
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioWhatsappNumber, setTwilioWhatsappNumber] = useState('');
  const [hasTwilioAuthToken, setHasTwilioAuthToken] = useState(false);
  const [isSavingTwilio, setIsSavingTwilio] = useState(false);
  const [twilioSaveNotice, setTwilioSaveNotice] = useState<string | null>(null);
  const [isTestingTwilio, setIsTestingTwilio] = useState(false);
  const [testPhoneRecipient, setTestPhoneRecipient] = useState('');
  const [twilioTestResult, setTwilioTestResult] = useState<{
    success?: boolean;
    message?: string;
    error?: string;
    errorCode?: number;
    sid?: string;
    suggestion?: string;
  } | null>(null);

  // Direct Account Verification State
  const [isVerifyingCredentials, setIsVerifyingCredentials] = useState(false);
  const [verifyCredentialsResult, setVerifyCredentialsResult] = useState<{
    success?: boolean;
    friendlyName?: string;
    status?: string;
    message?: string;
    error?: string;
    errorCode?: number;
    advice?: string;
  } | null>(null);

  // Crisis Keywords Management State
  const [crisisKeywordsDb, setCrisisKeywordsDb] = useState<CrisisKeywordEntry[]>(getStoredCrisisKeywords());
  const [newKeywordCategory, setNewKeywordCategory] = useState<'SUICIDIO' | 'CRIMEN_VIOLENCIA' | 'AUTOLESION' | 'AMENAZA_INMINENTE'>('SUICIDIO');
  const [newKeywordTerm, setNewKeywordTerm] = useState('');
  const [crisisNotice, setCrisisNotice] = useState<string | null>(null);

  const handleAddCrisisKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const term = newKeywordTerm.trim();
    if (!term) return;

    const updated = crisisKeywordsDb.map(entry => {
      if (entry.category === newKeywordCategory) {
        if (!entry.keywords.includes(term.toLowerCase())) {
          return {
            ...entry,
            keywords: [...entry.keywords, term.toLowerCase()]
          };
        }
      }
      return entry;
    });

    saveStoredCrisisKeywords(updated);
    setCrisisKeywordsDb([...updated]);
    setNewKeywordTerm('');
    setCrisisNotice(`Término "${term}" agregado exitosamente a la categoría ${newKeywordCategory}.`);
    setTimeout(() => setCrisisNotice(null), 3500);
  };

  const handleDeleteCrisisKeyword = (category: string, keywordToDelete: string) => {
    const updated = crisisKeywordsDb.map(entry => {
      if (entry.category === category) {
        return {
          ...entry,
          keywords: entry.keywords.filter(k => k !== keywordToDelete)
        };
      }
      return entry;
    });

    saveStoredCrisisKeywords(updated);
    setCrisisKeywordsDb([...updated]);
    setCrisisNotice(`Término "${keywordToDelete}" eliminado de la base de datos de crisis.`);
    setTimeout(() => setCrisisNotice(null), 3500);
  };

  // Admin WhatsApp Automated Updates & Error Alerts State
  const [adminNotifyPhone, setAdminNotifyPhone] = useState('+573107956907');
  const [enablePeriodicUpdates, setEnablePeriodicUpdates] = useState(true);
  const [enableErrorAlerts, setEnableErrorAlerts] = useState(true);
  const [lastReportTimestamp, setLastReportTimestamp] = useState<number | undefined>(undefined);
  const [isSavingNotifyConfig, setIsSavingNotifyConfig] = useState(false);
  const [isSendingTestReport, setIsSendingTestReport] = useState(false);
  const [notifyNotice, setNotifyNotice] = useState<string | null>(null);
  const [testReportResult, setTestReportResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const isOwner = currentUser.email === 'kailabwasd@gmail.com' || currentUser.isAdmin;

  // Load error logs & Twilio config on mount and when tab changes to errorlogs
  const loadErrorLogsAndTwilioConfig = async () => {
    setIsLoadingErrorLogs(true);
    try {
      const [logs, config, notifyConfig] = await Promise.all([
        fetchSystemErrorLogs(),
        fetchTwilioConfig().catch(() => null),
        fetchAdminNotificationConfig().catch(() => null),
      ]);
      setErrorLogs(logs);
      if (config) {
        if (config.accountSid) setTwilioAccountSid(config.accountSid);
        if (config.whatsappNumber) setTwilioWhatsappNumber(config.whatsappNumber);
        setHasTwilioAuthToken(config.hasAuthToken || false);
      }
      if (notifyConfig) {
        setAdminNotifyPhone(notifyConfig.adminPhone || '+573107956907');
        setEnablePeriodicUpdates(notifyConfig.enablePeriodicUpdates !== false);
        setEnableErrorAlerts(notifyConfig.enableErrorAlerts !== false);
        setLastReportTimestamp(notifyConfig.lastReportTimestamp);
      }
    } catch (e) {
      console.warn('Error loading logs/twilio config:', e);
    } finally {
      setIsLoadingErrorLogs(false);
    }
  };

  const handleSaveNotifyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingNotifyConfig(true);
    setNotifyNotice(null);
    try {
      const res = await updateAdminNotificationConfig({
        adminPhone: adminNotifyPhone,
        enablePeriodicUpdates,
        enableErrorAlerts,
      });
      if (res.success) {
        setNotifyNotice('Preferencias de alertas y reportes a WhatsApp guardadas exitosamente.');
        await logAuditEvent({
          adminEmail: currentUser.email || 'kailabwasd@gmail.com',
          adminName: currentUser.displayName || 'Administrador',
          action: 'SYSTEM_CONFIG',
          severity: 'INFO',
          category: 'SISTEMA',
          details: `Configuradas notificaciones administrativas a WhatsApp (${adminNotifyPhone}, Cada 30m: ${enablePeriodicUpdates}, Errores: ${enableErrorAlerts})`,
        });
        setTimeout(() => setNotifyNotice(null), 4000);
      }
    } catch (err: any) {
      setNotifyNotice(`Error al guardar: ${err.message || 'Fallo de conexión'}`);
    } finally {
      setIsSavingNotifyConfig(false);
    }
  };

  const handleTriggerTestReport = async () => {
    setIsSendingTestReport(true);
    setTestReportResult(null);
    try {
      const res = await triggerAdminTestReport();
      setTestReportResult(res);
      setLastReportTimestamp(Date.now());
      const updatedLogs = await fetchSystemErrorLogs();
      setErrorLogs(updatedLogs);
    } catch (err: any) {
      setTestReportResult({
        success: false,
        message: err.message || 'Error al enviar reporte de prueba a WhatsApp',
      });
    } finally {
      setIsSendingTestReport(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'errorlogs') {
      loadErrorLogsAndTwilioConfig();
    }
  }, [activeTab]);

  const handleSaveTwilioConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTwilio(true);
    setTwilioSaveNotice(null);
    try {
      const payload: { accountSid?: string; authToken?: string; whatsappNumber?: string } = {};
      if (twilioAccountSid) payload.accountSid = twilioAccountSid.trim();
      if (twilioAuthToken) payload.authToken = twilioAuthToken.trim();
      if (twilioWhatsappNumber) payload.whatsappNumber = twilioWhatsappNumber.trim();

      const res = await updateTwilioConfig(payload);
      if (res.success) {
        setHasTwilioAuthToken(res.hasAuthToken);
        setTwilioSaveNotice('Credenciales de Twilio actualizadas y aplicadas en el servidor.');
        await logAuditEvent({
          adminEmail: currentUser.email || 'kailabwasd@gmail.com',
          adminName: currentUser.displayName || 'Administrador',
          action: 'SYSTEM_CONFIG',
          severity: 'WARNING',
          category: 'SISTEMA',
          details: `Actualización manual de credenciales de Twilio (Account SID: ${res.accountSid}, WhatsApp: ${res.whatsappNumber}).`,
        });
        setTimeout(() => setTwilioSaveNotice(null), 4000);
      }
    } catch (err: any) {
      console.error('Error saving twilio config:', err);
      setTwilioSaveNotice(`Error al guardar: ${err.message || 'Fallo de red'}`);
    } finally {
      setIsSavingTwilio(false);
    }
  };

  const handleTestTwilioSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhoneRecipient) return;
    setIsTestingTwilio(true);
    setTwilioTestResult(null);
    try {
      const result = await testTwilioConnection({
        toPhone: testPhoneRecipient,
        accountSid: twilioAccountSid || undefined,
        authToken: twilioAuthToken || undefined,
        whatsappNumber: twilioWhatsappNumber || undefined,
      });
      setTwilioTestResult(result);
      // Reload error logs to show the test event if any
      const updatedLogs = await fetchSystemErrorLogs();
      setErrorLogs(updatedLogs);
    } catch (err: any) {
      setTwilioTestResult({
        success: false,
        error: err.message || 'Error al ejecutar la prueba de Twilio.',
      });
    } finally {
      setIsTestingTwilio(false);
    }
  };

  const handleVerifyCredentials = async () => {
    setIsVerifyingCredentials(true);
    setVerifyCredentialsResult(null);
    try {
      const res = await verifyTwilioCredentials(twilioAccountSid, twilioAuthToken);
      setVerifyCredentialsResult(res);
      if (res.success) {
        setHasTwilioAuthToken(true);
      }
      const updatedLogs = await fetchSystemErrorLogs();
      setErrorLogs(updatedLogs);
    } catch (err: any) {
      setVerifyCredentialsResult({
        success: false,
        error: err.message || 'Error de conexión al verificar credenciales con Twilio',
      });
    } finally {
      setIsVerifyingCredentials(false);
    }
  };

  const handleClearErrorLogs = async () => {
    try {
      await clearSystemErrorLogs();
      setErrorLogs([]);
      setSelectedError(null);
      await logAuditEvent({
        adminEmail: currentUser.email || 'kailabwasd@gmail.com',
        adminName: currentUser.displayName || 'Administrador',
        action: 'SYSTEM_CONFIG',
        severity: 'INFO',
        category: 'SISTEMA',
        details: 'Vaciado manual del registro de errores del sistema y Twilio.',
      });
    } catch (err) {
      console.error('Error clearing error logs:', err);
    }
  };

  // Roles y Permisos State Management
  const [psychDrafts, setPsychDrafts] = useState<Record<string, {
    role: string;
    customRole: string;
    isCustomRole: boolean;
    isAdmin: boolean;
    permissions: PsychologistPermissions;
    isSaving?: boolean;
    savedNotice?: boolean;
  }>>({});

  const handleClearAllPatients = async () => {
    setIsDeletingAll(true);
    try {
      if (onClearAllSessions) {
        await onClearAllSessions();
      }
      await logAuditEvent({
        adminEmail: currentUser.email || 'kailabwasd@gmail.com',
        adminName: currentUser.displayName || 'Administrador',
        action: 'SYSTEM_CONFIG',
        severity: 'CRITICAL',
        category: 'SISTEMA',
        details: `Purga total de pacientes: Se eliminaron todos los pacientes (${sessions?.length || 0}) de la guardia Triage en memoria y Firestore.`,
      });
      setPatientActionNotice('Todos los pacientes han sido eliminados de la guardia exitosamente.');
      setConfirmClearAllOpen(false);
      setTimeout(() => setPatientActionNotice(null), 4000);
    } catch (err) {
      console.error('Error clearing patients:', err);
      setPatientActionNotice('Error al purgar los pacientes.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleDeleteSinglePatient = async (session: PatientSession) => {
    setDeletingPatientId(session.id);
    try {
      if (onDeleteSession) {
        await onDeleteSession(session.id);
      }
      await logAuditEvent({
        adminEmail: currentUser.email || 'kailabwasd@gmail.com',
        adminName: currentUser.displayName || 'Administrador',
        action: 'SYSTEM_CONFIG',
        severity: 'WARNING',
        category: 'SISTEMA',
        details: `Eliminación de paciente en guardia: ${session.userName} (${session.phoneNumber || session.id}).`,
      });
      setPatientActionNotice(`Paciente ${session.userName} eliminado de la guardia.`);
      setTimeout(() => setPatientActionNotice(null), 3000);
    } catch (err) {
      console.error('Error deleting patient:', err);
    } finally {
      setDeletingPatientId(null);
    }
  };

  const STANDARD_CLINICAL_ROLES = [
    'Psicólogo(a) Clínico(a) Titulado(a)',
    'Terapeuta de Guardia y Crisis 24/7',
    'Supervisor(a) de Triage e Interconsulta',
    'Coordinador(a) de Salud Mental Subred Norte',
    'Psicólogo(a) de Apoyo Emocional',
    'Administrador(a) Clínico y de Auditoría',
    'OTRO_PERSONALIZADO'
  ];

  const getPsychDraft = (psych: PsychologistAuthUser) => {
    if (psychDrafts[psych.uid]) {
      return psychDrafts[psych.uid];
    }
    const defaultPerms: PsychologistPermissions = psych.permissions || {
      lectura: true,
      escritura: true,
      administrativo: Boolean(psych.isAdmin),
    };
    const isCustom = !STANDARD_CLINICAL_ROLES.slice(0, -1).includes(psych.role);
    return {
      role: isCustom ? 'OTRO_PERSONALIZADO' : psych.role,
      customRole: isCustom ? psych.role : '',
      isCustomRole: isCustom,
      isAdmin: Boolean(psych.isAdmin),
      permissions: defaultPerms,
    };
  };

  const updatePsychDraft = (uid: string, patch: Partial<{
    role: string;
    customRole: string;
    isCustomRole: boolean;
    isAdmin: boolean;
    permissions: PsychologistPermissions;
    isSaving: boolean;
    savedNotice: boolean;
  }>) => {
    const psych = allPsychologists.find(p => p.uid === uid);
    if (!psych) return;
    const current = getPsychDraft(psych);
    setPsychDrafts(prev => ({
      ...prev,
      [uid]: { ...current, ...patch }
    }));
  };

  const handleSavePsychologistPermissions = async (psych: PsychologistAuthUser) => {
    const draft = getPsychDraft(psych);
    const finalRole = draft.isCustomRole ? (draft.customRole.trim() || 'Psicólogo Clínico') : draft.role;
    
    updatePsychDraft(psych.uid, { isSaving: true });
    
    try {
      await onUpdatePsychologistRole(psych.uid, draft.isAdmin, finalRole, draft.permissions);
      
      await logAuditEvent({
        adminEmail: currentUser.email || 'kailabwasd@gmail.com',
        adminName: currentUser.displayName || 'Owner',
        action: 'ROLE_UPDATE',
        severity: 'CRITICAL',
        category: 'ROLES',
        details: `Actualización de rol y permisos para ${psych.displayName} (${psych.email || 'sin correo'}). Rol: "${finalRole}". Permisos: Lectura=${draft.permissions.lectura ? 'SÍ' : 'NO'}, Escritura=${draft.permissions.escritura ? 'SÍ' : 'NO'}, Administrativo=${draft.permissions.administrativo ? 'SÍ' : 'NO'}.`,
      });

      updatePsychDraft(psych.uid, { isSaving: false, savedNotice: true });
      setTimeout(() => {
        updatePsychDraft(psych.uid, { savedNotice: false });
      }, 3000);
    } catch (err) {
      console.error('Error saving psychologist permissions:', err);
      updatePsychDraft(psych.uid, { isSaving: false });
    }
  };

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
              <span>Roles y Permisos</span>
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => setActiveTab('patients')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'patients' ? 'border-[#C8102E] text-red-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <UserX className="w-4 h-4 text-red-400" />
              <span>Gestión de Pacientes</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-500/40 font-mono">
                {sessions.length}
              </span>
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => setActiveTab('errorlogs')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'errorlogs' ? 'border-amber-400 text-amber-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <Bug className="w-4 h-4 text-amber-400" />
              <span>Logs de Errores & Twilio</span>
              {errorLogs.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 font-mono">
                  {errorLogs.length}
                </span>
              )}
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => setActiveTab('crisiskeywords')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'crisiskeywords' ? 'border-red-500 text-red-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Palabras Clave de Crisis</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-500/40 font-mono font-bold">
                {crisisKeywordsDb.reduce((acc, c) => acc + c.keywords.length, 0)}
              </span>
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
              onClick={() => setActiveTab('audit')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'audit' ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <FileClock className="w-4 h-4 text-[#2BF267]" />
              <span>Registro de Auditoría</span>
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

          {/* TAB 3: ROLES Y PERMISOS (Only for Owner/Admin) */}
          {activeTab === 'admins' && isOwner && (
            <div className="space-y-5">
              
              {/* Header banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-amber-950/40 border border-cyan-500/30 text-xs flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-white text-sm">
                    Gestión de Roles y Permisos Específicos
                  </p>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    Como Administrador, puedes asignar el rol clínico actual y configurar los 3 niveles de permisos específicos (<strong className="text-blue-300">Lectura</strong>, <strong className="text-emerald-300">Escritura</strong> y <strong className="text-amber-300">Administrativo</strong>) para cada psicólogo registrado.
                  </p>
                </div>
              </div>

              {/* Guía rápida de permisos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-blue-500/20 flex items-center gap-2 text-slate-300">
                  <BookOpen className="w-4 h-4 text-blue-400 shrink-0" />
                  <span><strong>Lectura:</strong> Consulta de expedientes, notas y triage.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/20 flex items-center gap-2 text-slate-300">
                  <FileEdit className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Escritura:</strong> Atención por chat y redacción de evolución.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/20 flex items-center gap-2 text-slate-300">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span><strong>Administrativo:</strong> Configuración, auditoría y roles.</span>
                </div>
              </div>

              {/* Lista de Psicólogos con asignación */}
              <div className="space-y-4">
                {allPsychologists.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800">
                    <User className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No hay otros psicólogos registrados actualmente en Firestore.</p>
                  </div>
                ) : (
                  allPsychologists.map((psych) => {
                    const draft = getPsychDraft(psych);
                    const isProtectedOwner = psych.email === 'kailabwasd@gmail.com';

                    return (
                      <div 
                        key={psych.uid} 
                        className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-750 transition space-y-4"
                      >
                        {/* Cabecera del usuario */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-850">
                          <div className="flex items-center gap-3 min-w-0">
                            <img 
                              src={psych.photoURL} 
                              alt={psych.displayName} 
                              className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-700" 
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-white truncate">{psych.displayName}</p>
                                {isProtectedOwner ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    👑 Owner Principal
                                  </span>
                                ) : draft.isAdmin ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    👑 Admin
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-800 text-slate-400">
                                    👨‍⚕️ Clínico
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">{psych.email || 'Sin correo registrado'}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono text-cyan-400">
                                  {psych.license || 'Sin registro sanitario'}
                                </span>
                                {psych.uniqueUserId && (
                                  <span className="text-[10px] font-mono text-slate-500">
                                    · ID: {psych.uniqueUserId}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Resumen de permisos activos */}
                          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 ${
                              draft.permissions.lectura 
                                ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' 
                                : 'bg-slate-900 text-slate-600 line-through'
                            }`}>
                              <BookOpen className="w-2.5 h-2.5" /> Lectura
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 ${
                              draft.permissions.escritura 
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                                : 'bg-slate-900 text-slate-600 line-through'
                            }`}>
                              <FileEdit className="w-2.5 h-2.5" /> Escritura
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 ${
                              draft.permissions.administrativo 
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' 
                                : 'bg-slate-900 text-slate-600 line-through'
                            }`}>
                              <ShieldAlert className="w-2.5 h-2.5" /> Admin
                            </span>
                          </div>
                        </div>

                        {/* Selección de Rol Actual */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                            <span>Seleccionar Rol Clínico:</span>
                            <span className="text-[10px] text-cyan-400 font-mono">
                              Rol asignado: {draft.isCustomRole ? draft.customRole || 'Personalizado' : draft.role}
                            </span>
                          </label>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <div className={draft.isCustomRole ? 'sm:col-span-6' : 'sm:col-span-12'}>
                              <select
                                value={draft.role}
                                disabled={isProtectedOwner}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const isCustom = val === 'OTRO_PERSONALIZADO';
                                  const isAdminRole = val === 'Administrador(a) Clínico y de Auditoría';
                                  updatePsychDraft(psych.uid, {
                                    role: val,
                                    isCustomRole: isCustom,
                                    ...(isAdminRole
                                      ? { isAdmin: true, permissions: { ...draft.permissions, administrativo: true } }
                                      : {})
                                  });
                                }}
                                className="w-full bg-slate-900 border border-slate-750 focus:border-[#00E5FF] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {STANDARD_CLINICAL_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {r === 'OTRO_PERSONALIZADO' ? '✏️ Rol Clínico Personalizado...' : r}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {draft.isCustomRole && (
                              <div className="sm:col-span-6">
                                <input
                                  type="text"
                                  placeholder="Escribe el rol clínico específico..."
                                  value={draft.customRole}
                                  disabled={isProtectedOwner}
                                  onChange={(e) => updatePsychDraft(psych.uid, { customRole: e.target.value })}
                                  className="w-full bg-slate-900 border border-cyan-500/40 focus:border-[#00E5FF] rounded-xl px-3 py-2 text-xs text-cyan-200 outline-none placeholder-slate-500 disabled:opacity-50"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Asignación de Permisos Específicos */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-300 block">
                            Asignar Permisos Específicos:
                          </label>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {/* Permiso 1: Lectura */}
                            <button
                              type="button"
                              disabled={isProtectedOwner}
                              onClick={() => {
                                updatePsychDraft(psych.uid, {
                                  permissions: {
                                    ...draft.permissions,
                                    lectura: !draft.permissions.lectura
                                  }
                                });
                              }}
                              className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer disabled:cursor-not-allowed ${
                                draft.permissions.lectura
                                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-200 shadow-sm'
                                  : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:border-slate-700'
                              }`}
                            >
                              <BookOpen className={`w-4 h-4 shrink-0 mt-0.5 ${draft.permissions.lectura ? 'text-blue-400' : 'text-slate-600'}`} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-white">Lectura</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                    draft.permissions.lectura ? 'bg-blue-500/25 text-blue-300' : 'bg-slate-800 text-slate-500'
                                  }`}>
                                    {draft.permissions.lectura ? 'Activo' : 'Denegado'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                  Ver cola de triage, historiales y evolución clínica.
                                </p>
                              </div>
                            </button>

                            {/* Permiso 2: Escritura */}
                            <button
                              type="button"
                              disabled={isProtectedOwner}
                              onClick={() => {
                                updatePsychDraft(psych.uid, {
                                  permissions: {
                                    ...draft.permissions,
                                    escritura: !draft.permissions.escritura
                                  }
                                });
                              }}
                              className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer disabled:cursor-not-allowed ${
                                draft.permissions.escritura
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 shadow-sm'
                                  : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:border-slate-700'
                              }`}
                            >
                              <FileEdit className={`w-4 h-4 shrink-0 mt-0.5 ${draft.permissions.escritura ? 'text-emerald-400' : 'text-slate-600'}`} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-white">Escritura</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                    draft.permissions.escritura ? 'bg-emerald-500/25 text-emerald-300' : 'bg-slate-800 text-slate-500'
                                  }`}>
                                    {draft.permissions.escritura ? 'Activo' : 'Denegado'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                  Chatear con pacientes por WhatsApp y cerrar casos.
                                </p>
                              </div>
                            </button>

                            {/* Permiso 3: Administrativo */}
                            <button
                              type="button"
                              disabled={isProtectedOwner}
                              onClick={() => {
                                const newAdmin = !draft.permissions.administrativo;
                                updatePsychDraft(psych.uid, {
                                  isAdmin: newAdmin,
                                  permissions: {
                                    ...draft.permissions,
                                    administrativo: newAdmin
                                  }
                                });
                              }}
                              className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer disabled:cursor-not-allowed ${
                                draft.permissions.administrativo
                                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-sm'
                                  : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:border-slate-700'
                              }`}
                            >
                              <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${draft.permissions.administrativo ? 'text-amber-400' : 'text-slate-600'}`} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-white">Administrativo</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                    draft.permissions.administrativo ? 'bg-amber-500/25 text-amber-300' : 'bg-slate-800 text-slate-500'
                                  }`}>
                                    {draft.permissions.administrativo ? 'Activo' : 'Denegado'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                  Administrar otros psicólogos, roles y auditoría forense.
                                </p>
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Notificación de guardado exitoso */}
                        {draft.savedNotice && (
                          <div className="p-2.5 bg-emerald-950/70 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>¡Rol y permisos actualizados exitosamente en Firestore!</span>
                          </div>
                        )}

                        {/* Botones de acción */}
                        {!isProtectedOwner && (
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-850">
                            {/* Toggle rápido de admin */}
                            <button
                              type="button"
                              onClick={() => {
                                const newAdmin = !draft.isAdmin;
                                updatePsychDraft(psych.uid, {
                                  isAdmin: newAdmin,
                                  permissions: {
                                    ...draft.permissions,
                                    administrativo: newAdmin
                                  }
                                });
                              }}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
                                draft.isAdmin
                                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/50'
                                  : 'bg-slate-900 border-slate-750 text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{draft.isAdmin ? 'Quitar Rol Administrador' : 'Asignar como Administrador'}</span>
                            </button>

                            {/* Guardar cambios para este psicólogo */}
                            <button
                              type="button"
                              disabled={draft.isSaving}
                              onClick={() => handleSavePsychologistPermissions(psych)}
                              className="px-4 py-1.5 bg-[#00E5FF] hover:bg-[#00D2F4] text-slate-950 font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {draft.isSaving ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Guardando en Firestore...</span>
                                </>
                              ) : (
                                <>
                                  <Save className="w-3.5 h-3.5" />
                                  <span>Guardar Rol y Permisos</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: GESTIÓN DE PACIENTES EN GUARDIA / TRIAGE (ADMINS) */}
          {activeTab === 'patients' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Header Context Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-900 to-amber-950/30 border border-red-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                    <UserX className="w-5 h-5 text-red-400" />
                    <span>Control y Purgado de Pacientes en Guardia Triage</span>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-mono font-bold">
                    Área Exclusiva de Administradores
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Como administrador clínico, desde aquí puedes gestionar, purgar y eliminar los pacientes activos en la bandeja de guardia de Triage tanto del servidor como de la base de datos en tiempo real de Firestore.
                </p>
              </div>

              {/* Patient Action Notice */}
              {patientActionNotice && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{patientActionNotice}</span>
                  </div>
                  <button onClick={() => setPatientActionNotice(null)} className="text-emerald-400 hover:text-white">✕</button>
                </div>
              )}

              {/* Métricas de la Guardia */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" /> Total Pacientes
                  </span>
                  <span className="text-xl font-black text-white mt-1 font-mono">{sessions.length}</span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> En Espera Triage
                  </span>
                  <span className="text-xl font-black text-amber-300 mt-1 font-mono">
                    {sessions.filter(s => s.state === 'WAITING_PSYCHOLOGIST').length}
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-[11px] text-red-400 font-medium flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Código Rojo / Crisis
                  </span>
                  <span className="text-xl font-black text-red-400 mt-1 font-mono">
                    {sessions.filter(s => s.riskLevel === 'CRISIS').length}
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-emerald-400" /> Con Psicólogo
                  </span>
                  <span className="text-xl font-black text-emerald-400 mt-1 font-mono">
                    {sessions.filter(s => s.state === 'HUMAN_MODE').length}
                  </span>
                </div>
              </div>

              {/* Acciones Globales de Purga y Mantenimiento */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" /> Acciones Globales de Mantenimiento
                </h4>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Botón Purgar Todos */}
                  <button
                    type="button"
                    onClick={() => setConfirmClearAllOpen(true)}
                    disabled={sessions.length === 0 || isDeletingAll}
                    className="flex-1 px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-red-200 border border-red-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-red-950"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <span>Eliminar Todos los Pacientes en Guardia ({sessions.length})</span>
                  </button>
                </div>

                {/* Modal / Dialogo de Confirmación para Purgar Todos */}
                {confirmClearAllOpen && (
                  <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/50 space-y-3 animate-in fade-in">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h5 className="text-xs font-bold text-red-200">¿Confirmas la eliminación total de todos los pacientes?</h5>
                        <p className="text-[11px] text-red-300/80 leading-relaxed">
                          Esta acción eliminará de forma irreversible todas las sesiones activas ({sessions.length} pacientes) de la base de datos Firestore, la memoria del servidor y la bandeja de guardia.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setConfirmClearAllOpen(false)}
                        disabled={isDeletingAll}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllPatients}
                        disabled={isDeletingAll}
                        className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                      >
                        {isDeletingAll ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Eliminando...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Sí, Eliminar Todos</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Lista Detallada de Pacientes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-400" /> Pacientes Registrados en la Guardia ({sessions.length})
                  </h4>

                  <div className="relative w-48 sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o teléfono..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-750 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-400"
                    />
                  </div>
                </div>

                {sessions.length === 0 ? (
                  <div className="p-8 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
                    <h5 className="text-xs font-bold text-white">Guardia Triage Limpia</h5>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      No hay pacientes en la bandeja de guardia en este momento. Los nuevos pacientes que escriban por WhatsApp o se registren aparecerán aquí automáticamente.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-2xl bg-slate-950 overflow-hidden">
                    {sessions
                      .filter(s => {
                        if (!patientSearch.trim()) return true;
                        const query = patientSearch.toLowerCase();
                        return (
                          (s.userName || '').toLowerCase().includes(query) ||
                          (s.phoneNumber || '').toLowerCase().includes(query) ||
                          (s.id || '').toLowerCase().includes(query) ||
                          (s.primaryEmotion || '').toLowerCase().includes(query)
                        );
                      })
                      .map((session) => {
                        const isDeletingThis = deletingPatientId === session.id;
                        return (
                          <div
                            key={session.id}
                            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/60 transition"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white truncate">
                                  {session.userName || 'Paciente WhatsApp'}
                                </span>
                                {session.age && (
                                  <span className="text-[10px] text-slate-400">
                                    • {session.age} {session.gender ? `(${session.gender})` : ''}
                                  </span>
                                )}
                                <span className={`text-[10px] px-2 py-0.2 rounded font-semibold ${
                                  session.riskLevel === 'CRISIS' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                                  session.riskLevel === 'ALTO' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                  'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                }`}>
                                  {session.riskLevel}
                                </span>
                                <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                                  {session.state === 'HUMAN_MODE' ? 'Con Psicólogo' : session.state === 'CRISIS_ALERT' ? 'Alerta Roja' : 'En Espera'}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                                <span className="flex items-center gap-1 font-mono text-slate-300">
                                  <Phone className="w-3 h-3 text-slate-500" />
                                  {session.phoneNumber || session.id}
                                </span>
                                {session.primaryEmotion && (
                                  <span className="text-teal-400 truncate max-w-xs">
                                    Emoción: {session.primaryEmotion}
                                  </span>
                                )}
                                <span className="text-slate-500">
                                  {session.messages?.length || 0} mensajes
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                type="button"
                                disabled={isDeletingThis || isDeletingAll}
                                onClick={() => handleDeleteSinglePatient(session)}
                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/25 text-red-300 hover:text-red-200 border border-red-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                                title="Eliminar este paciente de la guardia"
                              >
                                {isDeletingThis ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-400" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                )}
                                <span>{isDeletingThis ? 'Eliminando...' : 'Eliminar'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: ERROR LOGS & TWILIO DIAGNOSTICS */}
          {activeTab === 'errorlogs' && (
            <div className="space-y-6">
              
              {/* Error 20003 Direct Action / Troubleshooting Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-red-950/50 border border-amber-500/40 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">
                        Diagnóstico de Twilio: Error 20003 (401 Unauthorized)
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-500/40 font-mono font-bold">
                        HTTP 401
                      </span>
                    </div>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      El error <strong className="text-white font-mono">20003 (Authenticate / Unauthorized)</strong> se produce cuando el <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-300 font-mono">TWILIO_AUTH_TOKEN</code> configurado no coincide con el token de tu consola de Twilio o fue regenerado.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-amber-500/30 text-xs text-slate-300 space-y-2">
                  <h5 className="font-bold text-amber-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> Pasos para solucionar el Error 20003:
                  </h5>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 leading-relaxed pl-1">
                    <li>Ingresa a tu consola de Twilio en <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline font-semibold inline-flex items-center gap-1">console.twilio.com <ExternalLink className="w-3 h-3" /></a>.</li>
                    <li>En la pantalla de inicio (<strong>Account Info</strong>), copia tu <strong>Account SID</strong> y haz clic en <strong>Show</strong> para copiar tu <strong>Auth Token</strong>.</li>
                    <li>Pégalos en el formulario a continuación y presiona <strong className="text-emerald-400">"Guardar Credenciales en Memoria"</strong> para probarlo inmediatamente, o actualiza la variable de entorno <code className="text-amber-300 font-mono">TWILIO_AUTH_TOKEN</code> en Railway.</li>
                  </ol>
                </div>

                {/* Error 63007 Guide: Channel Not Found */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-red-500/30 text-xs text-slate-300 space-y-2">
                  <h5 className="font-bold text-red-300 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-red-400" /> Pasos para solucionar el Error 63007 ("Could not find a Channel with specified From address"):
                  </h5>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Este error indica que tu cuenta de Twilio aún no tiene activo el Sandbox de WhatsApp o que el número remitente no está habilitado como canal de WhatsApp.
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 leading-relaxed pl-1">
                    <li>En tu consola de Twilio, ve al menú lateral izquierdo &rarr; <strong>Messaging</strong> &rarr; <strong>Try it out</strong> &rarr; <strong>Send a WhatsApp message</strong>.</li>
                    <li>Acepta los términos del Sandbox de WhatsApp para aprovisionar el canal remitente <code className="text-emerald-300 font-mono">+1 415 523 8886</code> en tu cuenta.</li>
                    <li>Envía desde tu WhatsApp al número <strong>+1 415 523 8886</strong> el mensaje con tu código de activación (ej: <code className="text-amber-300 font-mono font-bold">join &lt;tu-código-sandbox&gt;</code>) para vincular el número del paciente.</li>
                  </ol>
                </div>
              </div>

              {/* Twilio In-Memory Live Config Form */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" /> Configuración de Credenciales Twilio WhatsApp
                  </h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1 font-bold ${
                    hasTwilioAuthToken ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-red-950 text-red-300 border border-red-500/40'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${hasTwilioAuthToken ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    {hasTwilioAuthToken ? 'Token Cargado' : 'Sin Token'}
                  </span>
                </div>

                {twilioSaveNotice && (
                  <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{twilioSaveNotice}</span>
                  </div>
                )}

                <form onSubmit={handleSaveTwilioConfig} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      TWILIO_ACCOUNT_SID
                    </label>
                    <input
                      type="text"
                      value={twilioAccountSid}
                      onChange={(e) => setTwilioAccountSid(e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-slate-900 border border-slate-750 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      TWILIO_AUTH_TOKEN
                    </label>
                    <input
                      type="password"
                      value={twilioAuthToken}
                      onChange={(e) => setTwilioAuthToken(e.target.value)}
                      placeholder={hasTwilioAuthToken ? '••••••••••••••••••••••••••••••••' : 'Ingresa tu Auth Token de Twilio'}
                      className="w-full bg-slate-900 border border-slate-750 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      TWILIO_WHATSAPP_NUMBER
                    </label>
                    <input
                      type="text"
                      value={twilioWhatsappNumber}
                      onChange={(e) => setTwilioWhatsappNumber(e.target.value)}
                      placeholder="whatsapp:+14155238886"
                      className="w-full bg-slate-900 border border-slate-750 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                  </div>

                  <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleVerifyCredentials}
                      disabled={isVerifyingCredentials}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/50 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow disabled:opacity-50"
                      title="Prueba la combinación de Account SID y Auth Token directamente contra api.twilio.com sin enviar ningún mensaje de texto."
                    >
                      {isVerifyingCredentials ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <Activity className="w-3.5 h-3.5 text-cyan-400" />}
                      <span>Verificar Cuenta con Twilio (Sin SMS)</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingTwilio}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow disabled:opacity-50"
                    >
                      {isSavingTwilio ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>Guardar Credenciales en Servidor</span>
                    </button>
                  </div>
                </form>

                {/* Direct Verification Result Banner */}
                {verifyCredentialsResult && (
                  <div className={`p-4 rounded-xl border text-xs space-y-2 animate-in fade-in ${
                    verifyCredentialsResult.success
                      ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                      : 'bg-red-950/80 border-red-500/50 text-red-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-2">
                        {verifyCredentialsResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <span>{verifyCredentialsResult.success ? 'Autenticación Válida con Twilio' : 'Fallo de Autenticación Twilio (401)'}</span>
                      </span>
                      {verifyCredentialsResult.errorCode && (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-red-900/60 text-red-300 font-bold">
                          Error {verifyCredentialsResult.errorCode}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] leading-relaxed">
                      {verifyCredentialsResult.message || verifyCredentialsResult.error}
                    </p>

                    {verifyCredentialsResult.advice && (
                      <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-500/30 text-amber-200 text-[11px] space-y-1">
                        <strong className="text-amber-300 flex items-center gap-1">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-400" /> Diagnóstico Oficial:
                        </strong>
                        <p>{verifyCredentialsResult.advice}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Live Twilio Test Dispatcher */}
                <div className="pt-3 border-t border-slate-800/80 space-y-3">
                  <h5 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Send className="w-3.5 h-3.5 text-teal-400" /> Probar Conexión y Envío de WhatsApp en Vivo
                  </h5>
                  
                  <form onSubmit={handleTestTwilioSend} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={testPhoneRecipient}
                      onChange={(e) => setTestPhoneRecipient(e.target.value)}
                      placeholder="Número destino con código de país (ej. +573107956907)"
                      className="flex-1 bg-slate-900 border border-slate-750 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                    <button
                      type="submit"
                      disabled={isTestingTwilio || !testPhoneRecipient.trim()}
                      className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow disabled:opacity-50"
                    >
                      {isTestingTwilio ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      <span>Enviar Mensaje de Prueba</span>
                    </button>
                  </form>

                  {twilioTestResult && (
                    <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 animate-in fade-in ${
                      twilioTestResult.success 
                        ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200' 
                        : 'bg-red-950/80 border-red-500/50 text-red-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                          {twilioTestResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                          )}
                          {twilioTestResult.success ? 'Conexión Exitosa con Twilio' : 'Fallo de Autenticación / Despacho'}
                        </span>
                        {twilioTestResult.sid && (
                          <span className="font-mono text-[10px] text-emerald-300">
                            SID: {twilioTestResult.sid}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">
                        {twilioTestResult.message || twilioTestResult.error}
                      </p>
                      {twilioTestResult.suggestion && (
                        <p className="text-[11px] font-semibold text-amber-300 pt-1 border-t border-red-800/40">
                          💡 Solución: {twilioTestResult.suggestion}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* AUTOMATED ADMIN WHATSAPP UPDATES & ERROR ALERTS (EVERY 30 MINS) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/40 space-y-4 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        Actualizaciones Cada 30 Minutos & Alertas de Error por WhatsApp
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Envío de reportes de guardia y notificación instantánea de fallos a tu número personal.
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] px-2.5 py-1 rounded-full font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 self-start sm:self-auto">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Servicio Activo
                  </span>
                </div>

                {notifyNotice && (
                  <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{notifyNotice}</span>
                  </div>
                )}

                <form onSubmit={handleSaveNotifyConfig} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      Número de WhatsApp Administrador para Notificaciones
                    </label>
                    <input
                      type="text"
                      value={adminNotifyPhone}
                      onChange={(e) => setAdminNotifyPhone(e.target.value)}
                      placeholder="+573107956907"
                      className="w-full bg-slate-900 border border-slate-750 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                      <input
                        type="checkbox"
                        checked={enablePeriodicUpdates}
                        onChange={(e) => setEnablePeriodicUpdates(e.target.checked)}
                        className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-950 border-slate-700"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-white block">Actualizaciones de Estado cada 30 min</span>
                        <span className="text-[11px] text-slate-400">
                          Recibe conteo de pacientes en espera, crisis activas, guardias y salud de la plataforma.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                      <input
                        type="checkbox"
                        checked={enableErrorAlerts}
                        onChange={(e) => setEnableErrorAlerts(e.target.checked)}
                        className="mt-0.5 rounded text-red-500 focus:ring-red-400 bg-slate-950 border-slate-700"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-white block">Alertas Inmediatas de Errores</span>
                        <span className="text-[11px] text-slate-400">
                          Notifica de inmediato si ocurre un fallo de Twilio (401, 63007), caída de red o de API.
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div className="text-[11px] text-slate-400 font-mono">
                      {lastReportTimestamp && (
                        <span>Último reporte: {new Date(lastReportTimestamp).toLocaleTimeString('es-CO')}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTriggerTestReport}
                        disabled={isSendingTestReport}
                        className="px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow disabled:opacity-50"
                        title="Envía el reporte de 30 minutos en este instante a tu WhatsApp para verificar"
                      >
                        {isSendingTestReport ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Send className="w-3.5 h-3.5 text-emerald-400" />}
                        <span>Enviar Reporte Ahora (Prueba)</span>
                      </button>

                      <button
                        type="submit"
                        disabled={isSavingNotifyConfig}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow disabled:opacity-50"
                      >
                        {isSavingNotifyConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Guardar Preferencias</span>
                      </button>
                    </div>
                  </div>
                </form>

                {testReportResult && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
                    testReportResult.success
                      ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                      : 'bg-red-950/80 border-red-500/50 text-red-200'
                  }`}>
                    {testReportResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span>{testReportResult.message}</span>
                  </div>
                )}
              </div>

              {/* Real-time System Error Logs Feed */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-amber-400" /> Registro de Errores de Conexión y APIs ({errorLogs.length})
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={loadErrorLogsAndTwilioConfig}
                      disabled={isLoadingErrorLogs}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1 border border-slate-800 cursor-pointer"
                      title="Actualizar registro de errores"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoadingErrorLogs ? 'animate-spin' : ''}`} />
                      <span>Actualizar</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearErrorLogs}
                      disabled={errorLogs.length === 0}
                      className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-950/70 text-red-300 text-xs font-medium flex items-center gap-1 border border-red-500/30 cursor-pointer disabled:opacity-40"
                      title="Vaciar todos los errores"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Vaciar Logs</span>
                    </button>
                  </div>
                </div>

                {/* Filters and Search */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                    {(['ALL', 'TWILIO', 'WEBHOOK', 'GEMINI', 'AUTH'] as const).map((svc) => (
                      <button
                        key={svc}
                        type="button"
                        onClick={() => setErrorFilter(svc)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                          errorFilter === svc 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {svc === 'ALL' ? 'Todos los Servicios' : svc}
                      </button>
                    ))}
                  </div>

                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filtrar por código o texto..."
                      value={errorSearchQuery}
                      onChange={(e) => setErrorSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-750 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Log List View */}
                {errorLogs.length === 0 ? (
                  <div className="p-8 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-80" />
                    <h5 className="text-xs font-bold text-white">Sin Errores Registrados</h5>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      El servidor no ha reportado fallos de autenticación de Twilio ni excepciones de API en las sesiones recientes.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-2xl bg-slate-950 overflow-hidden max-h-80 overflow-y-auto">
                    {errorLogs
                      .filter((log) => {
                        if (errorFilter !== 'ALL' && log.service !== errorFilter) return false;
                        if (!errorSearchQuery.trim()) return true;
                        const q = errorSearchQuery.toLowerCase();
                        return (
                          log.title.toLowerCase().includes(q) ||
                          log.details.toLowerCase().includes(q) ||
                          String(log.errorCode || '').toLowerCase().includes(q) ||
                          (log.targetPhone || '').toLowerCase().includes(q)
                        );
                      })
                      .map((log) => {
                        const isTwilio401 = log.errorCode === 20003 || log.statusCode === 401;
                        return (
                          <div
                            key={log.id}
                            className="p-3.5 space-y-2 hover:bg-slate-900/60 transition cursor-pointer"
                            onClick={() => setSelectedError(selectedError?.id === log.id ? null : log)}
                          >
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                                  log.service === 'TWILIO' 
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                }`}>
                                  {log.service}
                                </span>

                                {log.errorCode && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                                    isTwilio401 
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                                      : 'bg-slate-800 text-slate-300'
                                  }`}>
                                    Error {log.errorCode}
                                  </span>
                                )}

                                <span className="text-xs font-bold text-white">
                                  {log.title}
                                </span>
                              </div>

                              <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3" />
                                {new Date(log.timestamp).toLocaleTimeString()} • {new Date(log.timestamp).toLocaleDateString()}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-300 leading-relaxed font-mono bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                              {log.details}
                            </p>

                            {log.targetPhone && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>Destino: {log.targetPhone}</span>
                              </div>
                            )}

                            {log.suggestion && (
                              <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200">
                                💡 <strong className="text-amber-300">Sugerencia:</strong> {log.suggestion}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB: CRISIS KEYWORDS */}
          {activeTab === 'crisiskeywords' && isOwner && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Gestión de Palabras Clave de Crisis</h3>
                  <p className="text-xs text-slate-400">Administra los términos que disparan automáticamente la Alerta Roja de Triage y la notificación WhatsApp a +573107956907.</p>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full font-mono bg-red-950 text-red-300 border border-red-500/40 font-bold">
                  {crisisKeywordsDb.reduce((acc, c) => acc + c.keywords.length, 0)} Términos Totales
                </span>
              </div>

              {crisisNotice && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{crisisNotice}</span>
                </div>
              )}

              {/* Add New Keyword Form */}
              <form onSubmit={handleAddCrisisKeyword} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Categoría de Riesgo</label>
                  <select
                    value={newKeywordCategory}
                    onChange={(e: any) => setNewKeywordCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-750 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    {crisisKeywordsDb.map(c => (
                      <option key={c.category} value={c.category}>{c.displayName} ({c.category})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Nueva Palabra o Frase Clave</label>
                  <input
                    type="text"
                    value={newKeywordTerm}
                    onChange={(e) => setNewKeywordTerm(e.target.value)}
                    placeholder="Ej. sobredosis, matarme, etc."
                    className="w-full bg-slate-900 border border-slate-750 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#00E5FF] hover:bg-[#00D2F4] text-slate-950 font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Agregar Término</span>
                  </button>
                </div>
              </form>

              {/* Keywords Table view by category */}
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {crisisKeywordsDb.map(entry => (
                  <div key={entry.category} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${entry.severity === 'CRITICA' ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
                        <h4 className="text-xs font-bold text-white">{entry.displayName}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300">
                          {entry.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {entry.keywords.length} términos
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 italic">
                      💡 Consejo clínico: {entry.clinicalAdvice}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {entry.keywords.map(kw => (
                        <span key={kw} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-750 text-slate-200 text-xs font-mono">
                          <span>{kw}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCrisisKeyword(entry.category, kw)}
                            className="text-slate-500 hover:text-red-400 transition cursor-pointer"
                            title={`Eliminar "${kw}"`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
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

          {/* TAB: AUDIT LOG */}
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
