<script>
	import { enhance } from '$app/forms';
	import { onMount, tick } from 'svelte';
	import { fmtDate } from '$lib/labels.js';
	import { createVoice, readSpeaker, chunks } from '$lib/speak.js';
	import { startRecording, transcribe } from '$lib/recorder.js';

	let { data, form } = $props();

	let model = $state(data.defaultModel);
	let text = $state('');
	let pending = $state(null); // текст, который сейчас отправляется
	let busy = $state(false);

	// Озвучка ответов модели (тот же выбор, что в «Разговоре»)
	const voice = createVoice();
	let voiceOn = $state(false);
	let speaking = $state(false);
	let voiceError = $state('');

	function setVoiceOn() {
		try {
			localStorage.setItem('talk.voice', voiceOn ? '1' : '0');
		} catch {
			/* без запоминания */
		}
		if (!voiceOn) stopVoice();
	}

	async function speak(said) {
		voiceError = '';
		speaking = true;
		try {
			const parts = chunks(said);
			const speaker = readSpeaker();
			parts.forEach((p) => voice.preload(p, speaker));
			for (const p of parts) await voice.say(p, speaker);
		} catch (e) {
			voiceError = 'Озвучка не получилась: ' + e.message;
		} finally {
			speaking = false;
		}
	}

	function replay(said) {
		voice.stop();
		voice.unlock(); // прямо в нажатии — иначе iPhone не даст звук
		speak(said);
	}

	function stopVoice() {
		voice.stop();
		speaking = false;
	}

	// Микрофон: запись → распознавание → текст дописывается в поле ответа
	let rec = null;
	let micMode = $state('idle'); // idle | starting | rec | busy
	let micSec = $state(0);
	let micError = $state('');
	let micTimer;

	async function toggleMic() {
		micError = '';
		if (micMode === 'rec') return stopMic();
		if (micMode !== 'idle') return;
		stopVoice();
		micMode = 'starting';
		try {
			rec = await startRecording();
		} catch (e) {
			micError = 'Не записалось: ' + e.message;
			micMode = 'idle';
			return;
		}
		micMode = 'rec';
		micSec = 0;
		micTimer = setInterval(() => ++micSec >= 180 && stopMic(), 1000);
	}

	async function stopMic() {
		clearInterval(micTimer);
		micMode = 'busy';
		try {
			const said = await transcribe(await rec.stop());
			if (!said) micError = 'Не расслышал — попробуйте ещё раз.';
			else text = text.trim() ? text.replace(/\s*$/, ' ') + said : said;
		} catch (e) {
			micError = 'Не получилось распознать: ' + e.message;
		} finally {
			rec = null;
			micMode = 'idle';
		}
	}

	const messages = $derived(data.review?.messages ?? []);
	const userTurns = $derived(messages.filter((m) => m.role === 'user').length);
	const summary = $derived(data.review?.model_summary ?? null);
	const isStage = $derived(data.kind === 'stage');
	const rated = $derived(messages.flatMap((m) => m.ratings ?? []).length);

	onMount(() => {
		try {
			const m = localStorage.getItem('talk.model');
			if (m && data.models.some((x) => x.id === m && x.available)) model = m;
			voiceOn = localStorage.getItem('talk.voice') === '1';
		} catch {
			/* без запоминания */
		}
		return () => {
			voice.stop();
			clearInterval(micTimer);
			rec?.stop();
		};
	});

	async function scrollDown() {
		await tick();
		window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
	}

	const sending = ({ formData }) => {
		busy = true;
		pending = formData.get('finish') ? data.finishText : String(formData.get('text') ?? '') || null;
		text = '';
		stopVoice();
		if (voiceOn) voice.unlock(); // прямо в нажатии — иначе iPhone не даст звук
		scrollDown();
		return async ({ update, result }) => {
			await update({ reset: false });
			busy = false;
			pending = null;
			scrollDown();
			const last = data.review?.messages?.at(-1);
			if (voiceOn && result.type === 'success' && last?.role === 'assistant') speak(last.content);
		};
	};
</script>

<p class="muted small">Этап {data.stage}: {data.title}</p>
<h1>{data.kindLabel}</h1>

<nav class="tabs">
	<a href="/review" class:on={isStage}>Итог этапа</a>
	<a href="/review?kind=interim" class:on={!isStage}>Промежуточный разбор</a>
</nav>

{#if isStage}
	<p class="muted small">
		Как встреча с терапевтом в конце этапа: модель видит ваши записи, эксперименты, оценки убеждений и GAD-7, задаёт вопросы,
		попросит заново оценить убеждения (оценки запишутся сами) и в конце скажет, готовы ли вы идти дальше. Решение о переходе — за вами.
	</p>
{:else}
	<p class="muted small">
		Короткая проверка посреди этапа, 3–5 вопросов: что получилось с прошлого разбора, что мешало, что делать на следующей неделе.
		{data.sinceLast > 0 ? `С прошлого разбора (или начала этапа) прошло дней: ${data.sinceLast}.` : ''}
		{#if data.sinceLast >= 7}<b>Пора — прошла неделя.</b>{/if}
	</p>
{/if}

{#if data.otherOpen}
	<p class="small muted">
		Есть незаконченный {isStage ? 'промежуточный разбор' : 'разбор итога этапа'} —
		<a href={isStage ? '/review?kind=interim' : '/review'}>продолжить</a>.
	</p>
{/if}

{#if data.review || pending !== null}
	<div class="chat">
		{#each messages as m}
			<div class="msg {m.role}">
				<div style="white-space: pre-wrap">{m.content}</div>
				{#if m.ratings?.length}
					<div class="rated">
						Записал оценки:
						{#each m.ratings as r}<div>«{r.text}» — <b>{r.percent}%</b></div>{/each}
					</div>
				{/if}
				{#if m.role === 'assistant' && m.modelLabel}
					<div class="meta">
						{m.modelLabel} · {(m.ms / 1000).toFixed(1).replace('.', ',')} с ·
						<button type="button" class="link small" onclick={() => replay(m.content)}>▶ прослушать</button>
					</div>
				{/if}
			</div>
		{/each}
		{#if pending}<div class="msg user"><div style="white-space: pre-wrap">{pending}</div></div>{/if}
		{#if busy}<div class="msg assistant muted">Думаю…</div>{/if}
	</div>
{/if}

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.saved}<p class="done">Итог сохранён. Его видно ниже{isStage ? ' и на странице «Этап»' : ''}.</p>{/if}

{#if !data.review && !busy}
	<form method="POST" action="?/say" use:enhance={sending} class="card">
		<input type="hidden" name="model" value={model} />
		<input type="hidden" name="kind" value={data.kind} />
		<input type="hidden" name="text" value="" />
		<button type="submit" class="big">{isStage ? 'Начать разбор этапа' : 'Начать промежуточный разбор'}</button>
	</form>
{:else if summary}
	<form method="POST" action="?/save" use:enhance class="card">
		<input type="hidden" name="kind" value={data.kind} />
		<h2 style="margin-top: 0">{isStage ? 'Итог этапа' : 'Итог разбора'}</h2>
		{#if isStage && summary.ready_reason}
			<div class="verdict" class:ready={summary.ready}>
				<b>Мнение модели: {summary.ready ? 'вы готовы к следующему этапу' : 'стоит задержаться на этом этапе'}.</b>
				<div>{summary.ready_reason}</div>
				<div class="small muted">
					Это мнение, а не решение.
					{#if data.unlock.hasRule}Формальные условия: {data.unlock.ok ? 'все выполнены' : 'выполнены не все'}.{/if}
					Перейти или задержаться — решаете вы на странице «Этап».
				</div>
			</div>
		{/if}
		<p class="small muted">Модель предложила итог — поправьте своими словами.</p>
		<label for="l">Что я понял</label>
		<textarea id="l" name="learned">{summary.learned}</textarea>
		<label for="h">Что пока трудно</label>
		<textarea id="h" name="still_hard">{summary.still_hard}</textarea>
		<label for="n">На чём сосредоточиться дальше</label>
		<textarea id="n" name="next_focus">{summary.next_focus}</textarea>
		<p><button type="submit" class="big">Сохранить итог</button></p>
	</form>
{:else}
	<form method="POST" action="?/say" use:enhance={sending} class="card">
		<input type="hidden" name="model" value={model} />
		<input type="hidden" name="kind" value={data.kind} />
		<button type="button" class="big mic" class:on={micMode === 'rec'} onclick={toggleMic} disabled={busy || micMode === 'starting' || micMode === 'busy'}>
			{micMode === 'rec' ? `■ Готово (${micSec} с)` : micMode === 'starting' ? 'Включаю микрофон…' : micMode === 'busy' ? 'Распознаю…' : '🎤 Сказать голосом'}
		</button>
		{#if micError}<p class="error small">{micError}</p>{/if}
		<textarea name="text" data-novoice="1" bind:value={text} placeholder="Ваш ответ — голосом (кнопка выше) или текстом. Перед отправкой можно поправить." disabled={busy}></textarea>
		<div class="row" style="margin-top: 8px">
			<button type="submit" disabled={busy || !text.trim()}>Ответить</button>
			{#if userTurns >= (isStage ? 3 : 2)}
				<button type="submit" name="finish" value="1" class="secondary" disabled={busy}>Подвести итог</button>
			{/if}
		</div>
		{#if rated}<p class="small muted">Оценок убеждений записано в этом разговоре: {rated}.</p>{/if}
	</form>
{/if}

{#if data.review}
	<form method="POST" action="?/restart" use:enhance onsubmit={(e) => confirm('Начать разбор заново? Этот разговор удалится (записанные оценки убеждений останутся).') || e.preventDefault()}>
		<input type="hidden" name="kind" value={data.kind} />
		<button type="submit" class="link small">Начать заново</button>
	</form>
{/if}

<p class="small row" style="align-items: center">
	<label style="margin: 0"><input type="checkbox" bind:checked={voiceOn} onchange={setVoiceOn} style="width: auto" /> 🔊 Озвучивать ответы</label>
	{#if speaking}<button type="button" class="secondary" onclick={stopVoice}>Стоп</button>{/if}
</p>
{#if voiceError}<p class="error small">{voiceError}</p>{/if}

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
			<summary><b>Этап {r.stage}</b> · {data.kinds[r.kind] ?? 'Итог этапа'} · {fmtDate(r.saved_at)}</summary>
			<p class="small"><b>Понял:</b> {r.user_summary?.learned}</p>
			{#if r.user_summary?.still_hard}<p class="small"><b>Трудно:</b> {r.user_summary.still_hard}</p>{/if}
			{#if r.user_summary?.next_focus}<p class="small"><b>Дальше:</b> {r.user_summary.next_focus}</p>{/if}
			{#if r.user_summary?.ready_reason}
				<p class="small"><b>Мнение модели:</b> {r.user_summary.ready ? 'готов' : 'задержаться'} — {r.user_summary.ready_reason}</p>
			{/if}
		</details>
	{/each}
{/if}

<style>
	.tabs {
		display: flex;
		gap: 8px;
		margin: 8px 0 12px;
		flex-wrap: wrap;
	}
	.tabs a {
		padding: 6px 12px;
		border-radius: 999px;
		border: 1px solid var(--line);
		text-decoration: none;
	}
	.tabs a.on {
		background: var(--accent-text);
		font-weight: 600;
	}
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
	.mic {
		width: 100%;
		margin-bottom: 8px;
	}
	.mic.on {
		background: #c0392b;
		border-color: #c0392b;
		color: #fff;
	}
	.rated {
		margin-top: 8px;
		padding-top: 6px;
		border-top: 1px dashed var(--line);
		font-size: 0.9rem;
	}
	.verdict {
		padding: 10px 12px;
		border-radius: 12px;
		border: 2px solid #d9a441;
		margin-bottom: 12px;
	}
	.verdict.ready {
		border-color: #4a9b6a;
	}
	.verdict div {
		margin-top: 4px;
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
