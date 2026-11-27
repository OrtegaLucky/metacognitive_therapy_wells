// Справочник программы: какое упражнение и эксперимент с какого этапа (для экрана этапа и меток «этап N / весь курс»).
// Можно использовать и в браузере, и на сервере.
import { EXPERIMENT_KINDS } from '$lib/experiments.js';

/** Упражнения и инструменты. fromStage — этап, на котором появляются; дальше они «на весь курс». */
export const TOOLS = [
	{ id: 'talk', label: 'Разговор: схема беспокойства', href: '/talk', fromStage: 1, only: true },
	{ id: 'beliefs', label: 'Убеждения и их оценка', href: '/beliefs', fromStage: 1 },
	{ id: 'gad7', label: 'Шкала GAD-7', href: '/scales', fromStage: 1 },
	{ id: 'trigger', label: 'Заметил триггер → отложил', href: '/', fromStage: 2 },
	{ id: 'window', label: 'Вечернее окно', href: '/window', fromStage: 2 },
	{ id: 'train', label: 'Поезд мыслей', href: '/exercises', fromStage: 2 },
	{ id: 'assoc', label: 'Свободная ассоциация', href: '/exercises', fromStage: 2 },
	{ id: 'type2', label: 'Отметка «беспокойство о беспокойстве»', href: '/diary?new=type2&back=/', fromStage: 2 },
	{ id: 'bear', label: 'Белый медведь', href: '/exercises', fromStage: 4 },
	{ id: 'problem', label: 'Решение или беспокойство?', href: '/problem', fromStage: 7 },
	{ id: 'plan', label: 'Мой план', href: '/plan', fromStage: 9 }
];

/** Этап, на котором впервые открывается вид эксперимента (по stages.json). «Свой» — всегда. */
export function experimentStages(stages) {
	const first = { custom: 1 };
	for (const s of stages) for (const k of s.experiments_enabled ?? []) first[k] ??= s.number;
	return first;
}

/** Метка для текущего этапа: «этап N» — новое на этом этапе, «весь курс» — открыто раньше. */
export function scopeTag(fromStage, current) {
	if (fromStage > current) return null;
	return fromStage === current ? `этап ${current}` : 'весь курс';
}

/** Блоки экрана этапа: упражнения и эксперименты этого этапа и всего курса. */
export function stageBlocks(current, stages) {
	const exp = experimentStages(stages);
	const tools = TOOLS.filter((t) => t.fromStage <= current && !(t.only && t.fromStage < current));
	const kinds = Object.keys(EXPERIMENT_KINDS).filter((k) => exp[k] != null && exp[k] <= current);
	const here = stageKinds(current, stages);
	return {
		toolsStage: tools.filter((t) => t.fromStage === current),
		toolsCourse: tools.filter((t) => t.fromStage < current),
		expStage: kinds.filter((k) => here.includes(k)),
		expCourse: kinds.filter((k) => !here.includes(k))
	};
}

/** Эксперименты, которые входят в задания этого этапа (даже если впервые открылись раньше). */
export function stageKinds(current, stages) {
	return stages.find((s) => s.number === current)?.experiments_enabled ?? [];
}

/** Метка эксперимента: «этап N» — входит в задания этапа, «весь курс» — открыт раньше, «всегда» — свой. */
export function expTag(kind, current, here) {
	if (kind === 'custom') return 'всегда';
	return here.includes(kind) ? `этап ${current}` : 'весь курс';
}
