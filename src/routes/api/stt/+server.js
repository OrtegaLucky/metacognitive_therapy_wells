// Распознавание речи: передаёт запись в службу faster-whisper на этом же сервере (SPEC 12.3).
// Доступно только после входа (hooks.server.js). Запись нигде не сохраняется.
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const MAX = 15 * 1024 * 1024;
const base = () => env.STT_URL || 'http://127.0.0.1:3012';

export async function POST({ request }) {
	if (!/^audio\//.test(request.headers.get('content-type') ?? '')) return json({ error: 'Нужна аудиозапись' }, { status: 415 });
	const data = await request.arrayBuffer();
	if (!data.byteLength) return json({ error: 'Запись пустая' }, { status: 400 });
	if (data.byteLength > MAX) return json({ error: 'Запись слишком длинная' }, { status: 413 });
	let res;
	try {
		res = await fetch(base() + '/stt', { method: 'POST', body: data, signal: AbortSignal.timeout(120_000) });
	} catch {
		return json({ error: 'Служба распознавания речи недоступна' }, { status: 503 });
	}
	const out = await res.json().catch(() => ({}));
	if (!res.ok) return json({ error: out.error ?? 'Ошибка распознавания' }, { status: res.status });
	return json(out);
}
