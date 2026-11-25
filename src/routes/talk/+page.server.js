// Экран «Разговор»: концептуализация с моделью (SPEC 7.1)
import { fail } from '@sveltejs/kit';
import { getDb, now } from '$lib/server/db.js';
import { modelList, DEFAULT_MODEL } from '$lib/server/llm.js';
import { openConversation } from '$lib/server/talk.js';
import { BELIEF_TYPES, COPING } from '$lib/labels.js';

export function load() {
	const f = getDb().prepare('SELECT trigger_examples, worry_chain, type2_worry FROM formulation WHERE id = 1').get();
	return {
		conv: openConversation(),
		models: modelList(),
		defaultModel: DEFAULT_MODEL,
		hasFormulation: !!(f?.trigger_examples || f?.worry_chain || f?.type2_worry)
	};
}

export const actions = {
	// Отложить текущий разговор и начать новый (старый остаётся в базе)
	new: () => {
		getDb().prepare("UPDATE conversations SET finished_at = ? WHERE kind = 'conceptualization' AND finished_at IS NULL").run(now());
	},

	// Сохранить проверенный черновик в схему и убеждения
	save: async ({ request }) => {
		const conv = openConversation();
		if (!conv) return fail(400, { error: 'Нет открытого разговора.' });
		const fd = await request.formData();
		const t = (n, max = 10000) => String(fd.get(n) ?? '').trim().slice(0, max);

		const types = new Set(BELIEF_TYPES.map((x) => x.id));
		const beliefs = [];
		const count = Math.min(parseInt(t('belief_count'), 10) || 0, 20);
		for (let i = 0; i < count; i++) {
			if (!fd.get(`b${i}_use`)) continue;
			const text = t(`b${i}_text`, 1000);
			const type = t(`b${i}_type`);
			if (!text || !types.has(type)) continue;
			const p = parseInt(t(`b${i}_percent`), 10);
			if (!(p >= 0 && p <= 100)) return fail(400, { error: `Укажите, насколько верите (0–100%), для убеждения «${text.slice(0, 60)}».` });
			beliefs.push({ type, text, percent: p });
		}

		const ids = new Set(COPING.map((c) => c.id));
		const coping = { checked: fd.getAll('coping').map(String).filter((c) => ids.has(c)), other: t('coping_other') };
		const dialog = conv.messages.map(({ role, content, model, ms, created_at }) => ({ role, content, model, ms, created_at }));

		const db = getDb();
		db.transaction(() => {
			// Пустое поле черновика не затирает то, что уже было в схеме
			db.prepare(
				`UPDATE formulation SET
					trigger_examples = COALESCE(NULLIF(?, ''), trigger_examples),
					worry_chain = COALESCE(NULLIF(?, ''), worry_chain),
					type2_worry = COALESCE(NULLIF(?, ''), type2_worry),
					coping_strategies = ?, raw_dialog = ?, updated_at = ?
				WHERE id = 1`
			).run(t('trigger_examples'), t('worry_chain'), t('type2_worry'), JSON.stringify(coping), JSON.stringify(dialog), now());
			const addB = db.prepare('INSERT INTO beliefs (type, text, created_at) VALUES (?, ?, ?)');
			const addR = db.prepare("INSERT INTO belief_ratings (belief_id, rated_at, percent, context) VALUES (?, ?, ?, 'initial')");
			for (const b of beliefs) addR.run(addB.run(b.type, b.text, now()).lastInsertRowid, now(), b.percent);
			db.prepare('UPDATE conversations SET finished_at = ?, saved_at = ? WHERE id = ?').run(now(), now(), conv.id);
		})();
		return { saved: true, beliefs: beliefs.length };
	}
};
