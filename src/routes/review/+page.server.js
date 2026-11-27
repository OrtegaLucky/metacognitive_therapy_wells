// Экран «Разбор»: разговор с моделью по данным этапа и итог «что я понял».
// ?kind=interim — промежуточный разбор посреди этапа; без него — итог этапа.
import { fail } from '@sveltejs/kit';
import { getDb, now } from '$lib/server/db.js';
import { getStage } from '$lib/server/content.js';
import { getProfile, checkUnlock } from '$lib/server/stages.js';
import { LlmError, DEFAULT_MODEL, modelList } from '$lib/server/llm.js';
import { openReview, savedReviews, reviewStep, daysSinceReview, kindOf, FINISH_TEXT, REVIEW_KINDS } from '$lib/server/review.js';

export function load({ url }) {
	const stage = getProfile().current_stage;
	const kind = kindOf(url.searchParams.get('kind'));
	return {
		stage,
		kind,
		kindLabel: REVIEW_KINDS[kind],
		title: getStage(stage)?.title ?? '',
		review: openReview(stage, kind),
		otherOpen: !!openReview(stage, kind === 'stage' ? 'interim' : 'stage'),
		sinceLast: daysSinceReview(stage),
		unlock: checkUnlock(stage),
		saved: savedReviews(),
		kinds: REVIEW_KINDS,
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
			await reviewStep(fd.get('finish') ? FINISH_TEXT : txt(fd, 'text'), model, kindOf(fd.get('kind')));
		} catch (e) {
			return fail(e instanceof LlmError ? 502 : 400, { error: e.message });
		}
		return { said: true };
	},
	save: async ({ request }) => {
		const fd = await request.formData();
		const stage = getProfile().current_stage;
		const rev = openReview(stage, kindOf(fd.get('kind')));
		if (!rev) return fail(400, { error: 'Разбор не найден.' });
		const m = rev.model_summary ?? {};
		const s = {
			learned: txt(fd, 'learned'),
			still_hard: txt(fd, 'still_hard'),
			next_focus: txt(fd, 'next_focus'),
			// мнение модели о готовности сохраняем как есть — решение о переходе всё равно за человеком
			...(rev.kind === 'stage' && m.ready_reason && { ready: m.ready === true, ready_reason: m.ready_reason })
		};
		if (!s.learned) return fail(400, { error: 'Напишите хотя бы, что вы поняли.' });
		getDb().prepare('UPDATE stage_reviews SET user_summary = ?, saved_at = ? WHERE id = ?').run(JSON.stringify(s), now(), rev.id);
		return { saved: true };
	},
	restart: async ({ request }) => {
		const fd = await request.formData();
		const rev = openReview(getProfile().current_stage, kindOf(fd.get('kind')));
		if (rev) getDb().prepare('DELETE FROM stage_reviews WHERE id = ?').run(rev.id);
		return { restarted: true };
	}
};
