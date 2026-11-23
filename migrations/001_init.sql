-- Начальная схема (SPEC.md, раздел 4)

CREATE TABLE profile (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	started_at TEXT NOT NULL,
	current_stage INTEGER NOT NULL DEFAULT 1,
	reminder_worry_window TEXT,
	reminder_att TEXT,
	reminder_weekly_review TEXT,
	telegram_chat_id TEXT
);

CREATE TABLE beliefs (
	id INTEGER PRIMARY KEY,
	type TEXT NOT NULL CHECK (type IN ('uncontrollability', 'danger', 'usefulness')),
	text TEXT NOT NULL,
	created_at TEXT NOT NULL,
	archived_at TEXT
);

CREATE TABLE belief_ratings (
	id INTEGER PRIMARY KEY,
	belief_id INTEGER NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
	rated_at TEXT NOT NULL,
	percent INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
	context TEXT NOT NULL CHECK (context IN ('initial', 'weekly', 'after_experiment'))
);
CREATE INDEX idx_belief_ratings_belief ON belief_ratings(belief_id, rated_at);

CREATE TABLE formulation (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	trigger_examples TEXT,
	worry_chain TEXT,
	type2_worry TEXT,
	coping_strategies TEXT,
	raw_dialog TEXT,
	updated_at TEXT
);

CREATE TABLE journal_entries (
	id INTEGER PRIMARY KEY,
	created_at TEXT NOT NULL,
	stage INTEGER NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('trigger', 'worry_window', 'type2', 'att', 'free')),
	payload TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_journal_stage_kind ON journal_entries(stage, kind);
CREATE INDEX idx_journal_created ON journal_entries(created_at);

CREATE TABLE experiments (
	id INTEGER PRIMARY KEY,
	stage INTEGER NOT NULL,
	belief_id INTEGER REFERENCES beliefs(id) ON DELETE SET NULL,
	kind TEXT NOT NULL CHECK (kind IN ('amplify_release', 'lose_control', 'day_with_without', 'stop_reassurance', 'custom')),
	prediction TEXT,
	prediction_percent INTEGER,
	what_i_did TEXT,
	what_happened TEXT,
	conclusion TEXT,
	belief_before_percent INTEGER,
	belief_after_percent INTEGER,
	gpt_questions TEXT,
	created_at TEXT NOT NULL,
	completed_at TEXT
);

CREATE TABLE scales (
	id INTEGER PRIMARY KEY,
	kind TEXT NOT NULL CHECK (kind IN ('gad7')),
	taken_at TEXT NOT NULL,
	answers TEXT NOT NULL,
	total INTEGER NOT NULL
);

-- Когда начат каждый этап (нужно для условия «прошло N дней»)
CREATE TABLE stage_history (
	id INTEGER PRIMARY KEY,
	stage INTEGER NOT NULL,
	started_at TEXT NOT NULL,
	manual INTEGER NOT NULL DEFAULT 0
);

-- Сессии входа (хранится хеш токена, не сам токен)
CREATE TABLE sessions (
	token_hash TEXT PRIMARY KEY,
	created_at TEXT NOT NULL,
	expires_at TEXT NOT NULL
);

INSERT INTO profile (id, started_at, current_stage, reminder_worry_window)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 1, '18:00');

INSERT INTO formulation (id, updated_at) VALUES (1, NULL);

INSERT INTO stage_history (stage, started_at, manual)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 0);
