-- Executar após revisão
-- ADR-001 Fase 1: colunas aditivas nullable em complaints + índices tenant/geo

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants (id),
  ADD COLUMN IF NOT EXISTS cd_mun char(7) REFERENCES malhas.municipios (cd_mun),
  ADD COLUMN IF NOT EXISTS cd_setor varchar REFERENCES malhas.setores (cd_setor),
  ADD COLUMN IF NOT EXISTS cd_bairro varchar,
  ADD COLUMN IF NOT EXISTS location geometry(Point, 4326);

CREATE INDEX IF NOT EXISTS idx_complaints_tenant_id ON public.complaints (tenant_id);
CREATE INDEX IF NOT EXISTS idx_complaints_cd_mun ON public.complaints (cd_mun);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON public.complaints USING GIST (location);
