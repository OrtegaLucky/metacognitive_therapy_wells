// Экран «Вечернее окно»: что откладывали днём, таймер на 15 минут, запись в дневник
import { fail } from '@sveltejs/kit';
import { getDb, now } from '$lib/server/db.js';
import { getProfile } from '$lib/server/stages.js';

export function load() {
	const db = getDb();
	const profile = getProfile();
	// Триггеры с последнего окна, но не старше суток
	const lastWindow = db
		.prepare("SELECT created_at FROM journal_entries WHERE kind = 'worry_window' ORDER BY created_at DESC LIMIT 1")
		.get()?.created_at;
	const dayAgo = new Date(Date.now() - 86400_000).toISOString();
	const since = lastWindow && lastWindow > dayAgo ? lastWindow : dayAgo;
	const triggers = db
		.prepare("SELECT created_at, payload FROM journal_entries WHERE kind = 'trigger' AND created_at > ? ORDER BY created_at")
		.all(since)
		.map((e) => ({ created_at: e.created_at, ...JSON.parse(e.payload) }));
	return {
		time: profile.reminder_worry_window || '18:00',
		timeSet: !!profile.reminder_worry_window,
		triggers,
		doneRecently: !!lastWindow && lastWindow > new Date(Date.now() - 12 * 3600_000).toISOString()
	};
}

export const actions = {
	default: async ({ request }) => {
		const fd = await request.formData();
		const wanted = fd.get('wanted') === 'yes';
		const minutes = Math.max(0, Math.min(120, parseInt(String(fd.get('minutes') ?? '0'), 10) || 0));
		const note = String(fd.get('note') ?? '').trim().slice(0, 5000);
		if (fd.get('wanted') !== 'yes' && fd.get('wanted') !== 'no') return fail(400, { error: 'Не понял ответ.' });
		getDb()
			.prepare("INSERT INTO journal_entries (created_at, stage, kind, payload) VALUES (?, ?, 'worry_window', ?)")
			.run(now(), getProfile().current_stage, JSON.stringify({ wanted_to_worry: wanted, minutes_used: minutes, note }));
		return { saved: true, wanted, minutes };
	}
};
