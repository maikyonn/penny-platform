import { getApps, initializeApp, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const app: App = getApps().length ? getApps()[0] : initializeApp();

export const adminApp = app;
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
