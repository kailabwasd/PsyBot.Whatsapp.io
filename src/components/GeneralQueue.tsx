import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  MessageSquare, 
  UserCheck, 
  ShieldAlert, 
  Filter, 
  Eye, 
  ChevronRight,
  Flame,
  CheckCircle2,
  Phone
} from 'lucide-react';
import type { PatientSession, RiskLevel } from '../types/index.ts';

interface GeneralQueueProps {
  sessions: PatientSession[];
  onClaim: (session: PatientSession) => void;
  onPreview: (session: PatientSession) => void;
  onOpenRecord?: (recordId: string) => void;
  onOpenRegisterModal?: () => void;
}

export const GeneralQueue: React.FC<GeneralQueueProps> = ({
  sessions,
  onClaim,
  onPreview,
  onOpenRecord,
  onOpenRegisterModal,
}) => {
  const [filterRisk, setFilterRisk] = useState<string>('ALL');

  // Filter cases waiting for a psychologist or in crisis
  const queueCases = sessions.filter(
    (s) => s.state === 'WAITING_PSYCHOLOGIST' || s.state === 'CRISIS_ALERT'
  );

  const filteredCases = queueCases.filter((s) => {
    if (filterRisk === 'ALL') return true;
    return s.riskLevel === filterRisk;
  });

  const crisisCount = queueCases.filter((s) => s.riskLevel === 'CRISIS').length;
  const highCount = queueCases.filter((s) => s.riskLevel === 'ALTO').length;
  const modCount = queueCases.filter((s) => s.riskLevel === 'MODERADO').length;

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'CRISIS':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1.5 animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            CÓDIGO ROJO / CRISIS
          </span>
        );
      case 'ALTO':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            PRIORIDAD ALTA
          </span>
        );
      case 'MODERADO':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            MODERADO
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600">
            BAJO / ESTABLE
          </span>
        );
    }
  };

  const formatWaitTime = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes <= 0) return 'Hace un instante';
    if (minutes === 1) return 'Hace 1 min';
    return `Hace ${minutes} min`;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Triage Stats */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
                <Flame className="w-6 h-6 text-amber-400" />
                Bandeja de Guardia: Pacientes Reales en Espera
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                100% Personas Reales
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Lista activa de personas que han escrito solicitando atención con un psicólogo humano especialista. La IA analiza el motivo y riesgo de forma inmediata para que el terapeuta disponga de un triage clínico antes de tomar la sesión.
            </p>
          </div>

          {/* Quick Filters / Counts */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenRegisterModal && (
              <button
                onClick={onOpenRegisterModal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition flex items-center gap-1.5 shadow-lg shadow-teal-500/20 cursor-pointer"
              >
                <span>+ Registrar Paciente</span>
              </button>
            )}

            <button
              onClick={() => setFilterRisk('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                filterRisk === 'ALL'
                  ? 'bg-slate-700 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({queueCases.length})
            </button>
            <button
              onClick={() => setFilterRisk('CRISIS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                filterRisk === 'CRISIS'
                  ? 'bg-red-500/30 text-red-200 border border-red-500/50 shadow-md'
                  : 'bg-slate-800/80 text-red-400/80 hover:text-red-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Crisis ({crisisCount})
            </button>
            <button
              onClick={() => setFilterRisk('ALTO')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                filterRisk === 'ALTO'
                  ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50 shadow-md'
                  : 'bg-slate-800/80 text-amber-400/80 hover:text-amber-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Alta ({highCount})
            </button>
            <button
              onClick={() => setFilterRisk('MODERADO')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                filterRisk === 'MODERADO'
                  ? 'bg-blue-500/30 text-blue-200 border border-blue-500/50 shadow-md'
                  : 'bg-slate-800/80 text-blue-400/80 hover:text-blue-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Moderado ({modCount})
            </button>
          </div>
        </div>
      </div>

      {/* Case List */}
      {filteredCases.length === 0 ? (
        <div className="bg-slate-800/40 rounded-2xl p-12 text-center border border-dashed border-slate-700">
          <CheckCircle2 className="w-12 h-12 text-teal-400 mx-auto mb-3 stroke-[1.5]" />
          <h3 className="text-lg font-bold text-white">Sin pacientes en espera de psicólogo</h3>
          <p className="text-sm text-slate-400 max-w-lg mx-auto mt-2 leading-relaxed">
            Los pacientes que escriben conversan de forma continua y segura con <strong className="text-teal-300">Aura (IA)</strong>. 
            Únicamente ingresarán a esta bandeja cuando soliciten explícitamente un <strong className="text-white">psicólogo real</strong> (escribiendo <em>#psicologo</em> o pidiendo hablar con un terapeuta humano) o en caso de código rojo de crisis.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Acompañamiento IA 100% activo en tiempo real</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCases.map((session) => {
            const lastMsg = session.messages[session.messages.length - 1];
            const isCrisis = session.riskLevel === 'CRISIS';

            return (
              <div
                key={session.id}
                className={`rounded-2xl p-5 border transition-all duration-200 ${
                  isCrisis 
                    ? 'bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border-red-500/50 shadow-lg shadow-red-950/30'
                    : 'bg-slate-850 bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left info */}
                  <div className="flex-1 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        {session.userName || 'Paciente WhatsApp'}
                        <span className="text-xs font-mono font-normal text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          {session.phoneNumber}
                        </span>
                      </h4>
                      {getRiskBadge(session.riskLevel)}
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        En espera {formatWaitTime(session.startedAt)}
                      </span>
                    </div>

                    {/* AI Emotion & Triage Summary */}
                    {session.primaryEmotion && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 font-medium">Emoción Detectada:</span>
                        <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 font-medium border border-teal-500/30">
                          {session.primaryEmotion}
                        </span>
                      </div>
                    )}

                    {session.triageSummary && (
                      <p className="text-xs text-slate-300 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60 leading-relaxed">
                        <span className="font-semibold text-teal-400 mr-1.5">Triage IA:</span>
                        {session.triageSummary}
                      </p>
                    )}

                    {/* Last WhatsApp message preview */}
                    {lastMsg && (
                      <div className="text-xs text-slate-400 flex items-start gap-2 pt-1">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                        <span className="italic truncate max-w-2xl">
                          "{lastMsg.text}"
                        </span>
                      </div>
                    )}

                    {/* Tags */}
                    {session.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {session.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    {onOpenRecord && (
                      <button
                        onClick={() => {
                          const normalizedId = session.id.replace(/[^a-zA-Z0-9_-]/g, '_');
                          onOpenRecord(`CR-${normalizedId}`);
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-medium text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 transition flex items-center gap-1.5"
                        title="Ver ficha clínica completa"
                      >
                        Expediente
                      </button>
                    )}

                    <button
                      onClick={() => onPreview(session)}
                      className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1.5"
                      title="Ver mensajes anteriores"
                    >
                      <Eye className="w-4 h-4 text-slate-400" />
                      Historial
                    </button>

                    <button
                      onClick={() => onClaim(session)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg ${
                        isCrisis
                          ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 animate-pulse'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                      }`}
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Reclamar Caso</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
