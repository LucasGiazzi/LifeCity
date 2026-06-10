const supabasePool = require('../../infra/supabasePool');

async function fetchGeoJson(pool, sql, cdMun) {
    const { rows } = await pool.query(sql, [cdMun]);
    return rows[0]?.geojson ?? { type: 'FeatureCollection', features: [] };
}

exports.getMunicipio = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const cdMun = req.tenant.cd_mun;

        const geojson = await fetchGeoJson(
            pool,
            `SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object('cd_mun', cd_mun, 'nm_mun', nm_mun),
                        'geometry', ST_AsGeoJSON(geometry)::json
                    )
                ), '[]'::json)
            ) AS geojson
            FROM malhas.municipios
            WHERE cd_mun = $1`,
            cdMun
        );

        res.status(200).json(geojson);
    } catch (error) {
        console.error('Erro ao buscar malha municipal:', error);
        res.status(500).json({ message: 'Erro ao buscar malha municipal.' });
    }
};

exports.getBairros = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const cdMun = req.tenant.cd_mun;

        const geojson = await fetchGeoJson(
            pool,
            `SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object(
                            'cd_bairro', cd_bairro,
                            'nm_bairro', nm_bairro,
                            'cd_mun', cd_mun
                        ),
                        'geometry', ST_AsGeoJSON(geometry)::json
                    )
                ), '[]'::json)
            ) AS geojson
            FROM malhas.bairros
            WHERE cd_mun = $1`,
            cdMun
        );

        res.status(200).json(geojson);
    } catch (error) {
        console.error('Erro ao buscar malha de bairros:', error);
        res.status(500).json({ message: 'Erro ao buscar malha de bairros.' });
    }
};

exports.getSetores = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const cdMun = req.tenant.cd_mun;

        const geojson = await fetchGeoJson(
            pool,
            `SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object(
                            'cd_setor', cd_setor,
                            'cd_mun', cd_mun
                        ),
                        'geometry', ST_AsGeoJSON(geometry)::json
                    )
                ), '[]'::json)
            ) AS geojson
            FROM malhas.setores
            WHERE cd_mun = $1`,
            cdMun
        );

        res.status(200).json(geojson);
    } catch (error) {
        console.error('Erro ao buscar malha de setores:', error);
        res.status(500).json({ message: 'Erro ao buscar malha de setores.' });
    }
};
