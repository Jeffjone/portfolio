CREATE TABLE IF NOT EXISTS notification_outbox (
  signature_id TEXT PRIMARY KEY REFERENCES signatures(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0,
  first_attempt_at INTEGER,
  payload TEXT,
  sent_at INTEGER,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS notifications_due ON notification_outbox(state, available_at, locked_until);
CREATE TABLE IF NOT EXISTS moderation_events (
  id TEXT PRIMARY KEY,
  signature_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
