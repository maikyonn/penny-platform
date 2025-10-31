import type { DecodedIdToken } from "firebase-admin/auth";

type FirestoreUserDoc = {
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  usage?: {
    emailDailyCap: number;
    emailDailySent: number;
    emailDailyResetAt: Date | FirebaseFirestore.Timestamp;
  };
  settings?: Record<string, unknown>;
  features?: Record<string, boolean>;
  plan?: {
    type: string;
    status: string;
  };
  createdAt?: Date | FirebaseFirestore.Timestamp;
  updatedAt?: Date | FirebaseFirestore.Timestamp;
};

type UserProfile = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  locale: string | null;
};

export type DerivedSession = {
  user: { id: string; email: string | null };
  claims: DecodedIdToken;
  tokenSource: "bearer" | "session" | null;
};

export type UserContext = {
  session: DerivedSession | null;
  firebaseUser: DecodedIdToken | null;
  userDoc: FirestoreUserDoc | null;
  profile: UserProfile | null;
};

async function ensureFirestoreUser(
  firestore: FirebaseFirestore.Firestore,
  firebaseUser: DecodedIdToken,
): Promise<FirestoreUserDoc> {
  const userRef = firestore.collection("users").doc(firebaseUser.uid);
  const snapshot = await userRef.get();

  if (!snapshot.exists) {
    const now = new Date();
    const seedDoc: FirestoreUserDoc = {
      email: firebaseUser.email ?? null,
      displayName: firebaseUser.name ?? null,
      photoURL: firebaseUser.picture ?? null,
      plan: {
        type: "free",
        status: "active",
      },
      usage: {
        emailDailyCap: 50,
        emailDailySent: 0,
        emailDailyResetAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    await userRef.set(seedDoc, { merge: true });
    return seedDoc;
  }

  return snapshot.data() as FirestoreUserDoc;
}

export async function loadUserContext(locals: App.Locals): Promise<UserContext> {
  const firebaseUser = locals.firebaseUser ?? null;
  let firestoreProfile: UserProfile | null = null;
  let userDoc: FirestoreUserDoc | null = null;

  if (firebaseUser && locals.firestore) {
    try {
      userDoc = await ensureFirestoreUser(locals.firestore, firebaseUser);
      firestoreProfile = {
        user_id: firebaseUser.uid,
        full_name: userDoc.displayName ?? null,
        avatar_url: userDoc.photoURL ?? null,
        locale: (userDoc.settings?.locale as string | undefined) ?? null,
      };
    } catch (error) {
      console.error("[user-context] failed to load Firestore user document", error);
    }
  }

  const session = await locals.getSession();

  if (!firebaseUser && !session) {
    return {
      session: null,
      firebaseUser: null,
      userDoc: null,
      profile: null,
    };
  }

  return {
    session,
    firebaseUser,
    userDoc,
    profile: firestoreProfile,
  };
}
