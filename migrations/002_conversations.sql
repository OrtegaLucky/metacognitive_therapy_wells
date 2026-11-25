-- Разговоры с моделью (SPEC 7.1, 12.2). Хранятся в зашифрованной базе.

CREATE TABLE conversations (
	id INTEGER PRIMARY KEY,
	kind TEXT NOT NULL CHECK (kind IN ('conceptualization')),
	started_at TEXT NOT NULL,
	draft TEXT,
	finished_at TEXT,
	saved_at TEXT
);

CREATE TABLE conversation_messages (
	id INTEGER PRIMARY KEY,
	conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
	content TEXT NOT NULL,
	model TEXT,
	ms INTEGER,
	created_at TEXT NOT NULL
);
CREATE INDEX idx_conversation_messages ON conversation_messages(conversation_id, id);
