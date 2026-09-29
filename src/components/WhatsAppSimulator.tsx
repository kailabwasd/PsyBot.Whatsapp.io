import React, { useState } from 'react';
import { 
  Send, 
  Phone, 
  Video, 
  MoreVertical, 
  Smile, 
  Paperclip, 
  Mic, 
  Sparkles, 
  ShieldAlert,
  RotateCcw,
  User,
  Bot,
  CheckCheck
} from 'lucide-react';
import type { PatientSession } from '../types/index.ts';

interface WhatsAppSimulatorProps {
  sessions: PatientSession[];
  activePhone: string;
  onSelectPhone: (phone: string) => void;
  onSendMessage: (phone: string, text: string, userName?: string) => Promise<void>;
  onNewUser: () => void;
}

const PRESET_MESSAGES = [
  { label: '🤖 Hablar con Aura (IA)', text: 'Hola Aura, me he sentido muy abrumado con el trabajo hoy' },
  { label: '🌬️ Pedir ejercicio de respiración a la IA', text: '¿Podrías enseñarme una técnica para calmar la ansiedad rápida?' },
  { label: '🩺 Solicitar Psicólogo Real (#psicologo)', text: 'Quiero hablar con un psicólogo real por favor' },
  { label: '🚨 Crisis / Desesperanza (#crisis)', text: '#crisis' },
  { label: '📋 Menú / Estado de caso (#menu)', text: '#menu' }
];

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({
  sessions,
  activePhone,
  onSelectPhone,
  onSendMessage,
  onNewUser,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const currentSession = sessions.find((s) => s.id === activePhone) || sessions[0] || null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !currentSession || isSending) return;

    setInputText('');
    setIsSending(true);
    try {
      await onSendMessage(currentSession.id, text, currentSession.userName);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Top Controller */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Simulador de Cliente WhatsApp (Twilio Content API Sandbox)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactúa con el bot o con el psicólogo humano tal como lo experimenta un paciente en su móvil.
          </p>
        </div>

        {/* Switch patient or new session */}
        <div className="flex items-center gap-2">
          <select
            value={currentSession?.id || ''}
            onChange={(e) => onSelectPhone(e.target.value)}
            className="bg-slate-800 text-xs text-white px-3 py-1.5 rounded-xl border border-slate-700 focus:outline-none focus:border-teal-500"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.userName || 'Usuario'} ({s.phoneNumber}) - {s.state}
              </option>
            ))}
          </select>

          <button
            onClick={onNewUser}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Nuevo Paciente
          </button>
        </div>
      </div>

      {/* Simulator Device Frame */}
      <div className="max-w-md mx-auto bg-slate-950 rounded-[40px] p-3 border-4 border-slate-800 shadow-2xl shadow-emerald-950/20">
        
        {/* Phone Screen Container */}
        <div className="bg-[#0b141a] rounded-[32px] overflow-hidden flex flex-col h-[640px] border border-slate-800 relative">
          
          {/* WhatsApp Header */}
          <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between border-b border-[#2a3942] z-10 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center font-bold text-slate-950 text-sm shadow-md">
                🌿
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white leading-tight flex items-center gap-1.5">
                  PsyBot - SubaTech
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Verificado Twilio"></span>
                </h4>
                <p className="text-[10px] text-emerald-400 font-medium">
                  {currentSession?.state === 'HUMAN_MODE' 
                    ? `En línea con ${currentSession.assignedPsychologistName || 'Psicólogo'}`
                    : currentSession?.state === 'WAITING_PSYCHOLOGIST'
                    ? 'Buscando terapeuta de guardia...'
                    : 'Aura Asistente IA 24/7'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-slate-400">
              <Phone className="w-4 h-4 cursor-pointer hover:text-white transition" />
              <Video className="w-4 h-4 cursor-pointer hover:text-white transition" />
              <MoreVertical className="w-4 h-4 cursor-pointer hover:text-white transition" />
            </div>
          </div>

          {/* WhatsApp Chat Body with Background Doodle Texture */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a] bg-opacity-95">
            
            {/* Encryption pill */}
            <div className="text-center my-1">
              <span className="inline-block bg-[#182229] text-[#ffd279] text-[10px] px-3 py-1 rounded-lg max-w-xs shadow-sm border border-[#2a3942]">
                🔒 Los mensajes están protegidos de extremo a extremo y encriptados bajo protocolos éticos de salud mental.
              </span>
            </div>

            {currentSession?.messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isPsychologist = msg.sender === 'psychologist';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-md relative ${
                      isUser
                        ? 'bg-[#005c4b] text-white rounded-tr-none'
                        : isPsychologist
                        ? 'bg-[#1f3a34] text-emerald-100 border border-emerald-500/40 rounded-tl-none'
                        : 'bg-[#202c33] text-slate-100 rounded-tl-none'
                    }`}
                  >
                    {!isUser && isPsychologist && (
                      <div className="text-[10px] font-bold text-teal-300 mb-0.5 flex items-center gap-1">
                        <span>🩺 {msg.psychologistName || 'Psicólogo Especialista'}</span>
                      </div>
                    )}

                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    
                    <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400/80 mt-1">
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isUser && <CheckCheck className="w-3 h-3 text-cyan-400 inline" />}
                    </div>
                  </div>

                  {/* Interactive WhatsApp Quick Reply Buttons (Twilio Content API simulation) */}
                  {msg.quickReplies && msg.quickReplies.length > 0 && (
                    <div className="mt-1.5 space-y-1 w-full max-w-[85%]">
                      {msg.quickReplies.map((replyText, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(replyText.split('.')[0] || replyText)}
                          className="w-full text-center py-2 px-3 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-teal-400 font-semibold text-xs border border-teal-500/30 transition shadow-sm"
                        >
                          {replyText}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isSending && (
              <div className="flex items-center space-x-2 text-[11px] text-slate-400 italic">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></span>
                <span>PsyBot está escribiendo...</span>
              </div>
            )}
          </div>

          {/* Preset Buttons for easy testing */}
          <div className="px-3 py-1.5 bg-[#182229] border-t border-[#2a3942] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {PRESET_MESSAGES.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(preset.text)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-[#202c33] hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 border border-[#2a3942] whitespace-nowrap transition"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* WhatsApp Bottom Input */}
          <div className="p-2.5 bg-[#202c33] flex items-center space-x-2">
            <Smile className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white" />
            <Paperclip className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white" />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-[#2a3942] text-xs text-white placeholder-slate-400 px-3.5 py-2 rounded-xl focus:outline-none"
            />
            {inputText.trim() ? (
              <button
                onClick={() => handleSend()}
                disabled={isSending}
                className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-slate-950 font-bold transition shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Mic className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white" />
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
