import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  buildValidatedUserPrivatePayload,
  buildValidatedUserProfilePayload,
} from './firestoreValidation';

export interface FirestoreRestoredProfile {
  displayName?: string;
  department?: string;
  academicYear?: string;
  interests?: string[];
  preferredSubjects?: string[];
  email?: string;
  studentCode?: string;
}

export async function fetchUserProfileFromFirestore(
  uid: string
): Promise<FirestoreRestoredProfile | null> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    return null;
  }

  const result: FirestoreRestoredProfile = {};
  let foundAny = false;

  const profilePath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      foundAny = true;
      if (typeof data.displayName === 'string') result.displayName = data.displayName;
      if (typeof data.department === 'string') result.department = data.department;
      if (typeof data.academicYear === 'string') result.academicYear = data.academicYear;
      if (Array.isArray(data.interests)) result.interests = data.interests.map(String);
      if (Array.isArray(data.preferredSubjects)) {
        result.preferredSubjects = data.preferredSubjects.map(String);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  const privatePath = `users/${uid}/private/contact`;
  try {
    const privSnap = await getDoc(doc(db, 'users', uid, 'private', 'contact'));
    if (privSnap.exists()) {
      const data = privSnap.data();
      foundAny = true;
      if (typeof data.email === 'string') result.email = data.email;
      if (typeof data.studentCode === 'string') result.studentCode = data.studentCode;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privatePath);
  }

  return foundAny ? result : null;
}

export async function syncUserProfileToFirestore(input: {
  uid: string;
  displayName: string;
  email: string;
  department?: string;
  academicYear?: string;
  interests?: string[];
  preferredSubjects?: string[];
  studentCode?: string;
}): Promise<void> {
  // firestore.rules enforces isVerifiedUser() (email_verified == true) on create/update
  if (
    !auth.currentUser ||
    auth.currentUser.uid !== input.uid ||
    auth.currentUser.emailVerified !== true
  ) {
    return;
  }

  const profilePayload = buildValidatedUserProfilePayload(input);
  const profilePath = `users/${profilePayload.uid}`;
  const profileRef = doc(db, 'users', profilePayload.uid);

  try {
    const existingSnap = await getDoc(profileRef);
    if (!existingSnap.exists()) {
      await setDoc(profileRef, {
        ...profilePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(profileRef, {
        displayName: profilePayload.displayName,
        department: profilePayload.department,
        academicYear: profilePayload.academicYear,
        interests: profilePayload.interests,
        preferredSubjects: profilePayload.preferredSubjects,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  const privatePayload = buildValidatedUserPrivatePayload(input);
  const privatePath = `users/${privatePayload.uid}/private/contact`;
  const privateRef = doc(db, 'users', privatePayload.uid, 'private', 'contact');

  try {
    const existingPrivate = await getDoc(privateRef);
    if (!existingPrivate.exists()) {
      await setDoc(privateRef, {
        ...privatePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, {
        email: privatePayload.email,
        studentCode: privatePayload.studentCode,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}
