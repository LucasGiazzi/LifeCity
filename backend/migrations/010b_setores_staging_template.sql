-- Executar após revisão (opcional — só se preferir staging em vez de append direto)
-- ADR-001: template de staging para recarga de malhas.setores com SRID correto
--
-- Fluxo:
--   1) ogr2ogr cria/sobrescreve malhas.setores_staging (ver comentários no 010)
--   2) Rodar este script
--   3) Rodar 009 se precisar re-backfill complaints

CREATE TABLE IF NOT EXISTS malhas.setores_staging (
  ogc_fid   serial,
  cd_setor  varchar NOT NULL,
  cd_mun    varchar,
  geometry  geometry(MultiPolygon, 4326)
);

-- Após ogr2ogr popular setores_staging:
-- TRUNCATE malhas.setores;
--
-- INSERT INTO malhas.setores (cd_setor, cd_mun, geometry)
-- SELECT cd_setor, cd_mun, geometry
-- FROM malhas.setores_staging
-- ON CONFLICT (cd_setor) DO UPDATE
--   SET cd_mun = EXCLUDED.cd_mun,
--       geometry = EXCLUDED.geometry;
--
-- DROP TABLE malhas.setores_staging;
