-- Enums (padrão tenant_role / ops_team_role)
DO $$ BEGIN
  CREATE TYPE complaint_watch_level AS ENUM ('basic', 'full');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE complaint_watch_source AS ENUM ('creator', 'like', 'witness', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS complaint_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level complaint_watch_level NOT NULL,
  source complaint_watch_source NOT NULL,
  muted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (complaint_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_complaint_watchers_complaint
  ON complaint_watchers (complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_watchers_user
  ON complaint_watchers (user_id);
CREATE INDEX IF NOT EXISTS idx_complaint_watchers_notify
  ON complaint_watchers (complaint_id, level) WHERE muted_at IS NULL;

CREATE TABLE IF NOT EXISTS user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('android', 'ios')),
  app_version VARCHAR(20),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON user_device_tokens (user_id);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS payload JSONB;

-- Backfill watchers a partir de dados existentes
INSERT INTO complaint_watchers (complaint_id, user_id, level, source)
SELECT c.id, c.created_by, 'full', 'creator'
FROM complaints c WHERE c.created_by IS NOT NULL
ON CONFLICT (complaint_id, user_id) DO NOTHING;

INSERT INTO complaint_watchers (complaint_id, user_id, level, source)
SELECT cw.complaint_id::bigint, cw.user_id, 'full', 'witness'
FROM complaint_witnesses cw
ON CONFLICT (complaint_id, user_id) DO UPDATE
  SET level = 'full', source = 'witness', updated_at = NOW();

INSERT INTO complaint_watchers (complaint_id, user_id, level, source)
SELECT cl.complaint_id::bigint, cl.user_id, 'basic', 'like'
FROM complaint_likes cl
WHERE NOT EXISTS (
  SELECT 1 FROM complaint_witnesses cw
  WHERE cw.complaint_id = cl.complaint_id AND cw.user_id = cl.user_id
)
ON CONFLICT (complaint_id, user_id) DO NOTHING;
