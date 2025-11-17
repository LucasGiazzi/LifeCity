const crypto = require('crypto')

function encryptPassword(password, salt) {
    const hash = crypto.createHash('sha256');
    hash.update(password + salt);
    return hash.digest('base64');
}

function generateSalt(length = 16) {
    return crypto.randomBytes(length).toString('base64');
}

module.exports = {
    encryptPassword,
    generateSalt,
};
