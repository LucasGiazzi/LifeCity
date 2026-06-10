-- ADR-003 Fase 4a: colunas operacionais em complaints

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS assigned_ops_team_id uuid
    REFERENCES public.ops_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.complaints
    ADD CONSTRAINT complaints_priority_check CHECK (priority BETWEEN 1 AND 5);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_complaints_assigned_team
  ON public.complaints (assigned_ops_team_id);

CREATE INDEX IF NOT EXISTS idx_complaints_sla_due
  ON public.complaints (sla_due_at) WHERE sla_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_status_tenant
  ON public.complaints (tenant_id, status);
