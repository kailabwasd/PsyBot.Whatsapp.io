import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  LogOut, 
  Award, 
  Mail, 
  Phone, 
  Building2, 
  CheckCircle2, 
  FileText,
  UserCheck,
  Calendar,
  Sparkles
} from 'lucide-react';
import type { PsychologistAuthUser } from '../types/index.ts';
import { getPsychologistFromFirestore } from '../lib/firebase.ts';
import { SubaTechLogo } from './SubaTechLogo.tsx';
import { BogotaCrest } from './BogotaCrest.tsx';

interface PendingApprovalScreenProps {
  user: PsychologistAuthUser;
  onLogout: () => void;
  onApproved: (updatedUser: PsychologistAuthUser) => void;
}

export const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({
  user,
  onLogout,
  onApproved,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  // Re-check function: queries Firestore for current approval state
  const handleRecheckStatus = async (silent = false) => {
    if (!silent) setIsChecking(true);
    try {
      const fresh = await getPsychologistFromFirestore(user.uid);
      if (fresh) {
        if (fresh.isApproved || fresh.approvalStatus === 'APPROVED') {
          setCheckMessage('¡Tu cuenta ha sido autorizada por el Administrador! Redirigiendo al panel clínico...');
          setTimeout(() => {
            onApproved(fresh);
          }, 800);
          return;
        } else if (fresh.approvalStatus === 'REJECTED') {
          setCheckMessage(`Tu solicitud fue denegada o suspendida: ${fresh.rejectionReason || 'Contacta a la Dirección Clínica.'}`);
        } else if (!silent) {
          setCheckMessage('Tu solicitud sigue en estado "Pendiente de Autorización". El Administrador Clínico revisará tu expediente en el Portal de Administradores.');
        }
      }
    } catch (e: any) {
      if (!silent) {
        setCheckMessage('Error de conexión al consultar Firestore.');
      }
    } finally {
      if (!silent) setIsChecking(false);
    }
  };

  // Automatic real-time polling every 4 seconds to detect when admin approves
  useEffect(() => {
    const timer = setInterval(() => {
      handleRecheckStatus(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [user.uid]);

  const isRejected = user.approvalStatus === 'REJECTED';

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans">
      
      {/* Top Bar Institucional */}
      <div className="bg-[#004884] text-white text-[11px] py-1.5 px-4 border-b border-[#003866] shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#FFC800] uppercase tracking-wider">GOV.CO</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-200">Alcaldía Mayor de Bogotá D.C. · Secretaría Distrital de Salud</span>
          </div>
          <span className="text-[10px] text-cyan-200 font-mono">Control de Habilitación Sanitaria</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex-1 flex flex-col justify-center">
        <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          
          <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Header con Escudo y Logo */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <BogotaCrest className="w-10 h-10" />
              <div>
                <h1 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>Subred Integrada Norte E.S.E.</span>
                </h1>
                <p className="text-[11px] text-slate-400">Portal de Acceso Clínico y Triage Psicológico</p>
              </div>
            </div>
            <SubaTechLogo className="h-8" />
          </div>

          {/* Status Badge & Icon */}
          <div className="text-center space-y-3 pt-2">
            <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border shadow-lg ${
              isRejected 
                ? 'bg-red-500/15 text-[#FF3646] border-red-500/30' 
                : 'bg-amber-500/15 text-amber-400 border-amber-500/40 animate-pulse'
            }`}>
              {isRejected ? <AlertCircle className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] font-bold">
                {isRejected ? (
                  <span className="text-red-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    ACCESO DENEGADO O SUSPENDIDO
                  </span>
                ) : (
                  <span className="text-amber-300 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    SOLICITUD PENDIENTE DE AUTORIZACIÓN POR ADMINISTRACIÓN
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white mt-2">
                {isRejected ? 'Acceso No Autorizado' : 'Autorización Clínica en Trámite'}
              </h2>
              <p className="text-xs text-slate-300 max-w-lg mx-auto mt-1 leading-relaxed">
                {isRejected ? (
                  user.rejectionReason || 'Tu acceso a la plataforma fue suspendido o revocado por la Dirección Clínica. Contacta a un administrador para mayores informes.'
                ) : (
                  'Tu cuenta profesional fue registrada en Firestore exitosamente. Para salvaguardar la reserva de historias clínicas (Ley 1090 de 2006 y Resolución 1995 de 1999), un Administrador Clínico debe validar tu Tarjeta Profesional y autorizar tu acceso al portal.'
                )}
              </p>
            </div>
          </div>

          {/* Detalle del Usuario Registrado en Firestore */}
          <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-4 space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-850 flex-wrap gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Expediente Registrado en Firestore</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
                  UID: {user.uid}
                </span>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-500/30 uppercase">
                  Vía {user.provider || 'Google OAuth'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <img 
                src={user.photoURL || 'https://images.unsplash.com/photo-1594824813576-a05e263d9061?w=150&auto=format&fit=crop&q=80'} 
                alt={user.displayName}
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-amber-500/30 shrink-0" 
              />
              <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Especialista Registrado</p>
                  <p className="font-bold text-white text-sm truncate">{user.displayName || 'Sin nombre registrado'}</p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Tarjeta Profesional / ReTHUS</p>
                  <p className="font-mono font-bold text-amber-300 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{user.license || 'Pendiente de captura'}</span>
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Correo Electrónico</p>
                  <p className="text-slate-300 flex items-center gap-1 font-mono text-[11px] truncate">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{user.email || 'Sin correo'}</span>
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Teléfono / WhatsApp</p>
                  <p className="text-slate-300 flex items-center gap-1 font-mono text-[11px]">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{user.phone || 'No especificado'}</span>
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Área Clínica / Especialidad</p>
                  <p className="text-slate-200 truncate">{user.specialty || 'Atención Psicológica y Triage de Crisis'}</p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Institución / Sede</p>
                  <p className="text-slate-300 truncate flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{user.institution || 'Subred Integrada Norte E.S.E.'}</span>
                  </p>
                </div>

                <div className="sm:col-span-2 pt-1 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>Fecha de Registro: {user.createdAt ? new Date(user.createdAt).toLocaleString('es-CO') : 'Reciente'}</span>
                  </span>
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 animate-spin" />
                    <span>En cola de revisión</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback message */}
          {checkMessage && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
              checkMessage.includes('aprobada')
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                : 'bg-slate-950 border-cyan-500/40 text-cyan-200'
            }`}>
              {checkMessage.includes('aprobada') ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
              <span>{checkMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleRecheckStatus(false)}
              disabled={isChecking}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Consultando Firestore...' : 'Verificar Aprobación en Tiempo Real'}</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>

        </div>
      </div>

      {/* Footer legal */}
      <div className="py-3 px-4 text-center text-[10px] text-slate-500 border-t border-slate-900 bg-slate-950/40">
        <span>Sistema de Tele-Triage Clínico SubaTECH · Cumplimiento Ley 1581 de 2012 y Ley 1090 de 2006</span>
      </div>

    </div>
  );
};
