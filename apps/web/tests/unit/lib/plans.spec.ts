import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
	getPlanByPriceId,
	getPlanConfig,
	getPlanConfigs,
	getPriceIdForPlan,
	getTrialPeriodDays
} from '../../../src/lib/server/billing/plans';

vi.mock('$env/static/private', () => ({
	STRIPE_PRICE_STARTER_MONTHLY: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? 'price_123_starter',
	STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY ?? 'price_123_pro',
	STRIPE_TRIAL_DAYS: process.env.STRIPE_TRIAL_DAYS ?? '3'
}));

describe('billing plan helpers', () => {
	beforeEach(() => {
		process.env.STRIPE_PRICE_STARTER_MONTHLY = 'price_123_starter';
		process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_123_pro';
		process.env.STRIPE_TRIAL_DAYS = '3';
	});

	it('returns price id for valid tier', () => {
		expect(getPriceIdForPlan('starter')).toBe(process.env.STRIPE_PRICE_STARTER_MONTHLY);
		expect(getPriceIdForPlan('pro')).toBe(process.env.STRIPE_PRICE_PRO_MONTHLY);
		expect(getPriceIdForPlan('enterprise')).toBeNull();
	});

	it('returns plan config by price id', () => {
		expect(getPlanByPriceId(process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '')?.tier).toBe('starter');
		expect(getPlanByPriceId(process.env.STRIPE_PRICE_PRO_MONTHLY ?? '')?.tier).toBe('pro');
		expect(getPlanByPriceId('')).toBeNull();
	});

	it('clones configs when retrieving list', () => {
		const configs = getPlanConfigs();
		expect(configs).toHaveLength(3);
		expect(configs).not.toBe(getPlanConfigs());
	});

	it('returns plan config by tier', () => {
		expect(getPlanConfig('starter')?.tier).toBe('starter');
		expect(getPlanConfig('enterprise')?.tier).toBe('enterprise');
	});

	it('returns trial days', () => {
		expect(getTrialPeriodDays('starter')).toBeGreaterThanOrEqual(0);
		expect(getTrialPeriodDays('pro')).toBe(0);
	});
});
