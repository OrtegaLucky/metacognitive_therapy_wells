// Подписи и справочники для интерфейса (можно использовать и в браузере, и на сервере)

export const BELIEF_TYPES = [
	{ id: 'uncontrollability', label: 'Неконтролируемость', hint: 'Например: «если начну беспокоиться, уже не смогу остановиться»' },
	{ id: 'danger', label: 'Опасность', hint: 'Например: «от постоянного беспокойства можно заболеть или сойти с ума»' },
	{ id: 'usefulness', label: 'Польза', hint: 'Например: «беспокойство помогает подготовиться к худшему»' }
];
export const BELIEF_LABEL = Object.fromEntries(BELIEF_TYPES.map((t) => [t.id, t.label]));

export const JOURNAL_KINDS = {
	trigger: 'Заметил триггер',
	worry_window: 'Вечернее окно',
	type2: 'Беспокойство о беспокойстве',
	att: 'Тренировка внимания (ATT)',
	free: 'Свободная запись'
};

export const RATING_CONTEXT = {
	initial: 'начальная',
	weekly: 'переоценка',
	after_experiment: 'после эксперимента'
};

export const COPING = [
	{ id: 'suppress', label: 'Стараюсь не думать, гоню мысли' },
	{ id: 'reassurance', label: 'Ищу успокоения: спрашиваю других, читаю в интернете' },
	{ id: 'analyze', label: 'Прокручиваю и анализирую, пока не найду ответ' },
	{ id: 'avoid', label: 'Избегаю ситуаций, новостей, разговоров' },
	{ id: 'distract', label: 'Отвлекаюсь: телефон, сериалы, работа' },
	{ id: 'check', label: 'Проверяю: самочувствие, близких, дела' },
	{ id: 'substances', label: 'Алкоголь, еда, успокоительные' }
];

export const GAD7_QUESTIONS = [
	'Нервозность, тревога, ощущение, что вы «на взводе»',
	'Не получалось остановить беспокойство или держать его под контролем',
	'Слишком сильно беспокоились по разным поводам',
	'Было трудно расслабиться',
	'Были настолько неспокойны, что трудно усидеть на месте',
	'Легко раздражались или злились',
	'Было чувство, будто может случиться что-то ужасное'
];
export const GAD7_OPTIONS = ['Ни разу', 'Несколько дней', 'Больше половины дней', 'Почти каждый день'];

export function gad7Level(total) {
	if (total <= 4) return 'минимальная тревога';
	if (total <= 9) return 'лёгкая';
	if (total <= 14) return 'умеренная';
	return 'выраженная';
}

export function fmtDate(iso) {
	if (!iso) return '';
	return new Date(iso).toLocaleString('ru-RU', {
		timeZone: 'Europe/Moscow',
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
}
