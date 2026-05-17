const sql = require('mssql');
require('dotenv').config();
 
const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        trustServerCertificate: true,
        encrypt: false,
        enableArithAbort: true,
    },
    connectionTimeout: 15000,
    requestTimeout: 10000,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    }
};
 
let pool = null;
 
async function getPool() {
    if (!pool) {
        try {
            pool = await sql.connect(config);
            console.log('✅ Подключено к:', process.env.DB_DATABASE);
        } catch (err) {
            pool = null;
            console.error('❌ Ошибка:', err.message);
            throw err;
        }
    }
    return pool;
}
 
async function query(queryString, params = {}) {
    const p = await getPool();
    const request = p.request();
    // Таймаут 8 секунд на каждый запрос
    request.timeout = 8000;
    for (const [key, { type, value }] of Object.entries(params)) {
        request.input(key, type, value);
    }
    return request.query(queryString);
}
 
module.exports = { sql, query, getPool };