-- ADR-003 Fase 4a: equipes operacionais municipais (≠ teams de gamificação)

DO $$ BEGIN
  CREATE TYPE public.ops_team_role AS ENUM ('lead', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.ops_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  slug text NOT NULL,
  description text,
  default_category_ids uuid[] NOT NULL DEFAULT '{}',
  default_cd_bairros varchar[] NOT NULL DEFAULT '{}',
  contact_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.ops_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ops_team_id uuid NOT NULL REFERENCES public.ops_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.ops_team_role NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ops_team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ops_teams_tenant
  ON public.ops_teams (tenant_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_ops_team_members_user
  ON public.ops_team_members (user_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_ops_team_members_team
  ON public.ops_team_members (ops_team_id) WHERE is_active;
