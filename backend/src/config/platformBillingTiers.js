const POPULATION_TIERS = [
    { maxPop: 20_000, baseMonthly: 1000 },
    { maxPop: 100_000, baseMonthly: 1500 },
    { maxPop: 500_000, baseMonthly: 2000 },
    { maxPop: 1_000_000, baseMonthly: 2800 },
    { maxPop: Infinity, baseMonthly: 3500 },
];

const INFRA_BASE_BRL = 120;
const INFRA_PER_CAPITA = 0.0015;
const INFRA_CAP_BRL = 800;

const VALID_CONTRACT_MONTHS = [12, 24, 36];
const DEFAULT_CONTRACT_MONTHS = 24;

function baseMonthlyForPopulation(population) {
    const pop = Math.max(0, Number(population) || 0);
    for (const tier of POPULATION_TIERS) {
        if (pop < tier.maxPop) return tier.baseMonthly;
    }
    return 3500;
}

function infraMonthlyForPopulation(population) {
    const pop = Math.max(0, Number(population) || 0);
    return Math.min(INFRA_CAP_BRL, INFRA_BASE_BRL + Math.ceil(pop * INFRA_PER_CAPITA));
}

function normalizeContractMonths(months) {
    const n = Number(months);
    return VALID_CONTRACT_MONTHS.includes(n) ? n : DEFAULT_CONTRACT_MONTHS;
}

module.exports = {
    POPULATION_TIERS,
    INFRA_BASE_BRL,
    INFRA_PER_CAPITA,
    INFRA_CAP_BRL,
    VALID_CONTRACT_MONTHS,
    DEFAULT_CONTRACT_MONTHS,
    baseMonthlyForPopulation,
    infraMonthlyForPopulation,
    normalizeContractMonths,
};
