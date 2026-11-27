// Экран «Этап» по шести блокам: чтение, упражнения этапа, эксперименты этапа, всего курса, фиксация результата
import { daysSinceReview } from '$lib/server/review.js';
import fs from 'node:fs';
import path from 'node:path';
import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { getStage, getStageHtml, getStages } from '$lib/server/content.js';
import { getProfile, checkUnlock, advanceStage, stageStartedAt, daysSince, LAST_STAGE } from '$lib/server/stages.js';
import { stageBlocks } from '$lib/program.js';

/** Текст этапа для озвучки: без разметки, кусками не длиннее 900 знаков (ограничение службы голоса — 1000). */
function speechParts(number) {
	const file = path.resolve('content/stages', `${String(number).padStart(2, '0')}.md`);
	if (!fs.existsSync(file)) return [];
	const plain = fs
		.readFileSync(file, 'utf8')
		.replace(/^#+\s*/gm, '')
		.replace(/^>\s*/gm, '')
		.replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
		.replace(/[*_`]/g, '')
		.replace(/→/g, ' — ');
	const parts = [];
	for (const para of plain.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, '. ').replace(/\.\.+/g, '.').trim()).filter(Boolean)) {
		if (parts.length && (parts.at(-1) + ' ' + para).length <= 900) parts[parts.length - 1] += ' ' + para;
		else for (let i = 0; i < para.length; i += 900) parts.push(para.slice(i, i + 900));
	}
	return parts;
}

export function load() {
	const db = getDb();
	const profile = getProfile();
	const n = profile.current_stage;
	const started = stageStartedAt(n);
	const expDone = Object.fromEntries(
		db.prepare('SELECT kind, count(*) AS c FROM experiments WHERE stage = ? AND completed_at IS NOT NULL GROUP BY kind').all(n).map((r) => [r.kind, r.c])
	);
	const review = db.prepare("SELECT user_summary, saved_at FROM stage_reviews WHERE stage = ? AND kind = 'stage' AND saved_at IS NOT NULL ORDER BY id DESC LIMIT 1").get(n);
	return {
		profile,
		stage: getStage(n),
		html: getStageHtml(n),
		speech: speechParts(n),
		days: daysSince(started),
		blocks: stageBlocks(n, getStages()),
		expDone,
		review: review && { ...JSON.parse(review.user_summary || '{}'), saved_at: review.saved_at },
		unlock: checkUnlock(n),
		sinceLast: daysSinceReview(n),
		route: getStages().map((s) => ({ number: s.number, title: s.title })),
		history: db.prepare('SELECT stage, started_at, manual FROM stage_history ORDER BY id').all(),
		isLast: n >= LAST_STAGE
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
