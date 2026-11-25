// Разговор концептуализации (SPEC 7.1): хранение в базе, вызов модели, разбор черновика.
import fs from 'node:fs';
import path from 'node:path';
import { getDb, now } from '$lib/server/db.js';
import { chatJson, modelLabel } from '$lib/server/llm.js';
import { BELIEF_TYPES, COPING } from '$lib/labels.js';

const KIND = 'conceptualization';
// Скрытое первое сообщение: модели нужен ход пользователя, чтобы начать
const OPENING = '(Пользователь открыл экран разговора. Поздоровайтесь одной фразой, скажите, что будет, и задайте первый вопрос.)';
export const FINISH_TEXT = 'Давайте подведём итог.';

function systemPrompt() {
	const raw = fs.readFileSync(path.resolve('content/prompts/conceptualization.md'), 'utf8');
	return raw.replace('{{COPING}}', COPING.map((c) => `- ${c.id} — ${c.label}`).join('\n'));
}

/** Текущий (не завершённый) разговор или null. */
export function openConversation() {
	const db = getDb();
	const c = db.prepare('SELECT * FROM conversations WHERE kind = ? AND finished_at IS NULL ORDER BY id DESC LIMIT 1').get(KIND);
	if (!c) return null;
	const messages = db
		.prepare('SELECT id, role, content, model, ms, created_at FROM conversation_messages WHERE conversation_id = ? ORDER BY id')
		.all(c.id)
		.map((m) => ({ ...m, modelLabel: m.model ? modelLabel(m.model) : null }));
	let draft = null;
	try {
		draft = c.draft ? JSON.parse(c.draft) : null;
	} catch {
		/* испорченный черновик — не показываем */
	}
	return { ...c, messages, draft };
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Приводит черновик модели к безопасному виду: только известные поля и значения. */
export function cleanDraft(d) {
	if (!d || typeof d !== 'object') return null;
	const f = d.formulation ?? {};
	const copingIds = new Set(COPING.map((c) => c.id));
	const types = new Set(BELIEF_TYPES.map((t) => t.id));
	const checked = Array.isArray(f.coping?.checked) ? f.coping.checked.filter((x) => copingIds.has(x)) : [];
	const beliefs = (Array.isArray(d.beliefs) ? d.beliefs : [])
		.filter((b) => b && types.has(b.type) && str(b.text, 1000))
		.slice(0, 20)
		.map((b) => {
			const p = Number(b.percent);
			return { type: b.type, text: str(b.text, 1000), percent: Number.isInteger(p) && p >= 0 && p <= 100 ? p : null };
		});
	return {
		formulation: {
			trigger_examples: str(f.trigger_examples, 10000),
			worry_chain: str(f.worry_chain, 10000),
			type2_worry: str(f.type2_worry, 10000),
			coping: { checked: [...new Set(checked)], other: str(f.coping?.other, 10000) }
		},
		beliefs
	};
}

/**
 * Один ход разговора: текст пользователя (пустой — начать) → ответ модели.
 * Сообщения пишутся в базу только после удачного ответа, чтобы при ошибке можно было просто повторить.
 */
export async function step(text, modelId) {
	const db = getDb();
	let conv = openConversation();
	const history = conv?.messages ?? [];
	if (!text && history.length) throw new Error('Пустое сообщение');

	const msgs = [{ role: 'user', content: OPENING }];
	for (const m of history) {
		// Ответы модели отдаём обратно в том же JSON-виде — так она не сбивается с формата
		msgs.push(m.role === 'assistant' ? { role: 'assistant', content: JSON.stringify({ reply: m.content }) } : { role: 'user', content: m.content });
	}
	if (text) msgs.push({ role: 'user', content: text });

	const { data, ms } = await chatJson(modelId, systemPrompt(), msgs);
	const reply = str(data?.reply, 4000) || '…';
	const draft = data?.done ? cleanDraft(data.draft) : null;

	db.transaction(() => {
		const id = conv?.id ?? db.prepare('INSERT INTO conversations (kind, started_at) VALUES (?, ?)').run(KIND, now()).lastInsertRowid;
		const ins = db.prepare('INSERT INTO conversation_messages (conversation_id, role, content, model, ms, created_at) VALUES (?, ?, ?, ?, ?, ?)');
		if (text) ins.run(id, 'user', text, null, null, now());
		ins.run(id, 'assistant', reply, modelId, ms, now());
		if (draft) db.prepare('UPDATE conversations SET draft = ? WHERE id = ?').run(JSON.stringify(draft), id);
	})();

	return { reply, model: modelId, modelLabel: modelLabel(modelId), ms, hasDraft: !!draft };
}
