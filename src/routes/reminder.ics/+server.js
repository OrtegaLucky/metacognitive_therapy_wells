// Файл для календаря: ежедневное напоминание о вечернем окне (и об упражнении, если задано время).
// На iPhone открывается «Календарь» с предложением добавить события — без серверов и ботов.
import { getProfile } from '$lib/server/stages.js';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function event(uid, date, time, minutes, summary, link) {
	const [, h, m] = time.match(TIME);
	return [
		'BEGIN:VEVENT',
		`UID:${uid}@mct`,
		`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
		`DTSTART;TZID=Europe/Moscow:${date}T${h}${m}00`,
		`DURATION:PT${minutes}M`,
		'RRULE:FREQ=DAILY',
		`SUMMARY:${summary}`,
		`URL:${link}`,
		`DESCRIPTION:${link}`,
		'BEGIN:VALARM',
		'ACTION:DISPLAY',
		`DESCRIPTION:${summary}`,
		'TRIGGER:PT0M',
		'END:VALARM',
		'END:VEVENT'
	];
}

export function GET({ url }) {
	const p = getProfile();
	const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' }).replace(/-/g, '');
	const worry = TIME.test(p.reminder_worry_window ?? '') ? p.reminder_worry_window : '18:00';
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//mct//reminders//RU',
		'CALSCALE:GREGORIAN',
		'BEGIN:VTIMEZONE',
		'TZID:Europe/Moscow',
		'BEGIN:STANDARD',
		'DTSTART:19700101T000000',
		'TZOFFSETFROM:+0300',
		'TZOFFSETTO:+0300',
		'TZNAME:MSK',
		'END:STANDARD',
		'END:VTIMEZONE',
		...event('worry-window', date, worry, 15, 'Окно для беспокойства', url.origin + '/window')
	];
	if (TIME.test(p.reminder_att ?? '')) {
		lines.push(...event('exercise', date, p.reminder_att, 5, 'Упражнение на внимание', url.origin + '/exercises'));
	}
	lines.push('END:VCALENDAR');
	return new Response(lines.join('\r\n') + '\r\n', {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': 'attachment; filename="mct-reminders.ics"'
		}
	});
}
