// Экран «Упражнения»: отстранённая осознанность (этап 2), запись в дневник как att
import { fail } from '@sveltejs/kit';
import { getDb, now } from '$lib/server/db.js';
import { getProfile } from '$lib/server/stages.js';
import { EXERCISES } from '$lib/labels.js';

export function load() {
	const dayStart = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' }) + 'T00:00:00+03:00').toISOString();
	const today = getDb()
		.prepare("SELECT count(*) AS c FROM journal_entries WHERE kind = 'att' AND created_at >= ?")
		.get(dayStart).c;
	return { today, stage: getProfile().current_stage };
}

export const actions = {
	default: async ({ request }) => {
		const fd = await request.formData();
		const exercise = String(fd.get('exercise') ?? '');
		if (!EXERCISES[exercise]) return fail(400, { error: 'Неизвестное упражнение.' });
		const minutes = Math.max(1, Math.min(60, parseInt(String(fd.get('minutes') ?? '1'), 10) || 1));
		const note = String(fd.get('note') ?? '').trim().slice(0, 5000);
		getDb()
			.prepare("INSERT INTO journal_entries (created_at, stage, kind, payload) VALUES (?, ?, 'att', ?)")
			.run(now(), getProfile().current_stage, JSON.stringify({ minutes, exercise, note }));
		return { saved: true };
	}
};
