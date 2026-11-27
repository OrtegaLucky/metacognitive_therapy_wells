// Напоминания в Telegram (SPEC 8). Запускается таймером mct-remind.timer каждые 5 минут.
// Шлёт напоминание, если наступило его время (окно 20 минут) и сегодня оно ещё не отправлялось.
// Базу только читает (её держит приложение); отметки об отправке — в файле reminders-sent.json рядом с базой.
// Запуск вручную: node --env-file=/opt/mct/.env scripts/remind.js [--dry-run]
import Database from 'better-sqlite3-multiple-ciphers';
import fs from 'node:fs';
import path from 'node:path';
import { sendTelegram, reminderText } from '../src/lib/server/telegram.js';

const DRY = process.argv.includes('--dry-run');
const WINDOW_MIN = 20;
const key = process.env.DB_KEY ?? '';
if (!/^[0-9a-f]{64}$/.test(key)) {
	console.error('[remind] DB_KEY не задан');
	process.exit(1);
}
const origin = process.env.ORIGIN || 'https://it.onlab.su';
const dbFile = path.resolve(process.env.DB_PATH || 'data/app.db');
const stateFile = path.join(path.dirname(dbFile), 'reminders-sent.json');

const db = new Database(dbFile, { readonly: true, fileMustExist: true });
db.pragma("cipher='sqlcipher'");
db.pragma('legacy=4');
db.pragma(`key='${key}'`);
const p = db.prepare('SELECT current_stage, reminder_worry_window, reminder_att, reminder_weekly_review, telegram_chat_id FROM profile WHERE id = 1').get();
db.close();

const msk = new Date(Date.now() + 3 * 3600_000); // Москва: UTC+3 без перехода на летнее время
const day = msk.toISOString().slice(0, 10);
const nowMin = msk.getUTCHours() * 60 + msk.getUTCMinutes();
const toMin = (t) => (/^\d\d:\d\d$/.test(t ?? '') ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);

let sent = {};
try {
	sent = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
} catch {
	/* файла ещё нет */
}

// Какие напоминания нужны на этом этапе
const due = [];
if (p.current_stage >= 2) {
	due.push(['worry_window', toMin(p.reminder_worry_window)]);
	due.push(['att', toMin(p.reminder_att)]);
	// Еженедельный обзор: «вс 19:00» — только в свой день недели
	const w = /^(пн|вт|ср|чт|пт|сб|вс)\s+(\d\d:\d\d)$/i.exec((p.reminder_weekly_review ?? '').trim());
	const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
	if (w && DAYS[msk.getUTCDay()] === w[1].toLowerCase()) due.push(['weekly', toMin(w[2])]);
}

let failed = false;
for (const [kind, at] of due) {
	if (at === null || nowMin < at || nowMin >= at + WINDOW_MIN) continue;
	if (sent[kind] === day) continue;
	if (DRY) {
		console.log(`[remind] (пробно) отправил бы: ${kind}`);
		continue;
	}
	try {
		await sendTelegram(process.env.TELEGRAM_BOT_TOKEN, p.telegram_chat_id, reminderText(kind, origin));
		sent[kind] = day;
		fs.writeFileSync(stateFile, JSON.stringify(sent), { mode: 0o600 });
		console.log(`[remind] отправлено: ${kind}`);
	} catch (e) {
		failed = true;
		console.error(`[remind] ${kind}: ${e.message}`);
	}
}
process.exit(failed ? 1 : 0);
