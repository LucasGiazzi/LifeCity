-- Executar após revisão
-- ADR-001 Fase 1: constraints e índices em malhas.* (pré-requisito para FKs municipais)

-- Tornar cd_mun referenciável
ALTER TABLE malhas.municipios
  ALTER COLUMN cd_mun SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_malhas_municipios_cd_mun
  ON malhas.municipios (cd_mun);

CREATE INDEX IF NOT EXISTS idx_malhas_bairros_cd_mun
  ON malhas.bairros (cd_mun);

-- setores: idx já existe (idx_setores_cd_mun)
