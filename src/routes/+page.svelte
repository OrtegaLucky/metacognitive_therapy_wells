<script>
	import { JOURNAL_KINDS } from '$lib/labels.js';

	let { data } = $props();
	const quick = $derived((data.stage?.journal_kinds_enabled ?? ['free']).filter((k) => k !== 'free'));
</script>

<p class="muted small">Этап {data.profile.current_stage}</p>
<h1>{data.stage?.title ?? 'Этап'}</h1>
{#if data.stage?.goal}<p>{data.stage.goal}</p>{/if}

{#if quick.length}
	<div class="grid">
		{#each quick as kind}
			<a class="btn big" href="/diary?new={kind}&back=/">
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
