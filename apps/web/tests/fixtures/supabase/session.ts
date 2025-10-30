import type { Session } from '@supabase/supabase-js';

export const sessionFixture: Session = {
	access_token: 'eyJhbGciOiJIUzI1NiJ9.test',
	token_type: 'bearer',
	expires_in: 3600,
	expires_at: Math.floor(Date.now() / 1000) + 3600,
	refresh_token: 'refresh_test',
	provider_token: undefined,
	provider_refresh_token: undefined,
	user: {
		id: '00000000-0000-4000-8000-000000000000',
		app_metadata: { provider: 'email', providers: ['email'] },
		user_metadata: { full_name: 'Test User' },
		aud: 'authenticated',
		created_at: new Date().toISOString(),
		email: 'test+user@example.com',
		email_confirmed_at: new Date().toISOString(),
		phone: '',
		phone_confirmed_at: null,
		last_sign_in_at: new Date().toISOString(),
		role: 'authenticated',
		identities: [],
		factor_ids: [],
		factors: [],
		is_anonymous: false
	}
};
