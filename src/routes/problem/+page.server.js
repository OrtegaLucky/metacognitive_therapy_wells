// Экран «Решение или беспокойство?» (этапы 7–8): отличить задачу (есть конкретный шаг) от прокручивания
import { fail } from '@sveltejs/kit';
import { getDb, now } from '$lib/server/db.js';
import { getProfile } from '$lib/server/stages.js';

const txt = (fd, n, max = 1000) => String(fd.get(n) ?? '').trim().slice(0, max);

export function load() {
	const items = getDb()
		.prepare("SELECT id, created_at, stage, payload FROM journal_entries WHERE kind = 'problem' ORDER BY created_at DESC LIMIT 100")
		.all()
		.map((e) => ({ ...e, ...JSON.parse(e.payload) }));
	return {
		stage: getProfile().current_stage,
		open: items.filter((i) => i.actionable && !i.done),
		history: items.filter((i) => !i.actionable || i.done).slice(0, 30)
	};
}

export const actions = {
	add: async ({ request }) => {
		const fd = await request.formData();
		const worry = txt(fd, 'worry');
		const a = fd.get('actionable');
		if (!worry) return fail(400, { error: 'Напишите, о чём беспокоитесь.' });
		if (a !== 'yes' && a !== 'no') return fail(400, { error: 'Ответьте: можно ли что-то сделать?' });
		const step = txt(fd, 'step');
		if (a === 'yes' && !step) return fail(400, { error: 'Напишите первый конкретный шаг.', worry });
		const payload = { worry, actionable: a === 'yes', step: a === 'yes' ? step : '', when: txt(fd, 'when', 100), done: false };
		getDb()
			.prepare("INSERT INTO journal_entries (created_at, stage, kind, payload) VALUES (?, ?, 'problem', ?)")
			.run(now(), getProfile().current_stage, JSON.stringify(payload));
		return { added: a };
	},
	done: async ({ request }) => {
		const fd = await request.formData();
		const id = parseInt(txt(fd, 'id'), 10);
		const db = getDb();
		const e = db.prepare("SELECT payload FROM journal_entries WHERE id = ? AND kind = 'problem'").get(id);
		if (!e) return fail(400, { error: 'Запись не найдена.' });
		const p = JSON.parse(e.payload);
		p.done = true;
		p.done_at = now();
		p.result = txt(fd, 'result');
		db.prepare('UPDATE journal_entries SET payload = ? WHERE id = ?').run(JSON.stringify(p), id);
		return { doneId: id };
	}
};
