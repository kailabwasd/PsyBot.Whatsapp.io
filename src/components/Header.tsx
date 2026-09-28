import React, { useState } from 'react';
import { 
  ShieldAlert, 
  UserCheck, 
  Activity, 
  Radio, 
  LogOut, 
  ShieldCheck, 
  Award, 
  Edit3, 
  Building2,
  ChevronDown,
  PhoneCall,
  ExternalLink,
  HeartPulse,
  Settings,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Sparkles
} from 'lucide-react';
import type { PsychologistAuthUser } from '../types/index.ts';
import { BogotaCrest } from './BogotaCrest.tsx';
import { SubaTechLogo } from './SubaTechLogo.tsx';

interface HeaderProps {
  currentUser: PsychologistAuthUser;
  onEditProfile: () => void;
  onOpenSettings: () => void;
  waitingCount: number;
  crisisCount: number;
  activeCount: number;
  onLogout: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  browserPermission?: NotificationPermission;
  onRequestPermission?: () => void;
  onTestNotification?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onEditProfile,
  onOpenSettings,
  waitingCount,
  crisisCount,
  activeCount,
  onLogout,
  soundEnabled = true,
  onToggleSound,
  browserPermission = 'default',
  onRequestPermission,
  onTestNotification,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      {/* 1. Barra Superior Institucional GOV.CO (Estilo Oficial Colombia & Bogotá.gov.co) */}
      <div className="bg-[#004884] text-white text-[11px] font-medium border-b border-[#003866]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Logo GOV.CO */}
            <a 
              href="https://www.gov.co" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1 font-black tracking-wider text-xs hover:text-amber-200 transition"
              title="Portal Único del Estado Colombiano"
            >
              <span>GOV.CO</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFC800]"></span>
            </a>

            <span className="text-[#6699CC] hidden sm:inline">|</span>

            <span className="hidden sm:inline text-slate-200 font-normal">
              Portal Oficial de la Alcaldía Mayor de Bogotá D.C.
            </span>
          </div>

          <div className="flex items-center space-x-4 text-[11px]">
            <a 
              href="https://drive.google.com/drive/folders/1VeROKtR3yWXn2X8Hkx_AwZIMO0jS-xmu?usp=drive_link" 
              target="_blank" 
              rel="noreferrer" 
              className="hover:underline flex items-center gap-1 text-cyan-200 hover:text-white font-semibold"
              title="Abrir carpeta compartida del proyecto en Google Drive"
            >
              <ExternalLink className="w-3 h-3 text-cyan-300" />
              <span>Google Drive del Proyecto</span>
            </a>
            <span className="text-[#6699CC] hidden sm:inline">|</span>
            <a 
              href="https://bogota.gov.co" 
              target="_blank" 
              rel="noreferrer" 
              className="hover:underline flex items-center gap-1 text-slate-200 hover:text-white"
            >
              <span>bogota.gov.co</span>
              <ExternalLink className="w-3 h-3 text-slate-300" />
            </a>
            <span className="text-[#6699CC] hidden md:inline">|</span>
            <div className="hidden md:flex items-center gap-2 text-amber-300 font-semibold">
              <PhoneCall className="w-3 h-3" />
              <span>Línea 106 de Ayuda Emocional</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Barra Principal de Identidad con Psybot y SubaTech */}
      <div className="bg-[#0B2545] border-b border-slate-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            
            {/* Marca Psybot & SubaTech */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <SubaTechLogo size="md" />
              
              <div className="hidden sm:flex flex-col border-l border-slate-700 pl-4 min-w-0">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Sistema de Teleorientación & Triage Clínico 24/7
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Subred Integrada de Salud Norte — Suba E.S.E.
                </span>
              </div>
            </div>

            {/* SubaTech Co-branding & Indicadores Rápidos */}
            <div className="hidden lg:flex items-center space-x-3 text-xs">
              <button
                onClick={() => {
                  const navBtn = document.querySelector('[data-tab="INTEGRATION"]') as HTMLButtonElement;
                  if (navBtn) navBtn.click();
                }}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 transition font-medium"
                title="Abrir panel de integración WhatsApp Twilio 24/7"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                <span className="text-slate-600">WhatsApp Suba:</span>
                <span className="font-mono font-bold text-slate-900">+1 415 523 8886</span>
              </button>

              {crisisCount > 0 && (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#C8102E] text-white font-bold shadow-sm animate-pulse">
                  <ShieldAlert className="w-4 h-4" />
                  <span>{crisisCount} En Crisis</span>
                </div>
              )}

              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                <Activity className="w-3.5 h-3.5 text-amber-600" />
                <span>Espera Triage:</span>
                <span className="font-bold bg-amber-500/20 text-amber-800 px-1.5 py-0.2 rounded">{waitingCount}</span>
              </div>

              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Mis Casos:</span>
                <span className="font-bold text-slate-900">{activeCount}</span>
              </div>
            </div>

            {/* Perfil del Profesional Autenticado y Controles de Notificaciones */}
            <div className="flex items-center space-x-2.5 shrink-0">
              
              {/* Sound toggle button */}
              {onToggleSound && (
                <button
                  type="button"
                  onClick={onToggleSound}
                  className={`p-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold ${
                    soundEnabled
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/50'
                      : 'bg-slate-900 text-slate-400 border-slate-750 hover:bg-slate-850'
                  }`}
                  title={soundEnabled ? 'Sonido de alertas activado' : 'Sonido silenciado'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                  <span className="hidden md:inline">{soundEnabled ? 'Audio ON' : 'Audio OFF'}</span>
                </button>
              )}

              {/* Browser notification permission request button */}
              {browserPermission !== 'granted' && onRequestPermission && (
                <button
                  type="button"
                  onClick={onRequestPermission}
                  className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50 text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Activar notificaciones en el navegador para nuevos pacientes"
                >
                  <Bell className="w-4 h-4 text-cyan-400 animate-bounce" />
                  <span className="hidden md:inline">Activar Alertas</span>
                </button>
              )}

              {/* Test Notification Button */}
              {onTestNotification && (
                <button
                  type="button"
                  onClick={onTestNotification}
                  className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 text-xs transition"
                  title="Probar sonido y notificación de alerta"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Probar</span>
                </button>
              )}

              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-xl border transition shadow-sm bg-white hover:bg-slate-50 ${
                    currentUser.isAdmin || currentUser.email === 'kailabwasd@gmail.com'
                      ? 'border-amber-400 ring-2 ring-amber-300/40'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <img
                    src={currentUser.photoURL || 'https://images.unsplash.com/photo-1594824813576-a05e263d9061?w=150&auto=format&fit=crop&q=80'}
                    alt={currentUser.displayName}
                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                  <div className="text-left hidden sm:block max-w-[150px]">
                    <div className="text-xs font-bold text-slate-900 leading-tight truncate flex items-center gap-1">
                      <span>{currentUser.displayName}</span>
                      {(currentUser.isAdmin || currentUser.email === 'kailabwasd@gmail.com') && (
                        <span className="text-[10px]" title="Super Administrador">👑</span>
                      )}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-mono leading-tight truncate flex items-center gap-1 font-semibold">
                      <Award className="w-2.5 h-2.5 shrink-0 text-amber-600" />
                      <span>{currentUser.license || 'Colpsic / Minsalud'}</span>
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
                </button>

                {dropdownOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-800"
                  >
                    {/* Tarjeta de identificación sanitaria */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-2.5">
                      <div className="flex items-start gap-3">
                        <img
                          src={currentUser.photoURL || 'https://images.unsplash.com/photo-1594824813576-a05e263d9061?w=150&auto=format&fit=crop&q=80'}
                          alt={currentUser.displayName}
                          className="w-11 h-11 rounded-lg object-cover ring-1 ring-slate-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-black text-slate-900 truncate">{currentUser.displayName}</p>
                            {(currentUser.isAdmin || currentUser.email === 'kailabwasd@gmail.com') && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">{currentUser.email || 'profesional@bogota.gov.co'}</p>
                          
                          {/* Registro sanitario */}
                          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#004884] font-mono text-[10px] font-bold">
                            <Award className="w-3 h-3 text-amber-600" />
                            <span>{currentUser.license}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-200 text-[11px] space-y-1 text-slate-600">
                        <p><strong className="text-slate-800">Rol:</strong> {currentUser.role}</p>
                        <p><strong className="text-slate-800">Especialidad:</strong> {currentUser.specialty}</p>
                        {currentUser.institution && (
                          <p className="flex items-center gap-1 text-slate-700 truncate">
                            <Building2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            <span className="truncate">{currentUser.institution}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="space-y-1">
                      <a
                        href="https://drive.google.com/drive/folders/1VeROKtR3yWXn2X8Hkx_AwZIMO0jS-xmu?usp=drive_link"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 px-3 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Carpeta Google Drive Oficial</span>
                        </div>
                        <span className="text-[10px] bg-white text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                          Drive
                        </span>
                      </a>

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onOpenSettings();
                        }}
                        className="w-full py-2 px-3 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Settings className="w-3.5 h-3.5 text-slate-700" />
                          <span>Configuración General</span>
                        </div>
                        <span className="text-[10px] bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-300">
                          Panel
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onEditProfile();
                        }}
                        className="w-full py-2 px-3 rounded-lg text-xs font-bold text-[#004884] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Edit3 className="w-3.5 h-3.5 text-[#004884]" />
                          <span>Modificar Perfil y Registro</span>
                        </div>
                        <span className="text-[10px] bg-white text-[#004884] px-2 py-0.5 rounded border border-blue-200">
                          Editar
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-[#C8102E] hover:bg-red-50 transition flex items-center justify-center gap-2 border border-transparent hover:border-red-200"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Cerrar Sesión Segura</span>
                      </button>
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
