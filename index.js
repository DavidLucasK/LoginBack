const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const authRoutes = require('./auth');
app.use('/api/auth', authRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
