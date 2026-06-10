-- Nível de utilizador: 1 = normal (app); >1 = acesso ao painel administrativo (admin-web).
-- Executar na base Supabase/Postgres após a tabela users existir.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_level INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.users.user_level IS '1 = utilizador normal; >1 = permissões administrativas no painel';
