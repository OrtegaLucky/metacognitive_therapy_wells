// Экран «Эксперименты» (SPEC 4.6, 6.4, 7.2): прогноз до, результат, вопросы модели, вывод пользователя.
import fs from 'node:fs';
import path from 'node:path';
import { fail } from '@sveltejs/kit';
import { getDb, now } from '$lib/server/db.js';
import { getProfile } from '$lib/server/stages.js';
import { getStages } from '$lib/server/content.js';
import { stageKinds } from '$lib/program.js';
import { chatJson, LlmError, DEFAULT_MODEL, modelLabel } from '$lib/server/llm.js';
import { EXPERIMENT_KINDS } from '$lib/experiments.js';
import { BELIEF_LABEL } from '$lib/labels.js';

const pct = (v) => {
	const s = String(v ?? '').trim();
	if (s === '') return null;
	const n = parseInt(s, 10);
	return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
};
const txt = (fd, n, max = 5000) => String(fd.get(n) ?? '').trim().slice(0, max);

/** Виды экспериментов, открытые на текущем и пройденных этапах, плюс «свой». */
function enabledKinds(stage) {
	const set = new Set();
	for (const s of getStages()) if (s.number <= stage) for (const k of s.experiments_enabled ?? []) set.add(k);
	set.add('custom');
	return Object.keys(EXPERIMENT_KINDS).filter((k) => set.has(k));
}

function currentPercent(db, beliefId) {
	return db.prepare('SELECT percent FROM belief_ratings WHERE belief_id = ? ORDER BY rated_at DESC, id DESC LIMIT 1').get(beliefId)?.percent ?? null;
}

export function load() {
	const db = getDb();
	const stage = getProfile().current_stage;
	const beliefs = db
		.prepare('SELECT id, type, text FROM beliefs WHERE archived_at IS NULL ORDER BY type, created_at')
		.all()
		.map((b) => ({ ...b, current: currentPercent(db, b.id) }));
	const experiments = db
		.prepare(
			`SELECT e.*, b.text AS belief_text, b.type AS belief_type FROM experiments e
			 LEFT JOIN beliefs b ON b.id = e.belief_id ORDER BY e.completed_at IS NOT NULL, e.created_at DESC`
		)
		.all()
		.map((e) => {
			let q = null;
			try {
				q = e.gpt_questions ? JSON.parse(e.gpt_questions) : null;
			} catch {
				/* испорченная запись — не показываем */
			}
			return { ...e, gpt_questions: q };
		});
	return { stage, kinds: enabledKinds(stage), here: stageKinds(stage, getStages()), beliefs, experiments };
}

function getOpen(db, id) {
	const e = db.prepare('SELECT * FROM experiments WHERE id = ?').get(id);
	return e && !e.completed_at ? e : null;
}

export const actions = {
	create: async ({ request }) => {
		const fd = await request.formData();
		const db = getDb();
		const stage = getProfile().current_stage;
		const kind = txt(fd, 'kind');
		if (!enabledKinds(stage).includes(kind)) return fail(400, { error: 'Этот вид эксперимента пока не открыт.' });
		const beliefId = parseInt(txt(fd, 'belief_id'), 10) || null;
		if (beliefId && !db.prepare('SELECT 1 FROM beliefs WHERE id = ?').get(beliefId)) return fail(400, { error: 'Убеждение не найдено.' });
		const prediction = txt(fd, 'prediction');
		if (!prediction) return fail(400, { error: 'Напишите прогноз: что, по-вашему, случится.' });
		const pp = pct(fd.get('prediction_percent'));
		const bb = pct(fd.get('belief_before_percent'));
		if (pp === undefined || bb === undefined) return fail(400, { error: 'Проценты — числа от 0 до 100.' });
		db.prepare(
			`INSERT INTO experiments (stage, belief_id, kind, prediction, prediction_percent, belief_before_percent, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		).run(stage, beliefId, kind, prediction, pp, bb ?? (beliefId ? currentPercent(db, beliefId) : null), now());
		return { created: true };
	},

	// Записать, что сделал и что произошло (можно несколько раз)
	result: async ({ request }) => {
		const fd = await request.formData();
		const db = getDb();
		const e = getOpen(db, parseInt(txt(fd, 'id'), 10));
		if (!e) return fail(400, { error: 'Эксперимент не найден или уже завершён.' });
		db.prepare('UPDATE experiments SET what_i_did = ?, what_happened = ? WHERE id = ?').run(txt(fd, 'what_i_did'), txt(fd, 'what_happened'), e.id);
		return { savedId: e.id };
	},

	// Вопросы модели к результату (SPEC 7.2). Модель вывод не пишет.
	questions: async ({ request }) => {
		const fd = await request.formData();
		const db = getDb();
		const e = getOpen(db, parseInt(txt(fd, 'id'), 10));
		if (!e) return fail(400, { error: 'Эксперимент не найден или уже завершён.' });
		const did = txt(fd, 'what_i_did');
		const happened = txt(fd, 'what_happened');
		db.prepare('UPDATE experiments SET what_i_did = ?, what_happened = ? WHERE id = ?').run(did, happened, e.id);
		if (!happened) return fail(400, { error: 'Сначала опишите, что произошло.', id: e.id });
		const b = e.belief_id ? db.prepare('SELECT type, text FROM beliefs WHERE id = ?').get(e.belief_id) : null;
		const input = {
			убеждение: b ? `${b.text} (${BELIEF_LABEL[b.type]})` : 'не указано',
			вера_в_убеждение_до: e.belief_before_percent,
			эксперимент: EXPERIMENT_KINDS[e.kind]?.label ?? e.kind,
			прогноз: e.prediction,
			уверенность_в_прогнозе: e.prediction_percent,
			что_сделал: did,
			что_произошло: happened
		};
		const system = fs.readFileSync(path.resolve('content/prompts/experiment_review.md'), 'utf8');
		try {
			const { data, ms } = await chatJson(DEFAULT_MODEL, system, [{ role: 'user', content: JSON.stringify(input, null, 1) }]);
			const questions = (Array.isArray(data?.questions) ? data.questions : [])
				.filter((q) => typeof q === 'string' && q.trim())
				.slice(0, 4)
				.map((q) => q.trim().slice(0, 500));
			if (!questions.length) return fail(502, { error: 'Модель не прислала вопросов, попробуйте ещё раз.', id: e.id });
			db.prepare('UPDATE experiments SET gpt_questions = ? WHERE id = ?').run(
				JSON.stringify({ questions, model: DEFAULT_MODEL, label: modelLabel(DEFAULT_MODEL), ms }),
				e.id
			);
		} catch (err) {
			if (err instanceof LlmError) return fail(502, { error: err.message, id: e.id });
			throw err;
		}
		return { savedId: e.id };
	},

	complete: async ({ request }) => {
		const fd = await request.formData();
		const db = getDb();
		const e = getOpen(db, parseInt(txt(fd, 'id'), 10));
		if (!e) return fail(400, { error: 'Эксперимент не найден или уже завершён.' });
		const conclusion = txt(fd, 'conclusion');
		const after = pct(fd.get('belief_after_percent'));
		const happened = txt(fd, 'what_happened') || e.what_happened;
		if (!happened) return fail(400, { error: 'Опишите, что произошло.', id: e.id });
		if (!conclusion) return fail(400, { error: 'Напишите свой вывод — его пишете вы, не модель.', id: e.id });
		if (after == null) return fail(400, { error: 'Оцените, насколько верите в убеждение теперь (0–100%).', id: e.id });
		db.transaction(() => {
			db.prepare(
				'UPDATE experiments SET what_i_did = COALESCE(NULLIF(?, \'\'), what_i_did), what_happened = ?, conclusion = ?, belief_after_percent = ?, completed_at = ? WHERE id = ?'
			).run(txt(fd, 'what_i_did'), happened, conclusion, after, now(), e.id);
			if (e.belief_id)
				db.prepare("INSERT INTO belief_ratings (belief_id, rated_at, percent, context) VALUES (?, ?, ?, 'after_experiment')").run(e.belief_id, now(), after);
		})();
		return { completedId: e.id };
	},

	remove: async ({ request }) => {
		const id = parseInt(String((await request.formData()).get('id')), 10);
		const db = getDb();
		if (getOpen(db, id)) db.prepare('DELETE FROM experiments WHERE id = ?').run(id);
	}
};
