// Обращение к моделям напрямую с сервера (SPEC 12.2). Ключи — только в .env на сервере, в браузер не уходят.
// OpenAI — напрямую. Gemini — через пересылку на mvps (Google не пускает main по стране).
import { env } from '$env/dynamic/private';

// Выбраны по сравнению на тестовом разговоре 2026-11-26 (скорость, качество, цена — см. SPEC 12.2)
export const MODELS = [
	{ id: 'gemini-3.6-flash', provider: 'gemini', label: 'Gemini 3.6 Flash', thinking: 'low' },
	{ id: 'gemini-3.8-flash', provider: 'gemini', label: 'Gemini 3.8 Flash', thinking: 'low' },
	{ id: 'gpt-6-luna', provider: 'openai', label: 'GPT-6 Luna', opts: { reasoning_effort: 'low' } },
	{ id: 'gpt-5.6-luna', provider: 'openai', label: 'GPT-5.6 Luna', opts: { reasoning_effort: 'low' } },
	{ id: 'gpt-6.1-terra', provider: 'openai', label: 'GPT-6.1 Terra', opts: { reasoning_effort: 'low' } }
];
export const DEFAULT_MODEL = 'gemini-3.6-flash';

const hasKey = (provider) =>
	provider === 'openai'
		? !!env.OPENAI_API_KEY
		: !!(env.GEMINI_API_KEY && env.GEMINI_RELAY_URL && env.GEMINI_RELAY_SECRET);

/** Список моделей для переключателя: без ключа модель видна, но выбрать её нельзя. */
export function modelList() {
	return MODELS.map(({ id, label, provider }) => ({ id, label, provider, available: hasKey(provider) }));
}

export function modelLabel(id) {
	return MODELS.find((m) => m.id === id)?.label ?? id;
}

export class LlmError extends Error {}

/**
 * Отправляет разговор модели и ждёт ответ в JSON.
 * messages: [{ role: 'user' | 'assistant', content }]. Возвращает { data, ms }.
 */
export async function chatJson(modelId, system, messages) {
	const m = MODELS.find((x) => x.id === modelId);
	if (!m) throw new LlmError('Неизвестная модель');
	if (!hasKey(m.provider)) throw new LlmError(`Для ${m.label} на сервере не задан ключ`);
	const t0 = Date.now();
	const text = m.provider === 'openai' ? await openai(m, system, messages) : await gemini(m, system, messages);
	const ms = Date.now() - t0;
	try {
		return { data: JSON.parse(text), ms };
	} catch {
		throw new LlmError(`${m.label} ответила не в том формате, попробуйте ещё раз`);
	}
}

async function post(url, headers, body, who) {
	let res;
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(120_000)
		});
	} catch (e) {
		throw new LlmError(e?.name === 'TimeoutError' ? `${who} не ответила за 2 минуты` : `${who} недоступна`);
	}
	if (!res.ok) {
		// В журнал — только код ответа, без текстов (SPEC 13.4)
		const err = (await res.json().catch(() => ({})))?.error ?? {};
		const code = String(err.code ?? err.status ?? '');
		console.error(`[llm] ${who}: HTTP ${res.status} ${code}`);
		const why =
			res.status === 401 || res.status === 403
				? 'ключ не принят'
				: /quota|credit/i.test(code)
					? 'на счёте кончились деньги — пополните баланс в кабинете'
					: res.status === 429
						? 'слишком много запросов, подождите минуту'
						: /model/i.test(code)
							? 'модель недоступна'
							: `ошибка ${res.status}`;
		throw new LlmError(`${who}: ${why}`);
	}
	return res.json();
}

async function openai(m, system, messages) {
	const d = await post(
		'https://api.openai.com/v1/chat/completions',
		{ authorization: `Bearer ${env.OPENAI_API_KEY}` },
		{
			model: m.id,
			messages: [{ role: 'system', content: system }, ...messages],
			response_format: { type: 'json_object' },
			store: false,
			...m.opts
		},
		'OpenAI'
	);
	return d.choices?.[0]?.message?.content ?? '';
}

async function gemini(m, system, messages) {
	const base = env.GEMINI_RELAY_URL.replace(/\/+$/, '');
	const generationConfig = { responseMimeType: 'application/json' };
	if (m.thinking) generationConfig.thinkingConfig = { thinkingLevel: m.thinking };
	const d = await post(
		`${base}/v1beta/models/${m.id}:generateContent`,
		{ 'x-goog-api-key': env.GEMINI_API_KEY, 'X-Relay-Key': env.GEMINI_RELAY_SECRET },
		{
			systemInstruction: { parts: [{ text: system }] },
			contents: messages.map((x) => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content }] })),
			generationConfig
		},
		'Gemini'
	);
	return (d.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
}
