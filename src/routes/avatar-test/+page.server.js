// Тестовая страница аватара: проверить голос, внешний вид и скорость (прототип, SPEC 12.6)
import { ttsBase } from '$lib/server/tts.js';

export async function load() {
	try {
		const res = await fetch(ttsBase() + '/health', { signal: AbortSignal.timeout(3000) });
		return { health: await res.json() };
	} catch {
		return { health: null };
	}
}
