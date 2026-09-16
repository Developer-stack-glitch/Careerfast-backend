require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');

async function main() {
    // Read and parse SQL file for CREATE TABLE statements
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

    // Connect to local DB
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

        console.log("=== MISSING TABLES IN LOCAL DB (Present in Live, missing in Local) ===");
        const missingLocalTables = [];
        for (const [tableName, columns] of Object.entries(liveTables)) {
            if (!localTables[tableName]) {
                missingLocalTables.push(tableName);
                console.log(`- ${tableName}`);
            }
        }
        if(missingLocalTables.length === 0) console.log("None");

        console.log("\n=== MISSING COLUMNS IN LOCAL DB (Present in Live, missing in Local) ===");
        let missingLocalColsCount = 0;
        for (const [tableName, columns] of Object.entries(liveTables)) {
            if (localTables[tableName]) {
                const missingCols = columns.filter(col => !localTables[tableName].includes(col));
                if (missingCols.length > 0) {
                    missingLocalColsCount++;
                    console.log(`Table: ${tableName}`);
                    missingCols.forEach(c => console.log(`  - ${c}`));
                }
            }
        }
        if(missingLocalColsCount === 0) console.log("None");

        console.log("\n=== MISSING TABLES IN LIVE DB (Present in Local, missing in Live) ===");
        const missingLiveTables = [];
        for (const [tableName, columns] of Object.entries(localTables)) {
            if (!liveTables[tableName]) {
                missingLiveTables.push(tableName);
                console.log(`- ${tableName}`);
            }
        }
        if(missingLiveTables.length === 0) console.log("None");

        console.log("\n=== MISSING COLUMNS IN LIVE DB (Present in Local, missing in Live) ===");
        let missingLiveColsCount = 0;
        for (const [tableName, columns] of Object.entries(localTables)) {
            if (liveTables[tableName]) {
                const missingCols = columns.filter(col => !liveTables[tableName].includes(col));
                if (missingCols.length > 0) {
                    missingLiveColsCount++;
                    console.log(`Table: ${tableName}`);
                    missingCols.forEach(c => console.log(`  - ${c}`));
                }
            }
        }
        if(missingLiveColsCount === 0) console.log("None");

    } catch(e) {
        console.error("DB error:", e.message);
    }
    
    process.exit(0);
}

main();
