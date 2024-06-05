const express = require('express');
const app = express();
const PORT = process.env.PORT || 8000;
const { connectToDatabase } = require('./config/dbConfig');
const userRoutes = require('./routes/userRoutes');
const cors = require('cors');

app.use(express.json());
app.use(cors());
app.use('/api/users', userRoutes);

connectToDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch(error => {
        console.error('Error starting server:', error);
        process.exit(1);
    });
