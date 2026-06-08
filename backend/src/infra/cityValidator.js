function getCepPrefixes() {
    const raw = process.env.CITY_CEP_PREFIXES;
    if (!raw) return [];
    return raw.split(',').map(p => p.trim()).filter(Boolean);
}

function getCityBounds() {
    const { CITY_LAT_MIN, CITY_LAT_MAX, CITY_LNG_MIN, CITY_LNG_MAX } = process.env;
    if (!CITY_LAT_MIN || !CITY_LAT_MAX || !CITY_LNG_MIN || !CITY_LNG_MAX) return null;
    return {
        latMin: parseFloat(CITY_LAT_MIN),
        latMax: parseFloat(CITY_LAT_MAX),
        lngMin: parseFloat(CITY_LNG_MIN),
        lngMax: parseFloat(CITY_LNG_MAX),
    };
}

// Retorna true se o CEP pertence à cidade, false se não pertence.
// Se CITY_CEP_PREFIXES não estiver configurado, sempre retorna true (sem validação).
exports.isValidCityCep = (cep) => {
    const prefixes = getCepPrefixes();
    if (prefixes.length === 0) return true;
    const digits = String(cep).replace(/\D/g, '');
    return prefixes.some(prefix => digits.startsWith(prefix));
};

// Retorna true se dentro dos limites, false se fora, null se sem GPS ou sem config.
exports.isWithinCityBounds = (lat, lng) => {
    const bounds = getCityBounds();
    if (!bounds || lat == null || lng == null) return null;
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (isNaN(latN) || isNaN(lngN)) return null;
    return latN >= bounds.latMin && latN <= bounds.latMax &&
           lngN >= bounds.lngMin && lngN <= bounds.lngMax;
};
