// Экран «Убеждения»: три группы, текущие проценты, переоценка
import { fail } from '@sveltejs/kit';
import { getDb, now } from '$lib/server/db.js';
import { BELIEF_TYPES } from '$lib/labels.js';

const percent = (v) => {
	const n = parseInt(String(v ?? ''), 10);
	return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};

export function load() {
	const db = getDb();
	const beliefs = db.prepare('SELECT * FROM beliefs WHERE archived_at IS NULL ORDER BY created_at').all();
	const ratings = db.prepare('SELECT * FROM belief_ratings ORDER BY rated_at, id').all();
	const byBelief = {};
	for (const r of ratings) (byBelief[r.belief_id] ??= []).push(r);
	return {
		groups: BELIEF_TYPES.map((t) => ({
			...t,
			items: beliefs
				.filter((b) => b.type === t.id)
				.map((b) => {
					const hist = byBelief[b.id] ?? [];
					return { ...b, history: hist, current: hist.at(-1)?.percent ?? null };
				})
		}))
	};
}

export const actions = {
	add: async ({ request }) => {
		const fd = await request.formData();
		const type = String(fd.get('type'));
		const text = String(fd.get('text') ?? '').trim().slice(0, 1000);
		const p = percent(fd.get('percent'));
		if (!BELIEF_TYPES.some((t) => t.id === type)) return fail(400, { error: 'Неизвестный тип убеждения.' });
		if (!text) return fail(400, { error: 'Напишите формулировку убеждения.', type });
		if (p === null) return fail(400, { error: 'Оценка — число от 0 до 100.', type });
		const db = getDb();
		db.transaction(() => {
			const id = db.prepare('INSERT INTO beliefs (type, text, created_at) VALUES (?, ?, ?)').run(type, text, now()).lastInsertRowid;
			db.prepare("INSERT INTO belief_ratings (belief_id, rated_at, percent, context) VALUES (?, ?, ?, 'initial')").run(id, now(), p);
		})();
	},
	rate: async ({ request }) => {
		const fd = await request.formData();
		const id = parseInt(String(fd.get('id')), 10);
		const p = percent(fd.get('percent'));
		if (!id || p === null) return fail(400, { error: 'Оценка — число от 0 до 100.' });
		getDb().prepare("INSERT INTO belief_ratings (belief_id, rated_at, percent, context) VALUES (?, ?, ?, 'weekly')").run(id, now(), p);
	},
	archive: async ({ request }) => {
		const id = parseInt(String((await request.formData()).get('id')), 10);
		if (id) getDb().prepare('UPDATE beliefs SET archived_at = ? WHERE id = ?').run(now(), id);
	}
};
