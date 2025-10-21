const app = require('./app');
const http = require('http');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.get('/', (req, res) => {
    res.send('Hello World');
});

