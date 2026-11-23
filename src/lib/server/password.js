// Хеширование пароля через scrypt (встроен в Node, без внешних библиотек).
// Формат: scrypt:N:r:p:соль:хеш — без символа $, чтобы .env не пытался его «раскрыть».
import crypto from 'node:crypto';

const N = 32768;
const R = 8;
const P = 1;
const LEN = 32;
const opts = (n, r, p) => ({ N: n, r, p, maxmem: 256 * n * r });

export function hashPassword(password) {
	const salt = crypto.randomBytes(16);
	const hash = crypto.scryptSync(password, salt, LEN, opts(N, R, P));
	return ['scrypt', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join(':');
}

export function verifyPassword(password, stored) {
	const parts = String(stored ?? '').split(':');
	if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
	const [, n, r, p, saltB64, hashB64] = parts;
	const expected = Buffer.from(hashB64, 'base64url');
	const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64url'), expected.length, opts(+n, +r, +p));
	return crypto.timingSafeEqual(actual, expected);
}
