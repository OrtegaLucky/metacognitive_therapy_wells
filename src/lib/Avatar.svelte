<!--
	Временный 2D-аватар (SPEC 12.4): рот открывается по громкости звука, глаза моргают,
	в режиме «думает» взгляд уходит вверх. Позже заменяется 3D-моделью с тем же интерфейсом:
	level — громкость 0..1, mode — 'idle' | 'thinking' | 'speaking'.
-->
<script>
	let { level = 0, mode = 'idle' } = $props();

	const mouthOpen = $derived(mode === 'speaking' ? 2 + level * 16 : 1.5);
	const mouthWidth = $derived(mode === 'speaking' ? 22 - level * 4 : 20);
	const tilt = $derived(mode === 'speaking' ? (level - 0.3) * 3 : 0);
	const look = $derived(mode === 'thinking' ? -5 : 0);
</script>

<svg viewBox="0 0 200 230" class="avatar" class:thinking={mode === 'thinking'} role="img" aria-label="Аватар-собеседник">
	<g transform="rotate({tilt} 100 200)">
		<!-- шея и плечи -->
		<path d="M70 190 Q100 205 130 190 L135 230 L65 230 Z" class="skin" />
		<path d="M20 230 Q30 195 75 192 Q100 205 125 192 Q170 195 180 230 Z" class="cloth" />
		<!-- волосы сзади -->
		<ellipse cx="100" cy="98" rx="70" ry="80" class="hair" />
		<!-- лицо -->
		<ellipse cx="100" cy="108" rx="56" ry="68" class="skin" />
		<!-- чёлка -->
		<path d="M44 95 Q50 40 100 38 Q150 40 156 95 Q140 62 100 64 Q66 64 44 95 Z" class="hair" />
		<!-- брови -->
		<path d="M66 {84 + look / 2} Q78 {78 + look / 2} 90 {83 + look / 2}" class="brow" />
		<path d="M110 {83 + look / 2} Q122 {78 + look / 2} 134 {84 + look / 2}" class="brow" />
		<!-- глаза -->
		<g class="eyes">
			<ellipse cx="78" cy="100" rx="9" ry="7" class="white" />
			<ellipse cx="122" cy="100" rx="9" ry="7" class="white" />
			<circle cx="78" cy={100 + look} r="4.5" class="pupil" />
			<circle cx="122" cy={100 + look} r="4.5" class="pupil" />
		</g>
		<!-- нос -->
		<path d="M100 108 Q96 124 101 128" class="line" />
		<!-- рот -->
		<ellipse cx="100" cy="148" rx={mouthWidth / 2} ry={mouthOpen} class="mouth" />
		<!-- румянец -->
		<ellipse cx="68" cy="130" rx="9" ry="5" class="blush" />
		<ellipse cx="132" cy="130" rx="9" ry="5" class="blush" />
	</g>
</svg>

<style>
	.avatar {
		width: 100%;
		max-width: 260px;
		display: block;
		margin: 0 auto;
		--skin: #f1c9a5;
		--hair: #4a3426;
		--cloth: #2f6f62;
		--line: #b07d5a;
	}
	.skin { fill: var(--skin); }
	.hair { fill: var(--hair); }
	.cloth { fill: var(--cloth); }
	.white { fill: #fff; }
	.pupil { fill: #2b2b2b; transition: cy 0.4s; }
	.brow { fill: none; stroke: var(--hair); stroke-width: 3.5; stroke-linecap: round; }
	.line { fill: none; stroke: var(--line); stroke-width: 2; stroke-linecap: round; }
	.mouth { fill: #8a3b3b; }
	.blush { fill: #e8a0a0; opacity: 0.35; }
	.eyes {
		transform-origin: 100px 100px;
		animation: blink 4.5s infinite;
	}
	@keyframes blink {
		0%, 94%, 100% { transform: scaleY(1); }
		96% { transform: scaleY(0.1); }
	}
	.thinking .eyes { animation-duration: 2.5s; }
</style>
