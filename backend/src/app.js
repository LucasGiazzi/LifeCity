const express = require('express');
const cors = require('cors');
const app = express();

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');

app.use(express.json());
app.use(cors());
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

module.exports = app;