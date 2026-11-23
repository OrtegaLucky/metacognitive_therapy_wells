// Подключение к зашифрованной базе SQLite (SPEC 3, 13.2)
import Database from 'better-sqlite3-multiple-ciphers';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '$env/dynamic/private';

let db = null;

/** Открывает базу один раз и возвращает её. */
export function getDb() {
	if (!db) db = open();
	return db;
}

export function now() {
	return new Date().toISOString();
}

function open() {
	const key = env.DB_KEY ?? '';
	if (!/^[0-9a-f]{64}$/.test(key)) {
		throw new Error('DB_KEY в .env не задан или неверный: нужна строка из 64 символов 0-9a-f (npm run gen-key)');
	}
	const file = path.resolve(env.DB_PATH || 'data/app.db');
	fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });

	const conn = new Database(file);
	conn.pragma("cipher='sqlcipher'");
	conn.pragma('legacy=4');
	conn.pragma(`key='${key}'`);
	try {
		conn.prepare('SELECT count(*) FROM sqlite_master').get();
	} catch {
		conn.close();
		throw new Error('Не удалось открыть базу: неверный DB_KEY или файл повреждён');
	}
	conn.pragma('journal_mode = WAL');
	conn.pragma('foreign_keys = ON');
	migrate(conn);
	try {
		fs.chmodSync(file, 0o600);
	} catch {
		/* на некоторых дисках права не меняются — не критично */
	}
	return conn;
}

/** Применяет новые файлы из migrations/ по порядку имени. */
function migrate(conn) {
	conn.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
	const dir = path.resolve('migrations');
	const done = new Set(conn.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
	const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
	for (const name of files) {
		if (done.has(name)) continue;
		const sql = fs.readFileSync(path.join(dir, name), 'utf8');
		conn.transaction(() => {
			conn.exec(sql);
			conn.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(name, now());
		})();
		console.log(`[db] применена миграция ${name}`);
	}
}
