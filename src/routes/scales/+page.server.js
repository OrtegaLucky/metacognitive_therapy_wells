// Шкала GAD-7
import { fail, redirect } from '@sveltejs/kit';
import { getDb, now } from '$lib/server/db.js';

export function load() {
	return {
		results: getDb().prepare("SELECT id, taken_at, total FROM scales WHERE kind = 'gad7' ORDER BY taken_at DESC").all()
	};
}

export const actions = {
	default: async ({ request }) => {
		const fd = await request.formData();
		const answers = [];
		for (let i = 0; i < 7; i++) {
			const v = parseInt(String(fd.get(`q${i}`) ?? ''), 10);
			if (!(v >= 0 && v <= 3)) return fail(400, { error: 'Ответьте на все 7 вопросов.' });
			answers.push(v);
		}
		const total = answers.reduce((s, v) => s + v, 0);
		getDb().prepare("INSERT INTO scales (kind, taken_at, answers, total) VALUES ('gad7', ?, ?, ?)").run(now(), JSON.stringify(answers), total);
		redirect(303, '/scales');
	}
};
