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

const daysSince = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 86400_000);

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

/**
 * Проверяет unlock_rule этапа.
 * Возвращает { hasRule, ok, items: [{ label, done }] }.
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
		items.push({ label: 'Концептуализация заполнена: триггеры, цепочка беспокойства, беспокойство о беспокойстве', done });
	}

	if (rule.min_beliefs_per_type) {
		const need = rule.min_beliefs_per_type;
		for (const t of BELIEF_TYPES) {
			const c = db.prepare('SELECT count(*) AS c FROM beliefs WHERE type = ? AND archived_at IS NULL').get(t.id).c;
			items.push({ label: `Убеждения «${t.label}»: ${c} из ${need}`, done: c >= need });
		}
	}

	if (rule.min_scales) {
		for (const [kind, need] of Object.entries(rule.min_scales)) {
			const c = db.prepare('SELECT count(*) AS c FROM scales WHERE kind = ?').get(kind).c;
			items.push({ label: `Шкала ${kind.toUpperCase()} пройдена: ${c} из ${need}`, done: c >= need });
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
		items.push({ label: `Завершённых экспериментов: ${c} из ${rule.min_experiments}`, done: c >= rule.min_experiments });
	}

	if (rule.belief_threshold) {
		const { type, max } = rule.belief_threshold;
		const avg = avgBelief(type);
		const name = BELIEF_TYPES.find((t) => t.id === type)?.label ?? type;
		items.push({
			label: `Средняя оценка убеждений «${name}»: ${avg === null ? 'нет оценок' : avg + '%'} (нужно ниже ${max}%)`,
			done: avg !== null && avg < max
		});
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
