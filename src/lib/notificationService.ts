/**
 * Audio and Browser Notification Service for Psychologists
 * Provides Web Audio API synthesized chimes and Native Browser Notifications
 */

export interface NotificationPayload {
  title: string;
  body: string;
  type: 'NEW_PATIENT' | 'CRISIS_ALERT' | 'NEW_MESSAGE';
  sessionId?: string;
  patientName?: string;
  timestamp?: number;
}

// Audio context singleton
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    console.warn('Web Audio API not supported:', e);
    return null;
  }
}

/**
 * Plays a gentle, pleasant ascending two-tone acoustic chime (New Patient in Queue)
 */
export function playNewPatientChime(volume: number = 0.3): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    
    // Note 1: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(volume, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Note 2: G5 (783.99 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(volume * 0.9, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.7);
  } catch (e) {
    console.warn('Error playing audio chime:', e);
  }
}

/**
 * Plays an urgent, triple-tone clinical alert chime (Crisis / Red Code Alert)
 */
export function playCrisisAlertChime(volume: number = 0.45): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [880, 659.25, 880]; // A5 -> E5 -> A5
    
    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  } catch (e) {
    console.warn('Error playing crisis chime:', e);
  }
}

/**
 * Plays a soft droplet pop tone (New Message in Active Chat)
 */
export function playNewMessageChime(volume: number = 0.25): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08); // E6
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  } catch (e) {
    console.warn('Error playing message chime:', e);
  }
}

/**
 * Requests browser notification permission
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Notification permission error:', err);
    return 'denied';
  }
}

/**
 * Checks current browser notification permission
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Sends a native browser desktop/mobile notification
 */
export function sendBrowserNotification(
  payload: NotificationPayload, 
  onClickHandler?: () => void
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const iconUrl = payload.type === 'CRISIS_ALERT' 
      ? 'https://cdn-icons-png.flaticon.com/512/564/564619.png'
      : 'https://cdn-icons-png.flaticon.com/512/3845/3845868.png';

    const notif = new Notification(payload.title, {
      body: payload.body,
      icon: iconUrl,
      badge: iconUrl,
      tag: `psybot-${payload.sessionId || payload.type}-${Date.now()}`,
      requireInteraction: payload.type === 'CRISIS_ALERT',
    });

    notif.onclick = () => {
      window.focus();
      if (onClickHandler) onClickHandler();
      notif.close();
    };
  } catch (e) {
    console.warn('Could not display system browser notification:', e);
  }
}

/**
 * Dispatches complete notification with sound and system alert
 */
export function notifyPsychologist(
  payload: NotificationPayload, 
  isAudioEnabled: boolean = true,
  onClickHandler?: () => void
): void {
  // 1. Play synthesized acoustic chime if enabled
  if (isAudioEnabled) {
    if (payload.type === 'CRISIS_ALERT') {
      playCrisisAlertChime();
    } else if (payload.type === 'NEW_PATIENT') {
      playNewPatientChime();
    } else {
      playNewMessageChime();
    }
  }

  // 2. Dispatch system browser notification
  sendBrowserNotification(payload, onClickHandler);
}
