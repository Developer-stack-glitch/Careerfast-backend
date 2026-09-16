const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
    const liveSqlPath = path.resolve(__dirname, '..', '..', 'live_db.sql');
    console.log('Reading live_db.sql from:', liveSqlPath);
    if (!fs.existsSync(liveSqlPath)) {
        console.error('live_db.sql not found at', liveSqlPath);
        process.exit(1);
    }

    const liveTables = {}; // tableName -> { rawCreate: string, columns: { [colName]: { raw: string, type: string, isNullable: boolean, defaultVal: string } }, keys: [] }

    const fileStream = fs.createReadStream(liveSqlPath, { encoding: 'utf8' });
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let inTable = false;
    let currentTableName = null;
    let currentTableLines = [];

    for await (const line of rl) {
        const trimmed = line.trim();
        if (!inTable) {
            const createMatch = line.match(/^CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+`([^`]+)`/i);
            if (createMatch) {
                inTable = true;
                currentTableName = createMatch[1];
                currentTableLines = [line];
            }
        } else {
            currentTableLines.push(line);
            if (trimmed.startsWith(') ENGINE=') || trimmed === ');' || trimmed.startsWith(') ;') || (trimmed.startsWith(')') && trimmed.endsWith(';'))) {
                inTable = false;
                parseLiveTable(currentTableName, currentTableLines.join('\n'), liveTables);
                currentTableName = null;
                currentTableLines = [];
            }
        }
    }

    console.log(`Parsed ${Object.keys(liveTables).length} tables from live_db.sql`);

    // Connect to local MySQL
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'career_fast',
        port: parseInt(process.env.DB_PORT || '3306', 10)
    };
    console.log(`Connecting to local DB: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}...`);
    const pool = mysql.createPool(dbConfig);

    try {
        const [tableRows] = await pool.query('SHOW TABLES');
        const localTableNames = tableRows.map(r => Object.values(r)[0]);
        console.log(`Found ${localTableNames.length} tables in local DB`);

        const localTables = {};
        for (const tableName of localTableNames) {
            const [createRows] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
            const createSql = createRows[0]['Create Table'];

            const [columns] = await pool.query(
                `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT, ORDINAL_POSITION
                 FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                 ORDER BY ORDINAL_POSITION`,
                [dbConfig.database, tableName]
            );

            const [indexes] = await pool.query(
                `SHOW INDEX FROM \`${tableName}\``
            );

            localTables[tableName] = {
                createSql,
                columns,
                indexes
            };
        }

        // Compare tables
        const missingInLiveTables = [];
        for (const tableName of localTableNames) {
            if (!liveTables[tableName]) {
                missingInLiveTables.push(tableName);
            }
        }

        const missingInLocalTables = [];
        for (const tableName of Object.keys(liveTables)) {
            if (!localTables[tableName]) {
                missingInLocalTables.push(tableName);
            }
        }

        // Compare columns for existing tables
        const missingColumnsInLive = {}; // tableName -> [ colObj ]
        const modifiedColumnsInLive = {}; // tableName -> [ { colName, localDef, liveDef } ]

        for (const tableName of localTableNames) {
            if (!liveTables[tableName]) continue;

            const liveTable = liveTables[tableName];
            const localCols = localTables[tableName].columns;

            for (const col of localCols) {
                const colName = col.COLUMN_NAME;
                const liveCol = liveTable.columns[colName];

                if (!liveCol) {
                    if (!missingColumnsInLive[tableName]) missingColumnsInLive[tableName] = [];
                    missingColumnsInLive[tableName].push(col);
                } else {
                    // Check if type/definition differs
                    const localType = col.COLUMN_TYPE.toLowerCase().replace(/\s+/g, ' ');
                    const liveType = (liveCol.type || '').toLowerCase().replace(/\s+/g, ' ');
                    
                    // Normalize int(11) vs int etc if needed
                    const normLocal = normalizeType(localType);
                    const normLive = normalizeType(liveType);

                    if (normLocal !== normLive && normLocal && normLive) {
                        if (!modifiedColumnsInLive[tableName]) modifiedColumnsInLive[tableName] = [];
                        modifiedColumnsInLive[tableName].push({
                            colName,
                            localCol: col,
                            liveCol: liveCol,
                            reason: `Type mismatch: local [${localType}] vs live [${liveType}]`
                        });
                    }
                }
            }
        }

        // Check columns present in live but missing in local
        const extraColumnsInLive = {};
        for (const tableName of Object.keys(liveTables)) {
            if (!localTables[tableName]) continue;
            const localColNames = new Set(localTables[tableName].columns.map(c => c.COLUMN_NAME));
            for (const colName of Object.keys(liveTables[tableName].columns)) {
                if (!localColNames.has(colName)) {
                    if (!extraColumnsInLive[tableName]) extraColumnsInLive[tableName] = [];
                    extraColumnsInLive[tableName].push(colName);
                }
            }
        }

        console.log('\n======================================================');
        console.log('                 DATABASE COMPARISON SUMMARY           ');
        console.log('======================================================');
        console.log(`Tables in Local: ${localTableNames.length}`);
        console.log(`Tables in Live:  ${Object.keys(liveTables).length}`);
        console.log(`Tables to CREATE in Live: ${missingInLiveTables.length}`);
        console.log(`Tables with missing columns in Live: ${Object.keys(missingColumnsInLive).length}`);
        console.log(`Tables with column definition differences: ${Object.keys(modifiedColumnsInLive).length}`);
        console.log(`Tables in Live not in Local: ${missingInLocalTables.length}`);
        console.log('======================================================\n');

        // Check seed data for newly created tables
        const seedDataQueries = {};
        for (const tableName of missingInLiveTables) {
            const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` LIMIT 100`);
            if (rows.length > 0) {
                seedDataQueries[tableName] = rows;
            }
        }

        // Output results to a JSON and display report
        const report = {
            missingInLiveTables,
            missingColumnsInLive,
            modifiedColumnsInLive,
            extraColumnsInLive,
            missingInLocalTables,
            localTablesMeta: localTables,
            seedDataQueries
        };

        fs.writeFileSync(
            path.join(__dirname, 'diff_report.json'),
            JSON.stringify(report, null, 2)
        );

        console.log('Detailed diff written to scripts/diff_report.json');

    } catch (err) {
        console.error('Error during comparison:', err);
    } finally {
        await pool.end();
    }
}

function normalizeType(t) {
    if (!t) return '';
    return t.replace(/int\(\d+\)/g, 'int')
            .replace(/tinyint\(\d+\)/g, 'tinyint')
            .replace(/smallint\(\d+\)/g, 'smallint')
            .replace(/mediumint\(\d+\)/g, 'mediumint')
            .replace(/bigint\(\d+\)/g, 'bigint');
}

function parseLiveTable(tableName, tableSql, liveTables) {
    const columns = {};
    const keys = [];

    const lines = tableSql.split('\n');
    for (const rawLine of lines) {
        const line = rawLine.trim();
        // Check for column definition: `col_name` type ...
        const colMatch = line.match(/^`([^`]+)`\s+([^,]+)/);
        if (colMatch) {
            const colName = colMatch[1];
            const rest = colMatch[2].trim().replace(/,$/, '');

            // extract type (e.g. varchar(255), int, text, enum(...))
            const typeMatch = rest.match(/^([a-zA-Z0-9_]+(?:\s*\([^)]+\))?(?:\s+unsigned)?)/i);
            const colType = typeMatch ? typeMatch[1] : '';

            const isNullable = !rest.toUpperCase().includes('NOT NULL');
            const defaultMatch = rest.match(/DEFAULT\s+('([^']*)'|NULL|CURRENT_TIMESTAMP|[0-9]+)/i);
            const defaultVal = defaultMatch ? defaultMatch[1] : undefined;

            columns[colName] = {
                raw: rest,
                type: colType,
                isNullable,
                defaultVal
            };
        } else if (line.match(/^(?:PRIMARY KEY|UNIQUE KEY|KEY|CONSTRAINT)/i)) {
            keys.push(line.replace(/,$/, ''));
        }
    }

    liveTables[tableName] = {
        tableName,
        columns,
        keys,
        rawCreate: tableSql
    };
}

run();
