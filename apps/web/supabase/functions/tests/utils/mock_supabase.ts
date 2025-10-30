export type QueryResult<T> = Promise<{ data: T | null; error: null }>; 

export function createTableApi<T>() {
	return {
		select: (_columns?: string, _options?: Record<string, unknown>) => ({
			eq: (_col: string, _value: unknown) => ({
				maybeSingle: async (): QueryResult<T> => ({ data: null, error: null })
			})
		}),
		insert: async (_rows: T | T[]) => ({ error: null }),
		upsert: async (_rows: T | T[], _options?: Record<string, unknown>) => ({ error: null })
	};
}

export function createSupabaseClient(overrides: Record<string, unknown> = {}) {
	return {
		auth: {
			getUser: async () => ({ data: { user: null }, error: null })
		},
		from: (_table: string) => createTableApi(),
		...overrides
	};
}
