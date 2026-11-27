<script>
	import { enhance } from '$app/forms';
	import { fmtDate } from '$lib/labels.js';

	let { data, form } = $props();
	let actionable = $state('');
</script>

<h1>Решение или беспокойство?</h1>
<p class="muted small">
	Беспокойство — это прокручивание «а что если…», у которого нет конца. Решение задачи — конкретный шаг, который можно
	сделать. Когда ловите себя на беспокойстве, разберите его здесь.
</p>

<form method="POST" action="?/add" class="card" use:enhance={() => async ({ update }) => { await update(); actionable = ''; }}>
	<label for="worry">О чём беспокоюсь</label>
	<textarea id="worry" name="worry" placeholder="Например: а вдруг проблема с машиной выльется в аварию">{form?.worry ?? ''}</textarea>

	<p><b>Можно ли в ближайшие сутки сделать что-то конкретное?</b></p>
	<label class="inline"><input type="radio" name="actionable" value="yes" bind:group={actionable} /> Да, есть конкретный шаг</label>
	<label class="inline"><input type="radio" name="actionable" value="no" bind:group={actionable} /> Нет — только думать и прокручивать</label>

	{#if actionable === 'yes'}
		<label for="step">Первый шаг — что именно сделаю</label>
		<input id="step" name="step" type="text" placeholder="Например: записаться в сервис на пятницу" />
		<label for="when">Когда</label>
		<input id="when" name="when" type="text" placeholder="Например: сегодня до 18:00" />
		<p class="small muted">Сделайте шаг — и дальше мысль можно не прокручивать: всё, что можно было сделать, сделано.</p>
	{:else if actionable === 'no'}
		<p class="small muted">
			Это беспокойство, а не задача. Прокручивание здесь ничего не даст — отложите его до вечернего окна и вернитесь к делам.
		</p>
	{/if}

	{#if form?.error}<p class="error">{form.error}</p>{/if}
	<p><button type="submit" class="big">Записать</button></p>
	{#if form?.added === 'yes'}<p class="done">Шаг записан — он ниже, в списке дел.</p>{/if}
	{#if form?.added === 'no'}<p class="done">Записано. Отложите до окна.</p>{/if}
</form>

{#if data.open.length}
	<h2>Шаги, которые нужно сделать</h2>
	{#each data.open as i (i.id)}
		<form method="POST" action="?/done" class="card" use:enhance>
			<input type="hidden" name="id" value={i.id} />
			<p class="small muted" style="margin-top: 0">{fmtDate(i.created_at)} · «{i.worry}»</p>
			<p><b>{i.step}</b>{#if i.when} — {i.when}{/if}</p>
			<input name="result" type="text" placeholder="Что получилось (по желанию)" />
			<p><button type="submit" class="secondary">Сделал</button></p>
		</form>
	{/each}
{/if}

{#if data.history.length}
	<h2>Раньше</h2>
	{#each data.history as i (i.id)}
		<div class="card small">
			<span class="muted">{fmtDate(i.created_at)}</span> · «{i.worry}» —
			{#if i.actionable}шаг: {i.step} ✓{#if i.result} ({i.result}){/if}{:else}беспокойство, отложил{/if}
		</div>
	{/each}
{/if}
