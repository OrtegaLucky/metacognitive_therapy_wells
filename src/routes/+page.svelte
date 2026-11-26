<script>
	import { JOURNAL_KINDS } from '$lib/labels.js';

	let { data } = $props();
	const enabled = $derived(data.stage?.journal_kinds_enabled ?? ['free']);
	// У этих записей свои экраны или быстрая кнопка — остальное ведём в дневник
	const SPECIAL = ['free', 'trigger', 'worry_window', 'att'];
	const quick = $derived(enabled.filter((k) => !SPECIAL.includes(k)));
</script>

<p class="muted small">Этап {data.profile.current_stage}</p>
<h1>{data.stage?.title ?? 'Этап'}</h1>
{#if data.stage?.goal}<p>{data.stage.goal}</p>{/if}

{#if enabled.includes('trigger')}
	<form method="POST" action="/diary?/add" class="card">
		<input type="hidden" name="kind" value="trigger" />
		<input type="hidden" name="back" value="/?logged=1" />
		<h2 style="margin-top: 0">
			Заметил триггер
			{#if data.today.trigger}<span class="small muted"> · сегодня {data.today.trigger}</span>{/if}
		</h2>
		<p class="muted small">Скажите себе: «Подумаю об этом вечером» — и отметьте.</p>
		<details>
			<summary class="small">Записать мысль (по желанию)</summary>
			<input name="note" maxlength="300" placeholder="Например: а вдруг не успею с отчётом" />
		</details>
		<div class="grid" style="margin-top: 8px">
			<button type="submit" name="postponed" value="yes" class="big">Отложил на вечер</button>
			<button type="submit" name="postponed" value="no" class="big secondary">Не получилось</button>
		</div>
		{#if data.logged}<p class="done">Записано. Возвращайтесь к своим делам.</p>{/if}
	</form>
{/if}

{#if enabled.includes('worry_window') || enabled.includes('att') || quick.length}
	<div class="grid">
		{#if enabled.includes('worry_window')}
			<a class="btn big" href="/window">
				Вечернее окно{#if data.today.worry_window}<span class="small"> · ✓</span>{/if}
			</a>
		{/if}
		{#if enabled.includes('att')}
			<a class="btn big secondary" href="/exercises">
				Упражнение{#if data.today.att}<span class="small"> · ✓</span>{/if}
			</a>
		{/if}
		{#each quick as kind}
			<a class="btn big secondary" href="/diary?new={kind}&back=/">
				{JOURNAL_KINDS[kind]}
				{#if data.today[kind]}<span class="small"> · сегодня {data.today[kind]}</span>{/if}
			</a>
		{/each}
	</div>
{/if}

{#if data.profile.current_stage === 1}
	<div class="grid" style="margin-top: 8px">
		<a class="btn secondary big" href="/formulation">Концептуализация</a>
		<a class="btn secondary big" href="/beliefs">Убеждения</a>
		<a class="btn secondary big" href="/scales">GAD-7</a>
	</div>
{/if}

{#if data.stage?.tasks?.length}
	<div class="card">
		<h2 style="margin-top: 0">Задания этапа</h2>
		<ul>
			{#each data.stage.tasks as task}<li>{task}</li>{/each}
		</ul>
	</div>
{/if}

<div class="card">
	<h2 style="margin-top: 0">До следующего этапа</h2>
	{#if data.unlock.hasRule}
		<ul class="checks">
			{#each data.unlock.items as item}
				<li class:done={item.done}>{item.done ? '✓' : '○'} {item.label}</li>
			{/each}
		</ul>
		{#if data.unlock.ok}<p class="done">Можно переходить — <a href="/stage">на страницу этапа</a>.</p>{/if}
	{:else}
		<p class="muted">Условия для этого этапа появятся в следующих фазах.</p>
	{/if}
</div>

{#if data.profile.reminder_worry_window}
	<p class="muted small">Вечернее окно для беспокойства: {data.profile.reminder_worry_window}</p>
{/if}
