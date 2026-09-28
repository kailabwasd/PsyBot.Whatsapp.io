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
  Settings
} from 'lucide-react';
import type { PsychologistAuthUser } from '../types/index.ts';
import { SubaTechLogo } from './SubaTechLogo.tsx';

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

  const isAuthenticated = Boolean(currentUser && currentUser.profileCompleted);
  const isAdmin = Boolean(currentUser?.isAdmin || currentUser?.email === 'kailabwasd@gmail.com');

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

    return matchesSearch && matchesRole;
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
            const perms = psych.permissions || {
              lectura: true,
              escritura: true,
              administrativo: Boolean(psych.isAdmin),
            };

            return (
              <div 
                key={psych.uid}
                className={`p-5 rounded-2xl bg-slate-900 border transition hover:shadow-xl space-y-4 relative ${
                  isMe ? 'border-cyan-500/50 ring-1 ring-cyan-500/30' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header card: foto, nombre, rol */}
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <img
                      src={psych.photoURL}
                      alt={psych.displayName}
                      className="w-13 h-13 rounded-2xl object-cover ring-2 ring-slate-700"
                    />
                    <span 
                      className="w-3.5 h-3.5 rounded-full bg-emerald-400 absolute -bottom-1 -right-1 ring-2 ring-slate-900 animate-pulse" 
                      title="En Guardia / Disponible"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-bold text-white truncate">
                        {psych.displayName}
                      </h3>
                      {isMe && (
                        <span className="text-[9px] bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.2 rounded border border-cyan-500/40">
                          Tú
                        </span>
                      )}
                      {psych.isAdmin && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/40">
                          👑 Admin
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-cyan-300 font-medium truncate mt-0.5">
                      {psych.role || 'Psicólogo Clínico'}
                    </p>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-1">
                      <Award className="w-3 h-3 text-cyan-400" />
                      <span>{psych.license || 'ReTHUS en trámite'}</span>
                    </div>
                  </div>
                </div>

                {/* Especialidad & Institución */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                  <p className="text-slate-300 truncate">
                    <strong>Especialidad:</strong> {psych.specialty || 'Salud Mental y Triage'}
                  </p>
                  <p className="text-slate-400 truncate">
                    <strong>Institución:</strong> {psych.institution || 'Subred Norte E.S.E.'}
                  </p>
                </div>

                {/* Permisos Asignados */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Permisos Clínicos Activos:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <div className={`p-1.5 rounded-lg border text-center font-semibold flex items-center justify-center gap-1 ${
                      perms.lectura ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' : 'bg-slate-950 text-slate-600 line-through'
                    }`}>
                      <BookOpen className="w-2.5 h-2.5" /> Lectura
                    </div>
                    <div className={`p-1.5 rounded-lg border text-center font-semibold flex items-center justify-center gap-1 ${
                      perms.escritura ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-slate-950 text-slate-600 line-through'
                    }`}>
                      <FileEdit className="w-2.5 h-2.5" /> Escritura
                    </div>
                    <div className={`p-1.5 rounded-lg border text-center font-semibold flex items-center justify-center gap-1 ${
                      perms.administrativo ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-slate-950 text-slate-600 line-through'
                    }`}>
                      <ShieldAlert className="w-2.5 h-2.5" /> Admin
                    </div>
                  </div>
                </div>

                {/* Footer de la tarjeta */}
                <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 font-mono text-[10px]">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>Guardia Activa</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => onNavigate('triage')}
                    className="text-cyan-300 hover:text-white font-bold flex items-center gap-1 transition"
                  >
                    <span>Ver Guardia</span>
                    <span>→</span>
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
