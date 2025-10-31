import { describe, expect, it, vi } from 'vitest';

import { POST } from '../../../src/routes/logout/+server';

describe('logout handler', () => {
	it('clears session and redirects home', async () => {
		const clearSession = vi.fn();

		await expect(
			POST({
				locals: { clearSession }
			} as any)
		).rejects.toMatchObject({ status: 303, location: '/' });

		expect(clearSession).toHaveBeenCalledTimes(1);
	});
});
