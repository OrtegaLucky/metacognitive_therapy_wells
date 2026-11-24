<script>
	import '../app.css';
	import { page } from '$app/stores';

	let { data, children } = $props();

	const links = [
		['/', 'Сегодня'],
		['/stage', 'Этап'],
		['/diary', 'Дневник'],
		['/beliefs', 'Убеждения'],
		['/formulation', 'Схема'],
		['/scales', 'GAD-7'],
		['/avatar-test', 'Аватар'],
		['/settings', 'Настройки']
	];
	const isActive = (href, path) => (href === '/' ? path === '/' : path.startsWith(href));
</script>

{#if data.authed}
	<nav>
		<div class="inner">
			{#each links as [href, label]}
				<a {href} class:active={isActive(href, $page.url.pathname)}>{label}</a>
			{/each}
			<form method="POST" action="/logout">
				<button class="link" type="submit">Выйти</button>
			</form>
		</div>
	</nav>
{/if}

<main>
	{@render children()}
</main>
