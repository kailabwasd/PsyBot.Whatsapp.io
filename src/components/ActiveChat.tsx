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
  BookOpen,
  Smile,
  Meh,
  Frown,
  BrainCircuit,
  Info,
  Archive,
  MessageSquare
} from 'lucide-react';
import type { PatientSession, PsychologistProfile, RiskLevel } from '../types/index.ts';
import { sendDirectTwilioWhatsApp } from '../services/api.ts';

interface PatientSentiment {
  sentimentCategory: 'feliz' | 'neutra' | 'preocupada';
  emotion: string;
  intensity: string;
  reason: string;
  keyObservation?: string;
  analyzedMessageId?: string;
}

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

const RESOLUTION_TEMPLATES = [
  'Paciente estabilizado de crisis de angustia tras intervención con respiración diafragmática. Refiere disminución de síntomas y se acuerda seguimiento.',
  'Plan de seguridad y contención acordado con red de apoyo familiar. Se suministraron líneas 106 y 192 de atención de urgencias.',
  'Atención clínica inicial completada con éxito. Paciente orientado hacia consulta externa de psicología de la Subred Norte.',
  'Caso remitido a valoración médica prioritaria con acompañamiento familiar.'
];

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
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastTwilioSid, setLastTwilioSid] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState('');
  const [resolutionPromptOpen, setResolutionPromptOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [copiedRecordLink, setCopiedRecordLink] = useState(false);
  
  // Gemini Patient Sentiment State
  const [sentiment, setSentiment] = useState<PatientSentiment | null>(null);
  const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false);
  const [showSentimentDetail, setShowSentimentDetail] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Active cases claimed by this specialist or in human mode
  const activeCases = sessions.filter(
    (s) => s.state === 'HUMAN_MODE' && (!s.assignedPsychologistId || s.assignedPsychologistId === currentSpecialist.id)
  );

  const currentSession = sessions.find((s) => s.id === activeSessionId) || activeCases[0] || null;

  // Identify last user message
  const userMessages = currentSession?.messages.filter((m) => m.sender === 'user') || [];
  const lastUserMessage = userMessages[userMessages.length - 1];

  useEffect(() => {
    if (currentSession) {
      setLocalNotes(currentSession.clinicalNotes || '');
    }
  }, [currentSession?.id]);

  // Smoothly scroll only the messages container WITHOUT forcing whole window scroll
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [currentSession?.messages?.length, currentSession?.id]);

  // Analyze Sentiment with Gemini on latest patient message
  useEffect(() => {
    if (!lastUserMessage || !currentSession) {
      setSentiment(null);
      return;
    }

    if (sentiment?.analyzedMessageId === lastUserMessage.id) return;

    let isMounted = true;
    const fetchSentiment = async () => {
      setIsAnalyzingSentiment(true);
      try {
        const res = await fetch('/api/gemini/sentiment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: lastUserMessage.text,
            patientName: currentSession.userName,
            previousMessages: currentSession.messages.slice(-5),
          }),
        });
        const data = await res.json();
        if (isMounted && data.success) {
          setSentiment({
            sentimentCategory: data.sentimentCategory,
            emotion: data.emotion,
            intensity: data.intensity,
            reason: data.reason,
            keyObservation: data.keyObservation,
            analyzedMessageId: lastUserMessage.id,
          });
        }
      } catch (err) {
        console.warn('Could not analyze sentiment with Gemini:', err);
      } finally {
        if (isMounted) setIsAnalyzingSentiment(false);
      }
    };

    fetchSentiment();

    return () => {
      isMounted = false;
    };
  }, [lastUserMessage?.id, currentSession?.id]);

  const handleManualReanalyzeSentiment = async () => {
    if (!lastUserMessage || !currentSession || isAnalyzingSentiment) return;
    setIsAnalyzingSentiment(true);
    try {
      const res = await fetch('/api/gemini/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: lastUserMessage.text,
          patientName: currentSession.userName,
          previousMessages: currentSession.messages.slice(-5),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSentiment({
          sentimentCategory: data.sentimentCategory,
          emotion: data.emotion,
          intensity: data.intensity,
          reason: data.reason,
          keyObservation: data.keyObservation,
          analyzedMessageId: lastUserMessage.id,
        });
      }
    } catch (err) {
      console.warn('Manual sentiment analysis error:', err);
    } finally {
      setIsAnalyzingSentiment(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentSession || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);
    setSendError(null);

    try {
      // Outbound dispatch via Twilio WhatsApp connected to the patient's phone + Firestore sync
      await onSendMessage(currentSession.id, text);
    } catch (err: any) {
      console.error('Error sending WhatsApp message:', err);
      setSendError(err?.message || 'Error al despachar el mensaje por Twilio WhatsApp.');
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
    const notesToSave = resolutionNotes.trim() || 'Atención completada y paciente dado de alta de guardia.';
    await onCloseSession(currentSession.id, notesToSave);
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 h-[calc(100dvh-200px)] min-h-[520px]">
      
      {/* 1. Left: Patient Caseload List (3 cols) */}
      <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col h-full overflow-hidden shadow-lg">
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
      <div className="lg:col-span-6 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col h-full overflow-hidden shadow-xl">
        
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-850 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
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

          {/* Banner de Estado de Modo Actual de Atención */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {currentSession.state === 'HUMAN_MODE' ? (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  👨‍⚕️ Atención Humana Activa ({currentSession.assignedPsychologistName || currentSpecialist.name})
                </span>
              ) : currentSession.state === 'WAITING_PSYCHOLOGIST' ? (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  ⌛ En Espera de Asignación por Psicólogo de Guardia
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-cyan-400" />
                  🤖 Asistencia Emocional con IA (Aura 24/7)
                </span>
              )}
            </div>

            {currentSession.riskLevel === 'CRISIS' && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                🚨 CÓDIGO ROJO / CRISIS
              </span>
            )}
          </div>

          {/* Indicador Visual de Sentimiento Gemini en el Último Mensaje */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sentimiento (Último Mensaje):</span>
              </span>

              {isAnalyzingSentiment ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Analizando con Gemini...</span>
                </div>
              ) : sentiment ? (
                <button
                  type="button"
                  onClick={() => setShowSentimentDetail(!showSentimentDetail)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold transition cursor-pointer ${
                    sentiment.sentimentCategory === 'feliz'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                      : sentiment.sentimentCategory === 'preocupada'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                      : 'bg-sky-500/15 text-sky-300 border-sky-500/40 hover:bg-sky-500/25'
                  }`}
                  title="Haz clic para ver el análisis de Gemini"
                >
                  {sentiment.sentimentCategory === 'feliz' && <Smile className="w-4 h-4 text-emerald-400" />}
                  {sentiment.sentimentCategory === 'neutra' && <Meh className="w-4 h-4 text-sky-400" />}
                  {sentiment.sentimentCategory === 'preocupada' && <Frown className="w-4 h-4 text-amber-400" />}
                  <span className="capitalize">
                    {sentiment.sentimentCategory === 'feliz' ? 'Feliz' : sentiment.sentimentCategory === 'preocupada' ? 'Preocupada' : 'Neutra'}
                  </span>
                  <span className="text-[10px] opacity-75 font-normal">
                    ({sentiment.emotion})
                  </span>
                  <Info className="w-3 h-3 opacity-60 ml-0.5" />
                </button>
              ) : (
                <span className="text-[11px] text-slate-500 italic">
                  Sin mensajes del paciente para analizar
                </span>
              )}
            </div>

            {sentiment && (
              <button
                type="button"
                onClick={handleManualReanalyzeSentiment}
                disabled={isAnalyzingSentiment}
                className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition disabled:opacity-50"
                title="Volver a analizar con Gemini"
              >
                <RefreshCw className={`w-3 h-3 ${isAnalyzingSentiment ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Re-analizar Gemini</span>
              </button>
            )}
          </div>

          {/* Popover / Desglose de Sentimiento Gemini */}
          {showSentimentDetail && sentiment && (
            <div className="p-3 bg-slate-900/95 rounded-xl border border-cyan-500/30 text-xs text-slate-200 space-y-1.5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between font-semibold text-cyan-300">
                <span className="flex items-center gap-1.5">
                  <BrainCircuit className="w-4 h-4" />
                  <span>Diagnóstico Emocional Gemini 3.8 Flash:</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Intensidad: <strong className="text-white capitalize">{sentiment.intensity}</strong>
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong>Motivo detectado:</strong> {sentiment.reason}
              </p>
              {sentiment.keyObservation && (
                <p className="text-[11px] text-cyan-200/90 leading-relaxed bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/20">
                  💡 <strong>Sugerencia terapéutica:</strong> {sentiment.keyObservation}
                </p>
              )}
            </div>
          )}
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
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-slate-950/40 via-slate-900 to-slate-950/40 scroll-smooth"
        >
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

                  {/* Indicator on the latest patient message */}
                  {isUser && msg.id === lastUserMessage?.id && sentiment && (
                    <div className="mt-2 pt-1.5 border-t border-slate-700/60 flex items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5 font-medium">
                        {sentiment.sentimentCategory === 'feliz' && <Smile className="w-3.5 h-3.5 text-emerald-400" />}
                        {sentiment.sentimentCategory === 'neutra' && <Meh className="w-3.5 h-3.5 text-sky-400" />}
                        {sentiment.sentimentCategory === 'preocupada' && <Frown className="w-3.5 h-3.5 text-amber-400" />}
                        <span className={`capitalize font-semibold ${
                          sentiment.sentimentCategory === 'feliz'
                            ? 'text-emerald-300'
                            : sentiment.sentimentCategory === 'preocupada'
                            ? 'text-amber-300'
                            : 'text-sky-300'
                        }`}>
                          Sentimiento: {sentiment.sentimentCategory}
                        </span>
                        <span className="text-slate-400">({sentiment.emotion})</span>
                      </div>
                      <span className="text-[9px] text-cyan-400/80 font-mono">Gemini 3.8</span>
                    </div>
                  )}

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
        </div>

        {/* Twilio Outbound Delivery Alerts / Notice */}
        {sendError && (
          <div className="px-4 py-2 bg-red-950/90 border-t border-red-500/50 text-xs text-red-200 flex items-center justify-between animate-in fade-in shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span><strong>Aviso Twilio:</strong> {sendError}</span>
            </div>
            <button
              onClick={() => setSendError(null)}
              className="text-xs text-red-300 hover:text-white px-2 py-0.5 rounded bg-red-900/40"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="p-3 bg-slate-850 border-t border-slate-800 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="flex items-center gap-1.5 font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Twilio WhatsApp Directo: {currentSession.phoneNumber || currentSession.id}</span>
            </span>
            {lastTwilioSid && (
              <span className="text-[10px] text-teal-300/80 font-mono truncate max-w-[200px]" title={`Twilio Message SID: ${lastTwilioSid}`}>
                SID: {lastTwilioSid}
              </span>
            )}
          </div>

          <form
            onSubmit={handleSend}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Escribe un mensaje para enviar directamente al WhatsApp de ${currentSession.userName}...`}
              className="flex-1 bg-slate-900 text-sm text-white placeholder-slate-500 px-4 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-teal-500 transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Enviar directamente al WhatsApp del paciente mediante Twilio REST API"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Enviar WhatsApp</span>
                </>
              )}
            </button>
          </form>
        </div>

      </div>

      {/* 3. Right: Clinical Dossier & Triage Record (3 cols) */}
      <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col h-full overflow-hidden shadow-lg p-4 space-y-4 overflow-y-auto">
        
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

        {/* Action Button: Concluir / Cerrar Caso */}
        <button
          type="button"
          onClick={() => setResolutionPromptOpen(true)}
          className="w-full py-2.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow"
        >
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>Cerrar y Archivar Caso</span>
        </button>

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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Concluir y Archivar Sesión
                </h3>
                <p className="text-xs text-slate-400">
                  Paciente: <strong className="text-white">{currentSession.userName}</strong> ({currentSession.phoneNumber})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              Al confirmar el cierre, la sesión se marcará como resuelta, se notificará al paciente en WhatsApp y los datos clínicos se sincronizarán permanentemente en Firestore.
            </p>

            {/* Quick Resolution Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-400" /> Plantillas Rápidas de Alta:
              </label>
              <div className="space-y-1">
                {RESOLUTION_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setResolutionNotes(tmpl)}
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-teal-950/40 border border-slate-800 hover:border-teal-500/40 text-[11px] text-slate-300 hover:text-teal-200 transition line-clamp-1"
                  >
                    • {tmpl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Resumen de Resolución e Indicaciones Finales:
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Ej: Paciente estabilizado de ataque de pánico tras técnica diafragmática. Se proporcionaron líneas de apoyo y se acordó consulta presencial."
                className="w-full bg-slate-950 text-xs text-white p-3 rounded-xl border border-slate-700 focus:outline-none focus:border-teal-500 h-24 resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setResolutionPromptOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseCaseSubmit}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Confirmar Cierre de Caso</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
