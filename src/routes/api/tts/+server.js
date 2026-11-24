// Озвучка текста: передаёт запрос в службу Silero на этом же сервере (SPEC 12.3).
// Доступно только после входа (проверка в hooks.server.js).
import { json } from '@sveltejs/kit';
import { ttsBase } from '$lib/server/tts.js';


export async function POST({ request }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Неверный запрос' }, { status: 400 });
	}
	const text = String(body.text ?? '').trim();
	if (!text || text.length > 1000) return json({ error: 'Текст пустой или длиннее 1000 символов' }, { status: 400 });

	let res;
	try {
		res = await fetch(ttsBase() + '/tts', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ text, speaker: String(body.speaker ?? 'xenia') }),
			signal: AbortSignal.timeout(60_000)
		});
	} catch {
		return json({ error: 'Служба голоса недоступна' }, { status: 503 });
	}
	if (!res.ok) {
		const e = await res.json().catch(() => ({}));
		return json({ error: e.error ?? 'Ошибка службы голоса' }, { status: res.status });
	}
	return new Response(res.body, {
		headers: { 'content-type': 'audio/wav', 'x-synth-ms': res.headers.get('x-synth-ms') ?? '' }
	});
}
