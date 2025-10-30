import { fetch as undiciFetch, Headers, Request, Response } from 'undici';

if (!globalThis.fetch) {
	globalThis.fetch = undiciFetch as typeof fetch;
}

if (!globalThis.Headers) {
	globalThis.Headers = Headers as typeof globalThis.Headers;
}

if (!globalThis.Request) {
	globalThis.Request = Request as typeof globalThis.Request;
}

if (!globalThis.Response) {
	globalThis.Response = Response as typeof globalThis.Response;
}
