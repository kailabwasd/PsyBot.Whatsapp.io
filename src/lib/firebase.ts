import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider, 
  GithubAuthProvider,
  onAuthStateChanged, 
  signOut,
  type User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  collection,
  getDocs,
  type DocumentData
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { PsychologistAuthUser } from '../types/index.ts';
import { encryptSecret, decryptSecret } from './cryptoUtils.ts';
import { generateSecret, generateURI, verifySync } from 'otplib';
import qrcode from 'qrcode';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Cloud Firestore
export const db = getFirestore(app);

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


export const ADMIN_EMAILS = [
  'kailabwasd@gmail.com',
  'leandro.menendez1192@gmail.com'
];

export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.trim().toLowerCase());
}

export function createAdminProfile(email = 'kailabwasd@gmail.com', name?: string, photo?: string): PsychologistAuthUser {
  const isKailab = email.toLowerCase().includes('kailab');
  return {
    uid: isKailab ? 'admin-kailabwasd' : 'admin-leandro',
    email: email,
    displayName: name || (isKailab ? 'Administrador Clínico (kailabwasd)' : 'Leandro Menéndez (Administrador Psybot)'),
    photoURL: photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    provider: 'google.com',
    role: 'Super Administrador & Director Clínico',
    license: 'REG-SAN-ADMIN-001 (Acceso Total)',
    specialty: 'Dirección Clínica, Triage & Supervisión IA',
    institution: 'Subred Integrada de Servicios de Salud Norte - Psybot SubaTECH',
    phone: '+57 300 987 6543',
    termsAccepted: true,
    profileCompleted: true,
    isAdmin: true,
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  };
}

export async function loginAsAdmin(customEmail = 'kailabwasd@gmail.com'): Promise<PsychologistAuthUser> {
  const adminUser = createAdminProfile(customEmail);
  localStorage.setItem('subatech_psychologist_session', JSON.stringify(adminUser));
  localStorage.setItem('psybot_psychologist_session', JSON.stringify(adminUser));
  try {
    const userDocRef = doc(db, 'psychologists', adminUser.uid);
    setDoc(userDocRef, adminUser, { merge: true }).catch(() => {});
  } catch {}
  return adminUser;
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

// GitHub Auth Provider
export const githubProvider = new GithubAuthProvider();
githubProvider.addScope('read:user');
githubProvider.addScope('user:email');

let cachedAccessToken: string | null = null;
let isSigningIn = false;

/**
 * Fetch psychologist profile from Firestore with strict timeout to prevent hangs
 */
export async function getPsychologistFromFirestore(uid: string): Promise<PsychologistAuthUser | null> {
  try {
    const docRef = doc(db, 'psychologists', uid);
    const snapPromise = getDoc(docRef);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000));
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
  const updatedProfile: PsychologistAuthUser = {
    ...profile,
    profileCompleted: true,
    lastLoginAt: Date.now(),
  };

  try {
    // Encrypt 2FA secret before persisting to Firestore for medical data compliance
    const firestorePayload: any = { ...updatedProfile };
    if (updatedProfile.twoFactorSecret) {
      firestorePayload.twoFactorSecret = await encryptSecret(updatedProfile.twoFactorSecret);
      firestorePayload.is2FASecretEncrypted = true;
    }

    const userDocRef = doc(db, 'psychologists', profile.uid);
    setDoc(userDocRef, firestorePayload, { merge: true }).catch(() => {});
  } catch (error) {
    console.warn('Could not sync psychologist profile to Firestore:', error);
  }

  localStorage.setItem('psybot_psychologist_session', JSON.stringify(updatedProfile));
  localStorage.setItem('subatech_psychologist_session', JSON.stringify(updatedProfile));
  return updatedProfile;
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
        user.displayName || 'Administrador General (Psybot)',
        user.photoURL || undefined
      );
      await savePsychologistProfile(adminProfile);
      return { user: adminProfile, isNewOrIncomplete: false };
    }

    const existing = await getPsychologistFromFirestore(user.uid);

    if (existing && existing.profileCompleted && existing.license?.trim()) {
      localStorage.setItem('psybot_psychologist_session', JSON.stringify(existing));
      return { user: existing, isNewOrIncomplete: false };
    }

    // Prepare draft user requiring profile completion
    const draftUser: PsychologistAuthUser = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.displayName || user.uid)}`,
      provider: 'google.com',
      role: existing?.role || 'Psicólogo(a) Clínico Titulado(a)',
      license: existing?.license || '',
      specialty: existing?.specialty || 'Atención Psicológica y Triage de Crisis',
      institution: existing?.institution || 'Subred Integrada de Servicios de Salud Norte - Suba',
      phone: existing?.phone || '',
      termsAccepted: existing?.termsAccepted ?? false,
      profileCompleted: false,
      createdAt: existing?.createdAt || Date.now(),
      lastLoginAt: Date.now(),
    };

    localStorage.setItem('psybot_psychologist_session', JSON.stringify(draftUser));
    return { user: draftUser, isNewOrIncomplete: true };
  } catch (error: any) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Sign in Psychologist with GitHub OAuth
 */
export async function signInWithGithub(): Promise<{ user: PsychologistAuthUser; isNewOrIncomplete: boolean }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, githubProvider);
    const credential = GithubAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }

    const { user } = result;
    const existing = await getPsychologistFromFirestore(user.uid);

    if (existing && existing.profileCompleted && existing.license?.trim()) {
      localStorage.setItem('subatech_psychologist_session', JSON.stringify(existing));
      return { user: existing, isNewOrIncomplete: false };
    }

    const draftUser: PsychologistAuthUser = {
      uid: user.uid,
      email: user.email || `${user.providerData[0]?.displayName?.toLowerCase().replace(/\s+/g, '') || 'psicologo'}@subatech.salud`,
      displayName: user.displayName || 'Profesional de Salud Mental',
      photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.displayName || user.uid)}`,
      provider: 'github.com',
      role: existing?.role || 'Psicólogo(a) Especialista en Intervención',
      license: existing?.license || '', // empty so user must fill
      specialty: existing?.specialty || 'Psicoterapia Cognitivo-Conductual & Urgencias',
      institution: existing?.institution || 'Subred Integrada de Servicios de Salud Norte - Suba',
      phone: existing?.phone || '',
      termsAccepted: existing?.termsAccepted ?? false,
      profileCompleted: false,
      createdAt: existing?.createdAt || Date.now(),
      lastLoginAt: Date.now(),
    };

    localStorage.setItem('subatech_psychologist_session', JSON.stringify(draftUser));
    return { user: draftUser, isNewOrIncomplete: true };
  } catch (error: any) {
    console.error('Error al iniciar sesión con GitHub:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Sign in or Register with Email and Password
 */
export async function signInWithEmailPassword(
  email: string, 
  pass: string, 
  isRegistering: boolean
): Promise<{ user: PsychologistAuthUser; isNewOrIncomplete: boolean }> {
  try {
    isSigningIn = true;
    let userCredential;
    if (isRegistering) {
      userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    } else {
      userCredential = await signInWithEmailAndPassword(auth, email, pass);
    }

    const { user } = userCredential;
    const existing = await getPsychologistFromFirestore(user.uid);

    if (existing && existing.profileCompleted && existing.license?.trim()) {
      localStorage.setItem('subatech_psychologist_session', JSON.stringify(existing));
      return { user: existing, isNewOrIncomplete: false };
    }

    const draftUser: PsychologistAuthUser = {
      uid: user.uid,
      email: user.email || email,
      displayName: user.displayName || email.split('@')[0],
      photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
      provider: 'email',
      role: existing?.role || 'Psicólogo(a) Clínico Titulado(a)',
      license: existing?.license || '',
      specialty: existing?.specialty || 'Triage y Atención Psicológica',
      institution: existing?.institution || 'Subred Integrada de Servicios de Salud Norte - Suba',
      phone: existing?.phone || '',
      termsAccepted: existing?.termsAccepted ?? false,
      profileCompleted: false,
      createdAt: existing?.createdAt || Date.now(),
      lastLoginAt: Date.now(),
    };

    localStorage.setItem('subatech_psychologist_session', JSON.stringify(draftUser));
    return { user: draftUser, isNewOrIncomplete: true };
  } catch (error: any) {
    console.error('Email auth error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Check existing stored session
 */
export async function listPsychologistsFromFirestore(): Promise<PsychologistAuthUser[]> {
  try {
    const colRef = collection(db, 'psychologists');
    const snapshot = await getDocs(colRef);
    const list: PsychologistAuthUser[] = [];
    snapshot.forEach((docSnap: DocumentData) => {
      list.push(docSnap.data() as PsychologistAuthUser);
    });
    // Include current admin owner if not in list
    if (!list.some(p => p.email === 'kailabwasd@gmail.com')) {
      list.unshift(createAdminProfile('kailabwasd@gmail.com', 'Kailabwasd Owner', undefined));
    }
    return list;
  } catch (err) {
    console.warn('Could not fetch psychologists list, using local cache:', err);
    return [createAdminProfile('kailabwasd@gmail.com', 'Kailabwasd Owner', undefined)];
  }
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
