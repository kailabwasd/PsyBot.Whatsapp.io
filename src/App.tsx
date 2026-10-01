import React, { useState, useEffect, useRef } from 'react';
import { 
  Inbox, 
  MessageSquare, 
  Bot, 
  ShieldAlert, 
  X, 
  User, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Database, 
  ChevronLeft, 
  ChevronRight,
  Users,
  Globe
} from 'lucide-react';
import type { PatientSession, PsychologistProfile, RiskLevel, PsychologistAuthUser } from './types/index.ts';
import { 
  fetchSessions, 
  claimSession, 
  sendPsychologistMessage, 
  transferSession, 
  saveClinicalNotes, 
  closeSession,
  deleteSession,
  clearAllSessions
} from './services/api.ts';
import { Header } from './components/Header.tsx';
import { GeneralQueue } from './components/GeneralQueue.tsx';
import { ActiveChat } from './components/ActiveChat.tsx';
import { AiSupervisor } from './components/AiSupervisor.tsx';
import { ClinicalReportModal } from './components/ClinicalReportModal.tsx';
import { ClinicalRecordsView } from './components/ClinicalRecordsView.tsx';
import { PsychologistLogin } from './components/PsychologistLogin.tsx';
import { CreatePsychologistProfile } from './components/CreatePsychologistProfile.tsx';
import { PendingApprovalScreen } from './components/PendingApprovalScreen.tsx';
import { CookieConsentBanner } from './components/CookieConsentBanner.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { AccessibilityModal } from './components/AccessibilityModal.tsx';
import { SubaTechLogo } from './components/SubaTechLogo.tsx';
import { LegalTermsModal, LegalTabType } from './components/LegalTermsModal.tsx';
import { NotificationToastContainer } from './components/NotificationToast.tsx';
import { PsychologistsDirectoryView } from './components/PsychologistsDirectoryView.tsx';
import { PatientRegistrationModal } from './components/PatientRegistrationModal.tsx';
import { logAuditEvent } from './components/AuditLog.tsx';
import { 
  syncSessionToFirestoreClinicalRecord, 
  saveActiveSessionToFirestore, 
  getActiveSessionsFromFirestore, 
  subscribeToActiveSessions,
  deleteActiveSessionFromFirestore,
  deleteAllActiveSessionsFromFirestore,
  getInitialSessionsSync
} from './lib/clinicalRecordsService.ts';
import { AppRoute, parseCurrentRoute, navigateTo, normalizeRoute } from './lib/router.ts';
import { applyAccessibilitySettings, getStoredAccessibilitySettings } from './lib/accessibility.ts';
import { 
  notifyPsychologist, 
  requestBrowserNotificationPermission, 
  getNotificationPermission,
  type NotificationPayload 
} from './lib/notificationService.ts';
import { 
  testFirestoreConnection, 
  auth, 
  getStoredPsychologist, 
  getPsychologistFromFirestore,
  logoutPsychologist,
  isUserAdmin,
  createAdminProfile,
  listPsychologistsFromFirestore,
  subscribeToPsychologists,
  savePsychologistProfile,
  isSigningIn
} from './lib/firebase.ts';
import { onAuthStateChanged } from 'firebase/auth';

type NavigationTab = 'QUEUE' | 'ACTIVE' | 'SUPERVISOR' | 'RECORDS' | 'PSYCHOLOGISTS';

export default function App() {
  const [currentUser, setCurrentUser] = useState<PsychologistAuthUser | null>(() => getStoredPsychologist());
  // If user is already in storage, do not show any loading screen
  const [isAuthChecking, setIsAuthChecking] = useState(() => !getStoredPsychologist());
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'profile' | 'twofactor' | 'admins' | 'patients' | 'errorlogs' | 'theme' | 'audit' | 'crisiskeywords'>('profile');
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTabType>('PRIVACY');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'subatech'>('subatech');
  const [allPsychologists, setAllPsychologists] = useState<PsychologistAuthUser[]>([]);

  // Count of psychologists waiting for Administrator authorization (only newly registered accounts in PENDING status)
  const pendingApprovalsCount = allPsychologists.filter(
    p => !p.isAdmin && !isUserAdmin(p.email) && (p.approvalStatus === 'PENDING' || (p.isApproved === false && p.approvalStatus !== 'REJECTED'))
  ).length;

  // Routing and Subdomain Navigation State
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => parseCurrentRoute());
  const [protectedRouteAttempted, setProtectedRouteAttempted] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    const route = parseCurrentRoute();
    if (route === 'psicologos') return 'PSYCHOLOGISTS';
    if (route === 'chat') return 'ACTIVE';
    if (route === 'expedientes') return 'RECORDS';
    if (route === 'supervisor') return 'SUPERVISOR';
    return 'QUEUE';
  });
  const [sessions, setSessions] = useState<PatientSession[]>(() => {
    const instant = getInitialSessionsSync();
    if (instant.length > 0) return instant;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('psybot_active_sessions_instant_cache') || 
                       localStorage.getItem('psybot_active_sessions_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('psybot_active_session_id') || null;
    }
    return null;
  });

  // Keep activeSessionId persisted in localStorage
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('psybot_active_session_id', activeSessionId);
    }
  }, [activeSessionId]);

  const [reportModalSession, setReportModalSession] = useState<PatientSession | null>(null);
  const [previewModalSession, setPreviewModalSession] = useState<PatientSession | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(() => sessions.length === 0);

  const handleRegisterNewPatient = async (data: { name: string; age: number; gender: string; phone: string }) => {
    const now = Date.now();
    const cleanPhone = data.phone.startsWith('whatsapp:') ? data.phone : `whatsapp:${data.phone.startsWith('+') ? data.phone : '+' + data.phone}`;
    const newSession: PatientSession = {
      id: cleanPhone,
      phoneNumber: data.phone,
      userName: data.name,
      age: String(data.age),
      gender: data.gender,
      state: 'WAITING_PSYCHOLOGIST',
      riskLevel: 'MODERADO',
      primaryEmotion: 'Solicitud de Atención Inicial',
      triageSummary: `Paciente ${data.name}, ${data.age} años (${data.gender}), registrado en guardia con teléfono ${data.phone}.`,
      startedAt: now,
      lastActivityAt: now,
      messages: [
        {
          id: `reg-${now}`,
          sender: 'bot',
          text: `🌿 ¡Hola ${data.name}! Tu registro en SubaTECH Triage se ha completado exitosamente. Un psicólogo humano especialista revisará tu caso en breve.`,
          timestamp: now,
        }
      ],
      clinicalNotes: `Registro inicial de paciente en guardia. Edad: ${data.age}, Género: ${data.gender}, Teléfono: ${data.phone}.`,
      diagnosticImpressions: ['Admisión Inicial a Guardia'],
      tags: ['Nuevo Paciente', data.gender, `${data.age} años`],
      sentimentScore: 0,
      termsAccepted: true,
    };

    await syncSessionToFirestoreClinicalRecord(newSession);
    await saveActiveSessionToFirestore(newSession);
    setSessions((prev) => [newSession, ...prev.filter(s => s.id !== newSession.id)]);
    setActiveSessionId(newSession.id);
    setActiveTab('QUEUE');
  };
  const navContainerRef = useRef<HTMLElement | null>(null);

  // Notification states and references
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('psybot_sound_enabled');
    return saved !== 'false';
  });
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() => getNotificationPermission());
  const [toasts, setToasts] = useState<NotificationPayload[]>([]);
  const previousSessionsMapRef = useRef<Map<string, { state: string; messagesCount: number; riskLevel: string }>>(new Map());
  const isFirstLoadRef = useRef<boolean>(true);
  const notifiedCrisisSessionsRef = useRef<Set<string>>(
    (() => {
      try {
        const raw = localStorage.getItem('psybot_notified_crisis_ids');
        return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
      } catch {
        return new Set<string>();
      }
    })()
  );

  const markCrisisNotified = (sessionId: string, phoneNumber?: string) => {
    if (!sessionId) return;
    notifiedCrisisSessionsRef.current.add(sessionId);
    if (phoneNumber) {
      notifiedCrisisSessionsRef.current.add(phoneNumber);
    }
    try {
      localStorage.setItem(
        'psybot_notified_crisis_ids',
        JSON.stringify(Array.from(notifiedCrisisSessionsRef.current))
      );
    } catch (e) {}
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('psybot_sound_enabled', String(next));
      return next;
    });
  };

  const handleRequestBrowserPermission = async () => {
    const perm = await requestBrowserNotificationPermission();
    setBrowserPermission(perm);
  };

  const handleTestNotification = () => {
    const testNotif: NotificationPayload = {
      title: '🚨 Prueba: Paciente en Guardia de Triage',
      body: 'Paciente de prueba solicita acompañamiento clínico inmediato en Suba.',
      type: 'CRISIS_ALERT',
      timestamp: Date.now(),
    };
    notifyPsychologist(testNotif, soundEnabled);
    setToasts((prev) => [testNotif, ...prev.slice(0, 3)]);
  };

  // Navigation scroll fade indicator states
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Smart auto-hide Header when scrolling down, reveal on scroll up
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Always show header near top
      if (currentScrollY <= 40) {
        setIsHeaderVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }
      // Scrolling down -> hide header
      if (currentScrollY > lastScrollYRef.current + 12) {
        setIsHeaderVisible(false);
      } 
      // Scrolling up -> show header
      else if (currentScrollY < lastScrollYRef.current - 8) {
        setIsHeaderVisible(true);
      }
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const checkNavScroll = () => {
    if (navContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navContainerRef.current;
      setCanScrollLeft(scrollLeft > 6);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
    }
  };

  const scrollNav = (direction: 'left' | 'right') => {
    if (navContainerRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      navContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(checkNavScroll, 320);
    }
  };

  // Re-check scroll on mount, resize, and whenever tabs change
  useEffect(() => {
    const timer = setTimeout(checkNavScroll, 120);
    window.addEventListener('resize', checkNavScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkNavScroll);
    };
  }, [allPsychologists.length, sessions.length, activeTab]);

  // Apply stored accessibility settings on mount
  useEffect(() => {
    applyAccessibilitySettings(getStoredAccessibilitySettings());
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    testFirestoreConnection();

    // Fast safety timeout: never let auth checking block the user for more than 400ms
    const safetyTimer = setTimeout(() => {
      setIsAuthChecking(false);
    }, 400);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimer);
      if (isSigningIn) {
        // Skip auth state change during active login/registration flow
        return;
      }
      if (firebaseUser) {
        // 1. If administrator (kailabwasd@gmail.com)
        if (isUserAdmin(firebaseUser.email)) {
          const admin = createAdminProfile(
            firebaseUser.email || undefined,
            firebaseUser.displayName || undefined,
            firebaseUser.photoURL || undefined
          );
          setCurrentUser(admin);
          setIsCompletingProfile(false);
          setIsAuthChecking(false);
          return;
        }

        // 2. Try to fetch latest stored profile
        const stored = getStoredPsychologist();
        if (stored && stored.uid === firebaseUser.uid && stored.profileCompleted && stored.license?.trim()) {
          setCurrentUser(stored);
          setIsCompletingProfile(false);
          setIsAuthChecking(false);
          return;
        }

        // 3. Query Firestore with fast timeout
        const remote = await getPsychologistFromFirestore(firebaseUser.uid);
        if (remote && remote.profileCompleted && remote.license?.trim()) {
          localStorage.setItem('psybot_psychologist_session', JSON.stringify(remote));
          setCurrentUser(remote);
          setIsCompletingProfile(false);
        } else {
          // New user without completed registration
          const draft: PsychologistAuthUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firebaseUser.displayName || firebaseUser.uid)}`,
            provider: (firebaseUser.providerData[0]?.providerId === 'password' ? 'email' : 'google.com'),
            role: 'Psicólogo(a) Clínico Titulado(a)',
            license: '',
            specialty: 'Psicología Clínica y Triage de Crisis',
            institution: 'Subred Integrada de Servicios de Salud Norte - Suba',
            phone: '',
            termsAccepted: false,
            profileCompleted: false,
            createdAt: Date.now(),
            lastLoginAt: Date.now(),
          };
          setCurrentUser(draft);
          setIsCompletingProfile(true);
        }
      } else {
        const stored = getStoredPsychologist();
        if (stored && stored.profileCompleted) {
          setCurrentUser(stored);
        } else {
          setCurrentUser(null);
          setIsCompletingProfile(false);
        }
      }
      setIsAuthChecking(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  // Real-time synchronization of psychologists directory and current user approval from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToPsychologists((list) => {
      if (list && list.length > 0) {
        setAllPsychologists(list);
        if (currentUser) {
          const freshCurrent = list.find(p => p.uid === currentUser.uid);
          if (
            freshCurrent && (
              freshCurrent.approvalStatus !== currentUser.approvalStatus ||
              freshCurrent.isApproved !== currentUser.isApproved ||
              freshCurrent.role !== currentUser.role ||
              freshCurrent.isAdmin !== currentUser.isAdmin
            )
          ) {
            setCurrentUser(freshCurrent);
          }
        }
      }
    });
    return () => unsubscribe();
  }, [currentUser?.uid, currentUser?.approvalStatus, currentUser?.isApproved, currentUser?.role, currentUser?.isAdmin]);

  // Central Router Handler: supports accounts, protection, and browser history
  const handleNavigate = (rawRoute: AppRoute | string, replace = false) => {
    const targetRoute = normalizeRoute(rawRoute);
    const isAuthed = Boolean(currentUser && currentUser.profileCompleted);

    // If unauthenticated and tries to access protected routes
    if (!isAuthed) {
      if (targetRoute === 'login' || targetRoute === 'registro' || targetRoute === 'inicio') {
        setProtectedRouteAttempted(null);
        setCurrentRoute(targetRoute);
        navigateTo(targetRoute, replace);
        return;
      }
      setProtectedRouteAttempted(targetRoute);
      setCurrentRoute('login');
      navigateTo('login', replace);
      return;
    }

    setProtectedRouteAttempted(null);

    // If already authenticated and tries to visit login/inicio, keep them in clinical triage
    if (targetRoute === 'inicio' || targetRoute === 'login' || targetRoute === 'registro') {
      setCurrentRoute('triage');
      setActiveTab('QUEUE');
      navigateTo('triage', replace);
      return;
    }

    setCurrentRoute(targetRoute);

    if (targetRoute === 'triage') setActiveTab('QUEUE');
    else if (targetRoute === 'chat') setActiveTab('ACTIVE');
    else if (targetRoute === 'expedientes') setActiveTab('RECORDS');
    else if (targetRoute === 'supervisor') setActiveTab('SUPERVISOR');
    else if (targetRoute === 'psicologos') setActiveTab('PSYCHOLOGISTS');
    else if (targetRoute === 'auditoria') {
      setIsSettingsOpen(true);
    }

    navigateTo(targetRoute, replace);
  };

  // Browser Navigation History Listener (Native Back / Forward Buttons)
  useEffect(() => {
    const onLocationChange = () => {
      const nextRoute = parseCurrentRoute();
      setCurrentRoute(nextRoute);

      if (nextRoute === 'triage') setActiveTab('QUEUE');
      else if (nextRoute === 'chat') setActiveTab('ACTIVE');
      else if (nextRoute === 'expedientes') setActiveTab('RECORDS');
      else if (nextRoute === 'supervisor') setActiveTab('SUPERVISOR');
      else if (nextRoute === 'psicologos') setActiveTab('PSYCHOLOGISTS');
      else if (nextRoute === 'auditoria') {
        setIsSettingsOpen(true);
      } else if (currentUser && (nextRoute === 'inicio' || nextRoute === 'login' || nextRoute === 'registro')) {
        setActiveTab('QUEUE');
      }
    };

    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('applet:routechange', onLocationChange as any);

    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('applet:routechange', onLocationChange as any);
    };
  }, [currentUser]);

  // Parse deep-link URL on boot (e.g. ?tab=RECORDS&recordId=CR-525541908231)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const recordParam = params.get('recordId');

      if (tabParam === 'RECORDS' || recordParam) {
        setActiveTab('RECORDS');
        handleNavigate('expedientes', true);
        if (recordParam) {
          setSelectedRecordId(recordParam);
        }
      }
    } catch (e) {
      console.error('Error parsing URL params:', e);
    }
  }, []);

  // Subscribe to real-time active sessions from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToActiveSessions((firestoreSessions) => {
      if (!firestoreSessions || firestoreSessions.length === 0) return;
      setSessions((prev) => {
        const map = new Map<string, PatientSession>();
        for (const p of prev) {
          if (p && p.id) map.set(p.id, p);
        }
        for (const fsSes of firestoreSessions) {
          if (!fsSes || !fsSes.id) continue;
          const existing = map.get(fsSes.id);
          // Prefer whichever session has more messages or newer activity
          if (!existing || (fsSes.messages && fsSes.messages.length >= (existing.messages?.length || 0))) {
            map.set(fsSes.id, fsSes);
          }
        }
        const updatedList = Array.from(map.values()).sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
        try {
          localStorage.setItem('psybot_active_sessions_cache', JSON.stringify(updatedList));
        } catch (e) {}
        return updatedList;
      });
    });
    return () => unsubscribe();
  }, []);

  // Sync sessions from backend + Firestore periodically and preserve active session context
  const loadSessions = async () => {
    const [apiList, firestoreList] = await Promise.all([
      fetchSessions().catch(() => []),
      getActiveSessionsFromFirestore().catch(() => [])
    ]);

    const sessionMap = new Map<string, PatientSession>();

    // 1. Load Firestore sessions first
    for (const fsSes of firestoreList) {
      if (fsSes && fsSes.id) {
        sessionMap.set(fsSes.id, fsSes);
      }
    }

    // 2. Merge API sessions
    for (const apiSes of apiList) {
      if (apiSes && apiSes.id) {
        const existing = sessionMap.get(apiSes.id);
        if (!existing || (apiSes.messages && apiSes.messages.length >= (existing.messages?.length || 0))) {
          sessionMap.set(apiSes.id, apiSes);
        }
      }
    }

    let list = Array.from(sessionMap.values()).sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));

    // 3. Fallback to LocalStorage cache if remote returned empty
    if (list.length === 0) {
      try {
        const cached = localStorage.getItem('psybot_active_sessions_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
          }
        }
      } catch (e) {
        console.warn('LocalStorage load error:', e);
      }
    } else {
      try {
        localStorage.setItem('psybot_active_sessions_cache', JSON.stringify(list));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }

    setSessions(list);

    // 4. Restore activeSessionId from localStorage or url or first available session
    const savedActiveId = localStorage.getItem('psybot_active_session_id');
    if (savedActiveId && list.some(s => s.id === savedActiveId)) {
      setActiveSessionId(savedActiveId);
    } else if (!activeSessionId && list.length > 0) {
      const firstHuman = list.find((s) => s.state === 'HUMAN_MODE');
      if (firstHuman) {
        setActiveSessionId(firstHuman.id);
      } else {
        setActiveSessionId(list[0].id);
      }
    }

    // Check for alerts and notifications if this is not the initial boot
    if (!isFirstLoadRef.current && currentUser && currentUser.profileCompleted) {
      const prevMap = previousSessionsMapRef.current;

      list.forEach((s) => {
        const prev = prevMap.get(s.id);
        const isClaimedOrHuman = s.state === 'HUMAN_MODE' || Boolean(s.assignedPsychologistId) || s.state === 'RESOLVED';

        // If the case is claimed or already in active human mode/resolved, silence crisis notifications permanently
        if (isClaimedOrHuman) {
          markCrisisNotified(s.id, s.phoneNumber);
        }

        const isCrisis = (s.state === 'CRISIS_ALERT' || s.riskLevel === 'CRISIS') && !isClaimedOrHuman;
        const alreadyNotifiedCrisis = notifiedCrisisSessionsRef.current.has(s.id) || (s.phoneNumber ? notifiedCrisisSessionsRef.current.has(s.phoneNumber) : false);

        // 1. Single Crisis Alert Notification (Fired strictly once per crisis incident)
        if (isCrisis && !alreadyNotifiedCrisis) {
          markCrisisNotified(s.id, s.phoneNumber);
          const notif: NotificationPayload = {
            title: `🚨 ¡Alerta Roja: ${s.userName}!`,
            body: s.triageSummary || 'Paciente con riesgo crítico detectado en guardia.',
            type: 'CRISIS_ALERT',
            sessionId: s.id,
            patientName: s.userName,
            timestamp: Date.now(),
          };
          notifyPsychologist(notif, soundEnabled, () => {
            setActiveTab('QUEUE');
            setPreviewModalSession(s);
          });
          setToasts((t) => [notif, ...t.slice(0, 3)]);
        } else if (!prev && s.state === 'WAITING_PSYCHOLOGIST' && !isClaimedOrHuman) {
          // 2. New standard patient registered in triage queue
          const notif: NotificationPayload = {
            title: `📥 Nuevo Paciente en Guardia: ${s.userName}`,
            body: s.triageSummary || 'Paciente solicita atención con psicólogo humano.',
            type: 'NEW_PATIENT',
            sessionId: s.id,
            patientName: s.userName,
            timestamp: Date.now(),
          };
          notifyPsychologist(notif, soundEnabled, () => {
            setActiveTab('QUEUE');
            setPreviewModalSession(s);
          });
          setToasts((t) => [notif, ...t.slice(0, 3)]);
        } else if (prev) {
          if (prev.state !== 'WAITING_PSYCHOLOGIST' && s.state === 'WAITING_PSYCHOLOGIST' && !isClaimedOrHuman) {
            const notif: NotificationPayload = {
              title: `📥 Paciente en Cola: ${s.userName}`,
              body: s.triageSummary || 'Paciente derivado a la bandeja de guardia.',
              type: 'NEW_PATIENT',
              sessionId: s.id,
              patientName: s.userName,
              timestamp: Date.now(),
            };
            notifyPsychologist(notif, soundEnabled, () => {
              setActiveTab('QUEUE');
              setPreviewModalSession(s);
            });
            setToasts((t) => [notif, ...t.slice(0, 3)]);
          }

          // 3. New message received in active chat (HUMAN_MODE)
          if (s.state === 'HUMAN_MODE' && s.messages.length > prev.messagesCount) {
            const lastMsg = s.messages[s.messages.length - 1];
            if (lastMsg && lastMsg.sender === 'user') {
              const notif: NotificationPayload = {
                title: `💬 Mensaje de ${s.userName}`,
                body: lastMsg.text,
                type: 'NEW_MESSAGE',
                sessionId: s.id,
                patientName: s.userName,
                timestamp: Date.now(),
              };
              notifyPsychologist(notif, soundEnabled, () => {
                setActiveTab('ACTIVE');
                setActiveSessionId(s.id);
              });
              setToasts((t) => [notif, ...t.slice(0, 3)]);
            }
          }
        }
      });
    }

    // Update reference map
    const nextMap = new Map<string, { state: string; messagesCount: number; riskLevel: string }>();
    list.forEach((s) => {
      nextMap.set(s.id, {
        state: s.state,
        messagesCount: s.messages.length,
        riskLevel: s.riskLevel,
      });
    });
    previousSessionsMapRef.current = nextMap;
    isFirstLoadRef.current = false;
  };

  useEffect(() => {
    if (currentUser && currentUser.profileCompleted) {
      loadSessions().then(() => setIsLoading(false));
      const interval = setInterval(loadSessions, 3000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Logout handler
  const handleLogout = async () => {
    if (currentUser) {
      logAuditEvent({
        action: 'LOGOUT',
        severity: 'INFO',
        category: 'ACCESOS',
        psychologistUid: currentUser.uid,
        psychologistName: currentUser.displayName,
        psychologistEmail: currentUser.email || undefined,
        psychologistLicense: currentUser.license || undefined,
        details: `Cierre de sesión de ${currentUser.displayName} (${currentUser.license || 'ReTHUS'}).`,
      }).catch(() => {});
    }
    await logoutPsychologist();
    setCurrentUser(null);
    setIsCompletingProfile(false);
    setIsEditingProfile(false);
  };

  // Build currentSpecialist object from authenticated user
  const currentSpecialist: PsychologistProfile = currentUser ? {
    id: currentUser.uid,
    name: currentUser.displayName,
    role: currentUser.role,
    license: currentUser.license,
    avatar: currentUser.photoURL,
    specialty: currentUser.specialty,
    activeCasesCount: sessions.filter(
      (s) => s.state === 'HUMAN_MODE' && (!s.assignedPsychologistId || s.assignedPsychologistId === currentUser.uid || s.assignedPsychologistName === currentUser.displayName)
    ).length,
  } : {
    id: 'anonymous',
    name: 'Psicólogo de Guardia',
    role: 'Psicólogo Clínico',
    license: 'Sin Registro',
    avatar: 'https://images.unsplash.com/photo-1594824813576-a05e263d9061?w=150&auto=format&fit=crop&q=80',
    specialty: 'Triage de Crisis',
    activeCasesCount: 0,
  };

  // Handlers with automatic audit traceability
  const handleClaim = async (session: PatientSession) => {
    if (!currentUser) return;
    markCrisisNotified(session.id, session.phoneNumber);
    try {
      const updated = await claimSession(session.id, currentUser.uid, currentUser.displayName);
      await saveActiveSessionToFirestore(updated);
      await syncSessionToFirestoreClinicalRecord(updated);
      setSessions((prev) => prev.map((s) => (s.id === session.id ? updated : s)));
      setActiveSessionId(session.id);
      setActiveTab('ACTIVE');

      logAuditEvent({
        action: 'SESSION_CLAIM',
        severity: 'INFO',
        category: 'CLÍNICO',
        psychologistUid: currentUser.uid,
        psychologistName: currentUser.displayName,
        psychologistEmail: currentUser.email || undefined,
        psychologistLicense: currentUser.license || undefined,
        patientId: session.phoneNumber || session.id,
        patientName: session.userName,
        sessionId: session.id,
        details: `El especialista ${currentUser.displayName} (${currentUser.license || 'ReTHUS'}) tomó la atención de ${session.userName}.`,
      }).catch(() => {});
    } catch (e) {
      console.error('Error claiming session:', e);
    }
  };

  const handleSendMessage = async (sessionId: string, text: string) => {
    if (!currentUser) return;
    try {
      const updated = await sendPsychologistMessage(
        sessionId, 
        text, 
        currentUser.displayName || currentUser.email || 'Psicólogo Especialista'
      );
      await saveActiveSessionToFirestore(updated);
      await syncSessionToFirestoreClinicalRecord(updated);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
    } catch (e: any) {
      console.error('Error sending message via Twilio WhatsApp:', e);
      if (e.session) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? e.session : s)));
      }
      throw e;
    }
  };

  const handleTransfer = async (sessionId: string, target: 'AI_MODE' | 'WAITING_PSYCHOLOGIST') => {
    try {
      const targetSes = sessions.find(s => s.id === sessionId);
      const updated = await transferSession(sessionId, target);
      await saveActiveSessionToFirestore(updated);
      await syncSessionToFirestoreClinicalRecord(updated);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
      if (sessionId === activeSessionId && target === 'AI_MODE') {
        const next = sessions.find((s) => s.id !== sessionId && s.state === 'HUMAN_MODE');
        setActiveSessionId(next ? next.id : null);
      }

      logAuditEvent({
        action: 'SESSION_TRANSFER',
        severity: 'WARNING',
        category: 'TRANSFERENCIAS',
        psychologistUid: currentUser?.uid,
        psychologistName: currentUser?.displayName,
        psychologistEmail: currentUser?.email || undefined,
        psychologistLicense: currentUser?.license || undefined,
        patientId: targetSes?.phoneNumber || targetSes?.id,
        patientName: targetSes?.userName,
        sessionId,
        details: `Transferencia de caso ${targetSes?.userName || sessionId} hacia ${target === 'AI_MODE' ? 'Supervisor IA / Contención' : 'Cola de Guardia General'}.`,
      }).catch(() => {});
    } catch (e) {
      console.error('Error transferring session:', e);
    }
  };

  const handleSaveNotes = async (
    sessionId: string,
    data: {
      clinicalNotes?: string;
      tags?: string[];
      riskLevel?: RiskLevel;
      diagnosticImpressions?: string[];
    }
  ) => {
    try {
      const targetSes = sessions.find(s => s.id === sessionId);
      const updated = await saveClinicalNotes(sessionId, data);
      await saveActiveSessionToFirestore(updated);
      await syncSessionToFirestoreClinicalRecord(updated);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));

      logAuditEvent({
        action: 'CLINICAL_NOTE_UPDATE',
        severity: 'INFO',
        category: 'CLÍNICO',
        psychologistUid: currentUser?.uid,
        psychologistName: currentUser?.displayName,
        psychologistEmail: currentUser?.email || undefined,
        psychologistLicense: currentUser?.license || undefined,
        patientId: targetSes?.phoneNumber || targetSes?.id,
        patientName: targetSes?.userName,
        sessionId,
        details: `Modificación de notas clínicas y diagnósticos de ${targetSes?.userName || sessionId}. Nivel de Riesgo: ${data.riskLevel || targetSes?.riskLevel || 'N/A'}.`,
      }).catch(() => {});
    } catch (e) {
      console.error('Error saving notes:', e);
    }
  };

  const handleCloseSession = async (sessionId: string, resolutionNotes: string) => {
    try {
      markCrisisNotified(sessionId);
      const updated = await closeSession(sessionId, resolutionNotes);
      await syncSessionToFirestoreClinicalRecord(updated);
      await deleteActiveSessionFromFirestore(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      
      setActiveSessionId((prevId) => {
        if (prevId === sessionId) {
          const remaining = sessions.filter((s) => s.id !== sessionId && s.state === 'HUMAN_MODE');
          return remaining.length > 0 ? remaining[0].id : null;
        }
        return prevId;
      });

      logAuditEvent({
        action: 'SESSION_CLOSE',
        severity: 'INFO',
        category: 'CLÍNICO',
        psychologistUid: currentUser?.uid,
        psychologistName: currentUser?.displayName,
        psychologistEmail: currentUser?.email || undefined,
        psychologistLicense: currentUser?.license || undefined,
        patientId: updated.phoneNumber || updated.id,
        patientName: updated.userName,
        sessionId,
        details: `Caso concluido y archivado para ${updated.userName}. Notas de resolución: "${resolutionNotes.slice(0, 120)}..."`,
      }).catch(() => {});

      const notif: NotificationPayload = {
        title: '✅ Caso Concluido y Archivado',
        body: `La atención de ${updated.userName} ha sido archivada en Expedientes Clínicos.`,
        type: 'NEW_MESSAGE',
        timestamp: Date.now(),
      };
      setToasts((prev) => [notif, ...prev.slice(0, 3)]);
    } catch (e) {
      console.error('Error closing session:', e);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      await deleteActiveSessionFromFirestore(sessionId);
      setSessions((prev) => prev.filter(s => s.id !== sessionId && s.phoneNumber !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        localStorage.removeItem('psybot_active_session_id');
      }
    } catch (e) {
      console.error('Error deleting session:', e);
    }
  };

  const handleClearAllSessions = async () => {
    try {
      await clearAllSessions();
      await deleteAllActiveSessionsFromFirestore();
      setSessions([]);
      setActiveSessionId(null);
      localStorage.removeItem('psybot_active_session_id');
      localStorage.removeItem('psybot_active_sessions_cache');
    } catch (e) {
      console.error('Error clearing all sessions:', e);
    }
  };

  // Counts
  const waitingCount = sessions.filter(
    (s) => s.state === 'WAITING_PSYCHOLOGIST' || s.state === 'CRISIS_ALERT'
  ).length;

  const crisisCount = sessions.filter((s) => s.riskLevel === 'CRISIS').length;

  const myActiveCount = sessions.filter(
    (s) => s.state === 'HUMAN_MODE' && (!s.assignedPsychologistId || s.assignedPsychologistId === currentUser?.uid || s.assignedPsychologistName === currentUser?.displayName)
  ).length;

  const aiCount = sessions.filter((s) => s.state === 'AI_MODE').length;

  // 1. Initial authentication check (only if we don't have a currentUser yet)
  if (isAuthChecking && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4">
        <SubaTechLogo size="lg" showTagline={false} />
        <div className="w-8 h-8 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-mono">Iniciando Psybot...</p>
      </div>
    );
  }

  // 2. Unauthenticated Gate: Show Login, Register, or Portal
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <PsychologistLogin
          initialAuthMode={currentRoute === 'login' ? 'LOGIN' : currentRoute === 'registro' ? 'REGISTER' : 'NONE'}
          onNavigate={handleNavigate}
          protectedRouteAttempted={protectedRouteAttempted}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            logAuditEvent({
              action: 'LOGIN',
              severity: 'INFO',
              category: 'ACCESOS',
              psychologistUid: user.uid,
              psychologistName: user.displayName,
              psychologistEmail: user.email || undefined,
              psychologistLicense: user.license || undefined,
              details: `Inicio de sesión de ${user.displayName} (${user.email || 'sin correo'}). Tarjeta Profesional: ${user.license || 'N/A'}.`,
            }).catch(() => {});

            if (user.isAdmin || isUserAdmin(user.email)) {
              setIsCompletingProfile(false);
            } else {
              setIsCompletingProfile(!user.profileCompleted || !user.license?.trim());
            }
            handleNavigate('triage');
          }}
          onNeedsProfileCompletion={(draft) => {
            if (draft.isAdmin || isUserAdmin(draft.email)) {
              setCurrentUser(draft);
              setIsCompletingProfile(false);
            } else {
              setCurrentUser(draft);
              setIsCompletingProfile(true);
            }
          }}
        />
        <CookieConsentBanner />
      </div>
    );
  }

  // 3. User authenticated but must fill out their Sanitary Registration and Clinical Profile (Admin is exempted with full access)
  const isUserAdminRole = Boolean(currentUser.isAdmin || isUserAdmin(currentUser.email));
  if (!isUserAdminRole && (isCompletingProfile || !currentUser.profileCompleted || !currentUser.license?.trim())) {
    return (
      <>
        <CreatePsychologistProfile
          initialUser={currentUser}
          onProfileSaved={(saved) => {
            setCurrentUser(saved);
            setIsCompletingProfile(false);
          }}
        />
        <CookieConsentBanner />
      </>
    );
  }

  // 3.5. Mandatory Administrator Authorization Gate:
  // When a psychologist registers, an administrator must authorize their access to the website through the Admin Portal
  const isApproved = isUserAdminRole || currentUser.approvalStatus === 'APPROVED' || currentUser.isApproved === true;
  if (!isApproved) {
    return (
      <>
        <PendingApprovalScreen
          user={currentUser}
          onLogout={handleLogout}
          onApproved={(updatedUser) => {
            setCurrentUser(updatedUser);
            handleNavigate('triage');
          }}
        />
        <CookieConsentBanner />
      </>
    );
  }

  // Dynamic Theme Styling Classes
  const getThemeClasses = () => {
    switch (themeMode) {
      case 'dark':
        return 'min-h-screen bg-[#0B0F19] text-slate-100 font-bold flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950';
      case 'light':
        return 'min-h-screen bg-[#FDF6F0] text-slate-900 font-bold flex flex-col font-sans selection:bg-amber-200 selection:text-slate-900';
      case 'subatech':
      default:
        return 'min-h-screen bg-[#F0F4F8] text-slate-900 font-bold flex flex-col font-sans selection:bg-amber-300/60 selection:text-[#0B2545]';
    }
  };

  // 4. Authenticated Clinical Dashboard with Bogota.gov.co Style
  return (
    <div className={getThemeClasses()}>
      
      {/* 1 & 2. Fixed/Sticky Header and Navigation Suite (Auto-hides smoothly on scroll down) */}
      <div className={`sticky top-0 z-40 w-full transition-transform duration-300 ease-in-out ${
        isHeaderVisible ? 'translate-y-0 shadow-md' : '-translate-y-full shadow-none'
      }`}>
        {/* 1. Global Header (GOV.CO + Alcaldía Mayor de Bogotá D.C.) */}
        <Header
          currentUser={currentUser}
          onEditProfile={() => setIsEditingProfile(true)}
          onOpenSettings={async () => {
            const list = await listPsychologistsFromFirestore();
            setAllPsychologists(list);
            setSettingsInitialTab('profile');
            setIsSettingsOpen(true);
          }}
          onOpenAdminPortal={async () => {
            const list = await listPsychologistsFromFirestore();
            setAllPsychologists(list);
            setSettingsInitialTab('admins');
            setIsSettingsOpen(true);
          }}
          pendingApprovalsCount={pendingApprovalsCount}
          onOpenAccessibility={() => setIsAccessibilityOpen(true)}
          waitingCount={waitingCount}
          crisisCount={crisisCount}
          activeCount={myActiveCount}
          onLogout={handleLogout}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          browserPermission={browserPermission}
          onRequestPermission={handleRequestBrowserPermission}
          onTestNotification={handleTestNotification}
        />

        {/* 2. Primary Navigation Tabs (Portal Institucional Bogotá.gov.co) */}
        <div className="bg-[#0B2545] text-white shadow-md relative group">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative flex items-center">
            {/* Left scroll navigation arrow */}
            <button
              onClick={() => scrollNav('left')}
              className={`hidden sm:flex shrink-0 mr-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95 z-30 ${
                !canScrollLeft ? 'opacity-40 cursor-default' : ''
              }`}
              title="Desplazar hacia la izquierda"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Navigation Scroll Container with Subtle, Neutral Edge Fade Indicators */}
            <div className="relative flex-1 min-w-0 flex items-center overflow-hidden">
              {/* Left Edge Subtle Fade Indicator */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-3.5 pointer-events-none z-20 bg-gradient-to-r from-[#0B2545]/60 to-transparent transition-opacity duration-300 ${
                  canScrollLeft ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden="true"
              />

              <nav 
                ref={navContainerRef as any}
                onScroll={checkNavScroll}
                className={`flex-1 flex space-x-1 sm:space-x-2 pt-2 overflow-x-auto nav-scrollbar text-xs sm:text-sm font-semibold scroll-smooth ${
                  canScrollLeft && canScrollRight
                    ? 'fade-both'
                    : canScrollLeft
                    ? 'fade-left'
                    : canScrollRight
                    ? 'fade-right'
                    : ''
                }`}
              >
                
                {/* Bandeja General */}
                <button
                  onClick={() => handleNavigate('triage')}
                  className={`px-4 py-2.5 rounded-t-lg transition flex items-center gap-2 whitespace-nowrap shrink-0 border-t-2 ${
                    activeTab === 'QUEUE'
                      ? 'bg-[#F4F6F9] text-[#0B2545] font-bold border-t-[#FFC800] shadow-sm'
                      : 'text-slate-200 hover:text-white hover:bg-white/10 border-t-transparent'
                  }`}
                >
                  <Inbox className="w-4 h-4 text-[#C8102E]" />
                  <span>Guardia Triage Pacientes</span>
                  {waitingCount > 0 && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold font-mono ${
                      crisisCount > 0 ? 'bg-[#C8102E] text-white animate-pulse' : 'bg-[#FFC800] text-[#0B2545]'
                    }`}>
                      {waitingCount}
                    </span>
                  )}
                </button>

                {/* Mis Casos Activos */}
                <button
                  onClick={() => handleNavigate('chat')}
                  className={`px-4 py-2.5 rounded-t-lg transition flex items-center gap-2 whitespace-nowrap shrink-0 border-t-2 ${
                    activeTab === 'ACTIVE'
                      ? 'bg-[#F4F6F9] text-[#0B2545] font-bold border-t-[#FFC800] shadow-sm'
                      : 'text-slate-200 hover:text-white hover:bg-white/10 border-t-transparent'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>Mis Pacientes en Atención</span>
                  {myActiveCount > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold font-mono bg-emerald-100 text-emerald-800">
                      {myActiveCount}
                    </span>
                  )}
                </button>

                {/* Directorio de Psicólogos */}
                <button
                  onClick={() => handleNavigate('psicologos')}
                  className={`px-4 py-2.5 rounded-t-lg transition flex items-center gap-2 whitespace-nowrap shrink-0 border-t-2 ${
                    activeTab === 'PSYCHOLOGISTS'
                      ? 'bg-[#F4F6F9] text-[#0B2545] font-bold border-t-[#FFC800] shadow-sm'
                      : 'text-slate-200 hover:text-white hover:bg-white/10 border-t-transparent'
                  }`}
                >
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Directorio de Psicólogos</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold font-mono bg-cyan-900/60 text-cyan-200 border border-cyan-500/30">
                    {allPsychologists.length}
                  </span>
                </button>

                {/* Historial Clínico Firebase */}
                <button
                  onClick={() => handleNavigate('expedientes')}
                  className={`px-4 py-2.5 rounded-t-lg transition flex items-center gap-2 whitespace-nowrap shrink-0 border-t-2 ${
                    activeTab === 'RECORDS'
                      ? 'bg-[#F4F6F9] text-[#0B2545] font-bold border-t-[#FFC800] shadow-sm'
                      : 'text-slate-200 hover:text-white hover:bg-white/10 border-t-transparent'
                  }`}
                >
                  <Database className="w-4 h-4 text-blue-400" />
                  <span>Historias Clínicas Digitales</span>
                </button>

                {/* Monitor IA */}
                <button
                  onClick={() => handleNavigate('supervisor')}
                  className={`px-4 py-2.5 rounded-t-lg transition flex items-center gap-2 whitespace-nowrap shrink-0 border-t-2 ${
                    activeTab === 'SUPERVISOR'
                      ? 'bg-[#F4F6F9] text-[#0B2545] font-bold border-t-[#FFC800] shadow-sm'
                      : 'text-slate-200 hover:text-white hover:bg-white/10 border-t-transparent'
                  }`}
                >
                  <Bot className="w-4 h-4 text-purple-400" />
                  <span>Supervisor Clínico IA</span>
                  {aiCount > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-purple-100 text-purple-900">
                      {aiCount}
                    </span>
                  )}
                </button>

                {/* Tab Portal de Administradores (Only for Administrator) */}
                {isUserAdminRole && (
                  <button
                    type="button"
                    onClick={async () => {
                      const list = await listPsychologistsFromFirestore();
                      setAllPsychologists(list);
                      setSettingsInitialTab('admins');
                      setIsSettingsOpen(true);
                    }}
                    className={`px-4 py-2.5 rounded-t-lg transition flex items-center gap-2 whitespace-nowrap shrink-0 border-t-2 cursor-pointer ${
                      pendingApprovalsCount > 0 
                        ? 'bg-amber-400 text-slate-950 font-bold border-t-amber-300 shadow-sm animate-pulse' 
                        : 'text-amber-300 hover:text-white hover:bg-white/10 border-t-transparent'
                    }`}
                    title="Portal de Administradores - Autorizaciones y Gestión de Usuarios"
                  >
                    <ShieldAlert className={`w-4 h-4 ${pendingApprovalsCount > 0 ? 'text-slate-950' : 'text-amber-400'}`} />
                    <span>Portal Administrador</span>
                    {pendingApprovalsCount > 0 ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold font-mono bg-slate-950 text-amber-300 border border-amber-300">
                        ⚠️ {pendingApprovalsCount} pendientes
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-amber-950/60 text-amber-300 border border-amber-500/30">
                        Control
                      </span>
                    )}
                  </button>
                )}
              </nav>

              {/* Right Edge Subtle Fade Indicator */}
              <div
                className={`absolute right-0 top-0 bottom-0 w-3.5 pointer-events-none z-20 bg-gradient-to-l from-[#0B2545]/60 to-transparent transition-opacity duration-300 ${
                  canScrollRight ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden="true"
              />
            </div>

            {/* Right scroll navigation arrow */}
            <button
              onClick={() => scrollNav('right')}
              className={`hidden sm:flex shrink-0 ml-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95 z-30 ${
                !canScrollRight ? 'opacity-40 cursor-default' : ''
              }`}
              title="Desplazar hacia la derecha"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          {/* Franja Bandera de Bogotá D.C. (Amarillo y Rojo) */}
          <div className="bogota-flag-ribbon w-full"></div>
        </div>
      </div>

      {/* 3. Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* TAB 1: Guardia / Cola General */}
        {activeTab === 'QUEUE' && (
          <GeneralQueue
            sessions={sessions}
            onClaim={handleClaim}
            onPreview={(session) => setPreviewModalSession(session)}
            onOpenRecord={(recordId) => {
              setSelectedRecordId(recordId);
              setActiveTab('RECORDS');
            }}
            onOpenRegisterModal={() => setIsRegistrationModalOpen(true)}
          />
        )}

        {/* TAB 2: Mis Pacientes Activos */}
        {activeTab === 'ACTIVE' && (
          <ActiveChat
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={(id) => setActiveSessionId(id)}
            currentSpecialist={currentSpecialist}
            onSendMessage={handleSendMessage}
            onTransfer={handleTransfer}
            onSaveNotes={handleSaveNotes}
            onCloseSession={handleCloseSession}
            onOpenReportModal={(session) => setReportModalSession(session)}
            onNavigateToRecord={(recordId) => {
              setSelectedRecordId(recordId);
              setActiveTab('RECORDS');
            }}
          />
        )}

        {/* TAB 3: Directorio de Psicólogos y Asignación de Roles/Permisos */}
        {activeTab === 'PSYCHOLOGISTS' && (
          <PsychologistsDirectoryView
            currentUser={currentUser}
            allPsychologists={allPsychologists}
            onNavigate={handleNavigate}
            onOpenSettings={async () => {
              const list = await listPsychologistsFromFirestore();
              setAllPsychologists(list);
              setIsSettingsOpen(true);
            }}
          />
        )}

        {/* TAB 4: Historiales Clínicos (Firebase Firestore) */}
        {activeTab === 'RECORDS' && (
          <ClinicalRecordsView
            sessions={sessions}
            initialSelectedRecordId={selectedRecordId}
            onSelectRecord={(recId) => setSelectedRecordId(recId)}
            currentUser={currentUser}
          />
        )}

        {/* TAB 5: Supervisión IA (Gemini) */}
        {activeTab === 'SUPERVISOR' && (
          <AiSupervisor
            sessions={sessions}
            onTakeOver={(session) => {
              handleClaim(session);
            }}
            onPreview={(session) => setPreviewModalSession(session)}
          />
        )}

      </main>

      {/* Pie de Página Institucional (Alcaldía Mayor de Bogotá D.C. - Secretaría Distrital de Salud) */}
      <footer className="bg-[#0B2545] text-slate-300 text-xs border-t-4 border-[#C8102E] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-slate-700">
            <div>
              <div className="flex items-center gap-2 mb-2 text-white font-bold text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFC800]"></span>
                <span>ALCALDÍA MAYOR DE BOGOTÁ D.C.</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Secretaría Distrital de Salud · Subred Integrada de Servicios de Salud Norte E.S.E.
                <br />Plataforma Distrital de Orientación Psicológica y Triage Clínico (SubaTECH / Psybot).
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C8102E]"></span>
                Líneas de Atención en Salud Mental
              </h4>
              <ul className="space-y-1 text-slate-400 text-xs">
                <li>• <strong className="text-slate-200">Línea 106:</strong> Ayuda emocional 24/7 "El poder de ser escuchado"</li>
                <li>• <strong className="text-slate-200">Línea 123:</strong> Número Único de Seguridad y Emergencias Bogotá</li>
                <li>• <strong className="text-slate-200">Línea Púrpura:</strong> 01 8000 112 137 (Atención distrital a mujeres)</li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-2">Canales Distritales Oficiales</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Sede Central: Cra 32 #12-81, Bogotá D.C., Colombia
                <br />Conmutador: (601) 364 9090
                <br />Portales:{' '}
                <a 
                  href="https://bogota.gov.co" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[#FFC800] hover:underline font-semibold"
                >
                  bogota.gov.co
                </a>
                {' · '}
                <a 
                  href="https://www.saludcapital.gov.co" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[#FFC800] hover:underline font-semibold"
                >
                  saludcapital.gov.co
                </a>
              </p>
            </div>
          </div>

          {/* Legal and Privacy Bar */}
          <div className="pt-4 mt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between text-slate-400 text-[11px] gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => {
                  setLegalTab('PRIVACY');
                  setShowLegalModal(true);
                }}
                className="hover:text-[#FFC800] transition underline"
              >
                Política de Privacidad
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => {
                  setLegalTab('HABEAS_DATA');
                  setShowLegalModal(true);
                }}
                className="hover:text-[#FFC800] transition underline"
              >
                Tratamiento de Datos Personales (Ley 1581)
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => {
                  setLegalTab('TERMS');
                  setShowLegalModal(true);
                }}
                className="hover:text-[#FFC800] transition underline"
              >
                Términos y Condiciones
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => {
                  setLegalTab('CONSENT');
                  setShowLegalModal(true);
                }}
                className="hover:text-[#FFC800] transition underline"
              >
                Secreto Profesional (Ley 1090)
              </button>
              <span>·</span>
              <a
                href="https://drive.google.com/drive/folders/1VeROKtR3yWXn2X8Hkx_AwZIMO0jS-xmu?usp=drive_link"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-300 hover:text-white transition underline font-semibold inline-flex items-center gap-1"
              >
                <span>Google Drive del Proyecto</span>
              </a>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-slate-400">SubaTECH · Cocreando la Suba del Futuro</span>
              <span>·</span>
              <span className="text-emerald-400 font-mono">Plataforma Segura SSL/TLS</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Profile Editing Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CreatePsychologistProfile
              initialUser={currentUser}
              isEditing={true}
              onCancel={() => setIsEditingProfile(false)}
              onProfileSaved={(updated) => {
                setCurrentUser(updated);
                setIsEditingProfile(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Settings Modal (Profile, Admins, Theme, Secrets, Patient Management) */}
      {isSettingsOpen && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setIsSettingsOpen(false)}
          initialTab={settingsInitialTab}
          onUpdateUser={(updated) => {
            setCurrentUser(updated);
            savePsychologistProfile(updated);
          }}
          allPsychologists={allPsychologists}
          onUpdatePsychologistRole={async (uid, isAdmin, role, permissions, approvalStatus, isApproved) => {
            const updatedList = allPsychologists.map(p => {
              if (p.uid === uid) {
                return {
                  ...p,
                  isAdmin,
                  ...(role !== undefined ? { role } : {}),
                  ...(permissions !== undefined ? { permissions } : {}),
                  ...(approvalStatus !== undefined ? { approvalStatus } : {}),
                  ...(isApproved !== undefined ? { isApproved } : {}),
                };
              }
              return p;
            });
            setAllPsychologists(updatedList);
            const target = updatedList.find(p => p.uid === uid);
            if (target) {
              await savePsychologistProfile(target);
              if (currentUser && currentUser.uid === uid) {
                setCurrentUser(target);
              }
            }
          }}
          themeMode={themeMode}
          onThemeChange={(mode) => setThemeMode(mode)}
          sessions={sessions}
          onDeleteSession={handleDeleteSession}
          onClearAllSessions={handleClearAllSessions}
        />
      )}

      {/* Clinical Report Modal */}
      {reportModalSession && (
        <ClinicalReportModal
          session={reportModalSession}
          currentUser={currentUser}
          onClose={() => setReportModalSession(null)}
        />
      )}

      {/* Preview Case Modal */}
      {previewModalSession && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 text-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004884] flex items-center justify-center border border-blue-200">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {previewModalSession.userName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {previewModalSession.phoneNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewModalSession(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-600 font-medium">Nivel de Riesgo Clínico:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold ${
                  previewModalSession.riskLevel === 'CRISIS' 
                    ? 'bg-[#C8102E] text-white animate-pulse' 
                    : previewModalSession.riskLevel === 'ALTO'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-blue-100 text-blue-900'
                }`}>
                  {previewModalSession.riskLevel}
                </span>
              </div>

              <div>
                <p className="text-slate-700 mb-1 font-semibold">Resumen de Triage:</p>
                <p className="text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                  {previewModalSession.triageSummary}
                </p>
              </div>

              <div>
                <p className="text-slate-700 mb-1 font-semibold">Último mensaje recibido vía WhatsApp:</p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700 font-mono text-[11px]">
                  {previewModalSession.messages[previewModalSession.messages.length - 1]?.text}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => setPreviewModalSession(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  const s = previewModalSession;
                  setPreviewModalSession(null);
                  handleClaim(s);
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-[#004884] text-white hover:bg-[#003866] flex items-center gap-1.5 shadow-sm transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Asignar a Mi Guardia</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Visual and Sound Notification Toast Container */}
      <NotificationToastContainer
        notifications={toasts}
        onDismiss={(index) => {
          setToasts((prev) => prev.filter((_, i) => i !== index));
        }}
        onAction={(notif) => {
          if (notif.sessionId) {
            const matched = sessions.find((s) => s.id === notif.sessionId);
            if (notif.type === 'NEW_MESSAGE') {
              setActiveSessionId(notif.sessionId);
              setActiveTab('ACTIVE');
            } else {
              setActiveTab('QUEUE');
              if (matched) setPreviewModalSession(matched);
            }
          } else {
            setActiveTab('QUEUE');
          }
        }}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
      />

      {/* Legal Policies, Data Protection and Terms Modal */}
      <LegalTermsModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        initialTab={legalTab}
        showAcceptButton={false}
      />

      {/* Accessibility & Inclusion Modal (Silla de Ruedas / Ajustes Adaptados) */}
      <AccessibilityModal
        isOpen={isAccessibilityOpen}
        onClose={() => setIsAccessibilityOpen(false)}
      />

      {/* Patient Registration Modal with Real-time Validation */}
      <PatientRegistrationModal
        isOpen={isRegistrationModalOpen}
        onClose={() => setIsRegistrationModalOpen(false)}
        onRegister={handleRegisterNewPatient}
      />

    </div>
  );
}
