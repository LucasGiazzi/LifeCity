/**
 * Importação de malhas territoriais — Campinas
 *
 * 1) UTB/UTR (pd2018_utbs.zip) → malhas_staging.utb_raw → malhas.bairros + malhas.utb_demografia
 * 2) CSVs IBGE por setor → malhas_staging.setores_ibge_csv → malhas.setores_indicadores
 *
 * Pré-requisitos:
 *   - migration 020 aplicada
 *   - ogr2ogr no PATH (GDAL)
 *   - variáveis SUPABASE_DB_* no .env
 *
 * Uso:
 *   node scripts/import-campinas-malhas.js --utb-zip "C:\\Users\\berna\\Downloads\\pd2018_utbs.zip"
 *   node scripts/import-campinas-malhas.js --setores-dir "C:\\Users\\berna\\Downloads\\IBGE\\Setores"
 *   node scripts/import-campinas-malhas.js --utb-zip ... --setores-dir ... --backfill-complaints
 *   node scripts/import-campinas-malhas.js --promote-only
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execFileSync, spawnSync } = require('child_process');
const supabasePool = require('../src/infra/supabasePool');

const CD_MUN = '3509502';
const NM_MUN = 'Campinas';
const CD_UF = '35';
const NM_UF = 'São Paulo';
const CD_REGIAO = '3';
const NM_REGIAO = 'Sudeste';

const SETOR_CSV_DATASETS = {
    'Agregados_por_setores_renda_responsavel_BR_UTF8.csv': 'renda_responsavel',
    'Agregados_por_setores_caracteristicas_domicilios_BR_UTF8.csv': 'caracteristicas_domicilios',
    'Agregados_por_setores_demografia_BR_UTF8.csv': 'demografia',
};

function parseArgs(argv) {
    const args = {
        utbZip: null,
        setoresDir: null,
        promoteOnly: false,
        skipOgr: false,
        backfillComplaints: false,
        cdMun: CD_MUN,
    };

    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--utb-zip') {
            args.utbZip = argv[++i];
        } else if (arg === '--setores-dir') {
            args.setoresDir = argv[++i];
        } else if (arg === '--promote-only') {
            args.promoteOnly = true;
        } else if (arg === '--skip-ogr') {
            args.skipOgr = true;
        } else if (arg === '--backfill-complaints') {
            args.backfillComplaints = true;
        } else if (arg === '--cd-mun') {
            args.cdMun = argv[++i];
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        } else {
            throw new Error(`Argumento desconhecido: ${arg}`);
        }
    }

    return args;
}

function printHelp() {
    console.log(`
Import Campinas malhas

  --utb-zip <path>         ZIP ou diretório com pd2018_utb.shp
  --setores-dir <path>     Pasta IBGE/Setores com CSVs agregados
  --promote-only           Só promove staging → produção
  --skip-ogr               Pula ogr2ogr (staging UTB já carregado)
  --backfill-complaints    Recalcula complaints.cd_bairro em Campinas
  --cd-mun <code>          Código IBGE do município (default 3509502)
`);
}

function ensureFile(filePath, label) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`${label} não encontrado: ${filePath}`);
    }
}

function runOgrToGeoJson(shapefilePath, geojsonPath) {
    console.log('[ogr2ogr] Convertendo UTB para GeoJSON ...');
    const args = [
        '-overwrite',
        '-f', 'GeoJSON',
        geojsonPath,
        shapefilePath,
        '-t_srs', 'EPSG:4326',
    ];

    const result = spawnSync('ogr2ogr', args, { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`ogr2ogr falhou:\n${result.stderr || result.stdout}`);
    }
    console.log('[ogr2ogr] OK');
}

const UTB_STAGING_FIELDS = [
    'densidade_', 'tot_pop', 'tot_dom', 'tot_pop_fa',
    'rendatemei', 'rendmeioa1', 'rend1a2_sm', 'rend2a3_sm', 'rend3a5_sm',
    'rend5a10_s', 'rend10a15_', 'rend15a20_', 'rendmaisd2',
    'id',
    'rend_dompc', 'rend_dom_1', 'rend_dom_2', 'rend_dom_3', 'rend_dom_4',
    'rend_dom_5', 'rend_dom_6', 'rend_dom_7', 'rend_dom_8',
    'mulheres', 'homens',
    'pessoas_al', 'pessoas__1', 'pessoas__2', 'pessoas__3',
    'pessoas_0a', 'pessoas_5a', 'pessoas_10', 'pessoas_15', 'pessoas_20',
    'pessoas_25', 'pessoas_30', 'pessoas_35', 'pessoas_40', 'pessoas_45',
    'pessoas_50', 'pessoas_55', 'pessoas_60', 'pessoas_65',
];

function normalizePropertyKey(key) {
    return String(key || '').toLowerCase();
}

function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(String(value).replace(',', '.'));
    return Number.isFinite(num) ? num : null;
}

function geometryToMultiPolygonWkt(geometry) {
    if (!geometry) return null;

    if (geometry.type === 'Polygon') {
        const rings = geometry.coordinates
            .map((ring) => `(${ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ')})`)
            .join(', ');
        return `MULTIPOLYGON((${rings}))`;
    }

    if (geometry.type === 'MultiPolygon') {
        const polys = geometry.coordinates
            .map((poly) => {
                const rings = poly
                    .map((ring) => `(${ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ')})`)
                    .join(', ');
                return `(${rings})`;
            })
            .join(', ');
        return `MULTIPOLYGON(${polys})`;
    }

    throw new Error(`Geometria não suportada: ${geometry.type}`);
}

async function loadUtbGeoJson(pool, geojsonPath) {
    console.log('[staging] Carregando malhas_staging.utb_raw via GeoJSON ...');
    const raw = fs.readFileSync(geojsonPath, 'utf8');
    const geojson = JSON.parse(raw);
    const features = geojson.features || [];

    if (features.length === 0) {
        throw new Error('GeoJSON UTB sem features');
    }

    await pool.query('TRUNCATE malhas_staging.utb_raw RESTART IDENTITY');

    const batchSize = 100;
    for (let i = 0; i < features.length; i += batchSize) {
        const chunk = features.slice(i, i + batchSize);
        const values = [];
        const placeholders = chunk.map((feature, idx) => {
            const props = {};
            for (const [key, value] of Object.entries(feature.properties || {})) {
                props[normalizePropertyKey(key)] = value;
            }

            const scalarCount = 3 + UTB_STAGING_FIELDS.length;
            const base = idx * (scalarCount + 1);
            const rowValues = [
                props.gid ?? null,
                props.utb_sigla ?? null,
                props.denominaca ?? null,
                ...UTB_STAGING_FIELDS.map((field) => toNumber(props[field])),
                geometryToMultiPolygonWkt(feature.geometry),
            ];
            values.push(...rowValues);

            const slots = [];
            for (let j = 0; j < scalarCount; j += 1) {
                slots.push(`$${base + j + 1}`);
            }
            slots.push(`ST_SetSRID(ST_GeomFromText($${base + scalarCount + 1}), 4326)`);
            return `(${slots.join(', ')})`;
        });

        await pool.query(`
            INSERT INTO malhas_staging.utb_raw (
                gid, utb_sigla, denominaca,
                densidade_, tot_pop, tot_dom, tot_pop_fa,
                rendatemei, rendmeioa1, rend1a2_sm, rend2a3_sm, rend3a5_sm,
                rend5a10_s, rend10a15_, rend15a20_, rendmaisd2,
                id,
                rend_dompc, rend_dom_1, rend_dom_2, rend_dom_3, rend_dom_4,
                rend_dom_5, rend_dom_6, rend_dom_7, rend_dom_8,
                mulheres, homens,
                pessoas_al, pessoas__1, pessoas__2, pessoas__3,
                pessoas_0a, pessoas_5a, pessoas_10, pessoas_15, pessoas_20,
                pessoas_25, pessoas_30, pessoas_35, pessoas_40, pessoas_45,
                pessoas_50, pessoas_55, pessoas_60, pessoas_65,
                geometry
            ) VALUES ${placeholders.join(', ')}
        `, values);
    }

    const count = await countRows(pool, 'SELECT COUNT(*)::int AS count FROM malhas_staging.utb_raw');
    console.log(`[staging] OK — ${count} linhas`);
}

function resolveShapefile(inputPath) {
    ensureFile(inputPath, 'Arquivo UTB');
    const stat = fs.statSync(inputPath);

    if (stat.isDirectory()) {
        const shp = fs.readdirSync(inputPath).find((f) => f.toLowerCase().endsWith('.shp'));
        if (!shp) throw new Error(`Nenhum .shp em ${inputPath}`);
        return path.join(inputPath, shp);
    }

    if (inputPath.toLowerCase().endsWith('.zip')) {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecity-utb-'));
        if (process.platform === 'win32') {
            execFileSync('powershell', [
                '-NoProfile',
                '-Command',
                `Expand-Archive -Path '${inputPath.replace(/'/g, "''")}' -DestinationPath '${tmpDir.replace(/'/g, "''")}' -Force`,
            ], { stdio: 'inherit' });
        } else {
            execFileSync('unzip', ['-o', inputPath, '-d', tmpDir], { stdio: 'inherit' });
        }
        return resolveShapefile(tmpDir);
    }

    if (inputPath.toLowerCase().endsWith('.shp')) {
        return inputPath;
    }

    throw new Error(`Formato UTB não suportado: ${inputPath}`);
}

function runOgr2ogr(shapefilePath, geojsonPath) {
    runOgrToGeoJson(shapefilePath, geojsonPath);
}

async function countRows(pool, query, params = []) {
    const { rows } = await pool.query(query, params);
    return Number(rows[0].count);
}

async function promoteUtb(pool, cdMun) {
    console.log('[promote] UTB → malhas.bairros + malhas.utb_demografia ...');

    const stagingCount = await countRows(
        pool,
        'SELECT COUNT(*)::int AS count FROM malhas_staging.utb_raw WHERE utb_sigla IS NOT NULL'
    );
    if (stagingCount === 0) {
        throw new Error('malhas_staging.utb_raw está vazio — rode ogr2ogr primeiro');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query('DELETE FROM malhas.utb_demografia WHERE cd_mun = $1', [cdMun]);
        await client.query('DELETE FROM malhas.bairros WHERE cd_mun = $1', [cdMun]);

        await client.query(`
            WITH utb_base AS (
                SELECT DISTINCT ON (utb_sigla)
                    utb_sigla,
                    denominaca,
                    densidade_,
                    tot_pop,
                    tot_dom,
                    tot_pop_fa,
                    rendatemei,
                    rendmeioa1,
                    rend1a2_sm,
                    rend2a3_sm,
                    rend3a5_sm,
                    rend5a10_s,
                    rend10a15_,
                    rend15a20_,
                    rendmaisd2,
                    rend_dompc,
                    rend_dom_1,
                    rend_dom_2,
                    rend_dom_3,
                    rend_dom_4,
                    rend_dom_5,
                    rend_dom_6,
                    rend_dom_7,
                    rend_dom_8,
                    mulheres,
                    homens,
                    pessoas_al,
                    pessoas__1,
                    pessoas__2,
                    pessoas__3,
                    pessoas_0a,
                    pessoas_5a,
                    pessoas_10,
                    pessoas_15,
                    pessoas_20,
                    pessoas_25,
                    pessoas_30,
                    pessoas_35,
                    pessoas_40,
                    pessoas_45,
                    pessoas_50,
                    pessoas_55,
                    pessoas_60,
                    pessoas_65
                FROM malhas_staging.utb_raw
                WHERE utb_sigla IS NOT NULL
                  AND btrim(utb_sigla) <> ''
                ORDER BY utb_sigla, ogc_fid
            ),
            utb_ranked AS (
                SELECT
                    utb_sigla,
                    denominaca,
                    ROW_NUMBER() OVER (ORDER BY utb_sigla) AS seq,
                    $1::varchar || lpad(ROW_NUMBER() OVER (ORDER BY utb_sigla)::text, 3, '0') AS cd_bairro
                FROM utb_base
            ),
            utb_geom AS (
                SELECT
                    utb_sigla,
                    ST_Multi(ST_UnaryUnion(ST_Collect(geometry))) AS geometry
                FROM malhas_staging.utb_raw
                WHERE utb_sigla IS NOT NULL
                  AND geometry IS NOT NULL
                GROUP BY utb_sigla
            )
            INSERT INTO malhas.bairros (
                cd_regiao, nm_regiao, cd_uf, nm_uf, cd_mun, nm_mun,
                cd_dist, nm_dist, cd_subdist, nm_subdist,
                cd_bairro, nm_bairro, geometry
            )
            SELECT
                $2, $3, $4, $5, $1, $6,
                NULL, NULL, NULL, NULL,
                r.cd_bairro,
                btrim(regexp_replace(b.denominaca, '\\s+', ' ', 'g')),
                g.geometry
            FROM utb_ranked r
            JOIN utb_base b ON b.utb_sigla = r.utb_sigla
            JOIN utb_geom g ON g.utb_sigla = r.utb_sigla
        `, [cdMun, CD_REGIAO, NM_REGIAO, CD_UF, NM_UF, NM_MUN]);

        await client.query(`
            WITH utb_base AS (
                SELECT DISTINCT ON (utb_sigla)
                    utb_sigla,
                    denominaca,
                    densidade_,
                    tot_pop,
                    tot_dom,
                    tot_pop_fa,
                    rendatemei,
                    rendmeioa1,
                    rend1a2_sm,
                    rend2a3_sm,
                    rend3a5_sm,
                    rend5a10_s,
                    rend10a15_,
                    rend15a20_,
                    rendmaisd2,
                    rend_dompc,
                    rend_dom_1,
                    rend_dom_2,
                    rend_dom_3,
                    rend_dom_4,
                    rend_dom_5,
                    rend_dom_6,
                    rend_dom_7,
                    rend_dom_8,
                    mulheres,
                    homens,
                    pessoas_al,
                    pessoas__1,
                    pessoas__2,
                    pessoas__3,
                    pessoas_0a,
                    pessoas_5a,
                    pessoas_10,
                    pessoas_15,
                    pessoas_20,
                    pessoas_25,
                    pessoas_30,
                    pessoas_35,
                    pessoas_40,
                    pessoas_45,
                    pessoas_50,
                    pessoas_55,
                    pessoas_60,
                    pessoas_65
                FROM malhas_staging.utb_raw
                WHERE utb_sigla IS NOT NULL
                  AND btrim(utb_sigla) <> ''
                ORDER BY utb_sigla, ogc_fid
            ),
            utb_ranked AS (
                SELECT
                    utb_sigla,
                    $1::varchar || lpad(ROW_NUMBER() OVER (ORDER BY utb_sigla)::text, 3, '0') AS cd_bairro
                FROM utb_base
            )
            INSERT INTO malhas.utb_demografia (
                cd_bairro, cd_mun, utb_sigla, utb_tipo, nm_bairro, densidade_hab_km2,
                tot_pop, tot_dom, tot_pop_fa,
                renda_ate_meio_sm, renda_meio_a_1_sm, renda_1_a_2_sm, renda_2_a_3_sm,
                renda_3_a_5_sm, renda_5_a_10_sm, renda_10_a_15_sm, renda_15_a_20_sm, renda_mais_20_sm,
                dom_renda_pc, dom_renda_f1, dom_renda_f2, dom_renda_f3, dom_renda_f4,
                dom_renda_f5, dom_renda_f6, dom_renda_f7, dom_renda_f8,
                mulheres, homens,
                escolaridade_al, escolaridade_f1, escolaridade_f2, escolaridade_f3,
                idade_0_4, idade_5_9, idade_10_14, idade_15_19, idade_20_24, idade_25_29,
                idade_30_34, idade_35_39, idade_40_44, idade_45_49, idade_50_54,
                idade_55_59, idade_60_64, idade_65_mais,
                source, source_year, updated_at
            )
            SELECT
                r.cd_bairro,
                $1,
                b.utb_sigla,
                CASE
                    WHEN b.utb_sigla LIKE 'UTR%' THEN 'UTR'
                    ELSE btrim(split_part(b.utb_sigla, '-', 1))
                END,
                btrim(regexp_replace(b.denominaca, '\\s+', ' ', 'g')),
                b.densidade_,
                b.tot_pop, b.tot_dom, b.tot_pop_fa,
                b.rendatemei, b.rendmeioa1, b.rend1a2_sm, b.rend2a3_sm,
                b.rend3a5_sm, b.rend5a10_s, b.rend10a15_, b.rend15a20_, b.rendmaisd2,
                b.rend_dompc, b.rend_dom_1, b.rend_dom_2, b.rend_dom_3, b.rend_dom_4,
                b.rend_dom_5, b.rend_dom_6, b.rend_dom_7, b.rend_dom_8,
                b.mulheres, b.homens,
                b.pessoas_al, b.pessoas__1, b.pessoas__2, b.pessoas__3,
                b.pessoas_0a, b.pessoas_5a, b.pessoas_10, b.pessoas_15, b.pessoas_20,
                b.pessoas_25, b.pessoas_30, b.pessoas_35, b.pessoas_40, b.pessoas_45,
                b.pessoas_50, b.pessoas_55, b.pessoas_60, b.pessoas_65,
                'pd2018_utb', 2018, now()
            FROM utb_ranked r
            JOIN utb_base b ON b.utb_sigla = r.utb_sigla
        `, [cdMun]);

        await client.query('COMMIT');

        const bairros = await countRows(
            pool,
            'SELECT COUNT(*)::int AS count FROM malhas.bairros WHERE cd_mun = $1',
            [cdMun]
        );
        const demo = await countRows(
            pool,
            'SELECT COUNT(*)::int AS count FROM malhas.utb_demografia WHERE cd_mun = $1',
            [cdMun]
        );
        console.log(`[promote] OK — bairros=${bairros}, utb_demografia=${demo}`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

function parseCsvLine(line, delimiter = ';') {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === delimiter && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

async function importSetorCsv(pool, filePath, dataset, cdMun) {
    console.log(`[csv] ${path.basename(filePath)} → staging (${dataset}) ...`);

    const rl = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: 'utf8' }),
        crlfDelay: Infinity,
    });

    let header = null;
    let imported = 0;
    let scanned = 0;
    const batch = [];
    const batchSize = 500;

    async function flushBatch() {
        if (batch.length === 0) return;
        const values = [];
        const placeholders = batch.map((row, idx) => {
            const base = idx * 4;
            values.push(row.dataset, row.cd_setor, row.cd_mun, JSON.stringify(row.indicadores));
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::jsonb, now())`;
        });

        await pool.query(`
            INSERT INTO malhas_staging.setores_ibge_csv (dataset, cd_setor, cd_mun, indicadores, imported_at)
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (dataset, cd_setor) DO UPDATE SET
                cd_mun = EXCLUDED.cd_mun,
                indicadores = EXCLUDED.indicadores,
                imported_at = now()
        `, values);
        imported += batch.length;
        batch.length = 0;
    }

    for await (const line of rl) {
        if (!line.trim()) continue;
        if (!header) {
            header = parseCsvLine(line);
            if (header[0].toUpperCase() !== 'CD_SETOR') {
                throw new Error(`CSV inválido (${filePath}): primeira coluna deve ser CD_SETOR`);
            }
            continue;
        }

        scanned += 1;
        const cols = parseCsvLine(line);
        const cdSetor = cols[0];
        if (!cdSetor.startsWith(cdMun)) continue;

        const indicadores = {};
        for (let i = 1; i < header.length; i += 1) {
            const key = header[i];
            const raw = cols[i];
            if (raw === undefined || raw === '') continue;
            const num = Number(String(raw).replace(',', '.'));
            indicadores[key] = Number.isFinite(num) ? num : raw;
        }

        batch.push({ dataset, cd_setor: cdSetor, cd_mun: cdMun, indicadores });
        if (batch.length >= batchSize) {
            await flushBatch();
        }
    }

    await flushBatch();
    console.log(`[csv] OK — ${imported} setores de Campinas (varridos ${scanned} linhas)`);
}

async function importSetoresDir(pool, dirPath, cdMun) {
    ensureFile(dirPath, 'Diretório de setores');
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.csv'));

    if (files.length === 0) {
        throw new Error(`Nenhum CSV em ${dirPath}`);
    }

    for (const file of files) {
        const dataset = SETOR_CSV_DATASETS[file];
        if (!dataset) {
            console.warn(`[csv] SKIP desconhecido: ${file}`);
            continue;
        }
        await importSetorCsv(pool, path.join(dirPath, file), dataset, cdMun);
    }
}

async function promoteSetoresIndicadores(pool, cdMun) {
    console.log('[promote] setores IBGE → malhas.setores_indicadores ...');

    const { rowCount } = await pool.query(`
        INSERT INTO malhas.setores_indicadores (cd_setor, cd_mun, dataset, indicadores, source, updated_at)
        SELECT
            cd_setor,
            cd_mun,
            dataset,
            indicadores,
            'ibge_censo2022_csv',
            now()
        FROM malhas_staging.setores_ibge_csv
        WHERE cd_mun = $1
        ON CONFLICT (cd_setor, dataset) DO UPDATE SET
            cd_mun = EXCLUDED.cd_mun,
            indicadores = EXCLUDED.indicadores,
            source = EXCLUDED.source,
            updated_at = now()
    `, [cdMun]);

    console.log(`[promote] OK — ${rowCount ?? 0} linhas em setores_indicadores`);
}

async function backfillComplaintBairros(pool, cdMun) {
    console.log('[backfill] complaints.cd_bairro ...');
    const { rowCount } = await pool.query(`
        UPDATE public.complaints c
        SET cd_bairro = geo.resolve_cd_bairro(c.location, $1::char(7))
        WHERE c.cd_mun = $1
          AND c.location IS NOT NULL
    `, [cdMun]);
    console.log(`[backfill] OK — ${rowCount ?? 0} reclamações atualizadas`);
}

async function applyMigration(pool) {
    const migrationPath = path.join(__dirname, '../migrations/020_malhas_staging_demografia.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('[migration] 020_malhas_staging_demografia OK');
}

async function main() {
    const args = parseArgs(process.argv);

    if (!args.promoteOnly && !args.utbZip && !args.setoresDir) {
        printHelp();
        process.exit(1);
    }

    const pool = await supabasePool.getPgPool();
    await applyMigration(pool);

    if (!args.promoteOnly && args.utbZip && !args.skipOgr) {
        const shapefile = resolveShapefile(path.resolve(args.utbZip));
        const geojsonPath = path.join(os.tmpdir(), `lifecity-utb-${Date.now()}.geojson`);
        console.log(`[utb] Shapefile: ${shapefile}`);
        runOgr2ogr(shapefile, geojsonPath);
        await loadUtbGeoJson(pool, geojsonPath);
        try { fs.unlinkSync(geojsonPath); } catch (_) { /* ignore */ }
    }

    if (!args.promoteOnly && args.setoresDir) {
        await importSetoresDir(pool, path.resolve(args.setoresDir), args.cdMun);
    }

    const shouldPromoteUtb = Boolean(args.utbZip || args.skipOgr);
    if (shouldPromoteUtb) {
        await promoteUtb(pool, args.cdMun);
    } else if (args.promoteOnly) {
        const utbStaging = await countRows(
            pool,
            'SELECT COUNT(*)::int AS count FROM malhas_staging.utb_raw'
        );
        if (utbStaging > 0) {
            await promoteUtb(pool, args.cdMun);
        }
    }

    const shouldPromoteSetores = Boolean(args.setoresDir);
    if (shouldPromoteSetores || args.promoteOnly) {
        const stagingSetores = await countRows(
            pool,
            'SELECT COUNT(*)::int AS count FROM malhas_staging.setores_ibge_csv WHERE cd_mun = $1',
            [args.cdMun]
        );
        if (stagingSetores > 0) {
            await promoteSetoresIndicadores(pool, args.cdMun);
        }
    }

    if (args.backfillComplaints) {
        await backfillComplaintBairros(pool, args.cdMun);
    }

    await supabasePool.closePgPool();
    console.log('Concluído.');
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
