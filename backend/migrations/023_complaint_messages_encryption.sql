CREATE TABLE IF NOT EXISTS complaint_message_keys (
  complaint_id BIGINT PRIMARY KEY REFERENCES complaints(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  encrypted_key BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE complaint_messages
  ADD COLUMN IF NOT EXISTS body_ciphertext BYTEA,
  ADD COLUMN IF NOT EXISTS body_nonce BYTEA;

CREATE TABLE IF NOT EXISTS complaint_message_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES complaint_messages(id) ON DELETE CASCADE,
  accessor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_message_access_log_message
  ON complaint_message_access_log (message_id, created_at DESC);
