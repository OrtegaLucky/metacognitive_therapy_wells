<script>
	import '../app.css';
	import { page } from '$app/stores';
	import VoiceFields from '$lib/VoiceFields.svelte';

	let { data, children } = $props();

	// Меню по группам: сверху — то, чем пользуются каждый день
	const groups = [
		[
			['/', 'Сегодня'],
			['/talk', 'Разговор'],
			['/diary', 'Дневник']
		],
		[
			['/window', 'Вечернее окно'],
			['/exercises', 'Упражнения'],
			['/problem', 'Решение или беспокойство'],
			['/plan', 'Мой план'],
			['/review', 'Разбор'],
			['/stage', 'Этап'],
			['/beliefs', 'Убеждения'],
			['/experiments', 'Эксперименты'],
			['/formulation', 'Схема'],
			['/scales', 'GAD-7']
		],
		[
			['/settings', 'Настройки'],
			['/avatar-test', 'Проверка аватара']
		]
	];
	const all = groups.flat();
	const isActive = (href, path) => (href === '/' ? path === '/' : path.startsWith(href));
	const title = $derived(all.find(([href]) => isActive(href, $page.url.pathname))?.[1] ?? '');

	let open = $state(false);
	// Закрываем меню при переходе на другую страницу
	$effect(() => {
		$page.url.pathname;
		open = false;
	});
	const onKey = (e) => e.key === 'Escape' && (open = false);
</script>

<svelte:window onkeydown={onKey} />

{#if data.authed}
	<header>
		<div class="bar">
			<a href="/" class="home" aria-label="На главную">◐</a>
			<span class="title">{title}</span>
			<button
				type="button"
				class="menu-btn"
				aria-expanded={open}
				aria-controls="menu"
				aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
				onclick={() => (open = !open)}
			>
				{#if open}✕{:else}<span class="burger"><i></i><i></i><i></i></span>{/if}
			</button>
		</div>
		{#if open}
			<button type="button" class="backdrop" aria-label="Закрыть меню" onclick={() => (open = false)}></button>
			<nav id="menu">
				{#each groups as g}
					<ul>
						{#each g as [href, label]}
							<li><a {href} class:active={isActive(href, $page.url.pathname)}>{label}</a></li>
						{/each}
					</ul>
				{/each}
				<form method="POST" action="/logout">
					<button class="link" type="submit">Выйти</button>
				</form>
			</nav>
		{/if}
	</header>
{/if}

{#if data.authed}<VoiceFields />{/if}

<main>
	{@render children()}
</main>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 20;
		background: var(--card);
		border-bottom: 1px solid var(--line);
	}
	.bar {
		max-width: 760px;
		margin: 0 auto;
		padding: 6px 12px;
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 48px;
	}
	.home {
		font-size: 1.4rem;
		text-decoration: none;
		color: var(--accent);
		line-height: 1;
		padding: 6px;
	}
	.title {
		flex: 1;
		font-weight: 600;
		text-align: center;
	}
	.menu-btn {
		background: none;
		border: none;
		color: var(--text);
		width: 44px;
		height: 44px;
		padding: 0;
		font-size: 1.2rem;
		display: grid;
		place-items: center;
	}
	.burger {
		display: grid;
		gap: 5px;
	}
	.burger i {
		display: block;
		width: 22px;
		height: 2px;
		background: currentColor;
		border-radius: 1px;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		top: 49px;
		background: rgb(0 0 0 / 0.25);
		border: none;
		border-radius: 0;
		padding: 0;
		cursor: default;
	}
	nav {
		position: absolute;
		right: max(12px, calc((100vw - 760px) / 2 + 12px));
		top: calc(100% + 6px);
		width: min(280px, calc(100vw - 24px));
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 12px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
		padding: 6px 0;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 4px 0;
	}
	ul + ul {
		border-top: 1px solid var(--line);
	}
	nav a {
		display: block;
		padding: 10px 18px;
		text-decoration: none;
		color: var(--text);
	}
	nav a:hover {
		background: var(--bg);
	}
	nav a.active {
		color: var(--accent);
		font-weight: 600;
	}
	nav form {
		border-top: 1px solid var(--line);
		padding: 6px 12px 2px;
	}
</style>
