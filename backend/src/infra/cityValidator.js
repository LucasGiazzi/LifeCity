const supabasePool = require('./supabasePool');

function getEnvCepPrefixes() {
    const raw = process.env.CITY_CEP_PREFIXES;
    if (!raw) return [];
    return raw.split(',').map((p) => p.trim()).filter(Boolean);
}

function getEnvBounds() {
    const { CITY_LAT_MIN, CITY_LAT_MAX, CITY_LNG_MIN, CITY_LNG_MAX } = process.env;
    if (!CITY_LAT_MIN || !CITY_LAT_MAX || !CITY_LNG_MIN || !CITY_LNG_MAX) return null;
    return {
        latMin: parseFloat(CITY_LAT_MIN),
        latMax: parseFloat(CITY_LAT_MAX),
        lngMin: parseFloat(CITY_LNG_MIN),
        lngMax: parseFloat(CITY_LNG_MAX),
    };
}

function getEnvGeoConfig() {
    return {
        cepPrefixes: getEnvCepPrefixes(),
        bounds: getEnvBounds(),
    };
}

function normalizeGeoFromSettings(settingsGeo) {
    if (!settingsGeo) return null;
    const bounds = settingsGeo.bounds;
    return {
        cepPrefixes: settingsGeo.cep_prefixes || [],
        bounds: bounds ? {
            latMin: bounds.lat_min,
            latMax: bounds.lat_max,
            lngMin: bounds.lng_min,
            lngMax: bounds.lng_max,
        } : null,
    };
}

async function getTenantGeoConfig(pool, cd_mun) {
    if (cd_mun) {
        const { rows } = await pool.query(
            `SELECT settings FROM tenants
             WHERE cd_mun = $1 AND status IN ('trial', 'active')
             LIMIT 1`,
            [cd_mun]
        );
        if (rows.length > 0) {
            const geo = normalizeGeoFromSettings(rows[0].settings?.geo);
            if (geo && (geo.cepPrefixes.length > 0 || geo.bounds)) {
                return geo;
            }
        }
    }

    console.warn(`[cityValidator] Fallback env para cd_mun=${cd_mun ?? 'null'}`);
    return getEnvGeoConfig();
}

function checkCepAgainstPrefixes(cep, prefixes) {
    if (!prefixes || prefixes.length === 0) return true;
    const digits = String(cep).replace(/\D/g, '');
    return prefixes.some((prefix) => digits.startsWith(prefix));
}

function checkBounds(lat, lng, bounds) {
    if (!bounds || lat == null || lng == null) return null;
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (Number.isNaN(latN) || Number.isNaN(lngN)) return null;
    return latN >= bounds.latMin && latN <= bounds.latMax &&
        lngN >= bounds.lngMin && lngN <= bounds.lngMax;
}

async function isValidCityCep(cep, cd_mun = null) {
    const pool = await supabasePool.getPgPool();

    if (cd_mun) {
        const config = await getTenantGeoConfig(pool, cd_mun);
        return checkCepAgainstPrefixes(cep, config.cepPrefixes);
    }

    const { rows } = await pool.query(
        `SELECT settings FROM tenants WHERE status IN ('trial', 'active')`
    );
    for (const row of rows) {
        const geo = normalizeGeoFromSettings(row.settings?.geo);
        if (geo?.cepPrefixes?.length > 0 && checkCepAgainstPrefixes(cep, geo.cepPrefixes)) {
            return true;
        }
    }

    const envPrefixes = getEnvCepPrefixes();
    if (envPrefixes.length === 0) return true;
    return checkCepAgainstPrefixes(cep, envPrefixes);
}

async function isWithinCityBounds(lat, lng, cd_mun = null) {
    const pool = await supabasePool.getPgPool();
    const config = await getTenantGeoConfig(pool, cd_mun);
    return checkBounds(lat, lng, config.bounds);
}

module.exports = {
    getTenantGeoConfig,
    isValidCityCep,
    isWithinCityBounds,
};
