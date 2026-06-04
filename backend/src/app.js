const express = require('express');
const cors = require('cors');
const app = express();

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const friendshipRoutes = require('./routes/friendshipRoutes');
const categoriesRoutes = require('./routes/categoriesRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use(express.json());
app.use(cors());
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/friendships', friendshipRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/admin', adminRoutes);

module.exports = app;