// Отправка сообщения ботом Telegram (SPEC 8). Без $env — модуль используют и приложение, и scripts/remind.js.
// Токен в журнал не попадает: в ошибке только код ответа и описание от Telegram.

export async function sendTelegram(token, chatId, text) {
	if (!token) throw new Error('не задан TELEGRAM_BOT_TOKEN');
	if (!chatId) throw new Error('не указан Telegram chat id в настройках');
	let res;
	try {
		res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
			signal: AbortSignal.timeout(15_000)
		});
	} catch {
		throw new Error('Telegram недоступен с сервера');
	}
	const body = await res.json().catch(() => ({}));
	if (!res.ok || !body.ok) {
		const d = String(body.description ?? '');
		if (res.status === 401) throw new Error('неверный токен бота');
		if (/chat not found|bot can't initiate|blocked/i.test(d)) throw new Error('бот не может вам написать — откройте бота и нажмите «Start»');
		throw new Error(`Telegram ответил ${res.status}: ${d.slice(0, 120)}`);
	}
}

/** Тексты напоминаний. Ссылка ведёт сразу на нужный экран. */
export function reminderText(kind, origin) {
	if (kind === 'worry_window') return `Время вечернего окна. Хочется ли ещё беспокоиться о том, что вы отложили днём?\n${origin}/window`;
	if (kind === 'att') return `Пара минут на упражнение: понаблюдать за мыслями со стороны.\n${origin}/exercises`;
	return `Напоминание\n${origin}/`;
}
