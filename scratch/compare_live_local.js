const fs = require('fs');
const readline = require('readline');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

async function run() {
  console.log('--- Starting Complete DB Comparison ---');
  const sqlPath = path.resolve(__dirname, '../../live_db.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('File not found:', sqlPath);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(sqlPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  // Store live DB schema
  const liveTables = {}; 
  // liveTables[tableName] = {
  //   columns: { colName: { type, nullable, defaultVal, extra, raw } },
  //   primaryKeys: [],
  //   indexes: { indexName: { unique, columns: [] } }
  // }

  let currentTable = null;
  let inAlterTable = null;
  let inAlterAutoInc = null;

  for await (const line of rl) {
    const trimmed = line.trim();

    // 1. CREATE TABLE
    const createMatch = trimmed.match(/^CREATE TABLE `([^`]+)`/i) || trimmed.match(/^CREATE TABLE IF NOT EXISTS `([^`]+)`/i);
    if (createMatch) {
      currentTable = createMatch[1];
      liveTables[currentTable] = {
        columns: {},
        primaryKeys: [],
        indexes: {}
      };
      continue;
    }

    if (currentTable) {
      if (trimmed.startsWith(') ENGINE=') || trimmed === ');') {
        currentTable = null;
        continue;
      }

      // Check column definition
      const colMatch = trimmed.match(/^`([^`]+)`\s+([^,]+)/);
      if (colMatch) {
        const colName = colMatch[1];
        let colDef = colMatch[2].replace(/,$/, '').trim();
        
        // Extract type
        const typeMatch = colDef.match(/^([a-zA-Z0-9_]+(?:\([^)]+\))?)/);
        const colType = typeMatch ? typeMatch[1].toLowerCase() : '';
        const isNullable = !colDef.toUpperCase().includes('NOT NULL');
        
        let defaultVal = null;
        const defaultMatch = colDef.match(/DEFAULT\s+('([^']*)'|NULL|CURRENT_TIMESTAMP|[0-9]+)/i);
        if (defaultMatch) {
          defaultVal = defaultMatch[2] !== undefined ? defaultMatch[2] : defaultMatch[1];
        }

        const extra = colDef.toUpperCase().includes('AUTO_INCREMENT') ? 'auto_increment' : '';

        liveTables[currentTable].columns[colName] = {
          colName,
          raw: colDef,
          type: colType,
          isNullable,
          defaultVal,
          extra
        };
        continue;
      }

      // Check inline primary key or key
      const pkMatch = trimmed.match(/^PRIMARY KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        const cols = pkMatch[1].replace(/`/g, '').split(',').map(s => s.trim());
        liveTables[currentTable].primaryKeys.push(...cols);
        continue;
      }

      const keyMatch = trimmed.match(/^(UNIQUE KEY|KEY)\s*`([^`]+)`\s*\(([^)]+)\)/i);
      if (keyMatch) {
        const isUnique = keyMatch[1].toUpperCase().includes('UNIQUE');
        const keyName = keyMatch[2];
        const cols = keyMatch[3].replace(/`/g, '').split(',').map(s => s.trim());
        liveTables[currentTable].indexes[keyName] = {
          unique: isUnique,
          columns: cols
        };
        continue;
      }
    }

    // 2. ALTER TABLE for Indexes
    const alterIndexMatch = trimmed.match(/^ALTER TABLE `([^`]+)`/i);
    if (alterIndexMatch) {
      inAlterTable = alterIndexMatch[1];
      if (!liveTables[inAlterTable]) {
        liveTables[inAlterTable] = { columns: {}, primaryKeys: [], indexes: {} };
      }
      continue;
    }

    if (inAlterTable) {
      // Look for ADD PRIMARY KEY
      const pkMatch = trimmed.match(/ADD PRIMARY KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        const cols = pkMatch[1].replace(/`/g, '').split(',').map(s => s.trim());
        liveTables[inAlterTable].primaryKeys.push(...cols);
      }

      // Look for ADD UNIQUE KEY or ADD KEY
      const keyMatches = trimmed.matchAll(/ADD (UNIQUE KEY|KEY)\s*`([^`]+)`\s*\(([^)]+)\)/gi);
      for (const km of keyMatches) {
        const isUnique = km[1].toUpperCase().includes('UNIQUE');
        const keyName = km[2];
        const cols = km[3].replace(/`/g, '').split(',').map(s => s.trim());
        liveTables[inAlterTable].indexes[keyName] = {
          unique: isUnique,
          columns: cols
        };
      }

      // Look for MODIFY ... AUTO_INCREMENT
      const autoIncMatch = trimmed.match(/MODIFY `([^`]+)`\s+([a-zA-Z0-9_()]+)\s+NOT NULL AUTO_INCREMENT/i);
      if (autoIncMatch) {
        const colName = autoIncMatch[1];
        if (liveTables[inAlterTable].columns[colName]) {
          liveTables[inAlterTable].columns[colName].extra = 'auto_increment';
        }
      }

      if (trimmed.endsWith(';')) {
        inAlterTable = null;
      }
    }
  }

  // Connect to local database
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'career_fast',
    port: process.env.DB_PORT || 3306
  });

  const dbName = process.env.DB_NAME || 'career_fast';

  // Fetch local tables
  const [localTableRows] = await pool.query('SHOW TABLES');
  const localTableNames = localTableRows.map(r => Object.values(r)[0]);
  const liveTableNames = Object.keys(liveTables);

  const missingTablesInLive = localTableNames.filter(t => !liveTables[t]);
  const missingTablesInLocal = liveTableNames.filter(t => !localTableNames.includes(t));

  console.log(`\n=== 1. TABLES OVERVIEW ===`);
  console.log(`Local DB (${dbName}) tables count: ${localTableNames.length}`);
  console.log(`Live DB dump tables count: ${liveTableNames.length}`);
  console.log(`Tables in Local missing in Live:`, missingTablesInLive);
  console.log(`Tables in Live missing in Local:`, missingTablesInLocal);

  // Queries to run on Live
  const liveQueries = [];

  // A. Missing tables CREATE TABLE statements
  for (const table of missingTablesInLive) {
    const [createRes] = await pool.query(`SHOW CREATE TABLE \`${table}\``);
    liveQueries.push({
      type: 'CREATE TABLE',
      table,
      sql: createRes[0]['Create Table'] + ';'
    });
  }

  // B. Missing columns in Live DB
  console.log(`\n=== 2. COLUMN COMPARISON ===`);
  const missingColsInLive = [];
  const typeMismatches = [];

  for (const table of localTableNames) {
    if (!liveTables[table]) continue;

    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [dbName, table]);

    const liveColMap = liveTables[table].columns;

    for (const col of columns) {
      const colName = col.COLUMN_NAME;
      if (!liveColMap[colName]) {
        let nullDef = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        let defaultDef = '';
        if (col.COLUMN_DEFAULT !== null) {
          defaultDef = `DEFAULT '${col.COLUMN_DEFAULT}'`;
        } else if (col.IS_NULLABLE === 'YES') {
          defaultDef = 'DEFAULT NULL';
        }
        let extraDef = col.EXTRA ? col.EXTRA.toUpperCase() : '';
        let commentDef = col.COLUMN_COMMENT ? `COMMENT '${col.COLUMN_COMMENT}'` : '';
        
        const sql = `ALTER TABLE \`${table}\` ADD COLUMN \`${colName}\` ${col.COLUMN_TYPE} ${nullDef} ${defaultDef} ${extraDef} ${commentDef};`.replace(/\s+/g, ' ').replace(' ;', ';');
        
        missingColsInLive.push({ table, column: colName, sql });
        liveQueries.push({
          type: 'ADD COLUMN',
          table,
          column: colName,
          sql
        });
      } else {
        // Compare types
        const localType = col.COLUMN_TYPE.toLowerCase().trim();
        const liveType = liveColMap[colName].type.toLowerCase().trim();
        // Normalize int vs int(11)
        const normLocal = localType.replace(/int\(\d+\)/, 'int');
        const normLive = liveType.replace(/int\(\d+\)/, 'int');
        if (normLocal !== normLive) {
          typeMismatches.push({
            table,
            column: colName,
            localType: col.COLUMN_TYPE,
            liveType: liveColMap[colName].raw
          });
        }
      }
    }
  }

  console.log(`Missing columns in Live: ${missingColsInLive.length}`);
  missingColsInLive.forEach(c => console.log(`  - \`${c.table}\`.\`${c.column}\``));

  if (typeMismatches.length > 0) {
    console.log(`\nColumn Type Differences:`);
    typeMismatches.forEach(tm => {
      console.log(`  - \`${tm.table}\`.\`${tm.column}\`: Local = ${tm.localType} | Live = ${tm.liveType}`);
    });
  }

  // C. Indexes comparison
  console.log(`\n=== 3. INDEXES COMPARISON ===`);
  const missingIndexesInLive = [];

  for (const table of localTableNames) {
    if (!liveTables[table]) continue;

    const [indexes] = await pool.query(`
      SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX, SUB_PART
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `, [dbName, table]);

    // Group local indexes
    const localIndexMap = {};
    for (const idx of indexes) {
      if (!localIndexMap[idx.INDEX_NAME]) {
        localIndexMap[idx.INDEX_NAME] = {
          name: idx.INDEX_NAME,
          unique: idx.NON_UNIQUE === 0,
          columns: []
        };
      }
      const colStr = idx.SUB_PART ? `\`${idx.COLUMN_NAME}\`(${idx.SUB_PART})` : `\`${idx.COLUMN_NAME}\``;
      localIndexMap[idx.INDEX_NAME].columns.push(colStr);
    }

    const liveIndexes = liveTables[table].indexes;
    const livePKs = liveTables[table].primaryKeys;

    for (const [idxName, idxInfo] of Object.entries(localIndexMap)) {
      if (idxName === 'PRIMARY') {
        // Check primary key
        if (livePKs.length === 0) {
          console.log(`  ⚠️ Primary key missing on Live for \`${table}\``);
        }
        continue;
      }

      // Check if index exists in live
      // Look for same index name or same columns
      let found = false;
      if (liveIndexes[idxName]) {
        found = true;
      } else {
        // Check if there is an index with exact same columns
        const colsJoined = idxInfo.columns.join(',').replace(/`|\(\d+\)/g, '');
        for (const [liveIdxName, liveIdx] of Object.entries(liveIndexes)) {
          const liveColsJoined = liveIdx.columns.join(',');
          if (colsJoined === liveColsJoined) {
            found = true;
            break;
          }
        }
      }

      if (!found) {
        const uniqueStr = idxInfo.unique ? 'UNIQUE ' : '';
        const sql = `ALTER TABLE \`${table}\` ADD ${uniqueStr}INDEX \`${idxName}\` (${idxInfo.columns.join(', ')});`;
        missingIndexesInLive.push({ table, index: idxName, sql });
        liveQueries.push({
          type: 'ADD INDEX',
          table,
          index: idxName,
          sql
        });
      }
    }
  }

  console.log(`Missing indexes in Live: ${missingIndexesInLive.length}`);
  missingIndexesInLive.forEach(i => console.log(`  - \`${i.table}\`.\`${i.index}\``));

  // Output all queries required for Live DB
  console.log(`\n======================================================`);
  console.log(`=== COMPLETE SQL MIGRATION SCRIPT FOR LIVE DB ===`);
  console.log(`======================================================\n`);

  if (liveQueries.length === 0) {
    console.log('-- No queries needed! Live DB is 100% in sync with Local DB.');
  } else {
    for (const q of liveQueries) {
      console.log(`-- [${q.type}] on ${q.table}`);
      console.log(q.sql);
      console.log();
    }
  }

  await pool.end();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
