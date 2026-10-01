import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Search, 
  Phone, 
  Award, 
  BookOpen, 
  FileEdit, 
  ShieldAlert, 
  Clock, 
  UserCheck, 
  Lock, 
  ArrowLeft, 
  LogIn, 
  UserPlus, 
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Settings,
  Plus,
  Database,
  Mail,
  Building2,
  Calendar,
  X,
  AlertCircle
} from 'lucide-react';
import type { PsychologistAuthUser } from '../types/index.ts';
import { SubaTechLogo } from './SubaTechLogo.tsx';
import { 
  savePsychologistProfile, 
  findPsychologistByEmail, 
  findPsychologistByLicense,
  approvePsychologist 
} from '../lib/firebase.ts';

interface PsychologistsDirectoryViewProps {
  currentUser: PsychologistAuthUser | null;
  allPsychologists: PsychologistAuthUser[];
  onNavigate: (route: string) => void;
  onOpenSettings?: () => void;
}

export const PsychologistsDirectoryView: React.FC<PsychologistsDirectoryViewProps> = ({
  currentUser,
  allPsychologists,
  onNavigate,
  onOpenSettings,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');
  const [approvalFilter, setApprovalFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [actionLoadingUid, setActionLoadingUid] = useState<string | null>(null);

  // Modal para registrar psicólogo en Firestore
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newLicense, setNewLicense] = useState('');
  const [newSpecialty, setNewSpecialty] = useState('Atención Psicológica y Triage de Crisis');
  const [newPhone, setNewPhone] = useState('');
  const [newInstitution, setNewInstitution] = useState('Subred Integrada de Servicios de Salud Norte - Suba');
  const [newRole, setNewRole] = useState('Psicólogo(a) Clínico Titulado(a)');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const isAuthenticated = Boolean(currentUser && currentUser.profileCompleted);
  const isAdmin = Boolean(currentUser?.isAdmin || currentUser?.email === 'kailabwasd@gmail.com');

  const handleQuickApprove = async (psych: PsychologistAuthUser) => {
    if (!isAdmin) return;
    setActionLoadingUid(psych.uid);
    try {
      await approvePsychologist(
        psych.uid, 
        currentUser?.email || 'kailabwasd@gmail.com',
        psych.permissions || { lectura: true, escritura: true, administrativo: false },
        psych.role || 'Psicólogo(a) Clínico Titulado(a)'
      );
    } catch (err) {
      console.error('Error in quick approve:', err);
    } finally {
      setActionLoadingUid(null);
    }
  };

  const handleRegisterNewPsychologist = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanLicense = newLicense.trim();

    if (!newFullName.trim() || newFullName.trim().length < 3) {
      setModalError('Ingresa el Nombre y Apellidos completos del especialista.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setModalError('Ingresa un correo electrónico válido.');
      return;
    }
    if (!cleanLicense || cleanLicense.length < 4) {
      setModalError('Ingresa una Tarjeta Profesional (ReTHUS) válida (mínimo 4 caracteres).');
      return;
    }
    if (!newPhone.trim() || newPhone.trim().length < 7) {
      setModalError('Ingresa un teléfono o número de WhatsApp válido.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Proactively check if email already exists in Firestore
      const existingEmail = await findPsychologistByEmail(cleanEmail);
      if (existingEmail) {
        setModalError(`El correo "${cleanEmail}" ya está registrado en la base de datos de Firestore.`);
        setIsSubmitting(false);
        return;
      }

      // 2. Proactively check if license already exists in Firestore
      const existingLicense = await findPsychologistByLicense(cleanLicense);
      if (existingLicense) {
        setModalError(`La Tarjeta Profesional "${cleanLicense}" ya está registrada por otro profesional en Firestore.`);
        setIsSubmitting(false);
        return;
      }

      // 3. Create document in Firestore
      const generatedUid = `psych-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newPsychProfile: PsychologistAuthUser = {
        uid: generatedUid,
        email: cleanEmail,
        displayName: newFullName.trim(),
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newFullName.trim())}`,
        provider: 'email',
        role: newRole,
        license: cleanLicense,
        specialty: newSpecialty,
        institution: newInstitution,
        phone: newPhone.trim(),
        termsAccepted: true,
        profileCompleted: true,
        isAdmin: false,
        permissions: {
          lectura: true,
          escritura: true,
          administrativo: false,
        },
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      };

      await savePsychologistProfile(newPsychProfile);
      setModalSuccess(`¡Especialista ${newFullName.trim()} registrado exitosamente en Firestore!`);
      setTimeout(() => {
        setShowAddModal(false);
        setNewFullName('');
        setNewEmail('');
        setNewLicense('');
        setNewPhone('');
        setModalSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error('Error al registrar psicólogo en Firestore:', err);
      setModalError(err?.message || 'Error al persistir el registro en Firestore.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If unauthenticated: Show protected route gate
  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="p-8 rounded-3xl bg-slate-900 border border-amber-500/30 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-bold">
              <span>🔒 ÁREA CLÍNICA PROTEGIDA</span>
            </div>

            <h2 className="text-2xl font-bold text-white">
              Directorio y Guardia del Cuerpo de Psicólogos
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Esta sección contiene información profesional, roles clínicos, asignaciones de guardia y expedientes de los especialistas del Distrito. Debes identificarte con tu cuenta autorizada.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="px-6 py-3 rounded-xl bg-[#00E5FF] hover:bg-[#00D2F4] text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Iniciar Sesión como Psicólogo</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('registro')}
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-sm border border-slate-700 hover:border-emerald-500/50 flex items-center gap-2 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Registrar Tarjeta Profesional</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('inicio')}
              className="px-4 py-3 rounded-xl bg-slate-900 text-slate-400 hover:text-white flex items-center gap-2 text-xs transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retroceder a Inicio</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter list
  const filteredPsychologists = allPsychologists.filter((psych) => {
    const matchesSearch = 
      psych.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (psych.license && psych.license.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (psych.specialty && psych.specialty.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (psych.email && psych.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = selectedRoleFilter === 'ALL' || psych.role === selectedRoleFilter;

    let matchesApproval = true;
    if (approvalFilter === 'PENDING') {
      matchesApproval = !psych.isAdmin && psych.email !== 'kailabwasd@gmail.com' && (psych.approvalStatus === 'PENDING' || psych.isApproved === false);
    } else if (approvalFilter === 'APPROVED') {
      matchesApproval = psych.isAdmin || psych.email === 'kailabwasd@gmail.com' || psych.approvalStatus === 'APPROVED' || psych.isApproved === true;
    } else if (approvalFilter === 'REJECTED') {
      matchesApproval = psych.approvalStatus === 'REJECTED';
    }

    return matchesSearch && matchesRole && matchesApproval;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Cabecera del Directorio */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs">
              <Lock className="w-3 h-3 text-cyan-400" />
              <span>Cuerpo Profesional Habilitado · Subred Integrada Norte</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-cyan-400" />
              <span>Directorio Oficial de Psicólogos y Guardia Activa</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              Cuerpo clínico habilitado ante la Secretaría Distrital de Salud y Subred Norte para atención psicológica 24/7 y tele-triage vía WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setModalError(null);
                setModalSuccess(null);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Registrar Especialista en Firestore</span>
            </button>

            {isAdmin && onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Settings className="w-4 h-4 text-amber-400" />
                <span>Asignar Roles y Permisos</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate('triage')}
              className="px-4 py-2 rounded-xl bg-[#00E5FF] hover:bg-[#00D2F4] text-slate-950 text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <UserCheck className="w-4 h-4" />
              <span>Ir a Guardia de Triage</span>
            </button>
          </div>
        </div>

        {/* Database Metric Counters & Live Sync Status */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Total en Firestore</p>
              <p className="text-base font-bold text-white">{allPsychologists.length}</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">ReTHUS Oficial</p>
              <p className="text-base font-bold text-emerald-300">
                {allPsychologists.filter(p => Boolean(p.license && p.license.trim().length >= 4)).length}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">En Guardia Activa</p>
              <p className="text-base font-bold text-blue-300">{allPsychologists.length}</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2BF267]/15 text-[#2BF267] flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2BF267] animate-pulse" />
                <p className="text-[10px] text-[#2BF267] font-bold uppercase truncate">Firestore Live</p>
              </div>
              <p className="text-[11px] font-mono text-slate-300">/psychologists</p>
            </div>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-800">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por nombre, tarjeta profesional (ReTHUS), especialidad o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-750 focus:border-cyan-400 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none transition"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-750 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">Todos los Roles Clínicos</option>
              <option value="Psicólogo(a) Clínico(a) Titulado(a)">Psicólogo(a) Clínico(a) Titulado(a)</option>
              <option value="Terapeuta de Guardia y Crisis 24/7">Terapeuta de Guardia y Crisis 24/7</option>
              <option value="Supervisor(a) de Triage e Interconsulta">Supervisor(a) de Triage e Interconsulta</option>
              <option value="Administrador(a) Clínico y de Auditoría">Administrador(a) Clínico y de Auditoría</option>
            </select>
          </div>
        </div>
        {/* Filtros de Autorización */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setApprovalFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                approvalFilter === 'ALL'
                  ? 'bg-[#00E5FF] text-slate-950 shadow font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>Todos ({allPsychologists.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setApprovalFilter('PENDING')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                approvalFilter === 'PENDING'
                  ? 'bg-amber-400 text-slate-950 shadow font-bold'
                  : 'bg-slate-950 text-amber-300 hover:text-amber-200 border border-amber-500/30'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pendientes ({allPsychologists.filter(p => !p.isAdmin && p.email !== 'kailabwasd@gmail.com' && (p.approvalStatus === 'PENDING' || p.isApproved === false)).length})</span>
            </button>

            <button
              type="button"
              onClick={() => setApprovalFilter('APPROVED')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                approvalFilter === 'APPROVED'
                  ? 'bg-emerald-400 text-slate-950 shadow font-bold'
                  : 'bg-slate-950 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Autorizados ({allPsychologists.filter(p => p.isAdmin || p.email === 'kailabwasd@gmail.com' || p.approvalStatus === 'APPROVED' || p.isApproved === true).length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Psicólogos Registrados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPsychologists.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
            <Users className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No se encontraron psicólogos con ese filtro</h3>
            <p className="text-xs text-slate-400">Prueba con otro término de búsqueda o limpia los filtros.</p>
          </div>
        ) : (
          filteredPsychologists.map((psych) => {
            const isMe = Boolean(currentUser && psych.uid === currentUser.uid);
            const isProtectedAdmin = psych.isAdmin || psych.email === 'kailabwasd@gmail.com';
            const isApproved = isProtectedAdmin || psych.approvalStatus === 'APPROVED' || psych.isApproved === true;
            const isPending = !isProtectedAdmin && (psych.approvalStatus === 'PENDING' || psych.isApproved === false);
            const isRejected = !isProtectedAdmin && psych.approvalStatus === 'REJECTED';

            const perms = psych.permissions || {
              lectura: isApproved,
              escritura: isApproved,
              administrativo: Boolean(psych.isAdmin),
            };

            return (
              <div 
                key={psych.uid}
                className={`p-5 rounded-2xl bg-slate-900 border transition hover:shadow-xl space-y-3.5 relative ${
                  isPending 
                    ? 'border-amber-500/50 bg-amber-950/10 ring-1 ring-amber-500/30' 
                    : isRejected
                    ? 'border-red-500/40 bg-red-950/10'
                    : isMe 
                    ? 'border-cyan-500/50 ring-1 ring-cyan-500/30' 
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header card: foto, nombre, rol, estado de autorización */}
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={psych.photoURL}
                      alt={psych.displayName}
                      className="w-13 h-13 rounded-2xl object-cover ring-2 ring-slate-700"
                    />
                    <span 
                      className={`w-3.5 h-3.5 rounded-full absolute -bottom-1 -right-1 ring-2 ring-slate-900 ${
                        isApproved ? 'bg-emerald-400 animate-pulse' : isRejected ? 'bg-red-500' : 'bg-amber-400 animate-ping'
                      }`} 
                      title={isApproved ? 'Acceso Autorizado' : isRejected ? 'Acceso Denegado' : 'Pendiente de Autorización'}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-bold text-white truncate">
                        {psych.displayName}
                      </h3>
                      {isMe && (
                        <span className="text-[9px] bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.2 rounded border border-cyan-500/40">
                          Tú
                        </span>
                      )}
                      {isProtectedAdmin && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/40">
                          👑 Admin
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-cyan-300 font-medium truncate">
                      {psych.role || 'Psicólogo Clínico'}
                    </p>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                      <Award className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="truncate">ReTHUS: {psych.license || 'En trámite'}</span>
                    </div>
                  </div>
                </div>

                {/* Badge de Estado de Autorización */}
                <div className="pt-1">
                  {isApproved ? (
                    <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Acceso Web Autorizado</span>
                    </div>
                  ) : isRejected ? (
                    <div className="px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      <span>Acceso Web Suspendido</span>
                    </div>
                  ) : (
                    <div className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center justify-between gap-1.5 animate-pulse">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pendiente de Autorización por Admin</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ficha de Información Completa del Especialista */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[10px] truncate">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{psych.email || 'Sin correo registrado'}</span>
                  </div>

                  {psych.phone && (
                    <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[10px] truncate">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{psych.phone}</span>
                    </div>
                  )}

                  <p className="text-slate-300 truncate text-[10px]">
                    <strong className="text-slate-400">Especialidad:</strong> {psych.specialty || 'Salud Mental y Triage'}
                  </p>
                  <p className="text-slate-400 truncate text-[10px]">
                    <strong className="text-slate-500">Institución:</strong> {psych.institution || 'Subred Norte E.S.E.'}
                  </p>

                  <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-850 font-mono">
                    <span>Vía {psych.provider || 'Google OAuth'}</span>
                    <span>UID: {psych.uid.slice(0, 10)}...</span>
                  </div>
                </div>

                {/* Permisos Asignados */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Permisos Clínicos:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <div className={`p-1 rounded-lg border text-center font-semibold flex items-center justify-center gap-1 ${
                      perms.lectura ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' : 'bg-slate-950 text-slate-600 line-through'
                    }`}>
                      <BookOpen className="w-2.5 h-2.5" /> Lectura
                    </div>
                    <div className={`p-1 rounded-lg border text-center font-semibold flex items-center justify-center gap-1 ${
                      perms.escritura ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-slate-950 text-slate-600 line-through'
                    }`}>
                      <FileEdit className="w-2.5 h-2.5" /> Escritura
                    </div>
                    <div className={`p-1 rounded-lg border text-center font-semibold flex items-center justify-center gap-1 ${
                      perms.administrativo ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-slate-950 text-slate-600 line-through'
                    }`}>
                      <ShieldAlert className="w-2.5 h-2.5" /> Admin
                    </div>
                  </div>
                </div>

                {/* Acciones de Administrador o Navegación */}
                {isAdmin && isPending ? (
                  <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={actionLoadingUid === psych.uid}
                      onClick={() => handleQuickApprove(psych)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${actionLoadingUid === psych.uid ? 'animate-spin' : ''}`} />
                      <span>{actionLoadingUid === psych.uid ? 'Autorizando...' : 'Autorizar Acceso Web'}</span>
                    </button>

                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                        title="Abrir en Portal de Administradores"
                      >
                        <Settings className="w-3.5 h-3.5 text-amber-400" />
                        <span>Detalles</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>{isApproved ? 'Habilitado' : 'No Habilitado'}</span>
                    </span>

                    {isAdmin && onOpenSettings ? (
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="text-amber-300 hover:text-white font-bold flex items-center gap-1 transition text-[11px] cursor-pointer"
                      >
                        <Settings className="w-3 h-3 text-amber-400" />
                        <span>Gestionar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onNavigate('triage')}
                        className="text-cyan-300 hover:text-white font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <span>Ver Guardia</span>
                        <span>→</span>
                      </button>
                    )}
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL REGISTRAR NUEVO ESPECIALISTA EN FIRESTORE                          */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Registrar Especialista en Firestore</h3>
                  <p className="text-[11px] text-slate-400">Habilitación Sanitaria Oficial SubaTECH</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-[#FF3646]/50 text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-[#FF3646] shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterNewPsychologist} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nombre y Apellidos del Especialista</label>
                <input
                  type="text"
                  required
                  placeholder="Lic. Nombre y Apellidos"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-750 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    placeholder="psicologo@subatech.salud o @gmail.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tarjeta Profesional (ReTHUS)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. TP-1092834 / COLPSIC"
                    value={newLicense}
                    onChange={(e) => setNewLicense(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    required
                    placeholder="+57 300 000 0000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rol Clínico</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="Psicólogo(a) Clínico Titulado(a)">Psicólogo(a) Clínico Titulado(a)</option>
                    <option value="Terapeuta de Guardia y Crisis 24/7">Terapeuta de Guardia y Crisis 24/7</option>
                    <option value="Supervisor(a) de Triage e Interconsulta">Supervisor(a) de Triage e Interconsulta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Especialidad Clínica</label>
                <input
                  type="text"
                  required
                  placeholder="Atención Psicológica y Triage de Crisis"
                  value={newSpecialty}
                  onChange={(e) => setNewSpecialty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-750 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Institución / Centro de Salud</label>
                <input
                  type="text"
                  required
                  value={newInstitution}
                  onChange={(e) => setNewInstitution(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-750 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 flex items-center gap-1.5 shadow transition disabled:opacity-50 cursor-pointer"
                >
                  <Database className="w-4 h-4" />
                  <span>{isSubmitting ? 'Guardando en Firestore...' : 'Guardar en Firestore'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
