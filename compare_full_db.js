const readline = require('readline');
const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

async function fullCompare() {
  const sqlPath = path.resolve(__dirname, '../live_db.sql');
  const fileStream = fs.createReadStream(sqlPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const liveSchema = {};
  let currentTable = null;

  for await (const line of rl) {
    const tableMatch = line.match(/^CREATE TABLE `([^`]+)`/i) || line.match(/^CREATE TABLE IF NOT EXISTS `([^`]+)`/i);
    if (tableMatch) {
      currentTable = tableMatch[1];
      liveSchema[currentTable] = { columns: new Map(), rawCols: [] };
      continue;
    }
    if (currentTable) {
      if (line.match(/^\)\s*ENGINE=/i) || line.match(/^\);/i)) {
        currentTable = null;
      } else {
        const colMatch = line.match(/^\s*`([^`]+)`\s+([a-zA-Z0-9_()]+)/);
        if (colMatch) {
          liveSchema[currentTable].columns.set(colMatch[1], line.trim().replace(/,$/, ''));
        }
      }
    }
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'career_fast',
  });

  const [tables] = await pool.query('SHOW TABLES');
  const localTableNames = tables.map(r => Object.values(r)[0]);
  const liveTableNames = Object.keys(liveSchema);

  console.log('======================================================');
  console.log('1. TABLE COMPARISON SUMMARY');
  console.log('======================================================');
  console.log(`Local tables: ${localTableNames.length}`);
  console.log(`Live tables:  ${liveTableNames.length}`);

  const missingTablesInLive = localTableNames.filter(t => !liveSchema[t]);
  console.log('Missing Tables in Live (Present in Local):', missingTablesInLive.length > 0 ? missingTablesInLive : 'None (All local tables exist in live DB)');

  const missingTablesInLocal = liveTableNames.filter(t => !localTableNames.includes(t));
  console.log('Missing Tables in Local (Present in Live):', missingTablesInLocal.length > 0 ? missingTablesInLocal : 'None (All live tables exist in local DB)');

  console.log('\n======================================================');
  console.log('2. MISSING COLUMNS IN LIVE DB (Required SQL Queries to run on Live DB)');
  console.log('======================================================');
  let missingInLiveCount = 0;
  for (const tableName of localTableNames) {
    if (!liveSchema[tableName]) continue;
    const [cols] = await pool.query(`SHOW FULL COLUMNS FROM \`${tableName}\``);
    const liveCols = liveSchema[tableName].columns;
    
    const tableMissing = [];
    for (const col of cols) {
      if (!liveCols.has(col.Field)) {
        missingInLiveCount++;
        let nullDef = col.Null === 'YES' ? 'NULL' : 'NOT NULL';
        let defaultDef = '';
        if (col.Default !== null) {
          defaultDef = `DEFAULT '${col.Default}'`;
        } else if (col.Null === 'YES') {
          defaultDef = 'DEFAULT NULL';
        }
        let extraDef = col.Extra ? `${col.Extra}` : '';
        let commentDef = col.Comment ? `COMMENT '${col.Comment}'` : '';
        const query = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${col.Field}\` ${col.Type} ${nullDef} ${defaultDef} ${extraDef} ${commentDef};`.replace(/\s+/g, ' ').replace(' ;', ';');
        tableMissing.push({ field: col.Field, query });
      }
    }
    if (tableMissing.length > 0) {
      console.log(`\n-- Table: \`${tableName}\` (${tableMissing.length} new column(s))`);
      tableMissing.forEach(m => console.log(m.query));
    }
  }
  if (missingInLiveCount === 0) {
    console.log('All columns in Local DB are already present in Live DB.');
  }

  console.log('\n======================================================');
  console.log('3. MISSING COLUMNS IN LOCAL DB (Present in Live DB, Missing in Local)');
  console.log('======================================================');
  let missingInLocalCount = 0;
  for (const tableName of localTableNames) {
    if (!liveSchema[tableName]) continue;
    const [cols] = await pool.query(`SHOW FULL COLUMNS FROM \`${tableName}\``);
    const localColNames = new Set(cols.map(c => c.Field));
    const liveCols = liveSchema[tableName].columns;

    for (const [colName, rawLine] of liveCols.entries()) {
      if (!localColNames.has(colName)) {
        missingInLocalCount++;
        console.log(`Local table \`${tableName}\` is missing column: \`${colName}\` -> Live definition: ${rawLine}`);
      }
    }
  }
  if (missingInLocalCount === 0) {
    console.log('All columns in Live DB are present in Local DB.');
  }

  await pool.end();
}

fullCompare().catch(e => {
  console.error(e);
  process.exit(1);
});
