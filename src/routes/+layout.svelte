<script>
	import '../app.css';
	import { page } from '$app/stores';
	import VoiceFields from '$lib/VoiceFields.svelte';
	import { menuSections, pageTitle } from '$lib/menu.js';

	let { data, children } = $props();

	const sections = $derived(data.authed ? menuSections(data.stage, data.expFrom) : []);
	const isActive = (href, path) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
	const title = $derived(pageTitle($page.url.pathname, sections));

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
				{#each sections as s, i}
					<div class="sec">
						{#if s.href}
							<a href={s.href} class="head" class:active={isActive(s.href, $page.url.pathname)}>
								<span class="n">{i + 1}</span>
								<span>{s.title}{#if s.note}<small>{s.note}</small>{/if}</span>
							</a>
						{:else}
							<div class="head plain"><span class="n">{i + 1}</span><span>{s.title}</span></div>
						{/if}
						{#if s.items.length}
							<ul>
								{#each s.items as it}
									<li>
										{#if it.from <= data.stage}
											<a href={it.href} class:active={isActive(it.href, $page.url.pathname)}>
												{it.label}{#if it.from === data.stage && it.from > 1}<span class="tag new">этап {it.from}</span>{/if}
											</a>
										{:else}
											<span class="locked">🔒 {it.label} <small>· с этапа {it.from}</small></span>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/each}
				<div class="foot">
					<a href="/settings" class:active={isActive('/settings', $page.url.pathname)}>Настройки</a>
					<form method="POST" action="/logout">
						<button class="link" type="submit">Выйти</button>
					</form>
				</div>
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
		width: min(320px, calc(100vw - 24px));
		max-height: calc(100vh - 70px);
		overflow-y: auto;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 12px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
		padding: 4px 0;
	}
	.sec + .sec {
		border-top: 1px solid var(--line);
	}
	.head {
		display: flex;
		gap: 10px;
		align-items: baseline;
		padding: 10px 16px 6px;
		font-weight: 600;
		text-decoration: none;
		color: var(--text);
	}
	.head.plain {
		cursor: default;
	}
	.head small {
		display: block;
		font-weight: 400;
		font-size: 0.8rem;
		opacity: 0.65;
	}
	.n {
		min-width: 1.4em;
		height: 1.4em;
		border-radius: 50%;
		border: 1px solid var(--line);
		display: inline-grid;
		place-items: center;
		font-size: 0.75rem;
		font-weight: 600;
		opacity: 0.8;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0 0 6px;
	}
	li a,
	.locked {
		display: block;
		padding: 7px 16px 7px 48px;
		text-decoration: none;
		color: var(--text);
	}
	.locked {
		opacity: 0.45;
	}
	.locked small {
		font-size: 0.8rem;
	}
	nav a:hover {
		background: var(--bg);
	}
	nav a.active {
		color: var(--accent);
		font-weight: 600;
	}
	li .tag {
		margin-left: 6px;
	}
	.foot {
		border-top: 1px solid var(--line);
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 4px 0 0;
	}
	.foot a {
		padding: 10px 16px;
		text-decoration: none;
		color: var(--text);
	}
</style>
