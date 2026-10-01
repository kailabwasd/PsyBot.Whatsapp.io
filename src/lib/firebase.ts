import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  type User 
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  type DocumentData
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { PsychologistAuthUser, PsychologistPermissions } from '../types/index.ts';
import { encryptSecret, decryptSecret } from './cryptoUtils.ts';
import { generateSecret, generateURI, verifySync } from 'otplib';
import qrcode from 'qrcode';
import { reportFirestoreCriticalError } from '../services/api.ts';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Cloud Firestore with High-Performance Multi-Tab IndexedDB Local Cache
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
  console.log('[Firestore Turbo] IndexedDB multi-tab cache initialized for instant 0ms loads.');
} catch (err) {
  // Fallback to standard instance if already initialized by HMR
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;

/**
 * Generate a new TOTP secret and QR code data URL for 2FA setup
 */
export async function generate2FASecret(userEmail: string): Promise<{ secret: string; qrCodeUrl: string }> {
  const secret = generateSecret();
  const serviceName = 'Psybot SubaTECH';
  const otpauth = generateURI({ secret, label: userEmail, issuer: serviceName });
  const qrCodeUrl = await qrcode.toDataURL(otpauth);
  return { secret, qrCodeUrl };
}

/**
 * Verify a 6-digit TOTP token against a user secret
 */
export function verify2FAToken(token: string, secret: string): boolean {
  try {
    const result = verifySync({ token, secret });
    return typeof result === 'boolean' ? result : !!(result && (result as any).valid);
  } catch {
    return false;
  }
}

// Authorized Administrator Real Accounts (kailabwasd@gmail.com)
export const ADMIN_EMAILS = [
  'kailabwasd@gmail.com'
];

export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.trim().toLowerCase());
}

export function createAdminProfile(email = 'kailabwasd@gmail.com', name?: string, photo?: string): PsychologistAuthUser {
  return {
    uid: 'admin-kailabwasd',
    email: email,
    displayName: name || 'Administrador Clínico (kailabwasd)',
    photoURL: photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    provider: 'google.com',
    role: 'Super Administrador & Director Clínico',
    license: 'REG-SAN-ADMIN-001 (Acceso Total)',
    specialty: 'Dirección Clínica, Triage & Supervisión IA',
    institution: 'Subred Integrada de Servicios de Salud Norte - Psybot SubaTECH',
    phone: '+57 300 987 6543',
    termsAccepted: true,
    profileCompleted: true,
    isApproved: true,
    approvalStatus: 'APPROVED',
    approvedAt: 1704067200000,
    approvedBy: 'SYSTEM_SUPERADMIN',
    isAdmin: true,
    permissions: {
      lectura: true,
      escritura: true,
      administrativo: true,
    },
    createdAt: 1704067200000,
    lastLoginAt: Date.now(),
  };
}

// Test Firestore Connection in background without blocking execution
export function testFirestoreConnection() {
  try {
    getDocFromServer(doc(db, 'clinical_records', 'test_connection')).catch(() => {});
  } catch {
    // Non-blocking
  }
}

// Google Auth Provider configured with required scopes (Drive, Docs, Sheets)
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.addScope('https://www.googleapis.com/auth/documents');
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

let cachedAccessToken: string | null = null;
export let isSigningIn = false;

/**
 * Ensure a valid non-empty UID for Firestore documents
 */
export function ensureValidUid(uid?: string | null, email?: string | null): string {
  if (uid && uid.trim().length > 0) return uid.trim();
  if (email && email.trim().length > 0) {
    return `email-${email.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  return `psy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Find psychologist in Firestore by email address
 */
export async function findPsychologistByEmail(rawEmail: string): Promise<PsychologistAuthUser | null> {
  const cleanEmail = (rawEmail || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  try {
    const colRef = collection(db, 'psychologists');
    const q = query(colRef, where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const data = snap.docs[0].data() as PsychologistAuthUser;
      if (data.twoFactorSecret) {
        data.twoFactorSecret = await decryptSecret(data.twoFactorSecret);
      }
      return data;
    }

    // Check by deterministic UID fallback
    const uidFallback = `google-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const docSnap = await getDoc(doc(db, 'psychologists', uidFallback));
    if (docSnap.exists()) {
      const data = docSnap.data() as PsychologistAuthUser;
      if (data.twoFactorSecret) {
        data.twoFactorSecret = await decryptSecret(data.twoFactorSecret);
      }
      return data;
    }
  } catch (err) {
    console.warn('Error querying psychologist by email in Firestore:', err);
  }
  return null;
}

/**
 * Find psychologist in Firestore by professional license (Tarjeta Profesional / ReTHUS)
 */
export async function findPsychologistByLicense(rawLicense: string): Promise<PsychologistAuthUser | null> {
  const cleanLicense = (rawLicense || '').trim().toLowerCase();
  if (!cleanLicense) return null;

  try {
    const colRef = collection(db, 'psychologists');
    const snap = await getDocs(colRef);
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as PsychologistAuthUser;
      if (data.license && data.license.trim().toLowerCase() === cleanLicense) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Error querying psychologist by license in Firestore:', err);
  }
  return null;
}

/**
 * Fetch psychologist profile from Firestore with strict timeout to prevent hangs
 */
export async function getPsychologistFromFirestore(uid: string): Promise<PsychologistAuthUser | null> {
  try {
    const docRef = doc(db, 'psychologists', uid);
    const snapPromise = getDoc(docRef);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    const snap = await Promise.race([snapPromise, timeoutPromise]);
    if (snap && 'exists' in snap && (snap as any).exists()) {
      const data = (snap as any).data() as PsychologistAuthUser;
      if (data.twoFactorSecret) {
        data.twoFactorSecret = await decryptSecret(data.twoFactorSecret);
      }
      return data;
    }
  } catch (err) {
    console.warn('Error reading psychologist profile from Firestore:', err);
  }
  return null;
}

/**
 * Save / Update psychologist profile in Firestore and localStorage (with encrypted 2FA secret)
 */
export async function savePsychologistProfile(profile: PsychologistAuthUser): Promise<PsychologistAuthUser> {
  const isSuperAdmin = isUserAdmin(profile.email);
  const isApproved = isSuperAdmin ? true : (profile.isApproved !== undefined ? profile.isApproved : false);
  const approvalStatus = isSuperAdmin ? 'APPROVED' : (profile.approvalStatus || (isApproved ? 'APPROVED' : 'PENDING'));
  const safeUid = ensureValidUid(profile.uid, profile.email);

  const updatedProfile: PsychologistAuthUser = {
    ...profile,
    uid: safeUid,
    isApproved,
    approvalStatus,
    permissions: profile.permissions || {
      lectura: isSuperAdmin || Boolean(isApproved),
      escritura: isSuperAdmin || Boolean(isApproved),
      administrativo: Boolean(profile.isAdmin || isSuperAdmin),
    },
    profileCompleted: Boolean(profile.license?.trim()),
    lastLoginAt: Date.now(),
  };

  try {
    // Encrypt 2FA secret before persisting to Firestore for medical data compliance
    const firestorePayload: any = { ...updatedProfile };
    if (updatedProfile.twoFactorSecret) {
      firestorePayload.twoFactorSecret = await encryptSecret(updatedProfile.twoFactorSecret);
      firestorePayload.is2FASecretEncrypted = true;
    }

    const userDocRef = doc(db, 'psychologists', safeUid);
    await setDoc(userDocRef, firestorePayload, { merge: true });
  } catch (error: any) {
    console.warn('Could not sync psychologist profile to Firestore:', error);
    reportFirestoreCriticalError(error, 'Error al procesar Perfil de Psicólogo para Firestore', `UID: ${safeUid}`).catch(() => {});
  }

  localStorage.setItem('psybot_psychologist_session', JSON.stringify(updatedProfile));
  localStorage.setItem('subatech_psychologist_session', JSON.stringify(updatedProfile));
  return updatedProfile;
}

/**
 * Approve a psychologist access from the Administrator Portal
 */
export async function approvePsychologist(
  uid: string, 
  adminEmail: string, 
  permissions?: PsychologistPermissions, 
  role?: string
): Promise<PsychologistAuthUser> {
  const docRef = doc(db, 'psychologists', uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error(`No se encontró el psicólogo con ID ${uid} en Firestore.`);
  }
  const current = snap.data() as PsychologistAuthUser;
  const updated: PsychologistAuthUser = {
    ...current,
    isApproved: true,
    approvalStatus: 'APPROVED',
    approvedAt: Date.now(),
    approvedBy: adminEmail,
    role: role || current.role || 'Psicólogo(a) Clínico Titulado(a)',
    permissions: permissions || {
      lectura: true,
      escritura: true,
      administrativo: Boolean(current.isAdmin),
    },
  };
  await savePsychologistProfile(updated);
  return updated;
}

/**
 * Reject or suspend a psychologist access from the Administrator Portal
 */
export async function rejectOrSuspendPsychologist(
  uid: string, 
  adminEmail: string, 
  reason?: string
): Promise<PsychologistAuthUser> {
  const docRef = doc(db, 'psychologists', uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error(`No se encontró el psicólogo con ID ${uid} en Firestore.`);
  }
  const current = snap.data() as PsychologistAuthUser;
  const updated: PsychologistAuthUser = {
    ...current,
    isApproved: false,
    approvalStatus: 'REJECTED',
    rejectionReason: reason || 'Acceso revocado o no autorizado por la Dirección Clínica',
    permissions: {
      lectura: false,
      escritura: false,
      administrativo: false,
    },
  };
  await savePsychologistProfile(updated);
  return updated;
}

/**
 * Delete a psychologist profile from Firestore
 */
export async function deletePsychologistFromFirestore(uid: string): Promise<void> {
  const docRef = doc(db, 'psychologists', uid);
  await deleteDoc(docRef);
}

/**
 * Sign in Psychologist with Google OAuth
 */
export async function signInWithGoogle(): Promise<{ user: PsychologistAuthUser; isNewOrIncomplete: boolean }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }

    const { user } = result;
    const userEmail = (user.email || '').trim().toLowerCase();

    // Check if this is the designated Administrator (kailabwasd@gmail.com)
    if (isUserAdmin(userEmail)) {
      const adminProfile = createAdminProfile(
        user.email || ADMIN_EMAILS[0],
        user.displayName || 'Administrador Clínico (kailabwasd)',
        user.photoURL || undefined
      );
      await savePsychologistProfile(adminProfile);
      return { user: adminProfile, isNewOrIncomplete: false };
    }

    // Proactive check in Firestore by UID and by email
    let existing = await getPsychologistFromFirestore(user.uid);
    if (!existing && user.email) {
      existing = await findPsychologistByEmail(user.email);
    }

    if (existing && existing.profileCompleted && existing.license?.trim()) {
      existing.lastLoginAt = Date.now();
      await savePsychologistProfile(existing);
      localStorage.setItem('psybot_psychologist_session', JSON.stringify(existing));
      return { user: existing, isNewOrIncomplete: false };
    }

    // Prepare draft user requiring profile completion (Tarjeta Profesional / ReTHUS) and admin authorization
    const isSuperAdmin = isUserAdmin(user.email);
    const draftUser: PsychologistAuthUser = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || existing?.displayName || '',
      photoURL: user.photoURL || existing?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.displayName || user.uid)}`,
      provider: 'google.com',
      role: existing?.role || 'Psicólogo(a) Clínico Titulado(a)',
      license: existing?.license || '',
      specialty: existing?.specialty || 'Atención Psicológica y Triage de Crisis',
      institution: existing?.institution || 'Subred Integrada de Servicios de Salud Norte - Suba',
      phone: existing?.phone || '',
      termsAccepted: existing?.termsAccepted ?? true,
      profileCompleted: Boolean(existing?.license?.trim()),
      isApproved: isSuperAdmin ? true : (existing?.isApproved ?? false),
      approvalStatus: isSuperAdmin ? 'APPROVED' : (existing?.approvalStatus ?? 'PENDING'),
      isAdmin: isSuperAdmin,
      permissions: {
        lectura: isSuperAdmin || Boolean(existing?.isApproved),
        escritura: isSuperAdmin || Boolean(existing?.isApproved),
        administrativo: isSuperAdmin,
      },
      createdAt: existing?.createdAt || Date.now(),
      lastLoginAt: Date.now(),
    };

    // Immediately persist draftUser to Firestore so realtime listeners have the record
    await savePsychologistProfile(draftUser);
    localStorage.setItem('psybot_psychologist_session', JSON.stringify(draftUser));
    return { user: draftUser, isNewOrIncomplete: !draftUser.profileCompleted };
  } catch (error: any) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Sign in or Register with Email and Password, actively checking Firestore database
 */
export async function signInWithEmailPassword(
  email: string, 
  pass: string, 
  isRegistering: boolean,
  initialDetails?: {
    fullName?: string;
    license?: string;
    specialty?: string;
    phone?: string;
    institution?: string;
  }
): Promise<{ user: PsychologistAuthUser; isNewOrIncomplete: boolean }> {
  const cleanEmail = (email || '').trim().toLowerCase();
  isSigningIn = true;

  try {
    // 1. Proactive lookup in Firestore
    const existingInDb = await findPsychologistByEmail(cleanEmail);

    if (!isRegistering) {
      // User is attempting to LOG IN: verify if account exists in Firestore
      if (!existingInDb) {
        throw new Error(`No encontramos una cuenta de especialista registrada con el correo "${cleanEmail}" en la base de datos de Firestore. Por favor selecciona "Crear Cuenta" para registrarte con tu Tarjeta Profesional.`);
      }

      let userUid = existingInDb.uid;
      try {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        if (userCredential?.user?.uid) {
          userUid = userCredential.user.uid;
        }
      } catch (authErr: any) {
        console.warn('Firebase Auth signIn notice (using Firestore record):', authErr);
        if (authErr?.code === 'auth/wrong-password') {
          throw new Error('Contraseña incorrecta. Por favor verifica tus credenciales.');
        }
      }

      const latest = (await getPsychologistFromFirestore(userUid)) || existingInDb;
      latest.lastLoginAt = Date.now();
      await savePsychologistProfile(latest);
      localStorage.setItem('psybot_psychologist_session', JSON.stringify(latest));
      return { 
        user: latest, 
        isNewOrIncomplete: !latest.profileCompleted || !latest.license?.trim() 
      };
    } else {
      // User is attempting to REGISTER: verify Firestore to prevent duplicate email or license
      if (existingInDb) {
        throw new Error(`El correo "${cleanEmail}" ya está registrado en la base de datos oficial de Firestore. Por favor selecciona "Iniciar Sesión".`);
      }

      if (initialDetails?.license) {
        const existingByLicense = await findPsychologistByLicense(initialDetails.license);
        if (existingByLicense) {
          throw new Error(`La Tarjeta Profesional "${initialDetails.license}" ya se encuentra registrada en Firestore por otro especialista.`);
        }
      }

      let userUid = ensureValidUid(null, cleanEmail);
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        if (userCredential?.user?.uid) {
          userUid = userCredential.user.uid;
        }
      } catch (authErr: any) {
        console.warn('Firebase Auth email registration notice:', authErr);
        if (authErr?.code === 'auth/email-already-in-use') {
          throw new Error(`Este correo ya está registrado en el sistema. Por favor selecciona "Iniciar Sesión".`);
        }
        if (authErr?.code === 'auth/weak-password') {
          throw new Error('La contraseña debe tener al menos 6 caracteres.');
        }
        if (authErr?.code === 'auth/invalid-email') {
          throw new Error('El formato del correo electrónico no es válido.');
        }
        // If auth/operation-not-allowed or network limitation, userUid is safely assigned
      }

      const hasValidLicense = Boolean(initialDetails?.license && initialDetails.license.trim().length >= 4);
      const isSuperAdmin = isUserAdmin(cleanEmail);

      const newPsychologist: PsychologistAuthUser = {
        uid: userUid,
        email: cleanEmail,
        displayName: initialDetails?.fullName?.trim() || cleanEmail.split('@')[0],
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(initialDetails?.fullName || cleanEmail)}`,
        provider: 'email',
        role: 'Psicólogo(a) Clínico Titulado(a)',
        license: initialDetails?.license?.trim() || '',
        specialty: initialDetails?.specialty?.trim() || 'Atención Psicológica y Triage de Crisis',
        institution: initialDetails?.institution?.trim() || 'Subred Integrada de Servicios de Salud Norte - Suba',
        phone: initialDetails?.phone?.trim() || '',
        termsAccepted: true,
        profileCompleted: hasValidLicense,
        isApproved: isSuperAdmin ? true : false,
        approvalStatus: isSuperAdmin ? 'APPROVED' : 'PENDING',
        isAdmin: isSuperAdmin,
        permissions: {
          lectura: isSuperAdmin,
          escritura: isSuperAdmin,
          administrativo: isSuperAdmin,
        },
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      };

      // Immediately write the new psychologist to Firestore
      await savePsychologistProfile(newPsychologist);

      return { 
        user: newPsychologist, 
        isNewOrIncomplete: !hasValidLicense 
      };
    }
  } finally {
    isSigningIn = false;
  }
}

/**
 * List real psychologists from Firestore
 */
export async function listPsychologistsFromFirestore(): Promise<PsychologistAuthUser[]> {
  try {
    const colRef = collection(db, 'psychologists');
    const snapshot = await getDocs(colRef);
    const list: PsychologistAuthUser[] = [];
    snapshot.forEach((docSnap: DocumentData) => {
      const data = docSnap.data() as PsychologistAuthUser;
      if (data && data.email) {
        list.push(data);
      }
    });

    // Ensure the system administrator is in the list
    if (!list.some(p => p.email === 'kailabwasd@gmail.com')) {
      const admin = createAdminProfile('kailabwasd@gmail.com', 'Administrador Clínico (kailabwasd)', undefined);
      list.unshift(admin);
      // Persist in background to Firestore
      setDoc(doc(db, 'psychologists', admin.uid), admin, { merge: true }).catch(() => {});
    }

    return list;
  } catch (err: any) {
    console.warn('Could not fetch psychologists list, using local cache:', err);
    reportFirestoreCriticalError(err, 'Listar Psicólogos desde Firestore', 'psychologists').catch(() => {});
    return [createAdminProfile('kailabwasd@gmail.com', 'Administrador Clínico (kailabwasd)', undefined)];
  }
}

/**
 * Subscribe to real-time updates of psychologists in Firestore
 */
export function subscribeToPsychologists(callback: (list: PsychologistAuthUser[]) => void): () => void {
  const colRef = collection(db, 'psychologists');
  return onSnapshot(colRef, (snapshot) => {
    const list: PsychologistAuthUser[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as PsychologistAuthUser;
      if (data && data.email) {
        list.push(data);
      }
    });

    if (!list.some(p => p.email === 'kailabwasd@gmail.com')) {
      list.unshift(createAdminProfile('kailabwasd@gmail.com', 'Administrador Clínico (kailabwasd)', undefined));
    }

    callback(list);
  }, (err) => {
    console.warn('Real-time psychologists subscription warning:', err);
  });
}
export function getStoredPsychologist(): PsychologistAuthUser | null {
  try {
    const raw = localStorage.getItem('psybot_psychologist_session') || localStorage.getItem('subatech_psychologist_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Logout current psychologist
 */
export async function logoutPsychologist(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('SignOut error:', e);
  }
  cachedAccessToken = null;
  localStorage.removeItem('psybot_psychologist_session');
  localStorage.removeItem('subatech_psychologist_session');
}

// -------------------------------------------------------------
// Compatibility exports for existing Google Sheets / Google Drive components
// -------------------------------------------------------------
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el Access Token para Google Services.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => cachedAccessToken;

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  localStorage.removeItem('subatech_psychologist_session');
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};
