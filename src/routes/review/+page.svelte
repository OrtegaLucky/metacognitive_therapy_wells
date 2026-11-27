<script>
	import { enhance } from '$app/forms';
	import { onMount, tick } from 'svelte';
	import { fmtDate } from '$lib/labels.js';

	let { data, form } = $props();

	let model = $state(data.defaultModel);
	let text = $state('');
	let pending = $state(null); // текст, который сейчас отправляется
	let busy = $state(false);

	const messages = $derived(data.review?.messages ?? []);
	const userTurns = $derived(messages.filter((m) => m.role === 'user').length);
	const summary = $derived(data.review?.model_summary ?? null);

	onMount(() => {
		try {
			const m = localStorage.getItem('talk.model');
			if (m && data.models.some((x) => x.id === m && x.available)) model = m;
		} catch {
			/* без запоминания */
		}
	});

	async function scrollDown() {
		await tick();
		window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
	}

	const sending = ({ formData }) => {
		busy = true;
		pending = formData.get('finish') ? data.finishText : String(formData.get('text') ?? '') || null;
		text = '';
		scrollDown();
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
			pending = null;
			scrollDown();
		};
	};
</script>

<p class="muted small">Этап {data.stage}: {data.title}</p>
<h1>Разбор этапа</h1>
<p class="muted small">
	Как обсуждение домашних заданий с терапевтом: модель видит ваши записи, эксперименты, оценки убеждений и GAD-7 за этап и
	задаёт вопросы. Выводы делаете вы — в конце запишите, что поняли.
</p>

{#if data.review || pending !== null}
	<div class="chat">
		{#each messages as m}
			<div class="msg {m.role}">
				<div style="white-space: pre-wrap">{m.content}</div>
				{#if m.role === 'assistant' && m.modelLabel}<div class="meta">{m.modelLabel} · {(m.ms / 1000).toFixed(1).replace('.', ',')} с</div>{/if}
			</div>
		{/each}
		{#if pending}<div class="msg user"><div style="white-space: pre-wrap">{pending}</div></div>{/if}
		{#if busy}<div class="msg assistant muted">Думаю…</div>{/if}
	</div>
{/if}

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.saved}<p class="done">Итог этапа сохранён. Его видно ниже и на странице «Этап».</p>{/if}

{#if !data.review && !busy}
	<form method="POST" action="?/say" use:enhance={sending} class="card">
		<input type="hidden" name="model" value={model} />
		<input type="hidden" name="text" value="" />
		<button type="submit" class="big">Начать разбор этапа</button>
	</form>
{:else if summary}
	<form method="POST" action="?/save" use:enhance class="card">
		<h2 style="margin-top: 0">Итог этапа</h2>
		<p class="small muted">Модель предложила итог — поправьте своими словами.</p>
		<label for="l">Что я понял</label>
		<textarea id="l" name="learned">{summary.learned}</textarea>
		<label for="h">Что пока трудно</label>
		<textarea id="h" name="still_hard">{summary.still_hard}</textarea>
		<label for="n">На чём сосредоточиться дальше</label>
		<textarea id="n" name="next_focus">{summary.next_focus}</textarea>
		{#if summary.ready_reason}
			<p class="small"><b>Модель о готовности к следующему этапу:</b> {summary.ready ? 'готовы' : 'пока рано'} — {summary.ready_reason}</p>
		{/if}
		<p><button type="submit" class="big">Сохранить итог этапа</button></p>
	</form>
{:else}
	<form method="POST" action="?/say" use:enhance={sending} class="card">
		<input type="hidden" name="model" value={model} />
		<textarea name="text" bind:value={text} placeholder="Ваш ответ (можно голосом — кнопка в углу поля)" disabled={busy}></textarea>
		<div class="row" style="margin-top: 8px">
			<button type="submit" disabled={busy || !text.trim()}>Ответить</button>
			{#if userTurns >= 3}
				<button type="submit" name="finish" value="1" class="secondary" disabled={busy}>Подвести итог</button>
			{/if}
		</div>
	</form>
{/if}

{#if data.review}
	<form method="POST" action="?/restart" use:enhance onsubmit={(e) => confirm('Начать разбор заново? Этот разговор удалится.') || e.preventDefault()}>
		<button type="submit" class="link small">Начать заново</button>
	</form>
{/if}

<p class="small">
	Модель:
	<select bind:value={model} style="width: auto">
		{#each data.models as m}<option value={m.id} disabled={!m.available}>{m.label}</option>{/each}
	</select>
</p>

{#if data.saved.length}
	<h2>Сохранённые итоги</h2>
	{#each data.saved as r (r.id)}
		<details class="card">
			<summary><b>Этап {r.stage}</b> · {fmtDate(r.saved_at)}</summary>
			<p class="small"><b>Понял:</b> {r.user_summary?.learned}</p>
			{#if r.user_summary?.still_hard}<p class="small"><b>Трудно:</b> {r.user_summary.still_hard}</p>{/if}
			{#if r.user_summary?.next_focus}<p class="small"><b>Дальше:</b> {r.user_summary.next_focus}</p>{/if}
		</details>
	{/each}
{/if}

<style>
	.chat {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 12px 0;
	}
	.msg {
		max-width: 88%;
		padding: 10px 12px;
		border-radius: 14px;
		background: var(--card);
		border: 1px solid var(--line);
	}
	.msg.user {
		align-self: flex-end;
		background: var(--accent-text);
	}
	.meta {
		font-size: 0.75rem;
		opacity: 0.6;
		margin-top: 4px;
	}
	summary {
		cursor: pointer;
	}
</style>
