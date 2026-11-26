// Звук для аватара через Web Audio с поправками для iPhone (Safari):
// 1) бесшумный режим глушит Web Audio — просим тип сессии «playback», как у плеера;
// 2) iOS «усыпляет» звук страницы (блокировка экрана, другое приложение) —
//    будим его прямо по нажатию и запускаем короткую тишину, это «разблокирует» звук;
// 3) если звук так и не проснулся, создаём его заново.

let ctx = null;

export function audioState() {
	return ctx?.state ?? 'нет';
}

/** Вызывать синхронно в обработчике нажатия, до любых await. */
export function unlockAudio(onState) {
	try {
		if (navigator.audioSession) navigator.audioSession.type = 'playback';
	} catch {
		/* старый Safari — без этой настройки */
	}
	if (!ctx || ctx.state === 'closed') {
		ctx = new AudioContext();
		ctx.onstatechange = () => onState?.(ctx.state);
	}
	const s = ctx.createBufferSource();
	s.buffer = ctx.createBuffer(1, 1, 22050);
	s.connect(ctx.destination);
	s.start(0);
	const resumed = ctx.resume().catch(() => {});
	onState?.(ctx.state);
	return { ctx, resumed };
}

/** Перед воспроизведением: убедиться, что звук работает. Возвращает контекст или null. */
export async function ensureRunning(resumed, onState) {
	await resumed;
	if (ctx.state !== 'running') await ctx.resume().catch(() => {});
	if (ctx.state !== 'running') {
		// iOS иногда держит старый контекст в состоянии interrupted — пробуем новый
		try {
			await ctx.close();
		} catch {
			/* уже закрыт */
		}
		ctx = new AudioContext();
		ctx.onstatechange = () => onState?.(ctx.state);
		await ctx.resume().catch(() => {});
	}
	onState?.(ctx.state);
	return ctx.state === 'running' ? ctx : null;
}

/** Перед записью с микрофона: в режиме «playback» iPhone запись не даёт. После записи unlockAudio вернёт «playback». */
export function micSession() {
	try {
		if (navigator.audioSession) navigator.audioSession.type = 'play-and-record';
	} catch {
		/* старый Safari — без этой настройки */
	}
}
