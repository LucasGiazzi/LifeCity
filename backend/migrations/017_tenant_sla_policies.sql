-- ADR-003 Fase 4a: SLA configurável por tenant e categoria

CREATE TABLE IF NOT EXISTS public.tenant_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.complaint_categories(id) ON DELETE CASCADE,
  response_hours integer NOT NULL CHECK (response_hours > 0),
  resolution_hours integer NOT NULL CHECK (resolution_hours > 0),
  business_hours_only boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_sla_policies_tenant
  ON public.tenant_sla_policies (tenant_id) WHERE is_active;
