-- Executar após revisão
-- ADR-001: corrigir SRID de malhas.setores na própria coluna
--
-- POR QUE SRID 0 COM ogr2ogr -t_srs EPSG:4326?
--   -t_srs reprojeta as COORDENADAS para WGS84, mas o SRID gravado no WKB depende
--   da definição da coluna de destino em geometry_columns.
--   malhas.municipios e malhas.bairros: geometry(MultiPolygon, 4326)  → SRID 4326
--   malhas.setores (atual):        geometry (sem typmod)             → SRID 0
--   Com -append numa coluna genérica, o PostGIS aceita os pontos corretos mas
--   metadata SRID fica 0 → ST_Contains falha contra pontos 4326 das complaints.
--
-- FIX (in-place, sem reproject — coords já estão em WGS84):
--   ST_SetSRID só atribui metadata; não altera lat/lng.
--   ALTER ... TYPE geometry(MultiPolygon, 4326) registra typmod e evita recarga futura com SRID 0.
--
-- ORDEM: rodar ESTE script ANTES do 009_backfill_complaints_missing_geo.sql
--
-- Se tiver aplicado versão anterior com geo.ensure_srid4326, o DROP abaixo remove.
DROP FUNCTION IF EXISTS geo.ensure_srid4326(geometry);
--
-- OGR2OGR — próximas cargas (escolha A ou B):
--
-- A) Append na tabela já tipada (após este script):
--    ogr2ogr ... -nln malhas.setores -nlt PROMOTE_TO_MULTI \
--      -lco GEOMETRY_NAME=geometry -t_srs EPSG:4326 -append ...
--
-- B) Staging (reload completo ou carga isolada):
--    ogr2ogr ... -nln malhas.setores_staging -nlt PROMOTE_TO_MULTI \
--      -lco GEOMETRY_NAME=geometry -lco SRID=4326 -t_srs EPSG:4326 \
--      -overwrite -where "SUBSTR(CD_SETOR, 1, 2) = '35'" ...
--    Depois:
--      TRUNCATE malhas.setores;
--      INSERT INTO malhas.setores (cd_setor, cd_mun, geometry)
--        SELECT cd_setor, cd_mun, geometry FROM malhas.setores_staging;
--      DROP TABLE malhas.setores_staging;

-- ---------------------------------------------------------------------------
-- 1) Atribuir SRID 4326 aos registros existentes (mesma coluna, coords intactas)
-- ---------------------------------------------------------------------------
UPDATE malhas.setores
SET geometry = ST_SetSRID(geometry, 4326)
WHERE geometry IS NOT NULL
  AND ST_SRID(geometry) = 0;

-- ---------------------------------------------------------------------------
-- 2) Tipar coluna como MultiPolygon 4326 (igual municipios/bairros)
-- ---------------------------------------------------------------------------
ALTER TABLE malhas.setores
  ALTER COLUMN geometry TYPE geometry(MultiPolygon, 4326)
  USING ST_SetSRID(
    CASE
      WHEN GeometryType(geometry) = 'POLYGON' THEN ST_Multi(geometry)
      ELSE geometry
    END,
    4326
  );

-- ---------------------------------------------------------------------------
-- 3) Validar
-- ---------------------------------------------------------------------------
-- SELECT type, srid FROM geometry_columns
--   WHERE f_table_schema = 'malhas' AND f_table_name = 'setores';
-- Esperado: MULTIPOLYGON, 4326
--
-- SELECT ST_SRID(geometry), COUNT(*) FROM malhas.setores GROUP BY 1;
-- Esperado: só 4326
--
-- SELECT geo.resolve_cd_setor(
--   ST_SetSRID(ST_MakePoint(-47.0502282, -22.8919745), 4326),
--   '3509502'::char(7)
-- );
-- Esperado: cd_setor (não erro de mixed SRID)

-- ---------------------------------------------------------------------------
-- 4) Restaurar funções geo sem workaround de SRID 0 (igual 002)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION geo.resolve_cd_mun(p_point geometry)
RETURNS char(7) AS $$
  SELECT m.cd_mun::char(7)
  FROM malhas.municipios m
  WHERE p_point IS NOT NULL
    AND ST_Contains(m.geometry, p_point)
  LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION geo.resolve_cd_bairro(p_point geometry, p_cd_mun char(7))
RETURNS varchar AS $$
  SELECT b.cd_bairro
  FROM malhas.bairros b
  WHERE p_cd_mun IS NOT NULL AND p_point IS NOT NULL
    AND b.cd_mun = p_cd_mun::varchar
    AND ST_Contains(b.geometry, p_point)
  LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION geo.resolve_cd_setor(p_point geometry, p_cd_mun char(7))
RETURNS varchar AS $$
  SELECT s.cd_setor
  FROM malhas.setores s
  WHERE p_cd_mun IS NOT NULL AND p_point IS NOT NULL
    AND s.cd_mun = p_cd_mun::varchar
    AND ST_Contains(s.geometry, p_point)
  LIMIT 1;
$$ LANGUAGE sql STABLE;
