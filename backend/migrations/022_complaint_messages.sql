DO $$ BEGIN
  CREATE TYPE complaint_message_sender AS ENUM ('citizen', 'municipality');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS complaint_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  sender_type complaint_message_sender NOT NULL,
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT CHECK (body IS NULL OR char_length(body) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_by_citizen_at TIMESTAMPTZ,
  read_by_municipality_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_complaint_messages_thread
  ON complaint_messages (complaint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaint_messages_tenant
  ON complaint_messages (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaint_messages_rate
  ON complaint_messages (complaint_id, sender_user_id, created_at DESC);
