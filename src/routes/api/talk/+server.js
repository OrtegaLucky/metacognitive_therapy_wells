// Ход разговора с моделью. Доступно только после входа (hooks.server.js).
import { json } from '@sveltejs/kit';
import { step } from '$lib/server/talk.js';
import { LlmError, MODELS } from '$lib/server/llm.js';

export async function POST({ request }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Неверный запрос' }, { status: 400 });
	}
	const text = String(body.text ?? '').trim();
	const model = String(body.model ?? '');
	if (text.length > 4000) return json({ error: 'Сообщение длиннее 4000 символов' }, { status: 400 });
	if (!MODELS.some((m) => m.id === model)) return json({ error: 'Неизвестная модель' }, { status: 400 });
	try {
		return json(await step(text, model));
	} catch (e) {
		if (e instanceof LlmError) return json({ error: e.message }, { status: 502 });
		console.error('[talk]', e?.message);
		return json({ error: 'Не получилось получить ответ' }, { status: 500 });
	}
}
