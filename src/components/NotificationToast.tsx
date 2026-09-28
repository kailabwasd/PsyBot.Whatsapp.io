import React from 'react';
import { 
  Bell, 
  BellOff, 
  ShieldAlert, 
  UserPlus, 
  MessageSquare, 
  X, 
  ArrowRight,
  Volume2,
  VolumeX
} from 'lucide-react';
import type { NotificationPayload } from '../lib/notificationService.ts';

interface NotificationToastProps {
  notifications: NotificationPayload[];
  onDismiss: (index: number) => void;
  onAction: (notif: NotificationPayload) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const NotificationToastContainer: React.FC<NotificationToastProps> = ({
  notifications,
  onDismiss,
  onAction,
  soundEnabled,
  onToggleSound,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {notifications.map((notif, index) => {
        const isCrisis = notif.type === 'CRISIS_ALERT';
        const isPatient = notif.type === 'NEW_PATIENT';

        return (
          <div
            key={`${notif.type}-${notif.timestamp || index}`}
            className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200 transition-all ${
              isCrisis
                ? 'bg-red-950/95 border-red-500 text-white ring-2 ring-red-500/50 animate-pulse'
                : isPatient
                ? 'bg-slate-900/95 border-amber-500/60 text-white'
                : 'bg-slate-900/95 border-cyan-500/60 text-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    isCrisis
                      ? 'bg-red-500 text-white border-red-400'
                      : isPatient
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                  }`}
                >
                  {isCrisis ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : isPatient ? (
                    <UserPlus className="w-5 h-5" />
                  ) : (
                    <MessageSquare className="w-5 h-5" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{notif.title}</span>
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                    {notif.body}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onDismiss(index)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
              <button
                onClick={onToggleSound}
                className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                title={soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
              >
                {soundEnabled ? <Volume2 className="w-3 h-3 text-emerald-400" /> : <VolumeX className="w-3 h-3 text-slate-500" />}
                <span>{soundEnabled ? 'Audio ON' : 'Audio OFF'}</span>
              </button>

              <button
                onClick={() => {
                  onAction(notif);
                  onDismiss(index);
                }}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition ${
                  isCrisis
                    ? 'bg-white text-red-950 hover:bg-slate-100 shadow-sm'
                    : 'bg-[#00E5FF] text-slate-950 hover:bg-cyan-300 shadow-sm'
                }`}
              >
                <span>Atender Ahora</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

          </div>
        );
      })}
    </div>
  );
};
