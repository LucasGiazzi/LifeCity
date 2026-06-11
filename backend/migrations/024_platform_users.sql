DO $$ BEGIN
    CREATE TYPE public.platform_role AS ENUM ('viewer', 'operator', 'admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.platform_users (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
    role       public.platform_role NOT NULL DEFAULT 'operator',
    is_active  boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_users_active
    ON public.platform_users (user_id) WHERE is_active;
