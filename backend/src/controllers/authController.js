exports.login = (req, res) => {
    res.status(200).json({ message: 'Login successful' });
}

exports.logout = (req, res) => {
    res.status(200).json({ message: 'Logout successful' });
}

exports.register = (req, res) => {
    res.status(200).json({ message: 'Register successful' });
}

