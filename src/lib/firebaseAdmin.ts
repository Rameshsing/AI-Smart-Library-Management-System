import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();

export interface VerifiedFirebaseGoogleClaims {
  uid: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export async function verifyFirebaseIdToken(
  idToken: string
): Promise<VerifiedFirebaseGoogleClaims> {
  const decoded = await adminAuth.verifyIdToken(idToken);
  if (!decoded.email || decoded.email_verified !== true) {
    throw new Error('Firebase account email must be verified before signing in.');
  }
  return {
    uid: decoded.uid,
    email: decoded.email.trim().toLowerCase(),
    email_verified: true,
    name: typeof decoded.name === 'string' ? decoded.name : undefined,
    picture: typeof decoded.picture === 'string' ? decoded.picture : undefined,
  };
}

export async function verifyFirebaseRestoreToken(
  idToken: string
): Promise<VerifiedFirebaseGoogleClaims> {
  const decoded = await adminAuth.verifyIdToken(idToken);
  if (!decoded.email) {
    throw new Error('Firebase account email is missing from token.');
  }
  return {
    uid: decoded.uid,
    email: decoded.email.trim().toLowerCase(),
    email_verified: decoded.email_verified === true,
    name: typeof decoded.name === 'string' ? decoded.name : undefined,
    picture: typeof decoded.picture === 'string' ? decoded.picture : undefined,
  };
}
