-- Этапы 7–11 и фиксация результата этапа (SPEC 5, 7.3)

-- Новый вид записи «Решение или беспокойство?» (этапы 7+). В SQLite условие CHECK не поменять — пересоздаём таблицу.
CREATE TABLE journal_entries_new (
	id INTEGER PRIMARY KEY,
	created_at TEXT NOT NULL,
	stage INTEGER NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('trigger', 'worry_window', 'type2', 'att', 'free', 'problem')),
	payload TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO journal_entries_new (id, created_at, stage, kind, payload) SELECT id, created_at, stage, kind, payload FROM journal_entries;
DROP TABLE journal_entries;
ALTER TABLE journal_entries_new RENAME TO journal_entries;
CREATE INDEX idx_journal_stage_kind ON journal_entries(stage, kind);
CREATE INDEX idx_journal_created ON journal_entries(created_at);

-- Разбор этапа с моделью: диалог, итог модели и итог пользователя «что я понял»
CREATE TABLE stage_reviews (
	id INTEGER PRIMARY KEY,
	stage INTEGER NOT NULL,
	started_at TEXT NOT NULL,
	messages TEXT NOT NULL DEFAULT '[]',
	model_summary TEXT,
	user_summary TEXT,
	saved_at TEXT
);
CREATE INDEX idx_stage_reviews ON stage_reviews(stage, id);

-- Свой план на случай триггера (этап 9) и «старый способ → новый способ» (этап 10)
CREATE TABLE plan (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	triggers TEXT,
	steps TEXT,
	warning_signs TEXT,
	old_way TEXT,
	new_way TEXT,
	updated_at TEXT
);
