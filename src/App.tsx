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
  closeSession
} from './services/api.ts';
import { Header } from './components/Header.tsx';
import { GeneralQueue } from './components/GeneralQueue.tsx';
import { ActiveChat } from './components/ActiveChat.tsx';
import { AiSupervisor } from './components/AiSupervisor.tsx';
import { ClinicalReportModal } from './components/ClinicalReportModal.tsx';
import { ClinicalRecordsView } from './components/ClinicalRecordsView.tsx';
import { PsychologistLogin } from './components/PsychologistLogin.tsx';
import { CreatePsychologistProfile } from './components/CreatePsychologistProfile.tsx';
import { CookieConsentBanner } from './components/CookieConsentBanner.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { SubaTechLogo } from './components/SubaTechLogo.tsx';
import { LegalTermsModal, LegalTabType } from './components/LegalTermsModal.tsx';
import { NotificationToastContainer } from './components/NotificationToast.tsx';
import { PsychologistsDirectoryView } from './components/PsychologistsDirectoryView.tsx';
import { AppRoute, parseCurrentRoute, navigateTo, normalizeRoute } from './lib/router.ts';
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
  savePsychologistProfile
} from './lib/firebase.ts';
import { onAuthStateChanged } from 'firebase/auth';

type NavigationTab = 'QUEUE' | 'ACTIVE' | 'SUPERVISOR' | 'RECORDS' | 'PSYCHOLOGISTS' | 'LANDING';

export default function App() {
  const [currentUser, setCurrentUser] = useState<PsychologistAuthUser | null>(() => getStoredPsychologist());
  // If user is already in storage, do not show any loading screen
  const [isAuthChecking, setIsAuthChecking] = useState(() => !getStoredPsychologist());
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTabType>('PRIVACY');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'subatech'>('subatech');
  const [allPsychologists, setAllPsychologists] = useState<PsychologistAuthUser[]>([]);

  // Routing and Subdomain Navigation State
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => parseCurrentRoute());
  const [protectedRouteAttempted, setProtectedRouteAttempted] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    const route = parseCurrentRoute();
    if (route === 'triage') return 'QUEUE';
    if (route === 'chat') return 'ACTIVE';
    if (route === 'expedientes') return 'RECORDS';
    if (route === 'supervisor') return 'SUPERVISOR';
    if (route === 'psicologos') return 'PSYCHOLOGISTS';
    if (route === 'inicio') return 'LANDING';
    return 'QUEUE';
  });
  const [sessions, setSessions] = useState<PatientSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [reportModalSession, setReportModalSession] = useState<PatientSession | null>(null);
  const [previewModalSession, setPreviewModalSession] = useState<PatientSession | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  const scrollNav = (direction: 'left' | 'right') => {
    if (navContainerRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      navContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    testFirestoreConnection();

    // Fast safety timeout: never let auth checking block the user for more than 400ms
    const safetyTimer = setTimeout(() => {
      setIsAuthChecking(false);
    }, 400);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimer);
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
            provider: firebaseUser.providerData[0]?.providerId || 'google.com',
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

  // Fetch psychologists list on boot
  useEffect(() => {
    listPsychologistsFromFirestore().then((list) => {
      setAllPsychologists(list);
    }).catch((err) => {
      console.warn('Could not load psychologists list on boot:', err);
    });
  }, []);

  // Central Router Handler: supports accounts, protection, and browser history
  const handleNavigate = (rawRoute: AppRoute | string, replace = false) => {
    const targetRoute = normalizeRoute(rawRoute);
    const isAuthed = Boolean(currentUser && currentUser.profileCompleted);

    // If unauthenticated and tries to access protected sub-domains
    if (!isAuthed && (targetRoute === 'triage' || targetRoute === 'chat' || targetRoute === 'expedientes' || targetRoute === 'supervisor' || targetRoute === 'auditoria')) {
      setProtectedRouteAttempted(targetRoute);
      setCurrentRoute('login');
      navigateTo('login', replace);
      return;
    }

    if (!isAuthed && targetRoute === 'psicologos') {
      setProtectedRouteAttempted(null);
      setCurrentRoute('psicologos');
      navigateTo('psicologos', replace);
      return;
    }

    setProtectedRouteAttempted(null);
    setCurrentRoute(targetRoute);

    if (targetRoute === 'triage') setActiveTab('QUEUE');
    else if (targetRoute === 'chat') setActiveTab('ACTIVE');
    else if (targetRoute === 'expedientes') setActiveTab('RECORDS');
    else if (targetRoute === 'supervisor') setActiveTab('SUPERVISOR');
    else if (targetRoute === 'psicologos') setActiveTab('PSYCHOLOGISTS');
    else if (targetRoute === 'inicio') setActiveTab('LANDING');
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
      else if (nextRoute === 'inicio') setActiveTab('LANDING');
      else if (nextRoute === 'auditoria') {
        setIsSettingsOpen(true);
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
  }, []);

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

  // Sync sessions from backend periodically and detect events for notifications
  const loadSessions = async () => {
    const list = await fetchSessions();
    setSessions(list);

    if (!activeSessionId && list.length > 0) {
      const firstHuman = list.find((s) => s.state === 'HUMAN_MODE');
      if (firstHuman) {
        setActiveSessionId(firstHuman.id);
      }
    }

    // Check for alerts and notifications if this is not the initial boot
    if (!isFirstLoadRef.current && currentUser && currentUser.profileCompleted) {
      const prevMap = previousSessionsMapRef.current;

      list.forEach((s) => {
        const prev = prevMap.get(s.id);

        // 1. New patient registered in triage queue or crisis alert
        if (!prev) {
          if (s.state === 'CRISIS_ALERT' || s.riskLevel === 'CRISIS') {
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
          } else if (s.state === 'WAITING_PSYCHOLOGIST') {
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
          }
        } else {
          // 2. Existing session transitioned to crisis or waiting
          if (prev.state !== 'CRISIS_ALERT' && (s.state === 'CRISIS_ALERT' || s.riskLevel === 'CRISIS')) {
            const notif: NotificationPayload = {
              title: `🚨 ¡Alerta Crítica: ${s.userName}!`,
              body: s.triageSummary || 'El caso ha sido reclasificado a riesgo crítico.',
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
          } else if (prev.state !== 'WAITING_PSYCHOLOGIST' && s.state === 'WAITING_PSYCHOLOGIST') {
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

  // Handlers
  const handleClaim = async (session: PatientSession) => {
    if (!currentUser) return;
    try {
      const updated = await claimSession(session.id, currentUser.uid, currentUser.displayName);
      setSessions((prev) => prev.map((s) => (s.id === session.id ? updated : s)));
      setActiveSessionId(session.id);
      setActiveTab('ACTIVE');
    } catch (e) {
      console.error('Error claiming session:', e);
    }
  };

  const handleSendMessage = async (sessionId: string, text: string) => {
    if (!currentUser) return;
    try {
      const updated = await sendPsychologistMessage(sessionId, text, currentUser.displayName);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
    } catch (e) {
      console.error('Error sending message:', e);
    }
  };

  const handleTransfer = async (sessionId: string, target: 'AI_MODE' | 'WAITING_PSYCHOLOGIST') => {
    try {
      const updated = await transferSession(sessionId, target);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
      if (sessionId === activeSessionId && target === 'AI_MODE') {
        const next = sessions.find((s) => s.id !== sessionId && s.state === 'HUMAN_MODE');
        setActiveSessionId(next ? next.id : null);
      }
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
      const updated = await saveClinicalNotes(sessionId, data);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
    } catch (e) {
      console.error('Error saving notes:', e);
    }
  };

  const handleCloseSession = async (sessionId: string, resolutionNotes: string) => {
    try {
      const updated = await closeSession(sessionId, resolutionNotes);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
      const next = sessions.find((s) => s.id !== sessionId && s.state === 'HUMAN_MODE');
      setActiveSessionId(next ? next.id : null);
    } catch (e) {
      console.error('Error closing session:', e);
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

  // 2. Unauthenticated Gate: Show Login, Register, Landing or Protected Psychologists Gate
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {currentRoute === 'psicologos' ? (
          <main className="flex-1">
            <PsychologistsDirectoryView
              currentUser={null}
              allPsychologists={allPsychologists}
              onNavigate={handleNavigate}
            />
          </main>
        ) : (
          <PsychologistLogin
            initialAuthMode={currentRoute === 'login' ? 'LOGIN' : currentRoute === 'registro' ? 'REGISTER' : 'NONE'}
            onNavigate={handleNavigate}
            protectedRouteAttempted={protectedRouteAttempted}
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              if (user.isAdmin || user.email === 'kailabwasd@gmail.com') {
                setIsCompletingProfile(false);
              } else {
                setIsCompletingProfile(!user.profileCompleted || !user.license?.trim());
              }
              handleNavigate('triage');
            }}
            onNeedsProfileCompletion={(draft) => {
              if (draft.isAdmin || draft.email === 'kailabwasd@gmail.com') {
                setCurrentUser(draft);
                setIsCompletingProfile(false);
              } else {
                setCurrentUser(draft);
                setIsCompletingProfile(true);
              }
            }}
          />
        )}
        <CookieConsentBanner />
      </div>
    );
  }

  // 3. User authenticated but must fill out their Sanitary Registration and Clinical Profile (Admin is exempted with full access)
  const isUserAdminRole = Boolean(currentUser.isAdmin || currentUser.email === 'kailabwasd@gmail.com');
  if (!isUserAdminRole && (isCompletingProfile || !currentUser.profileCompleted || !currentUser.license?.trim())) {
    return (
      <>
        <CreatePsychologistProfile
          initialUser={currentUser}
          onProfileSaved={(saved) => {
            setCurrentUser(saved);
            setIsCompletingProfile(false);
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
        return 'min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-[#00E5FF] selection:text-slate-950';
      case 'light':
        return 'min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-[#FFC800] selection:text-slate-900';
      case 'subatech':
      default:
        return 'min-h-screen bg-[#F4F6F9] text-slate-800 flex flex-col font-sans selection:bg-[#FFC800] selection:text-[#0B2545]';
    }
  };

  // 4. Authenticated Clinical Dashboard with Bogota.gov.co Style
  return (
    <div className={getThemeClasses()}>
      
      {/* 1. Global Header (GOV.CO + Alcaldía Mayor de Bogotá D.C.) */}
      <Header
        currentUser={currentUser}
        onEditProfile={() => setIsEditingProfile(true)}
        onOpenSettings={async () => {
          const list = await listPsychologistsFromFirestore();
          setAllPsychologists(list);
          setIsSettingsOpen(true);
        }}
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
            className="hidden sm:flex shrink-0 mr-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95 z-10"
            title="Desplazar hacia la izquierda"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <nav 
            ref={navContainerRef as any}
            className="flex-1 flex space-x-1 sm:space-x-2 pt-2 overflow-x-auto nav-scrollbar text-xs sm:text-sm font-semibold scroll-smooth"
          >
            
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
                {allPsychologists.length || 1}
              </span>
            </button>

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
          </nav>

          {/* Right scroll navigation arrow */}
          <button
            onClick={() => scrollNav('right')}
            className="hidden sm:flex shrink-0 ml-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95 z-10"
            title="Desplazar hacia la derecha"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        {/* Franja Bandera de Bogotá D.C. (Amarillo y Rojo) */}
        <div className="bogota-flag-ribbon w-full"></div>
      </div>

      {/* 3. Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* TAB 0: Directorio de Psicólogos (Sub-dominio protegido) */}
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

        {/* TAB 3: Historiales Clínicos (Firebase Firestore) */}
        {activeTab === 'RECORDS' && (
          <ClinicalRecordsView
            sessions={sessions}
            initialSelectedRecordId={selectedRecordId}
            onSelectRecord={(recId) => setSelectedRecordId(recId)}
            currentUser={currentUser}
          />
        )}

        {/* TAB 4: Supervisión IA (Gemini) */}
        {activeTab === 'SUPERVISOR' && (
          <AiSupervisor
            sessions={sessions}
            onTakeOver={(session) => {
              handleClaim(session);
            }}
            onPreview={(session) => setPreviewModalSession(session)}
          />
        )}

        {/* TAB 5: Vista de Inicio Institucional (Sub-dominio público /inicio) */}
        {activeTab === 'LANDING' && (
          <div className="space-y-6">
            <div className="p-4 bg-cyan-950/50 border border-cyan-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-cyan-200">
                <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Portal Institucional de Inicio de MindBridge SubaTECH. Sesión activa: <strong className="text-white">{currentUser?.displayName}</strong>.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleNavigate('triage')}
                  className="px-3.5 py-1.5 bg-[#00E5FF] hover:bg-[#00D2F4] text-slate-950 font-bold rounded-xl transition text-[11px] cursor-pointer shadow-sm"
                >
                  Ir a Guardia de Triage →
                </button>
              </div>
            </div>

            <PsychologistLogin
              initialAuthMode="NONE"
              onNavigate={handleNavigate}
              onLoginSuccess={() => {}}
              onNeedsProfileCompletion={() => {}}
            />
          </div>
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

      {/* Settings Modal (Profile, Admins, Theme, Secrets) */}
      {isSettingsOpen && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setIsSettingsOpen(false)}
          onUpdateUser={(updated) => {
            setCurrentUser(updated);
            savePsychologistProfile(updated);
          }}
          allPsychologists={allPsychologists}
          onUpdatePsychologistRole={async (uid, isAdmin, role, permissions) => {
            const updatedList = allPsychologists.map(p => {
              if (p.uid === uid) {
                return {
                  ...p,
                  isAdmin,
                  ...(role !== undefined ? { role } : {}),
                  ...(permissions !== undefined ? { permissions } : {}),
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

    </div>
  );
}
