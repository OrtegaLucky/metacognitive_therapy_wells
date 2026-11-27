// Меню по ходу курса: сегодня → мой этап → практика → убеждения и схема → история.
// from — этап, с которого экран открыт; раньше он виден серым с подписью «с этапа N».

/** @returns {{ title: string, href?: string, note?: string, items: { href: string, label: string, from: number }[] }[]} */
export function menuSections(stage, expFrom = 3) {
	return [
		{ title: 'Сегодня', href: '/', note: 'что сделать сейчас', items: [] },
		{
			title: 'Мой этап',
			href: '/stage',
			note: `этап ${stage} из 11`,
			items: [{ href: '/review', label: 'Разбор', from: 2 }]
		},
		{
			title: 'Практика',
			items: [
				{ href: '/window', label: 'Вечернее окно', from: 2 },
				{ href: '/exercises', label: 'Упражнения', from: 2 },
				{ href: '/experiments', label: 'Эксперименты', from: expFrom },
				{ href: '/problem', label: 'Решение или беспокойство', from: 7 }
			]
		},
		{
			title: 'Убеждения и схема',
			items: [
				{ href: '/beliefs', label: 'Убеждения', from: 1 },
				{ href: '/formulation', label: 'Схема беспокойства', from: 1 },
				{ href: '/talk', label: 'Разговор о схеме', from: 1 },
				{ href: '/scales', label: 'GAD-7', from: 1 },
				{ href: '/plan', label: 'Мой план', from: 9 }
			]
		},
		{ title: 'История', href: '/diary', note: 'дневник: все записи', items: [] }
	];
}

/** Заголовок в шапке для текущего адреса. */
export function pageTitle(path, sections) {
	const is = (href) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
	for (const s of sections) {
		for (const i of s.items) if (is(i.href)) return i.label;
		if (s.href && is(s.href)) return s.title;
	}
	if (is('/settings')) return 'Настройки';
	return '';
}
