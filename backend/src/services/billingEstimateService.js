const {
    baseMonthlyForPopulation,
    infraMonthlyForPopulation,
    normalizeContractMonths,
} = require('../config/platformBillingTiers');

async function resolvePopulation(pool, cd_mun, populationOverride = null) {
    if (populationOverride != null && Number(populationOverride) > 0) {
        return {
            population: Number(populationOverride),
            populationSource: 'manual',
        };
    }

    const { rows } = await pool.query(
        `SELECT COALESCE(SUM(tot_pop), 0)::bigint AS population
         FROM malhas.utb_demografia
         WHERE cd_mun = $1`,
        [cd_mun]
    );

    const population = Number(rows[0]?.population ?? 0);
    if (population > 0) {
        return { population, populationSource: 'utb_demografia' };
    }

    return { population: 0, populationSource: 'unknown' };
}

function estimateBilling({ population, contractMonths = 24 }) {
    const pop = Math.max(0, Number(population) || 0);
    const baseMonthly = baseMonthlyForPopulation(pop);
    const infraMonthly = infraMonthlyForPopulation(pop);
    const totalMonthly = baseMonthly + infraMonthly;
    const months = normalizeContractMonths(contractMonths);
    const totalContract = totalMonthly * months;

    return {
        population: pop,
        base_monthly_brl: baseMonthly,
        infra_monthly_brl: infraMonthly,
        total_monthly_brl: totalMonthly,
        contract_months: months,
        total_contract_brl: totalContract,
        breakdown: {
            base_label: 'Licença LifeCity (SaaS)',
            infra_label: 'Infraestrutura estimada (nuvem + tráfego)',
        },
    };
}

function toBillingSnapshot(estimate, populationSource) {
    return {
        population: estimate.population,
        population_source: populationSource,
        base_monthly_brl: estimate.base_monthly_brl,
        infra_monthly_brl: estimate.infra_monthly_brl,
        total_monthly_brl: estimate.total_monthly_brl,
        contract_months: estimate.contract_months,
        total_contract_brl: estimate.total_contract_brl,
        estimated_at: new Date().toISOString(),
    };
}

function toApiResponse(estimate, populationSource) {
    return {
        population: estimate.population,
        populationSource,
        baseMonthlyBrl: estimate.base_monthly_brl,
        infraMonthlyBrl: estimate.infra_monthly_brl,
        totalMonthlyBrl: estimate.total_monthly_brl,
        contractMonths: estimate.contract_months,
        totalContractBrl: estimate.total_contract_brl,
        disclaimer: 'Valores indicativos para proposta comercial. Não constitui fatura.',
    };
}

module.exports = {
    resolvePopulation,
    estimateBilling,
    toBillingSnapshot,
    toApiResponse,
};
