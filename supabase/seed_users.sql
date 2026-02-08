-- ===== 家族メンバーの初期データ =====
-- migration.sql を実行した後に、こちらを実行してください
-- PINハッシュは SHA-256 で生成済み

INSERT INTO users (id, name, avatar_emoji, pin_hash, is_admin) VALUES
  ('user-1', 'ひ', '🎸', '52c1d81tried', false),
  ('user-2', 'か', '🎹', 'placeholder', false),
  ('user-3', 'り', '📯', 'placeholder', false),
  ('user-4', 'た', '🎵', 'placeholder', false),
  ('user-5', 'こ', '🚗', 'placeholder', true),
  ('user-6', 'あ', '🌸', 'placeholder', false)
ON CONFLICT (id) DO NOTHING;

-- 注意: 上記のpin_hashは仮の値です。
-- アプリが初回起動時に正しいハッシュに自動更新します。
