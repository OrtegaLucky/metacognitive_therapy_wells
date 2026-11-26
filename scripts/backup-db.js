// Ежедневная копия базы (SPEC 12.1). Копия зашифрована тем же ключом DB_KEY, что и база.
// Запуск: node --env-file=/opt/mct/.env scripts/backup-db.js [папка]   (по умолчанию BACKUP_DIR или /opt/mct/backups)
// Хранит последние BACKUP_KEEP копий (по умолчанию 14). Каждую копию проверяет: без ключа не открывается, с ключом — да.
import Database from 'better-sqlite3-multiple-ciphers';
import fs from 'node:fs';
import path from 'node:path';

const key = process.env.DB_KEY ?? '';
if (!/^[0-9a-f]{64}$/.test(key)) fail('DB_KEY не задан');
const src = path.resolve(process.env.DB_PATH || 'data/app.db');
const dir = path.resolve(process.argv[2] || process.env.BACKUP_DIR || '/opt/mct/backups');
const keep = Math.max(1, parseInt(process.env.BACKUP_KEEP || '14', 10));

function fail(msg) {
	console.error(`[backup] ОШИБКА: ${msg}`);
	process.exit(1);
}

function open(file, withKey) {
	const db = new Database(file, { readonly: true, fileMustExist: true });
	db.pragma("cipher='sqlcipher'");
	db.pragma('legacy=4');
	if (withKey) db.pragma(`key='${key}'`);
	return db;
}

const tables = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name);
const counts = (db) => Object.fromEntries(tables(db).map((t) => [t, db.prepare(`SELECT count(*) AS n FROM "${t}"`).get().n]));

fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
const dest = path.join(dir, `app-${stamp}.db`);
const tmp = dest + '.part';
fs.rmSync(tmp, { force: true });

const db = open(src, true);
const before = counts(db);
db.prepare('VACUUM INTO ?').run(tmp); // целостный снимок, даже пока приложение пишет
db.close();

// Проверка копии
let plainOpens = false;
try {
	const p = open(tmp, false);
	p.prepare('SELECT count(*) FROM sqlite_master').get();
	plainOpens = true;
	p.close();
} catch {
	/* так и должно быть: без ключа не читается */
}
if (plainOpens) {
	fs.rmSync(tmp, { force: true });
	fail('копия открывается без ключа — не сохраняю');
}
const c = open(tmp, true);
const after = counts(c);
c.close();
for (const [t, n] of Object.entries(before)) if (after[t] !== n) fail(`в копии не совпало число строк в ${t}`);

fs.renameSync(tmp, dest);
fs.chmodSync(dest, 0o600);

const old = fs.readdirSync(dir).filter((f) => /^app-\d{8}-\d{4}\.db$/.test(f)).sort().slice(0, -keep);
for (const f of old) fs.rmSync(path.join(dir, f));

const rows = Object.values(after).reduce((a, b) => a + b, 0);
console.log(`[backup] ${path.basename(dest)}: ${Math.round(fs.statSync(dest).size / 1024)} КБ, таблиц ${Object.keys(after).length}, строк ${rows}, зашифрована; удалено старых: ${old.length}`);
