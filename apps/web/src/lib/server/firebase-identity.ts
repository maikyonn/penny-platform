import { FIREBASE_WEB_API_KEY } from "$env/static/private";

const API_BASE = "https://identitytoolkit.googleapis.com/v1";

if (!FIREBASE_WEB_API_KEY) {
  console.warn("FIREBASE_WEB_API_KEY is not set. Firebase identity calls will fail.");
}

async function identityRequest<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}/${endpoint}?key=${FIREBASE_WEB_API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message ?? `Firebase identity request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type PasswordSignInResponse = {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  email?: string;
};

export async function signInWithEmailAndPassword(email: string, password: string) {
  return identityRequest<PasswordSignInResponse>("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
}

export async function signUpWithEmailAndPassword(email: string, password: string) {
  return identityRequest<PasswordSignInResponse>("accounts:signUp", {
    email,
    password,
    returnSecureToken: true,
  });
}

export async function sendEmailVerification(idToken: string) {
  return identityRequest("accounts:sendOobCode", {
    requestType: "VERIFY_EMAIL",
    idToken,
  });
}

export async function sendPasswordResetEmail(email: string) {
  return identityRequest("accounts:sendOobCode", {
    requestType: "PASSWORD_RESET",
    email,
  });
}

export async function resendVerificationEmail(email: string) {
  return identityRequest("accounts:sendOobCode", {
    requestType: "VERIFY_EMAIL",
    email,
  });
}

export async function signInWithCustomToken(token: string) {
  return identityRequest<PasswordSignInResponse>("accounts:signInWithCustomToken", {
    token,
    returnSecureToken: true,
  });
}

export async function sendEmailSignInLink(email: string, continueUrl: string) {
  return identityRequest("accounts:sendOobCode", {
    requestType: "EMAIL_SIGNIN",
    email,
    continueUrl,
    canHandleCodeInApp: false,
  });
}

export async function signInWithEmailLink(email: string, oobCode: string) {
  return identityRequest<PasswordSignInResponse>("accounts:signInWithEmailLink", {
    email,
    oobCode,
  });
}
