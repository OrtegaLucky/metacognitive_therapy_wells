// Проверка входа и заголовки безопасности для каждого запроса (SPEC 13.1)
import { hasSession } from '$lib/server/auth.js';

const isPublic = (path) => path === '/login' || path.startsWith('/api/reminders');

export async function handle({ event, resolve }) {
	const path = event.url.pathname;
	event.locals.authed = hasSession(event.cookies);

	if (!isPublic(path) && !event.locals.authed) {
		return new Response(null, { status: 303, headers: { location: '/login' } });
	}

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	// Личные страницы не кешируем ни в браузере, ни на прокси
	response.headers.set('Cache-Control', 'no-store');
	return response;
}
