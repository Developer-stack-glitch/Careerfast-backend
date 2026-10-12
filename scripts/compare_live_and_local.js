const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
    const liveSqlPath = path.resolve(__dirname, '..', '..', 'career_fast (6).sql');
    console.log(`Analyzing Live SQL Dump: ${liveSqlPath}`);
    if (!fs.existsSync(liveSqlPath)) {
        console.error(`File not found: ${liveSqlPath}`);
        process.exit(1);
    }

    // Step 1: Parse live SQL dump
    const liveTables = new Map(); // tableName -> { createSqlLines: [], alterLines: [], columns: Map(name -> def) }
    
    const fileStream = fs.createReadStream(liveSqlPath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let currentTable = null;
    let mode = null; // 'create', 'alter'
    let currentAlterTable = null;

    for await (const line of rl) {
        const trimmed = line.trim();

        // Check for CREATE TABLE
        const createMatch = line.match(/^CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+`([^`]+)`/i);
        if (createMatch) {
            currentTable = createMatch[1];
            mode = 'create';
            if (!liveTables.has(currentTable)) {
                liveTables.set(currentTable, {
                    name: currentTable,
                    createLines: [],
                    alterStatements: [],
                    columns: new Map()
                });
            }
            liveTables.get(currentTable).createLines.push(line);
            continue;
        }

        if (mode === 'create' && currentTable) {
            liveTables.get(currentTable).createLines.push(line);
            
            // Check column definition
            const colMatch = line.match(/^\s*`([^`]+)`\s+([a-zA-Z0-9_()]+(?:\s+unsigned)?)/);
            if (colMatch) {
                const colName = colMatch[1];
                liveTables.get(currentTable).columns.set(colName, line.trim().replace(/,$/, ''));
            }

            if (/^\)\s*ENGINE=/i.test(trimmed) || /^\);/.test(trimmed)) {
                mode = null;
                currentTable = null;
            }
            continue;
        }

        // Check for ALTER TABLE
        const alterMatch = line.match(/^ALTER\s+TABLE\s+`([^`]+)`/i);
        if (alterMatch) {
            currentAlterTable = alterMatch[1];
            mode = 'alter';
            if (!liveTables.has(currentAlterTable)) {
                liveTables.set(currentAlterTable, {
                    name: currentAlterTable,
                    createLines: [],
                    alterStatements: [],
                    columns: new Map()
                });
            }
            liveTables.get(currentAlterTable).alterStatements.push([line]);
            continue;
        }

        if (mode === 'alter' && currentAlterTable) {
            const lastGroup = liveTables.get(currentAlterTable).alterStatements;
            if (lastGroup.length > 0) {
                lastGroup[lastGroup.length - 1].push(line);
            }
            if (trimmed.endsWith(';')) {
                mode = null;
                currentAlterTable = null;
            }
            continue;
        }
    }

    console.log(`Live SQL parsed: ${liveTables.size} tables found in live dump.`);

    // Step 2: Connect to local MySQL
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'career_fast',
        port: parseInt(process.env.DB_PORT || '3306', 10)
    };
    console.log(`Connecting to Local DB: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}...`);
    const pool = mysql.createPool(dbConfig);

    const [tableRows] = await pool.query('SHOW TABLES');
    const localTableNames = tableRows.map(r => Object.values(r)[0]);
    console.log(`Local DB connected: ${localTableNames.length} tables found in local DB.`);

    // Retrieve local tables schema
    const localTables = new Map();
    for (const tableName of localTableNames) {
        const [createRows] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
        const createSql = createRows[0]['Create Table'];
        
        const [columns] = await pool.query(`SHOW FULL COLUMNS FROM \`${tableName}\``);
        const colMap = new Map();
        for (const col of columns) {
            colMap.set(col.Field, col);
        }
        localTables.set(tableName, {
            name: tableName,
            createSql,
            columns: colMap
        });
    }

    // Step 3: Compare Tables
    const liveTableNames = Array.from(liveTables.keys());

    const missingInLive = localTableNames.filter(t => !liveTables.has(t));
    const missingInLocal = liveTableNames.filter(t => !localTables.has(t));

    console.log('\n======================================================');
    console.log('                 TABLE COMPARISON SUMMARY             ');
    console.log('======================================================');
    console.log(`Total Tables in Local DB: ${localTableNames.length}`);
    console.log(`Total Tables in Live DB:  ${liveTableNames.length}`);
    console.log(`Missing in Live DB (exist in Local): ${missingInLive.length}`);
    console.log(`Missing in Local DB (exist in Live): ${missingInLocal.length}`);

    // Detail missing in Live
    const sqlToAddInLive = [];
    if (missingInLive.length > 0) {
        console.log('\n>>> TABLES PRESENT IN LOCAL DB BUT MISSING IN LIVE DB:');
        for (const tbl of missingInLive) {
            console.log(`  - ${tbl}`);
            const fullCreateSql = localTables.get(tbl).createSql + ';';
            sqlToAddInLive.push(`-- Table: ${tbl}\n${fullCreateSql}\n`);
        }
    } else {
        console.log('\n>>> All Local tables exist in Live DB!');
    }

    // Detail missing in Local
    const sqlToAddInLocal = [];
    if (missingInLocal.length > 0) {
        console.log('\n>>> TABLES PRESENT IN LIVE DB BUT MISSING IN LOCAL DB:');
        for (const tbl of missingInLocal) {
            console.log(`  - ${tbl}`);
            const tblObj = liveTables.get(tbl);
            let ddl = tblObj.createLines.join('\n');
            if (tblObj.alterStatements.length > 0) {
                ddl += '\n\n' + tblObj.alterStatements.map(lines => lines.join('\n')).join('\n\n');
            }
            sqlToAddInLocal.push(`-- Table: ${tbl}\n${ddl}\n`);
        }
    } else {
        console.log('\n>>> All Live tables exist in Local DB!');
    }

    // Step 4: Compare Columns for common tables
    console.log('\n======================================================');
    console.log('                 COLUMN COMPARISON SUMMARY            ');
    console.log('======================================================');

    const missingColsInLive = []; // { table, col, query }
    const missingColsInLocal = []; // { table, col, def }

    for (const tbl of localTableNames) {
        if (!liveTables.has(tbl)) continue;
        const localTable = localTables.get(tbl);
        const liveTable = liveTables.get(tbl);

        // Check columns in local missing in live
        for (const [colName, col] of localTable.columns.entries()) {
            if (!liveTable.columns.has(colName)) {
                let nullDef = col.Null === 'YES' ? 'NULL' : 'NOT NULL';
                let defaultDef = '';
                if (col.Default !== null) {
                    defaultDef = `DEFAULT '${col.Default}'`;
                } else if (col.Null === 'YES') {
                    defaultDef = 'DEFAULT NULL';
                }
                let extraDef = col.Extra ? ` ${col.Extra}` : '';
                let commentDef = col.Comment ? ` COMMENT '${col.Comment}'` : '';
                const query = `ALTER TABLE \`${tbl}\` ADD COLUMN \`${col.Field}\` ${col.Type} ${nullDef} ${defaultDef}${extraDef}${commentDef};`.replace(/\s+/g, ' ').replace(' ;', ';');
                missingColsInLive.push({ table: tbl, col: colName, query });
            }
        }

        // Check columns in live missing in local
        for (const [colName, liveDef] of liveTable.columns.entries()) {
            if (!localTable.columns.has(colName)) {
                const query = `ALTER TABLE \`${tbl}\` ADD COLUMN ${liveDef};`;
                missingColsInLocal.push({ table: tbl, col: colName, query, liveDef });
            }
        }
    }

    console.log(`Columns missing in Live DB (exist in Local): ${missingColsInLive.length}`);
    if (missingColsInLive.length > 0) {
        for (const item of missingColsInLive) {
            console.log(`  - Table \`${item.table}\`: column \`${item.col}\``);
        }
    }

    console.log(`Columns missing in Local DB (exist in Live): ${missingColsInLocal.length}`);
    if (missingColsInLocal.length > 0) {
        for (const item of missingColsInLocal) {
            console.log(`  - Table \`${item.table}\`: column \`${item.col}\``);
        }
    }

    // Save outputs
    const resultObj = {
        summary: {
            localTablesCount: localTableNames.length,
            liveTablesCount: liveTableNames.length,
            missingTablesInLiveCount: missingInLive.length,
            missingTablesInLocalCount: missingInLocal.length,
            missingColumnsInLiveCount: missingColsInLive.length,
            missingColumnsInLocalCount: missingColsInLocal.length
        },
        missingTablesInLive: missingInLive,
        missingTablesInLocal: missingInLocal,
        sqlToAddTablesToLive: sqlToAddInLive.join('\n\n'),
        sqlToAddTablesToLocal: sqlToAddInLocal.join('\n\n'),
        missingColumnsInLive: missingColsInLive,
        missingColumnsInLocal: missingColsInLocal
    };

    fs.writeFileSync(path.join(__dirname, 'db_diff_result.json'), JSON.stringify(resultObj, null, 2));
    console.log('\nComparison complete! Detailed JSON saved to scripts/db_diff_result.json');

    await pool.end();
}

main().catch(err => {
    console.error('Execution error:', err);
    process.exit(1);
});
