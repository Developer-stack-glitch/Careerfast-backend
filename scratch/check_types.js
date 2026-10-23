const fs = require('fs');
const readline = require('readline');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

async function run() {
  const sqlPath = path.resolve(__dirname, '../../live_db.sql');
  const fileStream = fs.createReadStream(sqlPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const liveColumns = {}; // { tableName: { colName: fullRawDef } }

  let currentTable = null;

  for await (const line of rl) {
    const trimmed = line.trim();

    const createMatch = trimmed.match(/^CREATE TABLE `([^`]+)`/i) || trimmed.match(/^CREATE TABLE IF NOT EXISTS `([^`]+)`/i);
    if (createMatch) {
      currentTable = createMatch[1];
      liveColumns[currentTable] = {};
      continue;
    }

    if (currentTable) {
      if (trimmed.startsWith(') ENGINE=') || trimmed === ');') {
        currentTable = null;
        continue;
      }

      // Column match without stopping at comma
      const colMatch = trimmed.match(/^`([^`]+)`\s+(.*)$/);
      if (colMatch) {
        const colName = colMatch[1];
        let rest = colMatch[2].trim();
        // Remove trailing comma if present at end of line
        if (rest.endsWith(',')) rest = rest.slice(0, -1).trim();
        liveColumns[currentTable][colName] = rest;
      }
    }
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'career_fast',
    port: process.env.DB_PORT || 3306
  });

  const dbName = process.env.DB_NAME || 'career_fast';
  const [localTableRows] = await pool.query('SHOW TABLES');
  const localTableNames = localTableRows.map(r => Object.values(r)[0]);

  console.log('Comparing exact types, nullability, defaults...');

  const realDifferences = [];

  for (const table of localTableNames) {
    if (!liveColumns[table]) continue;

    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [dbName, table]);

    for (const col of columns) {
      const colName = col.COLUMN_NAME;
      const liveDef = liveColumns[table][colName];
      if (!liveDef) {
        // Missing column
        continue;
      }

      // Build local representation
      const localType = col.COLUMN_TYPE;
      const localNull = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      const localDef = `${localType} ${localNull} DEFAULT ${col.COLUMN_DEFAULT === null ? 'NULL' : `'${col.COLUMN_DEFAULT}'`}`;

      // Check if data types are significantly different
      // e.g. varchar vs enum, bigint vs int, text vs json
      const localTypeNorm = localType.toLowerCase().replace(/int\(\d+\)/, 'int').replace(/\s+/g, '');
      const liveDefNorm = liveDef.toLowerCase().replace(/int\(\d+\)/, 'int').replace(/\s+/g, '');

      // Check if local type is contained in live def
      if (!liveDefNorm.startsWith(localTypeNorm)) {
        realDifferences.push({
          table,
          column: colName,
          localType: col.COLUMN_TYPE,
          localNullable: col.IS_NULLABLE,
          localDefault: col.COLUMN_DEFAULT,
          liveRaw: liveDef
        });
      }
    }
  }

  console.log(`\nFound ${realDifferences.length} real column differences:`);
  for (const d of realDifferences) {
    console.log(`\nTable: \`${d.table}\` | Column: \`${d.column}\``);
    console.log(`  Local: ${d.localType} | Nullable: ${d.localNullable} | Default: ${d.localDefault}`);
    console.log(`  Live:  ${d.liveRaw}`);
  }

  await pool.end();
}

run().catch(console.error);
