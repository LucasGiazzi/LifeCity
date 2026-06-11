CREATE TABLE IF NOT EXISTS public.platform_audit_log (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    uuid NOT NULL REFERENCES public.users (id) ON DELETE SET NULL,
    action      text NOT NULL,
    target_type text NOT NULL,
    target_id   text NOT NULL,
    tenant_id   uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
    payload     jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_tenant
    ON public.platform_audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_actor
    ON public.platform_audit_log (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_action
    ON public.platform_audit_log (action, created_at DESC);
