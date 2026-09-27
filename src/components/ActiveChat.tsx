import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  User, 
  Bot, 
  ShieldAlert, 
  FileText, 
  Sparkles, 
  Tag, 
  RefreshCw, 
  LogOut, 
  CheckCircle,
  Clock,
  Phone,
  ArrowRightLeft,
  Flame,
  AlertTriangle,
  Download,
  BookOpen
} from 'lucide-react';
import type { PatientSession, PsychologistProfile, RiskLevel } from '../types/index.ts';

interface ActiveChatProps {
  sessions: PatientSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  currentSpecialist: PsychologistProfile;
  onSendMessage: (sessionId: string, text: string) => Promise<void>;
  onTransfer: (sessionId: string, target: 'AI_MODE' | 'WAITING_PSYCHOLOGIST') => Promise<void>;
  onSaveNotes: (sessionId: string, data: { clinicalNotes?: string; tags?: string[]; riskLevel?: RiskLevel; diagnosticImpressions?: string[] }) => Promise<void>;
  onCloseSession: (sessionId: string, resolutionNotes: string) => Promise<void>;
  onOpenReportModal: (session: PatientSession) => void;
  onNavigateToRecord?: (recordId: string) => void;
}

const THERAPEUTIC_PRESETS = [
  {
    label: '🌬️ Técnica 4-7-8',
    text: 'Te invito a realizar conmigo un ciclo de respiración para calmar el sistema nervioso: Inhala por la nariz contando mentalmente 4 segundos... sostén el aire durante 7 segundos... y suéltalo muy despacio por la boca en 8 segundos. Hagámoslo juntos 3 veces.',
  },
  {
    label: '⚓ Anclaje 5-4-3-2-1',
    text: 'Para ayudarte a volver al momento presente y cortar la sensación de irrealidad: Nombra en voz alta 5 cosas que puedas ver a tu alrededor, 4 que puedas tocar, 3 sonidos que escuches, 2 olores y 1 sabor en tu boca. Cuéntame qué encontraste.',
  },
  {
    label: '💚 Validación Empática',
    text: 'Quiero que sepas que todo lo que estás sintiendo en este instante es completamente válido y humano. No estás solo(a) en esto; estoy aquí contigo y vamos a transitar este momento paso a paso.',
  },
  {
    label: '📊 Escala 1 al 10',
    text: 'Siendo 1 calma total y 10 el malestar más intenso que hayas experimentado, ¿en qué número calificarías cómo te sientes en este mismo segundo?',
  },
  {
    label: '🔒 Plan de Seguridad',
    text: 'Tu bienestar es lo primero. Quiero pedirte un compromiso: acordemos que si sientes que el malestar se vuelve inmanejable, llamaremos de inmediato a la Línea de Crisis o a tu persona de mayor confianza. ¿Me autorizas a acordar este paso contigo?',
  }
];

const AVAILABLE_TAGS = [
  'Ataque de Pánico',
  'Ansiedad Severa',
  'Ideación de Escape',
  'Burnout Laboral',
  'Duelo / Pérdida',
  'Insomnio Crónico',
  'Conflicto Vincular',
  'Primeros Auxilios',
  'Estabilizado'
];

export const ActiveChat: React.FC<ActiveChatProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  currentSpecialist,
  onSendMessage,
  onTransfer,
  onSaveNotes,
  onCloseSession,
  onOpenReportModal,
  onNavigateToRecord,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [localNotes, setLocalNotes] = useState('');
  const [resolutionPromptOpen, setResolutionPromptOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [copiedRecordLink, setCopiedRecordLink] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active cases claimed by this specialist or in human mode
  const activeCases = sessions.filter(
    (s) => s.state === 'HUMAN_MODE' && (!s.assignedPsychologistId || s.assignedPsychologistId === currentSpecialist.id)
  );

  const currentSession = sessions.find((s) => s.id === activeSessionId) || activeCases[0] || null;

  useEffect(() => {
    if (currentSession) {
      setLocalNotes(currentSession.clinicalNotes || '');
    }
  }, [currentSession?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentSession || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);
    try {
      await onSendMessage(currentSession.id, text);
    } finally {
      setIsSending(false);
    }
  };

  const handleApplyPreset = (presetText: string) => {
    setInputText(presetText);
  };

  const handleSaveNotesBlur = () => {
    if (currentSession && localNotes !== currentSession.clinicalNotes) {
      onSaveNotes(currentSession.id, { clinicalNotes: localNotes });
    }
  };

  const handleRiskChange = (newRisk: RiskLevel) => {
    if (currentSession) {
      onSaveNotes(currentSession.id, { riskLevel: newRisk });
    }
  };

  const handleToggleTag = (tag: string) => {
    if (!currentSession) return;
    const currentTags = currentSession.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    onSaveNotes(currentSession.id, { tags: newTags });
  };

  const handleCloseCaseSubmit = async () => {
    if (!currentSession) return;
    await onCloseSession(currentSession.id, resolutionNotes);
    setResolutionPromptOpen(false);
    setResolutionNotes('');
  };

  if (!currentSession) {
    return (
      <div className="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
          <BookOpen className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-white">No tienes casos activos asignados</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
          Ve a la pestaña <span className="text-teal-400 font-semibold">"Bandeja General"</span> para revisar los pacientes en espera y presiona <span className="text-emerald-400 font-semibold">"Reclamar Caso"</span> para comenzar la atención en tiempo real.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[680px]">
      
      {/* 1. Left: Patient Caseload List (3 cols) */}
      <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 bg-slate-850/50">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Mis Casos Activos</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
              {activeCases.length}
            </span>
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
          {activeCases.map((s) => {
            const isSelected = s.id === currentSession.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={`w-full text-left p-3 rounded-xl transition flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600/15 border border-emerald-500/30 text-white'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold truncate">
                    {s.userName || 'Paciente WhatsApp'}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                    s.riskLevel === 'CRISIS' ? 'bg-red-500/20 text-red-300' :
                    s.riskLevel === 'ALTO' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {s.riskLevel}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {s.phoneNumber}
                </div>
                {s.primaryEmotion && (
                  <div className="text-[10px] text-teal-300/80 truncate">
                    {s.primaryEmotion}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Center: WhatsApp Live Chat Workstation (6 cols) */}
      <div className="lg:col-span-6 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-xl">
        
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white border border-slate-600">
              {currentSession.userName.charAt(0) || 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">
                  {currentSession.userName}
                </h4>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="En línea vía WhatsApp"></span>
              </div>
              <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {currentSession.phoneNumber}
              </p>
            </div>
          </div>

          {/* Quick Chat Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTransfer(currentSession.id, 'AI_MODE')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition"
              title="Transferir al Asistente Aura IA"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Transferir a IA</span>
            </button>

            <button
              onClick={() => setResolutionPromptOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-800 border border-emerald-500/40 flex items-center gap-1.5 transition"
              title="Concluir atención y registrar diagnóstico"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Resolver Caso</span>
            </button>
          </div>
        </div>

        {/* Therapeutic Presets Bar */}
        <div className="px-3 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider flex-shrink-0 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-teal-400" /> Atajos:
          </span>
          {THERAPEUTIC_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(preset.text)}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-teal-500/20 text-slate-300 hover:text-teal-200 border border-slate-700 hover:border-teal-500/40 whitespace-nowrap transition"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Chat Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-slate-950/40 via-slate-900 to-slate-950/40">
          {currentSession.messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isPsychologist = msg.sender === 'psychologist';
            const isBot = msg.sender === 'bot';
            const isSystem = msg.sender === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center my-2">
                  <span className="inline-block px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-slate-400">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-md transition leading-relaxed ${
                    isUser
                      ? msg.isCrisisTrigger
                        ? 'bg-red-950/80 text-red-100 border border-red-500/60 shadow-red-950/50'
                        : 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tl-sm'
                      : isPsychologist
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-sm'
                      : 'bg-slate-800/90 text-teal-100 border border-teal-500/30 rounded-tr-sm'
                  }`}
                >
                  {/* Sender Header */}
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold opacity-75 mb-1">
                    {isUser ? (
                      <>
                        <User className="w-3 h-3" />
                        <span>{currentSession.userName || 'Paciente (WhatsApp)'}</span>
                      </>
                    ) : isPsychologist ? (
                      <>
                        <User className="w-3 h-3" />
                        <span>{msg.psychologistName || currentSpecialist.name} (Tú)</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3 h-3 text-teal-300" />
                        <span className="text-teal-200">Aura (IA Asistente)</span>
                      </>
                    )}
                    <span className="ml-auto opacity-70">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Delivery Status Indicator for Psychologist Messages */}
                  {isPsychologist && (
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px]">
                      {msg.deliveryStatus === 'failed' ? (
                        <div className="flex items-center gap-1 text-red-200 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-500/40 text-[9px]" title={msg.deliveryError || 'Error de entrega en Twilio'}>
                          <AlertTriangle className="w-2.5 h-2.5 text-red-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{msg.deliveryError || 'No entregado'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 text-teal-200/90 text-[10px]">
                          <CheckCircle className="w-3 h-3 text-emerald-300" />
                          <span>WhatsApp</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-slate-850 border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Responder a ${currentSession.userName} en WhatsApp...`}
            className="flex-1 bg-slate-900 text-sm text-white placeholder-slate-500 px-4 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-teal-500 transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition shadow-lg shadow-emerald-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>

      {/* 3. Right: Clinical Dossier & Triage Record (3 cols) */}
      <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-lg p-4 space-y-4 overflow-y-auto">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-400" />
            Expediente Clínico
          </h3>
          <div className="flex items-center gap-2">
            {onNavigateToRecord && (
              <button
                onClick={() => {
                  const normalizedId = currentSession.id.replace(/[^a-zA-Z0-9_-]/g, '_');
                  onNavigateToRecord(`CR-${normalizedId}`);
                }}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 transition"
                title="Abrir expediente completo en Firestore"
              >
                <span>Ficha Firebase</span>
              </button>
            )}
            <button
              onClick={() => onOpenReportModal(currentSession)}
              className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1"
              title="Exportar informe de sesión"
            >
              <Download className="w-3.5 h-3.5" />
              Informe
            </button>
          </div>
        </div>

        {/* Risk Level Triage Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Nivel de Riesgo Activo
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(['BAJO', 'MODERADO', 'ALTO', 'CRISIS'] as RiskLevel[]).map((risk) => {
              const isSelected = currentSession.riskLevel === risk;
              return (
                <button
                  key={risk}
                  type="button"
                  onClick={() => handleRiskChange(risk)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition border ${
                    isSelected
                      ? risk === 'CRISIS'
                        ? 'bg-red-500/20 text-red-300 border-red-500/60 shadow-sm'
                        : risk === 'ALTO'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                        : risk === 'MODERADO'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/60 shadow-sm'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm'
                      : 'bg-slate-800 text-slate-400 border-slate-700/60 hover:text-white'
                  }`}
                >
                  {risk}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clinical Tags */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Etiquetas Diagnósticas</span>
            <Tag className="w-3 h-3 text-slate-500" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_TAGS.map((tag) => {
              const isChecked = currentSession.tags?.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`text-[10px] px-2 py-0.5 rounded-md transition border ${
                    isChecked
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-semibold'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {isChecked ? `✓ ${tag}` : `+ ${tag}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clinical Notes Field */}
        <div className="space-y-1.5 flex-1 flex flex-col">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Notas Terapéuticas Privadas
            </label>
            <span className="text-[10px] text-slate-500 italic">Autoguardado</span>
          </div>
          <textarea
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            onBlur={handleSaveNotesBlur}
            placeholder="Anotaciones de intervención, técnicas aplicadas, acuerdos de seguridad, plan de seguimiento..."
            className="flex-1 w-full min-h-[140px] bg-slate-950 text-xs text-slate-200 placeholder-slate-600 p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-teal-500 transition leading-relaxed resize-none"
          />
        </div>

      </div>

      {/* Resolution & Discharge Modal */}
      {resolutionPromptOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Concluir y Archivar Sesión
                </h3>
                <p className="text-xs text-slate-400">
                  Paciente: {currentSession.userName} ({currentSession.phoneNumber})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Al concluir, se enviará un mensaje de cierre respetuoso al paciente en WhatsApp y el caso quedará registrado en el historial clínico.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Resumen de Resolución e Indicaciones Finales:
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Ej: Paciente estabilizado de ataque de pánico tras técnica diafragmática. Se proporcionaron líneas de apoyo y se acordó consulta presencial."
                className="w-full bg-slate-950 text-xs text-white p-3 rounded-xl border border-slate-700 focus:outline-none focus:border-teal-500 h-24 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setResolutionPromptOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseCaseSubmit}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/20"
              >
                Confirmar Cierre de Caso
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
