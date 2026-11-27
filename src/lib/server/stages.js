// Текущий этап и проверка условий перехода (SPEC 5, 4.8)
import { getDb, now } from './db.js';
import { getStage } from './content.js';
import { BELIEF_TYPES, JOURNAL_KINDS } from '$lib/labels.js';

export const LAST_STAGE = 11;

export function getProfile() {
	return getDb().prepare('SELECT * FROM profile WHERE id = 1').get();
}

export function stageStartedAt(stage) {
	const row = getDb().prepare('SELECT started_at FROM stage_history WHERE stage = ? ORDER BY id DESC LIMIT 1').get(stage);
	return row?.started_at ?? getProfile().started_at;
}

export const daysSince = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 86400_000);

/** Средняя последняя оценка активных убеждений типа (или null, если оценок нет). */
export function avgBelief(type) {
	const rows = getDb()
		.prepare(
			`SELECT (SELECT percent FROM belief_ratings r WHERE r.belief_id = b.id ORDER BY rated_at DESC, id DESC LIMIT 1) AS p
			 FROM beliefs b WHERE b.type = ? AND b.archived_at IS NULL`
		)
		.all(type)
		.filter((r) => r.p !== null);
	if (!rows.length) return null;
	return Math.round(rows.reduce((s, r) => s + r.p, 0) / rows.length);
}

const filled = (...v) => v.every((x) => typeof x === 'string' && x.trim());

/**
 * Проверяет unlock_rule этапа.
 * Возвращает { hasRule, ok, items: [{ label, done, link? }] }.
 */
export function checkUnlock(stageNumber) {
	const rule = getStage(stageNumber)?.unlock_rule;
	if (!rule) return { hasRule: false, ok: false, items: [] };

	const db = getDb();
	const items = [];
	const started = stageStartedAt(stageNumber);

	if (rule.requires_formulation) {
		const f = db.prepare('SELECT * FROM formulation WHERE id = 1').get();
		const done = [f.trigger_examples, f.worry_chain, f.type2_worry].every((v) => v && v.trim());
		items.push({ label: 'Концептуализация заполнена: триггеры, цепочка беспокойства, беспокойство о беспокойстве', done, link: '/formulation' });
	}

	if (rule.min_beliefs_per_type) {
		const need = rule.min_beliefs_per_type;
		for (const t of BELIEF_TYPES) {
			const c = db.prepare('SELECT count(*) AS c FROM beliefs WHERE type = ? AND archived_at IS NULL').get(t.id).c;
			items.push({ label: `Убеждения «${t.label}»: ${c} из ${need}`, done: c >= need, link: '/beliefs' });
		}
	}

	if (rule.min_scales) {
		for (const [kind, need] of Object.entries(rule.min_scales)) {
			const c = db.prepare('SELECT count(*) AS c FROM scales WHERE kind = ?').get(kind).c;
			items.push({ label: `Шкала ${kind.toUpperCase()} пройдена: ${c} из ${need}`, done: c >= need, link: '/scales' });
		}
	}

	if (rule.min_days) {
		const d = daysSince(started);
		const left = rule.min_days - d;
		items.push({
			label: `Дней на этапе: ${d} из ${rule.min_days}` + (left > 0 ? ` (осталось ${left})` : ''),
			done: left <= 0
		});
	}

	if (rule.min_entries) {
		for (const [kind, need] of Object.entries(rule.min_entries)) {
			const c = db.prepare('SELECT count(*) AS c FROM journal_entries WHERE kind = ? AND stage = ?').get(kind, stageNumber).c;
			const left = need - c;
			items.push({
				label: `Записи «${JOURNAL_KINDS[kind] ?? kind}» на этом этапе: ${c} из ${need}` + (left > 0 ? ` (осталось ${left})` : ''),
				done: left <= 0
			});
		}
	}

	if (rule.min_experiments) {
		const c = db.prepare('SELECT count(*) AS c FROM experiments WHERE stage = ? AND completed_at IS NOT NULL').get(stageNumber).c;
		items.push({ label: `Завершённых экспериментов: ${c} из ${rule.min_experiments}`, done: c >= rule.min_experiments, link: '/experiments' });
	}

	if (rule.belief_threshold) {
		const { type, max } = rule.belief_threshold;
		const name = BELIEF_TYPES.find((t) => t.id === type)?.label ?? type;
		const count = db.prepare('SELECT count(*) AS c FROM beliefs WHERE type = ? AND archived_at IS NULL').get(type).c;
		const avg = avgBelief(type);
		items.push(
			count === 0
				? { label: `Убеждений «${name}» у вас нет — это условие не нужно`, done: true }
				: {
						label: `Средняя оценка убеждений «${name}»: ${avg === null ? 'нет оценок' : avg + '%'} (нужно ниже ${max}%)`,
						done: avg !== null && avg < max,
						link: '/beliefs'
					}
		);
	}

	if (rule.requires_plan) {
		const p = db.prepare('SELECT * FROM plan WHERE id = 1').get();
		items.push({ label: 'План на случай триггера заполнен', done: !!p && filled(p.triggers, p.steps), link: '/plan' });
	}

	if (rule.requires_new_way) {
		const p = db.prepare('SELECT * FROM plan WHERE id = 1').get();
		items.push({ label: 'Итог «старый способ → новый способ» написан', done: !!p && filled(p.old_way, p.new_way), link: '/plan' });
	}

	// Фиксация результата этапа: переоценка убеждений, GAD-7, разбор с моделью
	if (rule.requires_rerating) {
		const total = db.prepare('SELECT count(*) AS c FROM beliefs WHERE archived_at IS NULL').get().c;
		const rated = db
			.prepare(
				`SELECT count(*) AS c FROM beliefs b WHERE b.archived_at IS NULL
				 AND EXISTS (SELECT 1 FROM belief_ratings r WHERE r.belief_id = b.id AND r.rated_at >= ?)`
			)
			.get(started).c;
		items.push({ label: `Убеждения переоценены на этом этапе: ${rated} из ${total}`, done: rated >= total, link: '/beliefs' });
	}

	if (rule.requires_gad7) {
		const c = db.prepare("SELECT count(*) AS c FROM scales WHERE kind = 'gad7' AND taken_at >= ?").get(started).c;
		items.push({ label: 'GAD-7 пройдена на этом этапе', done: c > 0, link: '/scales' });
	}

	if (rule.requires_review) {
		const c = db.prepare('SELECT count(*) AS c FROM stage_reviews WHERE stage = ? AND saved_at IS NOT NULL').get(stageNumber).c;
		items.push({ label: 'Разбор этапа с моделью и ваш итог сохранены', done: c > 0, link: '/review' });
	}

	return { hasRule: true, ok: items.every((i) => i.done), items };
}

/** Переход на следующий этап. manual = принудительно, без проверки условий. */
export function advanceStage(manual) {
	const db = getDb();
	db.transaction(() => {
		const cur = getProfile().current_stage;
		const next = Math.min(cur + 1, LAST_STAGE);
		if (next === cur) return;
		db.prepare('UPDATE profile SET current_stage = ? WHERE id = 1').run(next);
		db.prepare('INSERT INTO stage_history (stage, started_at, manual) VALUES (?, ?, ?)').run(next, now(), manual ? 1 : 0);
	})();
}
