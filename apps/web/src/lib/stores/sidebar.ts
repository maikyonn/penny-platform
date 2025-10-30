import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'penny-platform:sidebar-open';

const sidebarStore = writable<boolean>(true);

if (browser) {
	const stored = window.localStorage.getItem(STORAGE_KEY);
	if (stored !== null) {
		sidebarStore.set(stored !== 'false');
	}

	sidebarStore.subscribe((value) => {
		window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
	});
}

export const sidebarState = {
	subscribe: sidebarStore.subscribe,
	open: () => sidebarStore.set(true),
	close: () => sidebarStore.set(false),
	set: (value: boolean) => sidebarStore.set(value),
	toggle: () => sidebarStore.update((value) => !value),
};
