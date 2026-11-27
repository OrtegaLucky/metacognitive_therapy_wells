<script>
	// Голосовой ввод в любое текстовое поле: когда поле в фокусе, в его правом верхнем углу
	// появляется кнопка микрофона. Нажали — запись, нажали ещё раз — текст дописывается в поле.
	// Поля с атрибутом data-novoice (у «Разговора» свой микрофон) пропускаются.
	import { onMount } from 'svelte';
	import { startRecording, transcribe } from '$lib/recorder.js';

	const MAX_SEC = 120;
	let target = $state(null);
	let pos = $state({ top: 0, left: 0 });
	let mode = $state('idle'); // idle | starting | rec | busy
	let sec = $state(0);
	let error = $state('');
	let recording = null;
	let timer, hideTimer;

	const eligible = (el) =>
		el instanceof HTMLElement &&
		!el.dataset.novoice &&
		!el.readOnly &&
		!el.disabled &&
		(el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['text', 'search', ''].includes(el.getAttribute('type') ?? '')));

	function place() {
		if (!target?.isConnected) return;
		const r = target.getBoundingClientRect();
		pos = { top: r.top + window.scrollY + 4, left: r.right + window.scrollX - 40 };
	}

	onMount(() => {
		const onIn = (e) => {
			if (!eligible(e.target)) return;
			clearTimeout(hideTimer);
			if (target !== e.target && mode === 'idle') error = '';
			if (mode === 'idle') target = e.target;
			place();
		};
		const onOut = () => {
			// Не прячем сразу: нажатие на кнопку на телефоне может снять фокус с поля
			hideTimer = setTimeout(() => {
				if (mode === 'idle' && !eligible(document.activeElement)) target = null;
			}, 400);
		};
		const onMove = () => place();
		document.addEventListener('focusin', onIn);
		document.addEventListener('focusout', onOut);
		window.addEventListener('resize', onMove);
		document.addEventListener('scroll', onMove, true);
		return () => {
			document.removeEventListener('focusin', onIn);
			document.removeEventListener('focusout', onOut);
			window.removeEventListener('resize', onMove);
			document.removeEventListener('scroll', onMove, true);
			recording?.stop();
		};
	});

	function insert(el, said) {
		const v = el.value;
		el.value = v.trim() ? v.replace(/\s*$/, ' ') + said : said;
		el.dispatchEvent(new Event('input', { bubbles: true }));
	}

	async function toggle() {
		error = '';
		if (mode === 'rec') return stop();
		if (mode !== 'idle' || !target) return;
		mode = 'starting';
		try {
			recording = await startRecording();
		} catch (e) {
			error = 'Не записалось: ' + e.message;
			mode = 'idle';
			return;
		}
		mode = 'rec';
		sec = 0;
		timer = setInterval(() => ++sec >= MAX_SEC && stop(), 1000);
	}

	async function stop() {
		clearInterval(timer);
		const el = target;
		mode = 'busy';
		try {
			const said = await transcribe(await recording.stop());
			if (!said) error = 'Не расслышал — попробуйте ещё раз.';
			else if (el?.isConnected) {
				insert(el, said);
				el.focus({ preventScroll: true });
			}
		} catch (e) {
			error = 'Не получилось распознать: ' + e.message;
		} finally {
			recording = null;
			mode = 'idle';
			place();
		}
	}
</script>

{#if target}
	<div class="mic-wrap" style="top: {pos.top}px; left: {pos.left}px">
		<button
			type="button"
			class="mic"
			class:on={mode === 'rec'}
			aria-label={mode === 'rec' ? 'Остановить запись' : 'Сказать голосом'}
			onmousedown={(e) => e.preventDefault()}
			onclick={toggle}
			disabled={mode === 'starting' || mode === 'busy'}
		>
			{#if mode === 'rec'}■ {sec}{:else if mode === 'busy' || mode === 'starting'}…{:else}🎤{/if}
		</button>
		{#if error}<div class="err">{error}</div>{/if}
	</div>
{/if}

<style>
	.mic-wrap {
		position: absolute;
		z-index: 30;
	}
	.mic {
		min-width: 36px;
		height: 32px;
		padding: 0 8px;
		border-radius: 16px;
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--text);
		font-size: 0.95rem;
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.2);
		white-space: nowrap;
	}
	.mic.on {
		background: #c0392b;
		color: #fff;
		border-color: #c0392b;
		transform: translateX(-24px);
	}
	.err {
		position: absolute;
		right: 0;
		top: 36px;
		width: min(260px, 80vw);
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 6px 8px;
		font-size: 0.85rem;
		color: var(--danger, #c0392b);
	}
</style>
