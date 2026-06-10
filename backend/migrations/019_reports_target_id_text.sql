-- Denúncias referenciam complaint id (bigint) ou user id (uuid) — coluna text

ALTER TABLE public.reports
  ALTER COLUMN target_id TYPE text USING target_id::text;
