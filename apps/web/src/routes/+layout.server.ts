import { loadUserContext } from '$lib/server/user-context';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const context = await loadUserContext(locals);
 return context;
};
