// Экран «Этап»: описание, условия перехода, кнопки перехода
import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { getStage, getStageHtml, getStages } from '$lib/server/content.js';
import { getProfile, checkUnlock, advanceStage, LAST_STAGE } from '$lib/server/stages.js';

export function load() {
	const profile = getProfile();
	return {
		profile,
		stage: getStage(profile.current_stage),
		html: getStageHtml(profile.current_stage),
		unlock: checkUnlock(profile.current_stage),
		route: getStages().map((s) => ({ number: s.number, title: s.title })),
		history: getDb().prepare('SELECT stage, started_at, manual FROM stage_history ORDER BY id').all(),
		isLast: profile.current_stage >= LAST_STAGE
	};
}

export const actions = {
	advance: () => {
		const cur = getProfile().current_stage;
		if (cur >= LAST_STAGE) return fail(400, { error: 'Это последний этап.' });
		if (!checkUnlock(cur).ok) return fail(400, { error: 'Условия перехода ещё не выполнены.' });
		advanceStage(false);
		redirect(303, '/');
	},
	force: async ({ request }) => {
		const fd = await request.formData();
		if (fd.get('confirm') !== 'yes') return fail(400, { error: 'Поставьте галочку, чтобы перейти вручную.' });
		if (getProfile().current_stage >= LAST_STAGE) return fail(400, { error: 'Это последний этап.' });
		advanceStage(true);
		redirect(303, '/');
	}
};
