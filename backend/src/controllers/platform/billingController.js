const supabasePool = require('../../infra/supabasePool');
const {
    resolvePopulation,
    estimateBilling,
    toApiResponse,
} = require('../../services/billingEstimateService');

exports.estimate = async (req, res) => {
    const { cd_mun, contractMonths, populationOverride } = req.query;

    if (!cd_mun) {
        return res.status(400).json({ message: 'cd_mun é obrigatório.' });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            'SELECT cd_mun FROM malhas.municipios WHERE cd_mun = $1',
            [cd_mun]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Município não encontrado.' });
        }

        const { population, populationSource } = await resolvePopulation(
            pool,
            cd_mun,
            populationOverride ?? null
        );
        const estimate = estimateBilling({ population, contractMonths });
        res.status(200).json(toApiResponse(estimate, populationSource));
    } catch (error) {
        console.error('Erro na estimativa de billing:', error);
        res.status(500).json({ message: 'Erro ao calcular estimativa comercial.' });
    }
};
