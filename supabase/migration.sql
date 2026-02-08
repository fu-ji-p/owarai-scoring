-- ===== お笑い採点アプリ Supabase テーブル作成 =====
-- Supabase Dashboard → SQL Editor で実行してください

-- 1. Users テーブル
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_emoji TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Competitions テーブル
CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('m1', 'r1', 'koc')),
  year INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'scoring', 'closed')),
  broadcast_date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Rounds テーブル
CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  round_order INTEGER NOT NULL,
  scoring_type TEXT NOT NULL DEFAULT '100point' CHECK (scoring_type IN ('100point', 'ranking'))
);

-- 4. Performers テーブル
CREATE TABLE IF NOT EXISTS performers (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  performance_order INTEGER,
  display_label TEXT NOT NULL
);

-- 5. Scores テーブル
CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  performer_id TEXT NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  comment TEXT,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_realtime BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, performer_id)
);

-- 6. User Competition Status テーブル
CREATE TABLE IF NOT EXISTS user_competition_status (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  viewing_mode TEXT NOT NULL DEFAULT 'delayed' CHECK (viewing_mode IN ('realtime', 'delayed')),
  has_completed_scoring BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, competition_id)
);

-- ===== インデックス =====
CREATE INDEX IF NOT EXISTS idx_rounds_competition ON rounds(competition_id);
CREATE INDEX IF NOT EXISTS idx_performers_round ON performers(round_id);
CREATE INDEX IF NOT EXISTS idx_performers_competition ON performers(competition_id);
CREATE INDEX IF NOT EXISTS idx_scores_user ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_round ON scores(round_id);
CREATE INDEX IF NOT EXISTS idx_scores_competition ON scores(competition_id);
CREATE INDEX IF NOT EXISTS idx_scores_performer ON scores(performer_id);
CREATE INDEX IF NOT EXISTS idx_ucs_user_comp ON user_competition_status(user_id, competition_id);

-- ===== Row Level Security (RLS) =====
-- 全員が読み書きできるようにする（家族アプリなのでシンプルに）
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE performers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_competition_status ENABLE ROW LEVEL SECURITY;

-- anon ユーザーに全権限を付与（家族のみが使うアプリ）
CREATE POLICY "Allow all for users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for competitions" ON competitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for rounds" ON rounds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for performers" ON performers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for scores" ON scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for user_competition_status" ON user_competition_status FOR ALL USING (true) WITH CHECK (true);

-- ===== Realtime を有効化 =====
ALTER PUBLICATION supabase_realtime ADD TABLE competitions;
ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE performers;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
ALTER PUBLICATION supabase_realtime ADD TABLE user_competition_status;
