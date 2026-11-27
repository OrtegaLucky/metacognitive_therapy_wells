// Экран «Сегодня»
import { getDb } from '$lib/server/db.js';
import { getStage } from '$lib/server/content.js';
import { getProfile, checkUnlock, daysSince } from '$lib/server/stages.js';

export function load({ url }) {
	const db = getDb();
	const profile = getProfile();
	const stage = getStage(profile.current_stage);
	const dayStart = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' }) + 'T00:00:00+03:00').toISOString();
	const today = db
		.prepare('SELECT kind, count(*) AS c FROM journal_entries WHERE created_at >= ? GROUP BY kind')
		.all(dayStart);
	const last = db.prepare('SELECT saved_at FROM stage_reviews WHERE stage = ? AND saved_at IS NOT NULL ORDER BY saved_at DESC LIMIT 1').get(profile.current_stage);
	return {
		profile,
		stage,
		unlock: checkUnlock(profile.current_stage),
		logged: url.searchParams.has('logged'),
		today: Object.fromEntries(today.map((r) => [r.kind, r.c])),
		lastReview: last ? daysSince(last.saved_at) : null
	};
}
