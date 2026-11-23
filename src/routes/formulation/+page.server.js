// Концептуализация (ручной ввод, Фаза 1)
import { getDb, now } from '$lib/server/db.js';
import { COPING } from '$lib/labels.js';

export function load() {
	const f = getDb().prepare('SELECT * FROM formulation WHERE id = 1').get();
	let coping = { checked: [], other: '' };
	try {
		if (f.coping_strategies) coping = JSON.parse(f.coping_strategies);
	} catch {
		/* старый формат — показываем пустым */
	}
	return { f, coping };
}

export const actions = {
	default: async ({ request }) => {
		const fd = await request.formData();
		const t = (n) => String(fd.get(n) ?? '').trim().slice(0, 10000);
		const ids = new Set(COPING.map((c) => c.id));
		const coping = { checked: fd.getAll('coping').map(String).filter((c) => ids.has(c)), other: t('coping_other') };
		getDb()
			.prepare(
				'UPDATE formulation SET trigger_examples = ?, worry_chain = ?, type2_worry = ?, coping_strategies = ?, updated_at = ? WHERE id = 1'
			)
			.run(t('trigger_examples'), t('worry_chain'), t('type2_worry'), JSON.stringify(coping), now());
		return { saved: true };
	}
};
