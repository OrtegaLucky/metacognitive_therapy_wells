// Настройки: время напоминаний, Telegram chat id, проверка бота
import { fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db.js';
import { getProfile } from '$lib/server/stages.js';
import { sendTelegram } from '$lib/server/telegram.js';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function load() {
	return { profile: getProfile(), botReady: !!env.TELEGRAM_BOT_TOKEN };
}

export const actions = {
	save: async ({ request }) => {
		const fd = await request.formData();
		const t = (n) => String(fd.get(n) ?? '').trim();
		const worry = t('reminder_worry_window');
		const att = t('reminder_att');
		const weekly = t('reminder_weekly_review').slice(0, 40);
		const chat = t('telegram_chat_id');
		if (worry && !TIME.test(worry)) return fail(400, { error: 'Время вечернего окна — в формате ЧЧ:ММ.' });
		if (att && !TIME.test(att)) return fail(400, { error: 'Время ATT — в формате ЧЧ:ММ.' });
		if (chat && !/^-?\d{1,20}$/.test(chat)) return fail(400, { error: 'Telegram chat id — только цифры.' });
		getDb()
			.prepare(
				'UPDATE profile SET reminder_worry_window = ?, reminder_att = ?, reminder_weekly_review = ?, telegram_chat_id = ? WHERE id = 1'
			)
			.run(worry || null, att || null, weekly || null, chat || null);
		return { saved: true };
	},
	telegram: async () => {
		try {
			await sendTelegram(env.TELEGRAM_BOT_TOKEN, getProfile().telegram_chat_id, 'Проверка: напоминания будут приходить сюда.');
			return { tgOk: true };
		} catch (e) {
			return fail(400, { tgError: 'Не отправилось: ' + e.message });
		}
	}
};
