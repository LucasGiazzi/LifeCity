-- ADR-001 / Campinas: staging para carga de UTB (bairros) e indicadores IBGE por setor
--
-- Fluxo UTB (pd2018_utbs.zip):
--   1) node scripts/import-campinas-malhas.js --utb-zip <path>
--   2) ogr2ogr → malhas_staging.utb_raw
--   3) script promove → malhas.bairros + malhas.utb_demografia
--
-- Fluxo setores IBGE (CSV):
--   1) node scripts/import-campinas-malhas.js --setores-dir <IBGE/Setores>
--   2) CSV filtrado (cd_setor LIKE '3509502%') → malhas_staging.setores_ibge_csv
--   3) script promove → malhas.setores_indicadores

CREATE SCHEMA IF NOT EXISTS malhas_staging;

-- ---------------------------------------------------------------------------
-- Staging bruto da shapefile UTB/UTR (ogr2ogr)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS malhas_staging.utb_raw (
    ogc_fid         serial PRIMARY KEY,
    gid             integer,
    utb_sigla       varchar(100),
    denominaca      varchar(255),
    densidade_      numeric,
    tot_pop         numeric,
    tot_dom         numeric,
    tot_pop_fa      numeric,
    rendatemei      numeric,
    rendmeioa1      numeric,
    rend1a2_sm      numeric,
    rend2a3_sm      numeric,
    rend3a5_sm      numeric,
    rend5a10_s      numeric,
    rend10a15_      numeric,
    rend15a20_      numeric,
    rendmaisd2      numeric,
    id              integer,
    rend_dompc      numeric,
    rend_dom_1      numeric,
    rend_dom_2      numeric,
    rend_dom_3      numeric,
    rend_dom_4      numeric,
    rend_dom_5      numeric,
    rend_dom_6      numeric,
    rend_dom_7      numeric,
    rend_dom_8      numeric,
    mulheres        numeric,
    homens          numeric,
    pessoas_al      numeric,
    pessoas__1      numeric,
    pessoas__2      numeric,
    pessoas__3      numeric,
    pessoas_0a      numeric,
    pessoas_5a      numeric,
    pessoas_10      numeric,
    pessoas_15      numeric,
    pessoas_20      numeric,
    pessoas_25      numeric,
    pessoas_30      numeric,
    pessoas_35      numeric,
    pessoas_40      numeric,
    pessoas_45      numeric,
    pessoas_50      numeric,
    pessoas_55      numeric,
    pessoas_60      numeric,
    pessoas_65      numeric,
    geometry        geometry(MultiPolygon, 4326)
);

CREATE INDEX IF NOT EXISTS idx_utb_raw_sigla
    ON malhas_staging.utb_raw (utb_sigla);

CREATE INDEX IF NOT EXISTS idx_utb_raw_geom
    ON malhas_staging.utb_raw USING gist (geometry);

-- ---------------------------------------------------------------------------
-- Staging genérico para CSVs IBGE por setor (colunas variáveis → jsonb)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS malhas_staging.setores_ibge_csv (
    dataset     varchar(80) NOT NULL,
    cd_setor    varchar(20) NOT NULL,
    cd_mun      varchar(7)  NOT NULL,
    indicadores jsonb       NOT NULL,
    imported_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dataset, cd_setor)
);

CREATE INDEX IF NOT EXISTS idx_setores_ibge_csv_mun
    ON malhas_staging.setores_ibge_csv (cd_mun);

-- ---------------------------------------------------------------------------
-- Camada analítica: demografia municipal UTB (Campinas PD2018)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS malhas.utb_demografia (
    cd_bairro           varchar(20) PRIMARY KEY,
    cd_mun              char(7)     NOT NULL DEFAULT '3509502',
    utb_sigla           varchar(100) NOT NULL,
    utb_tipo            varchar(20),
    nm_bairro           varchar(255),
    densidade_hab_km2   numeric,
    tot_pop             numeric,
    tot_dom             numeric,
    tot_pop_fa          numeric,
    renda_ate_meio_sm   numeric,
    renda_meio_a_1_sm   numeric,
    renda_1_a_2_sm      numeric,
    renda_2_a_3_sm      numeric,
    renda_3_a_5_sm      numeric,
    renda_5_a_10_sm     numeric,
    renda_10_a_15_sm    numeric,
    renda_15_a_20_sm    numeric,
    renda_mais_20_sm    numeric,
    dom_renda_pc        numeric,
    dom_renda_f1        numeric,
    dom_renda_f2        numeric,
    dom_renda_f3        numeric,
    dom_renda_f4        numeric,
    dom_renda_f5        numeric,
    dom_renda_f6        numeric,
    dom_renda_f7        numeric,
    dom_renda_f8        numeric,
    mulheres            numeric,
    homens              numeric,
    escolaridade_al     numeric,
    escolaridade_f1     numeric,
    escolaridade_f2     numeric,
    escolaridade_f3     numeric,
    idade_0_4           numeric,
    idade_5_9           numeric,
    idade_10_14         numeric,
    idade_15_19         numeric,
    idade_20_24         numeric,
    idade_25_29         numeric,
    idade_30_34         numeric,
    idade_35_39         numeric,
    idade_40_44         numeric,
    idade_45_49         numeric,
    idade_50_54         numeric,
    idade_55_59         numeric,
    idade_60_64         numeric,
    idade_65_mais       numeric,
    source              varchar(50) NOT NULL DEFAULT 'pd2018_utb',
    source_year         integer     NOT NULL DEFAULT 2018,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_utb_demografia_sigla UNIQUE (utb_sigla)
);

CREATE INDEX IF NOT EXISTS idx_utb_demografia_mun
    ON malhas.utb_demografia (cd_mun);

-- ---------------------------------------------------------------------------
-- Camada analítica: indicadores IBGE por setor censitário (jsonb flexível)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS malhas.setores_indicadores (
    cd_setor    varchar(20) NOT NULL,
    cd_mun      varchar(7)  NOT NULL,
    dataset     varchar(80) NOT NULL,
    indicadores jsonb       NOT NULL,
    source      varchar(100),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (cd_setor, dataset)
);

CREATE INDEX IF NOT EXISTS idx_setores_indicadores_mun
    ON malhas.setores_indicadores (cd_mun);

CREATE INDEX IF NOT EXISTS idx_setores_indicadores_dataset
    ON malhas.setores_indicadores (dataset);

-- Upsert idempotente em malhas.bairros (Campinas)
CREATE UNIQUE INDEX IF NOT EXISTS uq_malhas_bairros_mun_cd
    ON malhas.bairros (cd_mun, cd_bairro);

-- Ajustes idempotentes (tabela pode ter sido criada em versão anterior)
ALTER TABLE malhas_staging.utb_raw
    ALTER COLUMN utb_sigla TYPE varchar(100);

ALTER TABLE malhas.utb_demografia
    ALTER COLUMN utb_sigla TYPE varchar(100),
    ALTER COLUMN utb_tipo TYPE varchar(20);
