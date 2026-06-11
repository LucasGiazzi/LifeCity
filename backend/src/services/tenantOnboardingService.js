const { writeAuditLog } = require('./platformService');
const { inviteMemberInTransaction } = require('./tenantInvitationService');
const {
    resolvePopulation,
    estimateBilling,
    toBillingSnapshot,
} = require('./billingEstimateService');

const SLUG_REGEX = /^[a-z0-9-]+$/;

async function resolveGeoFromMunicipality(pool, cd_mun) {
    const { rows } = await pool.query(
        `SELECT
            ST_YMin(ST_Envelope(geometry)) AS lat_min,
            ST_YMax(ST_Envelope(geometry)) AS lat_max,
            ST_XMin(ST_Envelope(geometry)) AS lng_min,
            ST_XMax(ST_Envelope(geometry)) AS lng_max
         FROM malhas.municipios
         WHERE cd_mun = $1 AND geometry IS NOT NULL`,
        [cd_mun]
    );

    if (rows.length === 0 || rows[0].lat_min == null) {
        return null;
    }

    const row = rows[0];
    return {
        bounds: {
            lat_min: Number(row.lat_min),
            lat_max: Number(row.lat_max),
            lng_min: Number(row.lng_min),
            lng_max: Number(row.lng_max),
        },
        bounds_source: 'malhas_municipios',
    };
}

async function getCoverage(pool, cd_mun) {
    const [bairros, setores] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS n FROM malhas.bairros WHERE cd_mun = $1', [cd_mun]),
        pool.query('SELECT COUNT(*)::int AS n FROM malhas.setores WHERE cd_mun = $1', [cd_mun]),
    ]);

    const bairroCount = bairros.rows[0]?.n ?? 0;
    const setorCount = setores.rows[0]?.n ?? 0;

    return {
        bairrosLoaded: bairroCount > 0,
        setoresLoaded: setorCount > 0,
        bairroCount,
        setorCount,
    };
}

function formatTenantRow(row) {
    return {
        id: row.id,
        cd_mun: row.cd_mun?.trim?.() ?? row.cd_mun,
        slug: row.slug,
        displayName: row.display_name,
        status: row.status,
        settings: row.settings ?? {},
        activatedAt: row.activated_at,
        createdAt: row.created_at,
    };
}

function deepMerge(target, source) {
    const result = { ...(target || {}) };
    for (const key of Object.keys(source || {})) {
        const val = source[key];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            result[key] = deepMerge(result[key], val);
        } else if (val !== undefined) {
            result[key] = val;
        }
    }
    return result;
}

async function seedDefaults(pool, tenantId) {
    const opsResult = await pool.query(
        `INSERT INTO public.ops_teams (tenant_id, name, slug, description, default_category_ids)
         SELECT $1, v.name, v.slug, v.description, v.category_ids
         FROM (
           VALUES
             ('Triagem Geral', 'triagem-geral', 'Recepção e encaminhamento inicial de ocorrências.', ARRAY[]::uuid[]),
             ('Secretaria de Obras', 'obras', 'Infraestrutura urbana, vias e calçadas.',
              ARRAY(SELECT id FROM public.complaint_categories WHERE slug = 'infraestrutura')),
             ('Defesa Civil / Segurança', 'seguranca', 'Situações de risco e segurança pública.',
              ARRAY(SELECT id FROM public.complaint_categories WHERE slug = 'seguranca')),
             ('Limpeza Urbana', 'limpeza', 'Coleta, entulho e limpeza de vias.',
              ARRAY(SELECT id FROM public.complaint_categories WHERE slug = 'limpeza')),
             ('Trânsito e Mobilidade', 'transito', 'Sinalização, trânsito e mobilidade urbana.',
              ARRAY(SELECT id FROM public.complaint_categories WHERE slug = 'transito'))
         ) AS v(name, slug, description, category_ids)
         ON CONFLICT (tenant_id, slug) DO NOTHING
         RETURNING id`,
        [tenantId]
    );

    const slaResult = await pool.query(
        `INSERT INTO public.tenant_sla_policies (tenant_id, category_id, response_hours, resolution_hours)
         SELECT $1, cat.id, v.response_hours, v.resolution_hours
         FROM public.complaint_categories cat
         JOIN (
           VALUES
             ('seguranca', 4, 24),
             ('infraestrutura', 24, 72),
             ('limpeza', 24, 48),
             ('transito', 24, 72),
             ('outros', 48, 120)
         ) AS v(slug, response_hours, resolution_hours) ON v.slug = cat.slug
         ON CONFLICT (tenant_id, category_id) DO NOTHING
         RETURNING id`,
        [tenantId]
    );

    return {
        opsTeamsCreated: opsResult.rowCount,
        slaPoliciesCreated: slaResult.rowCount,
    };
}

async function createTenant(pool, {
    cd_mun,
    slug,
    displayName,
    status = 'trial',
    settings = {},
    seedDefaults: shouldSeed = true,
    billing = {},
    inviteOwner = null,
    actorId,
}) {
    const normalizedSlug = String(slug).toLowerCase().trim();
    if (!SLUG_REGEX.test(normalizedSlug)) {
        const err = new Error('Slug inválido. Use apenas letras minúsculas, números e hífens.');
        err.status = 400;
        throw err;
    }

    const { rows: munRows } = await pool.query(
        'SELECT cd_mun, nm_mun FROM malhas.municipios WHERE cd_mun = $1',
        [cd_mun]
    );
    if (munRows.length === 0) {
        const err = new Error('Município não encontrado em malhas.');
        err.status = 404;
        throw err;
    }

    const { rows: existing } = await pool.query(
        'SELECT id FROM tenants WHERE cd_mun = $1 OR slug = $2',
        [cd_mun, normalizedSlug]
    );
    if (existing.length > 0) {
        const err = new Error('cd_mun ou slug já existem.');
        err.status = 409;
        throw err;
    }

    const resolvedDisplayName = displayName?.trim() || munRows[0].nm_mun;
    const { population, populationSource } = await resolvePopulation(
        pool,
        cd_mun,
        billing.populationOverride ?? null
    );
    const billingEstimate = estimateBilling({
        population,
        contractMonths: billing.contractMonths,
    });
    const billingSnapshot = toBillingSnapshot(billingEstimate, populationSource);

    const autoGeo = await resolveGeoFromMunicipality(pool, cd_mun);
    const geoFromMalhas = autoGeo
        ? {
            bounds: autoGeo.bounds,
            bounds_source: autoGeo.bounds_source,
            ...(settings?.geo?.cep_prefixes?.length
                ? { cep_prefixes: settings.geo.cep_prefixes }
                : {}),
        }
        : settings?.geo;

    const mergedSettings = deepMerge(settings, {
        billing: billingSnapshot,
        ...(geoFromMalhas ? { geo: geoFromMalhas } : {}),
    });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: tenantRows } = await client.query(
            `INSERT INTO tenants (cd_mun, slug, display_name, status, settings, activated_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING *`,
            [cd_mun, normalizedSlug, resolvedDisplayName, status, JSON.stringify(mergedSettings)]
        );
        const tenant = tenantRows[0];

        let seed = { opsTeamsCreated: 0, slaPoliciesCreated: 0 };
        if (shouldSeed) {
            seed = await seedDefaults(client, tenant.id);
        }

        await writeAuditLog(client, {
            actorId,
            action: 'tenant.create',
            targetType: 'tenant',
            targetId: tenant.id,
            tenantId: tenant.id,
            payload: { cd_mun, slug: normalizedSlug, displayName: resolvedDisplayName },
        });

        let invitation = null;
        if (inviteOwner?.email) {
            invitation = await inviteMemberInTransaction(client, {
                tenantId: tenant.id,
                tenantDisplayName: resolvedDisplayName,
                email: inviteOwner.email,
                role: 'admin',
                name: inviteOwner.name,
                invitedBy: actorId,
            });
        }

        await client.query('COMMIT');

        const coverage = await getCoverage(pool, cd_mun);
        return { tenant, seed, coverage, invitation };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function getTenantHealth(pool, tenantId) {
    const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (rows.length === 0) return null;

    const tenant = rows[0];
    const cd_mun = tenant.cd_mun?.trim?.() ?? tenant.cd_mun;
    const coverage = await getCoverage(pool, cd_mun);

    const [opsTeams, slaPolicies, ownerCheck] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS n FROM ops_teams WHERE tenant_id = $1 AND is_active', [tenantId]),
        pool.query('SELECT COUNT(*)::int AS n FROM tenant_sla_policies WHERE tenant_id = $1 AND is_active', [tenantId]),
        pool.query(
            `SELECT COUNT(*)::int AS n FROM tenant_members
             WHERE tenant_id = $1 AND is_active AND role IN ('admin', 'owner')`,
            [tenantId]
        ),
    ]);

    const geoConfigured = Boolean(tenant.settings?.geo?.bounds);
    const ownerAssigned = (ownerCheck.rows[0]?.n ?? 0) > 0;

    const checks = [
        {
            key: 'tenant_active',
            ok: tenant.status !== 'suspended',
            detail:
                tenant.status !== 'suspended'
                    ? `Cliente ${tenant.status === 'active' ? 'ativo' : 'em trial'}`
                    : 'Cliente suspenso',
        },
        {
            key: 'malhas_bairros',
            ok: coverage.bairrosLoaded,
            detail: coverage.bairrosLoaded ? `${coverage.bairroCount} bairros` : 'Sem bairros',
        },
        {
            key: 'malhas_setores',
            ok: coverage.setoresLoaded,
            detail: coverage.setoresLoaded ? `${coverage.setorCount} setores` : 'Sem setores',
        },
        {
            key: 'ops_teams',
            ok: (opsTeams.rows[0]?.n ?? 0) > 0,
            detail: `${opsTeams.rows[0]?.n ?? 0} equipes`,
        },
        {
            key: 'sla_policies',
            ok: (slaPolicies.rows[0]?.n ?? 0) > 0,
            detail: `${slaPolicies.rows[0]?.n ?? 0} políticas`,
        },
        {
            key: 'owner_assigned',
            ok: ownerAssigned,
            detail: ownerAssigned ? 'Gestor municipal ativo' : 'Nenhum owner/admin convidado',
        },
        {
            key: 'geo_config',
            ok: geoConfigured,
            detail: geoConfigured
                ? 'Limites definidos a partir da malha IBGE'
                : 'Malha municipal sem geometria',
        },
    ];

    let status = 'healthy';
    if (tenant.status === 'suspended' || !coverage.bairrosLoaded) {
        status = 'critical';
    } else if (checks.some((c) => !c.ok)) {
        status = 'degraded';
    }

    return { status, checks, computedAt: new Date().toISOString() };
}

module.exports = {
    SLUG_REGEX,
    resolveGeoFromMunicipality,
    getCoverage,
    formatTenantRow,
    deepMerge,
    seedDefaults,
    createTenant,
    getTenantHealth,
};
