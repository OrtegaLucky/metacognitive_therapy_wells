<script>
	// Дневник эксперимента «Без поиска успокоения» (этап 6): раз в день отметка — удержался ли,
	// дописывается строкой в поле «Что произошло» и сразу сохраняется.
	let { id } = $props();
	let note = $state('');
	let saved = $state('');

	function log(held) {
		const el = document.getElementById('hap' + id);
		if (!el) return;
		const day = new Date().toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit' });
		const line = `${day} — ${held ? 'не искал успокоения' : 'искал успокоения'}${note.trim() ? ': ' + note.trim() : ''}`;
		el.value = el.value.trim() ? el.value.trim() + '\n' + line : line;
		el.dispatchEvent(new Event('input', { bubbles: true }));
		el.form?.querySelector('button[formaction="?/result"]')?.click();
		note = '';
		saved = line;
	}
</script>

<div class="daylog">
	<p style="margin: 0 0 6px"><b>Отметка за сегодня</b></p>
	<p class="small muted" style="margin: 0 0 6px">Что было с тревогой, когда тянуло проверить или спросить? Через сколько она спала сама?</p>
	<input type="text" bind:value={note} placeholder="Например: тянуло позвонить, через 20 минут отпустило" maxlength="300" />
	<div class="row" style="margin-top: 6px">
		<button type="button" onclick={() => log(true)}>Удержался</button>
		<button type="button" class="secondary" onclick={() => log(false)}>Не удержался</button>
	</div>
	{#if saved}<p class="small done">Записано: {saved}</p>{/if}
</div>

<style>
	.daylog {
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 8px 12px;
		margin: 10px 0;
	}
</style>
