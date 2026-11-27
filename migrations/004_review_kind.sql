-- Разборы бывают двух видов: итог этапа (stage) и промежуточный, посреди этапа (interim)
ALTER TABLE stage_reviews ADD COLUMN kind TEXT NOT NULL DEFAULT 'stage' CHECK (kind IN ('stage', 'interim'));
