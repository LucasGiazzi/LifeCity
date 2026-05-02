function isValidCpf(cpf) {
    const digits = cpf.replace(/\D/g, '');

    if (digits.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(digits)) return false;

    const calc = (factor) => {
        let sum = 0;
        for (let i = 0; i < factor - 1; i++) {
            sum += parseInt(digits[i]) * (factor - i);
        }
        const remainder = (sum * 10) % 11;
        return remainder === 10 || remainder === 11 ? 0 : remainder;
    };

    return calc(10) === parseInt(digits[9]) && calc(11) === parseInt(digits[10]);
}

module.exports = { isValidCpf };
