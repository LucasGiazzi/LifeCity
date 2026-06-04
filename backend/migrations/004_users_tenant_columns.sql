-- Executar após revisão
-- ADR-001 Fase 1: colunas aditivas nullable em users (Fase 3 tornará home_cd_mun obrigatório)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS home_cd_mun char(7)
    REFERENCES malhas.municipios (cd_mun),
  ADD COLUMN IF NOT EXISTS registration_address text,
  ADD COLUMN IF NOT EXISTS address_confirmed_at timestamptz;
