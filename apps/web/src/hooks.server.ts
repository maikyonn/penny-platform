import type { Handle } from "@sveltejs/kit";
import { adminAuth, adminDb } from "$lib/server/firebase-admin";
import type { DecodedIdToken } from "firebase-admin/auth";

const SESSION_COOKIE_NAME = "__session";
const SESSION_EXPIRES_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function sessionCookieOptions(expiresAt: number) {
  return {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    expires: new Date(expiresAt),
  };
}

export const handle: Handle = async ({ event, resolve }) => {
  const authHeader = event.request.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);

  let firebaseUser: DecodedIdToken | null = null;
  let verifiedSource: "bearer" | "session" | null = null;

  if (bearerToken) {
    try {
      firebaseUser = await adminAuth.verifyIdToken(bearerToken, true);
      verifiedSource = "bearer";
    } catch (error) {
      console.warn("[auth] bearer verification failed", error);
    }
  }

  if (!firebaseUser && sessionCookie) {
    try {
      firebaseUser = await adminAuth.verifySessionCookie(sessionCookie, true);
      verifiedSource = "session";
    } catch (error) {
      console.warn("[auth] session cookie verification failed", error);
      event.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
    }
  }

  event.locals.firebaseUser = firebaseUser;
  event.locals.firestore = adminDb;
  event.locals.firebaseAuth = adminAuth;

  event.locals.getSession = async () => {
    if (!firebaseUser) {
      return null;
    }
    return {
      user: {
        id: firebaseUser.uid,
        email: firebaseUser.email ?? null,
      },
      claims: firebaseUser,
      tokenSource: verifiedSource,
    };
  };

  event.locals.createSession = async (idToken: string, remember = false) => {
    const expiresIn = remember ? 1000 * 60 * 60 * 24 * 30 : SESSION_EXPIRES_MS;
    const sessionToken = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });
    const expiresAt = Date.now() + expiresIn;
    event.cookies.set(
      SESSION_COOKIE_NAME,
      sessionToken,
      sessionCookieOptions(expiresAt)
    );
  };

  event.locals.clearSession = () => {
    event.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
  };

  const response = await resolve(event);

  return response;
};
