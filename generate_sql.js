require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');

async function main() {
    const sqlContent = fs.readFileSync('career_fast_live.sql', 'utf8');
    const createTableRegex = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\) ENGINE=/g;
    
    const liveTables = {};
    let match;
    while ((match = createTableRegex.exec(sqlContent)) !== null) {
        const tableName = match[1];
        const columnsStr = match[2];
        const columns = [];
        const columnRegex = /^\s*`([^`]+)`/gm;
        let colMatch;
        while ((colMatch = columnRegex.exec(columnsStr)) !== null) {
            columns.push(colMatch[1]);
        }
        liveTables[tableName] = columns;
    }

    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'careerfast',
    });

    try {
        const [rows] = await pool.query('SHOW TABLES');
        const localTables = {};
        
        for (const row of rows) {
            const tableName = Object.values(row)[0];
            const [colRows] = await pool.query(`DESCRIBE \`${tableName}\``);
            localTables[tableName] = colRows.map(r => r.Field);
        }

        console.log("-- SQL COMMANDS TO UPDATE LIVE DB --\n");

        for (const [tableName, columns] of Object.entries(localTables)) {
            if (!liveTables[tableName]) {
                const [createTableRows] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
                console.log(`-- Create table: ${tableName}`);
                console.log(createTableRows[0]['Create Table'] + ';');
                console.log();
            }
        }

        for (const [tableName, columns] of Object.entries(localTables)) {
            if (liveTables[tableName]) {
                const missingCols = columns.filter(col => !liveTables[tableName].includes(col));
                if (missingCols.length > 0) {
                    const [schemaCols] = await pool.query(
                        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA 
                         FROM INFORMATION_SCHEMA.COLUMNS 
                         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME IN (?)`,
                        [process.env.DB_NAME || 'careerfast', tableName, missingCols]
                    );

                    console.log(`-- Add missing columns to table: ${tableName}`);
                    const alterStmts = schemaCols.map(col => {
                        let def = `ADD COLUMN \`${col.COLUMN_NAME}\` ${col.COLUMN_TYPE}`;
                        if (col.IS_NULLABLE === 'NO') def += ' NOT NULL';
                        if (col.COLUMN_DEFAULT !== null) def += ` DEFAULT '${col.COLUMN_DEFAULT}'`;
                        if (col.EXTRA) def += ` ${col.EXTRA}`;
                        return def;
                    });
                    console.log(`ALTER TABLE \`${tableName}\`\n  ${alterStmts.join(',\n  ')};`);
                    console.log();
                }
            }
        }

    } catch(e) {
        console.error("DB error:", e.message);
    }
    
    process.exit(0);
}

main();
