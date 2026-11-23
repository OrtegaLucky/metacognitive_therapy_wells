<script>
	import { fmtDate } from '$lib/labels.js';

	let { data, form } = $props();
</script>

<p class="muted small">Этап {data.profile.current_stage} из 10</p>
<h1>{data.stage?.title ?? 'Этап'}</h1>
{#if data.stage?.goal}<p><b>Цель:</b> {data.stage.goal}</p>{/if}

<div class="card">
	{#if data.html}
		<!-- Тексты этапов — свои файлы из content/, не пользовательский ввод -->
		{@html data.html}
	{:else}
		<p class="muted">Текст этого этапа появится в следующих фазах.</p>
	{/if}
</div>

{#if !data.isLast}
	<div class="card">
		<h2 style="margin-top: 0">Переход на следующий этап</h2>
		{#if data.unlock.hasRule}
			<ul class="checks">
				{#each data.unlock.items as item}
					<li class:done={item.done}>{item.done ? '✓' : '○'} {item.label}</li>
				{/each}
			</ul>
			{#if data.unlock.ok}
				<form method="POST" action="?/advance">
					<button type="submit" class="big">Перейти на этап {data.profile.current_stage + 1}</button>
				</form>
			{:else}
				<p class="muted">Пока нет: выполнены не все условия.</p>
			{/if}
		{:else}
			<p class="muted">Условия перехода для этого этапа ещё не заданы.</p>
		{/if}

		<details style="margin-top: 12px">
			<summary class="muted small">Перейти вручную</summary>
			<form method="POST" action="?/force">
				<label class="inline"><input type="checkbox" name="confirm" value="yes" /> Понимаю, что перехожу без выполнения условий</label>
				<p><button type="submit" class="danger">Перейти вручную</button></p>
			</form>
		</details>
		{#if form?.error}<p class="error">{form.error}</p>{/if}
	</div>
{/if}

<h2>Маршрут</h2>
<ol>
	{#each data.route as s}
		<li class:muted={s.number > data.profile.current_stage}>
			{#if s.number === data.profile.current_stage}<b>{s.title}</b> — сейчас{:else}{s.title}{/if}
		</li>
	{/each}
</ol>

<h2>История</h2>
<ul class="small">
	{#each data.history as h}
		<li>Этап {h.stage}: с {fmtDate(h.started_at)}{h.manual ? ' (вручную)' : ''}</li>
	{/each}
</ul>
