import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import checkoutResponse from '../fixtures/http/create-checkout-session.response.json';

const server = setupServer(
	http.post('/api/stripe/create-checkout-session', async () => {
		return HttpResponse.json(checkoutResponse, { status: 200 });
	})
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
