// Разбор с моделью (SPEC 7.3): данные этапа → разговор в духе сессии с терапевтом → итог.
// Два вида: «итог этапа» (stage, условие перехода, с мнением модели о готовности) и «промежуточный» (interim, посреди этапа).
// В разговоре модель может записать новые оценки убеждений, которые назвал человек.
import fs from 'node:fs';
import path from 'node:path';
import { getDb, now } from '$lib/server/db.js';
import { getStage } from '$lib/server/content.js';
import { getProfile, stageStartedAt, checkUnlock, daysSince } from '$lib/server/stages.js';
import { chatJson, modelLabel } from '$lib/server/llm.js';
import { BELIEF_LABEL, JOURNAL_KINDS, RATING_CONTEXT, EXERCISES } from '$lib/labels.js';
import { EXPERIMENT_KINDS } from '$lib/experiments.js';

export const REVIEW_KINDS = { stage: 'Итог этапа', interim: 'Промежуточный разбор' };
export const kindOf = (v) => (v === 'interim' ? 'interim' : 'stage');

const MODE = { stage: 'итог этапа', interim: 'промежуточный' };
const OPENING = {
	stage: '(Пользователь открыл разбор этапа. Поздоровайтесь, одним предложением скажите, что заметно по данным, и задайте первый вопрос.)',
	interim:
		'(Пользователь открыл промежуточный разбор посреди этапа. Поздоровайтесь, одним предложением скажите, что заметно по данным с прошлого разбора, и задайте первый вопрос.)'
};
export const FINISH_TEXT = 'Давайте подведём итог.';

const day = (iso) => new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit' });
const cut = (s, n = 300) => (s ?? '').toString().replace(/\s+/g, ' ').trim().slice(0, n);
const parse = (s, d = null) => {
	try {
		return s ? JSON.parse(s) : d;
	} catch {
		return d;
	}
};

function entryText(kind, p) {
	if (kind === 'trigger') return `${p.postponed ? 'отложил' : 'не получилось отложить'}${p.note ? ': ' + cut(p.note) : ''}`;
	if (kind === 'worry_window') return `${p.wanted_to_worry ? 'захотелось беспокоиться' : 'желания не было'}, ${p.minutes_used ?? 0} мин${p.note ? ': ' + cut(p.note) : ''}`;
	if (kind === 'att') return `${EXERCISES[p.exercise]?.label ?? 'упражнение'}, ${p.minutes ?? '?'} мин${p.note ? ': ' + cut(p.note) : ''}`;
	if (kind === 'problem') return `«${cut(p.worry, 200)}» → ${p.actionable ? `задача, шаг: ${cut(p.step, 200)}${p.done ? ' (сделал)' : ''}` : 'беспокойство, отложил'}`;
	return cut(p.note);
}

/** Сводка всего, что накопилось на этапе, — текстом для модели. */
export function stageData(stage) {
	const db = getDb();
	const st = getStage(stage);
	const started = stageStartedAt(stage);
	const today = day(now());
	const out = [];
	out.push(`Сегодня ${today}. Этап ${stage}: «${st?.title}». Цель: ${st?.goal}. Начат ${day(started)} (дней на этапе: ${daysSince(started)}).`);
	if (st?.tasks?.length) out.push('Задания этапа:\n' + st.tasks.map((t) => '- ' + t).join('\n'));
	const unlock = checkUnlock(stage);
	if (unlock.hasRule) out.push('Условия перехода:\n' + unlock.items.map((i) => `- ${i.done ? '✓' : '○'} ${i.label}`).join('\n'));

	const counts = db.prepare('SELECT kind, count(*) AS c FROM journal_entries WHERE stage = ? GROUP BY kind').all(stage);
	if (counts.length) out.push('Записей в дневнике на этапе: ' + counts.map((c) => `${JOURNAL_KINDS[c.kind] ?? c.kind} — ${c.c}`).join(', ') + '.');
	const entries = db.prepare('SELECT created_at, kind, payload FROM journal_entries WHERE stage = ? ORDER BY created_at DESC LIMIT 30').all(stage);
	if (entries.length)
		out.push(
			'Последние записи:\n' +
				entries
					.reverse()
					.map((e) => `- ${day(e.created_at)} ${JOURNAL_KINDS[e.kind] ?? e.kind}: ${entryText(e.kind, parse(e.payload, {}))}`)
					.join('\n')
		);

	const exps = db
		.prepare('SELECT e.*, b.text AS belief_text FROM experiments e LEFT JOIN beliefs b ON b.id = e.belief_id WHERE e.stage = ? ORDER BY e.created_at')
		.all(stage);
	for (const e of exps)
		out.push(
			[
				`Эксперимент «${EXPERIMENT_KINDS[e.kind]?.label ?? e.kind}»${e.completed_at ? '' : ' (не завершён)'}`,
				e.belief_text && `  убеждение: ${cut(e.belief_text)}`,
				`  прогноз: ${cut(e.prediction)}${e.prediction_percent != null ? ` (уверен на ${e.prediction_percent}%)` : ''}`,
				e.what_i_did && `  что сделал: ${cut(e.what_i_did)}`,
				e.what_happened && `  что произошло: ${cut(e.what_happened, 600)}`,
				e.conclusion && `  вывод: ${cut(e.conclusion)}`,
				(e.belief_before_percent != null || e.belief_after_percent != null) &&
					`  вера в убеждение: ${e.belief_before_percent ?? '—'}% → ${e.belief_after_percent ?? '—'}%`
			]
				.filter(Boolean)
				.join('\n')
		);

	const beliefs = db.prepare('SELECT id, type, text FROM beliefs WHERE archived_at IS NULL ORDER BY type, created_at').all();
	if (beliefs.length) {
		const rate = db.prepare('SELECT percent, rated_at, context FROM belief_ratings WHERE belief_id = ? ORDER BY rated_at, id');
		const when = (iso) => (day(iso) === today ? 'сегодня' : day(iso));
		out.push(
			'Убеждения и оценки (по порядку):\n' +
				beliefs
					.map(
						(b) =>
							`- [убеждение ${b.id}] ${BELIEF_LABEL[b.type]}: «${cut(b.text)}» — ${
								rate
									.all(b.id)
									.map((r) => `${r.percent}% (${when(r.rated_at)}, ${RATING_CONTEXT[r.context]})`)
									.join(' → ') || 'оценок нет'
							}`
					)
					.join('\n')
		);
	}
	const gad = db.prepare("SELECT taken_at, total FROM scales WHERE kind = 'gad7' ORDER BY taken_at").all();
	if (gad.length) out.push('GAD-7 (0–21): ' + gad.map((g) => `${g.total} (${day(g.taken_at)})`).join(' → '));

	const plan = db.prepare('SELECT * FROM plan WHERE id = 1').get();
	if (plan)
		out.push(
			[
				'План на случай триггера:',
				plan.triggers && `  триггеры: ${cut(plan.triggers)}`,
				plan.steps && `  шаги: ${cut(plan.steps, 600)}`,
				plan.old_way && `  старый способ: ${cut(plan.old_way)}`,
				plan.new_way && `  новый способ: ${cut(plan.new_way)}`
			]
				.filter(Boolean)
				.join('\n')
		);

	const prev = db.prepare("SELECT stage, user_summary FROM stage_reviews WHERE saved_at IS NOT NULL AND kind = 'stage' AND stage < ? ORDER BY stage, id").all(stage);
	for (const r of prev) {
		const u = parse(r.user_summary, {});
		out.push(`Итог этапа ${r.stage}: понял — ${cut(u.learned)}; трудно — ${cut(u.still_hard)}; дальше — ${cut(u.next_focus)}`);
	}
	const mids = db.prepare("SELECT saved_at, user_summary FROM stage_reviews WHERE saved_at IS NOT NULL AND kind = 'interim' AND stage = ? ORDER BY id").all(stage);
	for (const r of mids) {
		const u = parse(r.user_summary, {});
		out.push(`Промежуточный разбор ${day(r.saved_at)}: понял — ${cut(u.learned)}; трудно — ${cut(u.still_hard)}; дальше — ${cut(u.next_focus)}`);
	}
	return out.join('\n\n');
}

function prompt(stage, kind) {
	return fs
		.readFileSync(path.resolve('content/prompts/stage_review.md'), 'utf8')
		.replace('{{MODE}}', MODE[kind])
		.replace('{{DATA}}', stageData(stage));
}

const rowToReview = (r) => r && { ...r, messages: parse(r.messages, []), model_summary: parse(r.model_summary), user_summary: parse(r.user_summary) };

/** Незавершённый разбор текущего этапа этого вида или null. */
export function openReview(stage, kind = 'stage') {
	return rowToReview(
		getDb().prepare('SELECT * FROM stage_reviews WHERE stage = ? AND kind = ? AND saved_at IS NULL ORDER BY id DESC LIMIT 1').get(stage, kind)
	);
}

export function savedReviews() {
	return getDb().prepare('SELECT * FROM stage_reviews WHERE saved_at IS NOT NULL ORDER BY id DESC').all().map(rowToReview);
}

/** Дней с последнего сохранённого разбора на этапе (любого вида) или с начала этапа. */
export function daysSinceReview(stage) {
	const last = getDb().prepare('SELECT max(saved_at) AS t FROM stage_reviews WHERE stage = ? AND saved_at IS NOT NULL').get(stage)?.t;
	return daysSince(last ?? stageStartedAt(stage));
}

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** Проверяет оценки от модели: только живые убеждения, целые 0–100, по одной на убеждение. */
function cleanRatings(list) {
	if (!Array.isArray(list)) return [];
	const get = getDb().prepare('SELECT id, text FROM beliefs WHERE id = ? AND archived_at IS NULL');
	const out = [];
	for (const r of list.slice(0, 20)) {
		const id = Number(r?.belief);
		const p = Number(r?.percent);
		if (!Number.isInteger(id) || !Number.isFinite(p) || p < 0 || p > 100) continue;
		const b = get.get(id);
		if (!b || out.some((o) => o.id === id)) continue;
		out.push({ id, text: cut(b.text, 140), percent: Math.round(p) });
	}
	return out;
}

/** Один ход разбора. Пустой текст — начать. Пишем в базу только после удачного ответа. */
export async function reviewStep(text, modelId, kind = 'stage') {
	const db = getDb();
	const stage = getProfile().current_stage;
	const rev = openReview(stage, kind);
	const history = rev?.messages ?? [];
	if (!text && history.length) throw new Error('Пустое сообщение');

	const msgs = [{ role: 'user', content: OPENING[kind] }];
	for (const m of history) msgs.push(m.role === 'assistant' ? { role: 'assistant', content: JSON.stringify({ reply: m.content }) } : { role: 'user', content: m.content });
	if (text) msgs.push({ role: 'user', content: text });

	const { data, ms } = await chatJson(modelId, prompt(stage, kind), msgs);
	const reply = str(data?.reply, 4000) || '…';
	const ratings = text ? cleanRatings(data?.ratings) : []; // в первом ходе человек ещё ничего не называл
	const s = data?.done ? data.summary : null;
	const summary = s
		? {
				learned: str(s.learned, 2000),
				still_hard: str(s.still_hard, 2000),
				next_focus: str(s.next_focus, 2000),
				...(kind === 'stage' && { ready: s.ready === true, ready_reason: str(s.ready_reason, 800) })
			}
		: null;

	const next = [...history];
	if (text) next.push({ role: 'user', content: text });
	next.push({ role: 'assistant', content: reply, model: modelId, modelLabel: modelLabel(modelId), ms, ...(ratings.length && { ratings }) });

	db.transaction(() => {
		const at = now();
		const ins = db.prepare("INSERT INTO belief_ratings (belief_id, rated_at, percent, context) VALUES (?, ?, ?, 'weekly')");
		for (const r of ratings) ins.run(r.id, at, r.percent);
		if (rev) {
			db.prepare('UPDATE stage_reviews SET messages = ?, model_summary = COALESCE(?, model_summary) WHERE id = ?').run(
				JSON.stringify(next),
				summary && JSON.stringify(summary),
				rev.id
			);
		} else {
			db.prepare('INSERT INTO stage_reviews (stage, kind, started_at, messages, model_summary) VALUES (?, ?, ?, ?, ?)').run(
				stage,
				kind,
				at,
				JSON.stringify(next),
				summary && JSON.stringify(summary)
			);
		}
	})();
}
