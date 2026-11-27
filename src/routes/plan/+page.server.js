// Экран «Мой план» (этапы 9–10): план на случай триггера и «старый способ → новый способ»
import { getDb, now } from '$lib/server/db.js';
import { getProfile } from '$lib/server/stages.js';
import { COPING } from '$lib/labels.js';

/** Подсказки из концептуализации, пока план пустой. */
function defaults(db) {
	const f = db.prepare('SELECT trigger_examples, coping_strategies FROM formulation WHERE id = 1').get() ?? {};
	let coping = [];
	try {
		const c = JSON.parse(f.coping_strategies || '{}');
		coping = [...(c.checked ?? []).map((id) => COPING.find((x) => x.id === id)?.label).filter(Boolean), c.other].filter(Boolean);
	} catch {
		/* старый формат — без подсказки */
	}
	return { triggers: f.trigger_examples ?? '', old_way: coping.map((c) => '— ' + c).join('\n') };
}

export function load() {
	const db = getDb();
	const plan = db.prepare('SELECT * FROM plan WHERE id = 1').get();
	return { plan, hints: defaults(db), stage: getProfile().current_stage };
}

export const actions = {
	default: async ({ request }) => {
		const fd = await request.formData();
		const t = (n) => String(fd.get(n) ?? '').trim().slice(0, 5000) || null;
		getDb()
			.prepare(
				`INSERT INTO plan (id, triggers, steps, warning_signs, old_way, new_way, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(id) DO UPDATE SET triggers = excluded.triggers, steps = excluded.steps, warning_signs = excluded.warning_signs,
				 old_way = excluded.old_way, new_way = excluded.new_way, updated_at = excluded.updated_at`
			)
			.run(t('triggers'), t('steps'), t('warning_signs'), t('old_way'), t('new_way'), now());
		return { saved: true };
	}
};
