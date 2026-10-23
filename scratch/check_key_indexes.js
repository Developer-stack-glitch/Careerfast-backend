const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function checkIndexes() {
  const sqlPath = path.resolve(__dirname, '../../live_db.sql');
  const fileStream = fs.createReadStream(sqlPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const targetIndexes = [
    'idx_users_role_active',
    'idx_users_created_date',
    'idx_users_location',
    'idx_users_gender',
    'idx_users_last_login',
    'idx_users_role_comp',
    'idx_user_prof_user_del',
    'idx_user_prof_curr',
    'idx_user_prof_title',
    'idx_user_prof_comp',
    'idx_user_prof_desig',
    'idx_user_edu_user_del',
    'idx_user_edu_course',
    'idx_user_edu_qual',
    'idx_applied_postId',
    'idx_job_post_user',
    'idx_ticket_created_at',
    'uniq_user_id'
  ];

  const found = {};
  for (const idx of targetIndexes) found[idx] = false;

  for await (const line of rl) {
    for (const idx of targetIndexes) {
      if (line.includes(`\`${idx}\``) || line.includes(` ${idx} `) || line.includes(` ${idx}(`)) {
        found[idx] = true;
      }
    }
  }

  console.log('Index Presence in live_db.sql:');
  for (const [idx, isPresent] of Object.entries(found)) {
    console.log(`  ${idx}: ${isPresent ? 'EXISTS' : '❌ MISSING'}`);
  }
}

checkIndexes().catch(console.error);
