// Защита от подбора пароля (SPEC 13.1):
// не больше 5 попыток в минуту, после 10 неудач подряд — пауза 15 минут.
const PER_MINUTE = 5;
const MAX_FAILS = 10;
const BLOCK_MS = 15 * 60_000;

/** @type {Map<string, {times: number[], fails: number, blockedUntil: number}>} */
const state = new Map();

function get(ip) {
	let s = state.get(ip);
	if (!s) {
		s = { times: [], fails: 0, blockedUntil: 0 };
		state.set(ip, s);
	}
	return s;
}

/** Можно ли сейчас пробовать войти. retryAfter — через сколько секунд. */
export function checkAttempt(ip) {
	const s = get(ip);
	const t = Date.now();
	if (s.blockedUntil > t) return { allowed: false, retryAfter: Math.ceil((s.blockedUntil - t) / 1000) };
	s.times = s.times.filter((x) => t - x < 60_000);
	if (s.times.length >= PER_MINUTE) return { allowed: false, retryAfter: Math.ceil((60_000 - (t - s.times[0])) / 1000) };
	s.times.push(t);
	return { allowed: true, retryAfter: 0 };
}

export function recordFail(ip) {
	const s = get(ip);
	s.fails += 1;
	if (s.fails >= MAX_FAILS) {
		s.blockedUntil = Date.now() + BLOCK_MS;
		s.fails = 0;
	}
}

export function recordSuccess(ip) {
	state.delete(ip);
}
