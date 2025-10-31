// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
	interface Locals {
		firebaseUser: import("firebase-admin/auth").DecodedIdToken | null;
		firestore: import("firebase-admin/firestore").Firestore;
		firebaseAuth: import("firebase-admin/auth").Auth;
		getSession: () => Promise<{
			user: { id: string; email: string | null };
			claims: import("firebase-admin/auth").DecodedIdToken;
			tokenSource: "bearer" | "session" | null;
		} | null>;
		createSession: (idToken: string, remember?: boolean) => Promise<void>;
		clearSession: () => void;
	}

	interface PageData {
		firebaseUser?: {
			uid: string;
			email: string | null;
			claims: Record<string, unknown>;
		} | null;
		profile?: {
			user_id: string;
			full_name: string | null;
			avatar_url: string | null;
			locale?: string | null;
		} | null;
		subscription?: {
			type: string;
			status: string;
			priceId?: string | null;
			productId?: string | null;
			customerId?: string | null;
		} | null;
		form?: any;
		[key: string]: unknown;
	}
	}
}

export {};
