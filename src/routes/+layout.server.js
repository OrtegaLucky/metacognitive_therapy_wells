import { getProfile } from '$lib/server/stages.js';
import { getStages } from '$lib/server/content.js';
import { experimentStages } from '$lib/program.js';

export function load({ locals }) {
	if (!locals.authed) return { authed: false };
	// С какого этапа открываются эксперименты (кроме «своего»)
	const first = Object.entries(experimentStages(getStages()))
		.filter(([k]) => k !== 'custom')
		.map(([, n]) => n);
	return { authed: true, stage: getProfile().current_stage, expFrom: first.length ? Math.min(...first) : 3 };
}
