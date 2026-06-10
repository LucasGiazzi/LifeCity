-- Executar após revisão
-- ADR-001 Fase 1: tenants operacionais + RBAC municipal (tenant_members)
-- RLS permanece desabilitado nesta fase (isolamento admin via backend JWT na Fase 2)

CREATE TYPE public.tenant_role AS ENUM (
  'owner', 'admin', 'operator', 'viewer'
);

CREATE TABLE public.tenants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cd_mun       char(7) NOT NULL,
  slug         text NOT NULL,
  display_name text NOT NULL,
  status       text NOT NULL DEFAULT 'trial'
               CHECK (status IN ('trial', 'active', 'suspended')),
  settings     jsonb NOT NULL DEFAULT '{}',
  activated_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_cd_mun_fkey
    FOREIGN KEY (cd_mun) REFERENCES malhas.municipios (cd_mun),
  CONSTRAINT tenants_cd_mun_unique UNIQUE (cd_mun),
  CONSTRAINT tenants_slug_unique UNIQUE (slug)
);

CREATE TABLE public.tenant_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  role       public.tenant_role NOT NULL DEFAULT 'operator',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_members_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_user ON public.tenant_members (user_id);
CREATE INDEX idx_tenant_members_tenant ON public.tenant_members (tenant_id);
