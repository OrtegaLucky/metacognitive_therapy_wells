// Сессии входа (SPEC 13.1). В базе лежит только хеш токена.
import crypto from 'node:crypto';
import { dev } from '$app/environment';
import { getDb, now } from './db.js';

export const SESSION_COOKIE = 'sid';
const DAYS = 30;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(cookies) {
	const db = getDb();
	db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
	const token = crypto.randomBytes(32).toString('base64url');
	const expires = new Date(Date.now() + DAYS * 86400_000).toISOString();
	db.prepare('INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)').run(sha256(token), now(), expires);
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		// lax, а не strict: иначе ссылки из Telegram-напоминаний открывали бы страницу входа
		sameSite: 'lax',
		secure: !dev,
		maxAge: DAYS * 86400
	});
}

export function hasSession(cookies) {
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return false;
	const row = getDb().prepare('SELECT 1 FROM sessions WHERE token_hash = ? AND expires_at > ?').get(sha256(token), now());
	return !!row;
}

export function destroySession(cookies) {
	const token = cookies.get(SESSION_COOKIE);
	if (token) getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
