<script>
	import { onMount, tick } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import Avatar from '$lib/Avatar.svelte';
	import { unlockAudio, ensureRunning } from '$lib/audio.js';
	import { BELIEF_TYPES, COPING } from '$lib/labels.js';

	let { data, form } = $props();

	const FINISH_TEXT = 'Давайте подведём итог.';
	const VOICES = { xenia: 'Ксения', baya: 'Бая', kseniya: 'Ксения 2', aidar: 'Айдар', eugene: 'Евгений' };

	let model = $state(data.defaultModel);
	let voiceOn = $state(false);
	let voice = $state('xenia');
	let text = $state('');
	let pending = $state(null); // текст, который сейчас отправляется
	let busy = $state(false);
	let error = $state('');
	let mode = $state('idle');
	let level = $state(0);
	let chatEl;

	const messages = $derived(data.conv?.messages ?? []);
	const draft = $derived(data.conv?.draft ?? null);
	const userTurns = $derived(messages.filter((m) => m.role === 'user').length);

	const store = {
		get(k) {
			try {
				return localStorage.getItem('talk.' + k);
			} catch {
				return null;
			}
		},
		set(k, v) {
			try {
				localStorage.setItem('talk.' + k, String(v));
			} catch {
				/* приватный режим — просто не запоминаем */
			}
		}
	};

	onMount(() => {
		const m = store.get('model');
		if (m && data.models.some((x) => x.id === m && x.available)) model = m;
		voiceOn = store.get('voice') === '1';
		voice = store.get('speaker') ?? 'xenia';
		scrollDown();
	});

	async function scrollDown() {
		await tick();
		chatEl?.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
	}

	async function send(msg) {
		if (busy) return;
		error = '';
		// Звук включаем прямо по нажатию, до любых ожиданий — иначе iPhone его не даст
		const audio = voiceOn ? unlockAudio() : null;
		busy = true;
		pending = msg || null;
		mode = 'thinking';
		scrollDown();
		try {
			const res = await fetch('/api/talk', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: msg, model })
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok) {
				error = out.error ?? `Ошибка ${res.status}`;
				mode = 'idle';
				return;
			}
			if (msg === text) text = '';
			await invalidateAll();
			scrollDown();
			if (audio) await say(out.reply, audio.resumed);
			else mode = 'idle';
		} catch (e) {
			error = 'Нет связи с сервером: ' + (e?.message ?? e);
			mode = 'idle';
		} finally {
			busy = false;
			pending = null;
		}
	}

	let source, raf;
	function stopVoice() {
		try {
			source?.stop();
		} catch {
			/* уже остановлен */
		}
		cancelAnimationFrame(raf);
		level = 0;
		mode = 'idle';
	}

	async function say(reply, resumed) {
		try {
			const res = await fetch('/api/tts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: reply.slice(0, 1000), speaker: voice })
			});
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.status);
			const bytes = await res.arrayBuffer();
			const ctx = await ensureRunning(resumed);
			if (!ctx) throw new Error('телефон не дал включить звук');
			const buf = await ctx.decodeAudioData(bytes);
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 1024;
			source = ctx.createBufferSource();
			source.buffer = buf;
			source.connect(analyser);
			analyser.connect(ctx.destination);
			source.onended = stopVoice;
			source.start();
			mode = 'speaking';
			const samples = new Float32Array(analyser.fftSize);
			const loop = () => {
				analyser.getFloatTimeDomainData(samples);
				let sum = 0;
				for (const v of samples) sum += v * v;
				level = level * 0.4 + Math.min(1, Math.sqrt(sum / samples.length) * 6) * 0.6;
				raf = requestAnimationFrame(loop);
			};
			loop();
		} catch (e) {
			error = 'Ответ не озвучен: ' + (e?.message ?? e);
			mode = 'idle';
		}
	}

	function onKey(e) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) send(text.trim());
	}

	const sec = (ms) => (ms / 1000).toFixed(1).replace('.', ',');
</script>

<h1>Разговор</h1>
<p class="muted small">
	Этап 1: модель задаёт вопросы по одному и в конце предлагает черновик схемы и убеждений. Вы его проверяете и
	сохраняете. Разговор хранится в зашифрованной базе на сервере.
</p>

<div class="card row small">
	<label class="inline" for="model">Модель</label>
	<select id="model" bind:value={model} onchange={() => store.set('model', model)} style="width: auto">
		{#each data.models as m}
			<option value={m.id} disabled={!m.available}>{m.label}{m.available ? '' : ' — нет ключа'}</option>
		{/each}
	</select>
	<label class="inline" style="display: flex; gap: 6px">
		<input type="checkbox" bind:checked={voiceOn} onchange={() => store.set('voice', voiceOn ? '1' : '0')} />
		Озвучивать ответы
	</label>
	{#if voiceOn}
		<select bind:value={voice} onchange={() => store.set('speaker', voice)} style="width: auto">
			{#each Object.entries(VOICES) as [id, label]}<option value={id}>{label}</option>{/each}
		</select>
	{/if}
</div>

{#if voiceOn}
	<div class="avatar">
		<Avatar {level} {mode} />
		{#if mode === 'speaking'}<button type="button" class="secondary" onclick={stopVoice}>Стоп</button>{/if}
	</div>
{/if}

{#if form?.saved}
	<p class="done card">
		Сохранено: схема обновлена, добавлено убеждений — {form.beliefs}. Посмотреть: <a href="/formulation">Схема</a>,
		<a href="/beliefs">Убеждения</a>.
	</p>
{/if}

<div class="chat" bind:this={chatEl}>
	{#each messages as m (m.id)}
		<div class="msg {m.role}">
			<div class="bubble">{m.content}</div>
			{#if m.role === 'assistant'}<div class="meta">{m.modelLabel} · {sec(m.ms)} с</div>{/if}
		</div>
	{/each}
	{#if pending}<div class="msg user"><div class="bubble">{pending}</div></div>{/if}
	{#if busy}<div class="msg assistant"><div class="bubble muted">думает…</div></div>{/if}
</div>

{#if !messages.length && !busy}
	<p><button type="button" class="big" onclick={() => send('')}>Начать разговор</button></p>
	{#if data.hasFormulation}
		<p class="muted small">Схема уже заполнена. Новый разговор её не сотрёт: при сохранении заменятся только поля, которые есть в черновике.</p>
	{/if}
{:else}
	<div class="card">
		<label for="text" class="small muted">Ваш ответ (Ctrl+Enter — отправить)</label>
		<textarea id="text" bind:value={text} onkeydown={onKey} maxlength="4000" disabled={busy}></textarea>
		<div class="row" style="margin-top: 8px">
			<button type="button" style="flex: 1" disabled={busy || !text.trim()} onclick={() => send(text.trim())}>Отправить</button>
			{#if userTurns >= 3 && !draft}
				<button type="button" class="secondary" disabled={busy} onclick={() => send(FINISH_TEXT)}>Подвести итог</button>
			{/if}
		</div>
	</div>
{/if}

{#if error}<p class="error">{error}</p>{/if}

{#if draft}
	<form method="POST" action="?/save" class="card">
		<h2>Черновик — проверьте и поправьте</h2>
		<label for="d1">Что запускает беспокойство</label>
		<textarea id="d1" name="trigger_examples">{draft.formulation.trigger_examples}</textarea>
		<label for="d2">Как оно разворачивается</label>
		<textarea id="d2" name="worry_chain">{draft.formulation.worry_chain}</textarea>
		<label for="d3">Что пугает в самом беспокойстве</label>
		<textarea id="d3" name="type2_worry">{draft.formulation.type2_worry}</textarea>

		<p><b>Что делаете, чтобы справиться</b></p>
		{#each COPING as c}
			<label class="inline" style="display: flex">
				<input type="checkbox" name="coping" value={c.id} checked={draft.formulation.coping.checked.includes(c.id)} />
				{c.label}
			</label>
		{/each}
		<label for="d4">Другое</label>
		<textarea id="d4" name="coping_other" style="min-height: 60px">{draft.formulation.coping.other}</textarea>

		<h2>Убеждения</h2>
		{#if !draft.beliefs.length}<p class="muted small">Модель не выделила убеждений. Их можно добавить на экране «Убеждения».</p>{/if}
		<input type="hidden" name="belief_count" value={draft.beliefs.length} />
		{#each draft.beliefs as b, i}
			<div class="belief">
				<label class="inline" style="display: flex">
					<input type="checkbox" name="b{i}_use" value="1" checked /> сохранить
				</label>
				<select name="b{i}_type">
					{#each BELIEF_TYPES as t}<option value={t.id} selected={t.id === b.type}>{t.label}</option>{/each}
				</select>
				<textarea name="b{i}_text" style="min-height: 60px">{b.text}</textarea>
				<label class="inline small">
					Верю на <input type="number" name="b{i}_percent" min="0" max="100" value={b.percent ?? ''} style="width: 80px" /> %
				</label>
			</div>
		{/each}

		<p><button type="submit" class="big">Сохранить в схему и убеждения</button></p>
		{#if form?.error}<p class="error">{form.error}</p>{/if}
		<p class="muted small">Можно продолжить разговор выше — если модель снова подведёт итог, черновик обновится.</p>
	</form>
{/if}

{#if messages.length}
	<form method="POST" action="?/new" onsubmit={(e) => confirm('Отложить этот разговор и начать новый? Он останется в базе.') || e.preventDefault()}>
		<button type="submit" class="link small">Начать заново</button>
	</form>
{/if}

<style>
	.chat {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-height: 60vh;
		overflow-y: auto;
		margin: 12px 0;
	}
	.msg {
		display: flex;
		flex-direction: column;
		max-width: 85%;
	}
	.msg.user {
		align-self: flex-end;
		align-items: flex-end;
	}
	.bubble {
		padding: 10px 14px;
		border-radius: 14px;
		background: var(--card);
		border: 1px solid var(--line);
		white-space: pre-wrap;
		line-height: 1.45;
	}
	.msg.user .bubble {
		background: var(--accent, #3b6ea5);
		color: var(--accent-text);
		border-color: transparent;
	}
	.meta {
		font-size: 0.75rem;
		color: var(--muted);
		margin-top: 2px;
	}
	.avatar {
		max-width: 220px;
		margin: 0 auto;
		text-align: center;
	}
	.belief {
		border-top: 1px solid var(--line);
		padding: 10px 0;
	}
</style>
