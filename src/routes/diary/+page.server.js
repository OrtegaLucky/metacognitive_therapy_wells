// Экран «Дневник»: лента записей, фильтр, добавление
import { fail, redirect } from '@sveltejs/kit';
import { getDb, now } from '$lib/server/db.js';
import { getStage } from '$lib/server/content.js';
import { getProfile } from '$lib/server/stages.js';
import { JOURNAL_KINDS } from '$lib/labels.js';

const text = (fd, name) => String(fd.get(name) ?? '').trim().slice(0, 5000);
const int = (fd, name) => {
	const n = parseInt(String(fd.get(name) ?? ''), 10);
	return Number.isFinite(n) && n >= 0 && n <= 1440 ? n : null;
};
// Возвращаемся только на свои страницы, никаких внешних адресов
const safeBack = (v) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/diary');

export function load({ url }) {
	const profile = getProfile();
	const enabled = (getStage(profile.current_stage)?.journal_kinds_enabled ?? ['free']).filter((k) => k !== 'problem');
	const kind = url.searchParams.get('kind') || '';
	const stage = parseInt(url.searchParams.get('stage') || '', 10) || null;

	let sql = 'SELECT * FROM journal_entries WHERE 1=1';
	const args = [];
	if (kind && JOURNAL_KINDS[kind]) {
		sql += ' AND kind = ?';
		args.push(kind);
	}
	if (stage) {
		sql += ' AND stage = ?';
		args.push(stage);
	}
	sql += ' ORDER BY created_at DESC LIMIT 300';
	const entries = getDb()
		.prepare(sql)
		.all(...args)
		.map((e) => ({ ...e, payload: JSON.parse(e.payload) }));

	const newKind = url.searchParams.get('new');
	return {
		entries,
		enabled,
		filter: { kind, stage },
		newKind: enabled.includes(newKind) ? newKind : enabled[0],
		back: safeBack(url.searchParams.get('back')),
		added: url.searchParams.has('added')
	};
}

export const actions = {
	add: async ({ request }) => {
		const fd = await request.formData();
		const kind = String(fd.get('kind'));
		if (!JOURNAL_KINDS[kind]) return fail(400, { error: 'Неизвестный тип записи.' });

		let payload;
		if (kind === 'trigger') payload = { postponed: fd.get('postponed') === 'yes', note: text(fd, 'note') };
		else if (kind === 'worry_window')
			payload = { wanted_to_worry: fd.get('wanted_to_worry') === 'yes', minutes_used: int(fd, 'minutes_used'), note: text(fd, 'note') };
		else if (kind === 'att') payload = { minutes: int(fd, 'minutes') };
		else payload = { note: text(fd, 'note') };

		if (kind === 'free' && !payload.note) return fail(400, { error: 'Запись пустая.' });

		getDb()
			.prepare('INSERT INTO journal_entries (created_at, stage, kind, payload) VALUES (?, ?, ?, ?)')
			.run(now(), getProfile().current_stage, kind, JSON.stringify(payload));

		const back = safeBack(fd.get('back'));
		redirect(303, back === '/diary' ? '/diary?added=1' : back);
	},
	delete: async ({ request }) => {
		const id = parseInt(String((await request.formData()).get('id')), 10);
		if (id) getDb().prepare('DELETE FROM journal_entries WHERE id = ?').run(id);
	}
};
