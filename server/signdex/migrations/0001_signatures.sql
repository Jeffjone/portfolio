CREATE TABLE IF NOT EXISTS signatures (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  work TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  pokemon TEXT NOT NULL,
  game TEXT NOT NULL,
  series TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  consent_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS signatures_book ON signatures(status, created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
