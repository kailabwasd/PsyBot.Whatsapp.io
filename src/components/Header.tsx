import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck,
  UserCheck, 
  Activity, 
  LogOut, 
  Award, 
  Edit3, 
  ChevronDown,
  PhoneCall,
  ExternalLink,
  Settings,
  Bell,
  Volume2,
  VolumeX,
  Sparkles
} from 'lucide-react';
import type { PsychologistAuthUser } from '../types/index.ts';
import { SubaTechLogo } from './SubaTechLogo.tsx';

interface HeaderProps {
  currentUser: PsychologistAuthUser;
  onEditProfile: () => void;
  onOpenSettings: () => void;
  onOpenAccessibility?: () => void;
  waitingCount: number;
  crisisCount: number;
  activeCount: number;
  onLogout: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  browserPermission?: NotificationPermission;
  onRequestPermission?: () => void;
  onTestNotification?: () => void;
  pendingApprovalsCount?: number;
  onOpenAdminPortal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onEditProfile,
  onOpenSettings,
  onOpenAccessibility,
  waitingCount,
  crisisCount,
  activeCount,
  onLogout,
  soundEnabled = true,
  onToggleSound,
  browserPermission = 'default',
  onRequestPermission,
  onTestNotification,
  pendingApprovalsCount = 0,
  onOpenAdminPortal,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isAdmin = Boolean(currentUser.isAdmin || currentUser.email === 'kailabwasd@gmail.com' || currentUser.email === 'leandro.menendez1192@gmail.com');

  return (
    <header className="w-full shadow-sm text-xs">
      {/* 1. Barra GOV.CO (Slim Mini) */}
      <div className="bg-[#004884] text-white text-[10px] font-medium border-b border-[#003866]">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 h-5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <a 
              href="https://www.gov.co" 
              target="_blank" 
              rel="noreferrer"
              className="font-black tracking-wider text-[10px] hover:text-amber-200 transition flex items-center gap-1"
            >
              <span>GOV.CO</span>
              <span className="w-1 h-1 rounded-full bg-[#FFC800]"></span>
            </a>
            <span className="text-[#6699CC]">|</span>
            <span className="hidden sm:inline text-slate-200 text-[10px]">
              Bogotá D.C. · Salud
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[10px]">
            <a 
              href="https://drive.google.com/drive/folders/1VeROKtR3yWXn2X8Hkx_AwZIMO0jS-xmu?usp=drive_link" 
              target="_blank" 
              rel="noreferrer" 
              className="hover:underline text-cyan-200 hover:text-white flex items-center gap-1 font-medium"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              <span>Drive</span>
            </a>
            <span className="text-[#6699CC]">|</span>
            <div className="hidden md:flex items-center gap-1 text-amber-300 font-semibold">
              <PhoneCall className="w-2.5 h-2.5" />
              <span>Línea 106</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Barra Principal Slim */}
      <div className="bg-[#0B2545] border-b border-slate-800 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-1">
          <div className="flex items-center justify-between gap-2">
            
            {/* Marca (Mini) */}
            <div className="flex items-center gap-2 min-w-0">
              <SubaTechLogo size="sm" />
              <span className="hidden sm:inline text-[11px] font-bold text-slate-200 tracking-wide border-l border-slate-700/80 pl-2">
                Teleorientación 24/7
              </span>
            </div>

            {/* Indicadores Clínicos (Slim) */}
            <div className="hidden lg:flex items-center space-x-1.5 text-[10px]">
              {crisisCount > 0 && (
                <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#C8102E] text-white font-bold animate-pulse">
                  <ShieldAlert className="w-3 h-3" />
                  <span>{crisisCount} Crisis</span>
                </div>
              )}

              <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-900/80 border border-slate-750 text-slate-300">
                <Activity className="w-3 h-3 text-amber-400" />
                <span>Espera:</span>
                <span className="font-bold text-amber-300 font-mono">{waitingCount}</span>
              </div>

              <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-900/80 border border-slate-750 text-slate-300">
                <UserCheck className="w-3 h-3 text-cyan-400" />
                <span>Mis Casos:</span>
                <span className="font-bold text-white font-mono">{activeCount}</span>
              </div>
            </div>

            {/* Controles y Perfil */}
            <div className="flex items-center space-x-1.5 shrink-0">
              
              {/* Botón Accesibilidad */}
              {onOpenAccessibility && (
                <button
                  type="button"
                  onClick={onOpenAccessibility}
                  className="p-1 sm:px-2 sm:py-1 rounded bg-slate-900/80 hover:bg-cyan-950/60 border border-slate-700 text-cyan-300 hover:text-white transition flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
                  title="Accesibilidad"
                >
                  <svg className="w-3 h-3 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="4.5" r="2.5"/>
                    <path d="M10 9h4l2 5h-3"/>
                    <path d="M7.5 13.5a5.5 5.5 0 1 0 7.2 4.7"/>
                    <path d="m11 9-1.5 5.5"/>
                  </svg>
                  <span className="hidden md:inline">Accesibilidad</span>
                </button>
              )}

              {/* Sound toggle */}
              {onToggleSound && (
                <button
                  type="button"
                  onClick={onToggleSound}
                  className={`p-1 sm:px-2 sm:py-1 rounded border transition flex items-center gap-1 text-[10px] font-semibold ${
                    soundEnabled
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-750'
                  }`}
                  title={soundEnabled ? 'Sonido activado' : 'Silenciado'}
                >
                  {soundEnabled ? <Volume2 className="w-3 h-3 text-emerald-400" /> : <VolumeX className="w-3 h-3 text-slate-500" />}
                  <span className="hidden xl:inline">{soundEnabled ? 'Audio' : 'Mute'}</span>
                </button>
              )}

              {/* Botón Portal de Administradores (Only for Admins) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdminPortal || onOpenSettings}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    pendingApprovalsCount > 0
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300 shadow-md shadow-amber-400/25 animate-pulse'
                      : 'bg-slate-900/90 hover:bg-slate-800 text-amber-300 border-amber-500/40'
                  }`}
                  title="Portal de Administradores - Autorizar psicólogos y controlar accesos"
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${pendingApprovalsCount > 0 ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span className="hidden sm:inline">Portal Admin</span>
                  {pendingApprovalsCount > 0 ? (
                    <span className="px-1.5 py-0.2 bg-slate-950 text-amber-300 rounded-full font-mono text-[9px] font-black border border-amber-300">
                      ⚠️ {pendingApprovalsCount}
                    </span>
                  ) : null}
                </button>
              )}

              {/* Perfil dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-1.5 px-2 py-0.5 rounded-lg border border-slate-300 hover:border-slate-400 transition bg-white text-slate-900 cursor-pointer shadow-sm"
                >
                  <img
                    src={currentUser.photoURL || 'https://images.unsplash.com/photo-1594824813576-a05e263d9061?w=150&auto=format&fit=crop&q=80'}
                    alt={currentUser.displayName}
                    className="w-5 h-5 rounded object-cover ring-1 ring-slate-200"
                  />
                  <div className="text-left hidden sm:block max-w-[110px]">
                    <div className="text-[10px] font-bold leading-tight truncate">
                      {currentUser.displayName}
                    </div>
                  </div>
                  <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-50 text-slate-800 text-xs">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 mb-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={currentUser.photoURL || 'https://images.unsplash.com/photo-1594824813576-a05e263d9061?w=150&auto=format&fit=crop&q=80'}
                          alt={currentUser.displayName}
                          className="w-8 h-8 rounded object-cover ring-1 ring-slate-200"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-900 text-[11px] truncate">{currentUser.displayName}</h4>
                          <p className="text-[9px] text-slate-500 truncate">{currentUser.email || 'Psicólogo(a) Guardia'}</p>
                          {isAdmin && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 font-bold rounded text-[9px] border border-amber-200">
                              👑 Administrador Clínico
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      {isAdmin && (
                        <button
                          onClick={() => { setDropdownOpen(false); onOpenAdminPortal ? onOpenAdminPortal() : onOpenSettings(); }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold flex items-center justify-between text-[11px] transition border border-amber-200"
                        >
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>Portal Administrador</span>
                          </div>
                          {pendingApprovalsCount > 0 && (
                            <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 rounded-full font-mono text-[9px] font-black animate-pulse">
                              {pendingApprovalsCount} por autorizar
                            </span>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => { setDropdownOpen(false); onEditProfile(); }}
                        className="w-full text-left px-2.5 py-1 rounded hover:bg-slate-100 flex items-center gap-1.5 font-medium text-slate-700 transition"
                      >
                        <Edit3 className="w-3 h-3 text-blue-600" />
                        <span>Editar Credenciales</span>
                      </button>

                      <button
                        onClick={() => { setDropdownOpen(false); onOpenSettings(); }}
                        className="w-full text-left px-2.5 py-1 rounded hover:bg-slate-100 flex items-center gap-1.5 font-medium text-slate-700 transition"
                      >
                        <Settings className="w-3 h-3 text-slate-600" />
                        <span>Configuración / Auditoría</span>
                      </button>

                      <div className="border-t border-slate-200 my-1 pt-1">
                        <button
                          onClick={() => { setDropdownOpen(false); onLogout(); }}
                          className="w-full text-left px-2.5 py-1 rounded hover:bg-red-50 flex items-center gap-1.5 font-bold text-red-600 transition"
                        >
                          <LogOut className="w-3 h-3 text-red-500" />
                          <span>Cerrar Sesión</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
