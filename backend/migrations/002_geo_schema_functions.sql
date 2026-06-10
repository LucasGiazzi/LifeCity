-- Executar após revisão
-- ADR-001 Fase 1: schema geo com funções espaciais (resolve + point_from_latlng)

CREATE SCHEMA IF NOT EXISTS geo;

CREATE OR REPLACE FUNCTION geo.point_from_latlng(p_lat text, p_lng text)
RETURNS geometry(Point, 4326) AS $$
  SELECT CASE
    WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL
    WHEN p_lat !~ '^-?[0-9]+(\.[0-9]+)?$' THEN NULL
    WHEN p_lng !~ '^-?[0-9]+(\.[0-9]+)?$' THEN NULL
    ELSE ST_SetSRID(ST_MakePoint(p_lng::float8, p_lat::float8), 4326)
  END;
$$ LANGUAGE sql IMMUTABLE;

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
