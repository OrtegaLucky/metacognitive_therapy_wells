// Запись с микрофона и распознавание на сервере (/api/stt). Общая часть для голосового ввода в полях.
import { micSession } from '$lib/audio.js';

function pickMime() {
	for (const t of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'])
		if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
	return '';
}

/** Включает микрофон и начинает запись. Возвращает { stop() → Promise<Blob> }. Ошибки — по-русски. */
export async function startRecording() {
	if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('этот браузер не умеет записывать звук');
	micSession();
	let stream;
	try {
		const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('микрофон не ответил за 15 секунд')), 15000));
		stream = await Promise.race([navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }), timeout]);
	} catch (e) {
		if (e?.name === 'NotAllowedError')
			throw new Error('нет доступа к микрофону. iPhone: Настройки → Safari → Микрофон → «Разрешить», затем обновите страницу');
		throw new Error('микрофон не включился: ' + (e?.message || e?.name || e));
	}
	const mime = pickMime();
	const parts = [];
	let rec;
	try {
		rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
	} catch {
		rec = new MediaRecorder(stream);
	}
	rec.ondataavailable = (ev) => ev.data.size && parts.push(ev.data);
	const done = new Promise((resolve) => (rec.onstop = () => resolve(new Blob(parts, { type: rec.mimeType || mime || 'audio/mp4' }))));
	rec.start(1000);
	return {
		stop() {
			stream.getTracks().forEach((t) => t.stop()); // микрофон выключается сразу
			if (rec.state !== 'inactive') rec.stop();
			return done;
		}
	};
}

/** Отправляет запись на распознавание, возвращает текст (может быть пустым). */
export async function transcribe(blob) {
	const res = await fetch('/api/stt', { method: 'POST', headers: { 'content-type': blob.type.split(';')[0] }, body: blob });
	const out = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(out.error ?? `ошибка ${res.status}`);
	return (out.text ?? '').trim();
}
