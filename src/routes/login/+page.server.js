import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { verifyPassword } from '$lib/server/password.js';
import { createSession } from '$lib/server/auth.js';
import { checkAttempt, recordFail, recordSuccess } from '$lib/server/ratelimit.js';

export function load({ locals }) {
	if (locals.authed) redirect(303, '/');
}

export const actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const ip = getClientAddress();
		const attempt = checkAttempt(ip);
		if (!attempt.allowed) {
			return fail(429, { error: `Слишком много попыток. Попробуйте через ${Math.ceil(attempt.retryAfter / 60)} мин.` });
		}
		if (!env.PASSWORD_HASH) {
			return fail(500, { error: 'В .env не задан PASSWORD_HASH (npm run hash-password).' });
		}
		const password = String((await request.formData()).get('password') ?? '');
		if (!verifyPassword(password, env.PASSWORD_HASH)) {
			recordFail(ip);
			return fail(400, { error: 'Неверный пароль.' });
		}
		recordSuccess(ip);
		createSession(cookies);
		redirect(303, '/');
	}
};
