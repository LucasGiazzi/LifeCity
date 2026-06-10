-- ADR-003 Fase 4a: audit trail de ações administrativas

CREATE TABLE IF NOT EXISTS public.complaint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id bigint NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  event_type varchar(50) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT complaint_events_type_check CHECK (
    event_type IN (
      'status_change', 'assignment', 'note', 'priority_change', 'sla_breach', 'moderation'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_complaint_events_complaint
  ON public.complaint_events (complaint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaint_events_tenant
  ON public.complaint_events (tenant_id, created_at DESC);
