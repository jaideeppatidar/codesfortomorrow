const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'JaiPtdr@1212',
    server: 'localhost',
    database: 'DemoDatabase',
    options: {
        encrypt: false
    }
};

async function connectToDatabase() {
    try {
        await sql.connect(config);
        console.log('Connected to SQL Server');
    } catch (error) {
        console.error('Error connecting to SQL Server:', error);
        process.exit(1);
    }
}
module.exports = { connectToDatabase };
