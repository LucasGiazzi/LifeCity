const supabasePool = require('../../infra/supabasePool');
const { getCoverage } = require('../../services/tenantOnboardingService');
const { resolvePopulation } = require('../../services/billingEstimateService');

exports.search = async (req, res) => {
    const { q, uf = 'SP', limit = 20 } = req.query;

    if (!q || String(q).trim().length < 2) {
        return res.status(400).json({ message: 'Parâmetro q deve ter no mínimo 2 caracteres.' });
    }

    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const search = `%${String(q).trim()}%`;

    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            `SELECT m.cd_mun, m.nm_mun, m.sigla_uf,
                    EXISTS(SELECT 1 FROM tenants t WHERE t.cd_mun = m.cd_mun) AS has_tenant
             FROM malhas.municipios m
             WHERE m.sigla_uf = $1
               AND (m.nm_mun ILIKE $2 OR m.cd_mun ILIKE $2)
             ORDER BY m.nm_mun
             LIMIT $3`,
            [uf.toUpperCase(), search, lim]
        );

        const items = await Promise.all(rows.map(async (row) => {
            const cd_mun = row.cd_mun?.trim?.() ?? row.cd_mun;
            const coverage = await getCoverage(pool, cd_mun);
            const { population, populationSource } = await resolvePopulation(pool, cd_mun);
            return {
                cd_mun,
                nm_mun: row.nm_mun,
                sigla_uf: row.sigla_uf,
                hasTenant: row.has_tenant,
                population: population > 0 ? population : null,
                populationSource,
                coverage: {
                    bairrosLoaded: coverage.bairrosLoaded,
                    setoresLoaded: coverage.setoresLoaded,
                },
            };
        }));

        res.status(200).json({ items });
    } catch (error) {
        console.error('Erro na busca de municípios:', error);
        res.status(500).json({ message: 'Erro ao buscar municípios.' });
    }
};
