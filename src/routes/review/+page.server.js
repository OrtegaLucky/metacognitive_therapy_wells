// Экран «Разбор этапа»: разговор с моделью по данным этапа и итог «что я понял»
import { fail } from '@sveltejs/kit';
import { getDb, now } from '$lib/server/db.js';
import { getStage } from '$lib/server/content.js';
import { getProfile } from '$lib/server/stages.js';
import { LlmError, DEFAULT_MODEL, modelList } from '$lib/server/llm.js';
import { openReview, savedReviews, reviewStep, FINISH_TEXT } from '$lib/server/review.js';

export function load() {
	const stage = getProfile().current_stage;
	return {
		stage,
		title: getStage(stage)?.title ?? '',
		review: openReview(stage),
		saved: savedReviews(),
		models: modelList(),
		defaultModel: DEFAULT_MODEL,
		finishText: FINISH_TEXT
	};
}

const txt = (fd, n, max = 4000) => String(fd.get(n) ?? '').trim().slice(0, max);

export const actions = {
	say: async ({ request }) => {
		const fd = await request.formData();
		const model = txt(fd, 'model', 64);
		if (!modelList().some((m) => m.id === model && m.available)) return fail(400, { error: 'Эта модель недоступна.' });
		try {
			await reviewStep(fd.get('finish') ? FINISH_TEXT : txt(fd, 'text'), model);
		} catch (e) {
			return fail(e instanceof LlmError ? 502 : 400, { error: e.message });
		}
		return { said: true };
	},
	save: async ({ request }) => {
		const fd = await request.formData();
		const stage = getProfile().current_stage;
		const rev = openReview(stage);
		if (!rev) return fail(400, { error: 'Разбор не найден.' });
		const s = { learned: txt(fd, 'learned'), still_hard: txt(fd, 'still_hard'), next_focus: txt(fd, 'next_focus') };
		if (!s.learned) return fail(400, { error: 'Напишите хотя бы, что вы поняли на этом этапе.' });
		getDb().prepare('UPDATE stage_reviews SET user_summary = ?, saved_at = ? WHERE id = ?').run(JSON.stringify(s), now(), rev.id);
		return { saved: true };
	},
	restart: () => {
		const rev = openReview(getProfile().current_stage);
		if (rev) getDb().prepare('DELETE FROM stage_reviews WHERE id = ?').run(rev.id);
		return { restarted: true };
	}
};
