import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type Unsubscribe,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const configuredDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = configuredDatabaseId ? getFirestore(app, configuredDatabaseId) : getFirestore(app);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function initAuth(
  onSignedIn?: (user: User) => void,
  onSignedOut?: () => void
): Unsubscribe {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      onSignedIn?.(user);
    } else {
      onSignedOut?.();
    }
  });
}

export async function googleSignIn(): Promise<{
  user: User;
  idToken: string;
}> {
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  return {
    user: result.user,
    idToken,
  };
}

export async function registerFirebaseEmailAccount(
  email: string,
  password: string,
  displayName?: string
): Promise<{
  created: boolean;
  uid?: string;
  idToken?: string;
  emailVerified?: boolean;
  verificationSent?: boolean;
  disabled?: boolean;
  alreadyInUse?: boolean;
}> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    if (displayName && displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() }).catch(() => {});
    }
    let verificationSent = false;
    try {
      await sendEmailVerification(cred.user);
      verificationSent = true;
    } catch {
      verificationSent = false;
    }
    const idToken = await cred.user.getIdToken();
    return {
      created: true,
      uid: cred.user.uid,
      idToken,
      emailVerified: cred.user.emailVerified,
      verificationSent,
    };
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
      return { created: false, disabled: true };
    }
    if (code === 'auth/email-already-in-use') {
      return { created: false, alreadyInUse: true };
    }
    return { created: false };
  }
}

export async function signInFirebaseEmailAccount(
  email: string,
  password: string
): Promise<
  | { signedIn: true; user: User; idToken: string }
  | { signedIn: false }
> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const idToken = await cred.user.getIdToken();
    return {
      signedIn: true,
      user: cred.user,
      idToken,
    };
  } catch {
    return { signedIn: false };
  }
}

export async function firebaseLogout(): Promise<void> {
  await auth.signOut();
}
