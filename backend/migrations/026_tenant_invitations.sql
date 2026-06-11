CREATE TABLE IF NOT EXISTS public.tenant_invitations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    email       text NOT NULL,
    role        public.tenant_role NOT NULL DEFAULT 'admin',
    token_hash  text NOT NULL,
    invited_by  uuid NOT NULL REFERENCES public.users (id) ON DELETE SET NULL,
    expires_at  timestamptz NOT NULL,
    accepted_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tenant_invitations_unique_pending UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token
    ON public.tenant_invitations (token_hash)
    WHERE accepted_at IS NULL;
