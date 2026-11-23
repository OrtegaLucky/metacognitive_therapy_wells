import { destroySession } from '$lib/server/auth.js';

export function POST({ cookies }) {
	destroySession(cookies);
	return new Response(null, { status: 303, headers: { location: '/login' } });
}
