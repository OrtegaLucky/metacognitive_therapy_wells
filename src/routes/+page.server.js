// Экран «Сегодня»: только действия — отметка триггера, дела на сегодня, сколько осталось до перехода.
// Описание этапа, сроки и подробные условия — на экране «Мой этап».
import { getDb } from '$lib/server/db.js';
import { getStage } from '$lib/server/content.js';
import { getProfile, checkUnlock, daysSince, stageStartedAt } from '$lib/server/stages.js';
import { daysSinceReview } from '$lib/server/review.js';
import { EXPERIMENT_KINDS } from '$lib/experiments.js';

export function load({ url }) {
	const db = getDb();
	const profile = getProfile();
	const n = profile.current_stage;
	const stage = getStage(n);
	const dayStart = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' }) + 'T00:00:00+03:00').toISOString();
	const today = Object.fromEntries(
		db.prepare('SELECT kind, count(*) AS c FROM journal_entries WHERE created_at >= ? GROUP BY kind').all(dayStart).map((r) => [r.kind, r.c])
	);
	const enabled = stage?.journal_kinds_enabled ?? ['free'];
	const t = (v) => (v ? `в ${v}` : '');

	// Дела на сегодня: что ещё не сделано — сверху, сделанное — внизу с галочкой
	const todo = [];
	if (enabled.includes('att'))
		todo.push({ label: 'Упражнение внимания', sub: today.att ? 'сделано' : [t(profile.reminder_att), '10–12 минут'].filter(Boolean).join(', '), href: '/exercises', done: !!today.att });
	for (const e of db.prepare('SELECT id, kind FROM experiments WHERE completed_at IS NULL ORDER BY created_at').all())
		todo.push({ label: `Эксперимент: ${EXPERIMENT_KINDS[e.kind]?.label ?? e.kind}`, sub: 'записать, как прошёл день', href: '/experiments', done: false });
	const stageExp = (stage?.experiments_enabled ?? []).filter((k) => k !== 'custom');
	const openExp = todo.some((x) => x.href === '/experiments');
	const unlock = checkUnlock(n);
	if (!openExp && stageExp.length && !unlock.ok)
		todo.push({ label: 'Начать эксперимент этапа', sub: stageExp.map((k) => EXPERIMENT_KINDS[k]?.label ?? k).join(' или '), href: '/experiments', done: false });
	if (enabled.includes('problem'))
		todo.push({ label: 'Решение или беспокойство?', sub: today.problem ? `сегодня: ${today.problem}` : 'когда накатит тревожная мысль', href: '/problem', done: false });
	if (enabled.includes('worry_window'))
		todo.push({ label: 'Вечернее окно', sub: today.worry_window ? 'сделано' : [t(profile.reminder_worry_window), '15 минут'].filter(Boolean).join(', '), href: '/window', done: !!today.worry_window });
	const since = daysSinceReview(n);
	if (n >= 2 && n <= 10 && since >= 7)
		todo.push({ label: 'Промежуточный разбор', sub: `прошло дней с прошлого разбора: ${since}`, href: '/review?kind=interim', done: false });
	todo.sort((a, b) => a.done - b.done);

	return {
		n,
		title: stage?.title ?? '',
		days: daysSince(stageStartedAt(n)) + 1,
		enabled,
		todo,
		// Этап 1 — дела не ежедневные, а задания этапа: показываем невыполненные условия
		steps: unlock.hasRule ? unlock.items : [],
		unlockOk: unlock.ok,
		hasRule: unlock.hasRule,
		logged: url.searchParams.has('logged'),
		today,
		lastReview: n >= 11 ? since : null
	};
}
