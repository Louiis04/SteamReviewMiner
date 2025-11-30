const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const sqlFile = path.resolve(__dirname, '..', 'init.sql');

async function run() {
    if (!fs.existsSync(sqlFile)) {
        console.error('❌ Arquivo init.sql não encontrado.');
        process.exit(1);
    }

    const sql = fs.readFileSync(sqlFile, 'utf-8');

    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'steamuser',
        password: process.env.DB_PASSWORD || 'steampass123',
        database: process.env.DB_NAME || 'steamreviews',
    });

    try {
        console.log('🚧 Aplicando estrutura do banco...');
        await pool.query(sql);
        console.log('✅ Estrutura aplicada com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao aplicar estrutura do banco:', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

run();
