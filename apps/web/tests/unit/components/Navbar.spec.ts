import { render, screen } from '@testing-library/svelte';
import Navbar from '../../../src/lib/components/Navbar.svelte';
import { sessionFixture } from '../../fixtures/supabase/session';

describe('Navbar', () => {
	it('renders auth links when no session', async () => {
		render(Navbar);
		expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
	});

	it('renders dashboard and sign-out when session provided', async () => {
		render(Navbar, { props: { session: sessionFixture } });
		expect(await screen.findByText(sessionFixture.user.email ?? 'there')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/campaign');
		expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
	});
});
