const pool = require('../config/dbConfig');

async function test() {
  try {
    const [team] = await pool.query('SELECT * FROM sub_recruiters');
    console.log('Sub recruiters:', JSON.stringify(team, null, 2));
    const mainIds = [...new Set(team.map(t => t.main_recruiter_id))];
    const subIds = [...new Set(team.map(t => t.sub_recruiter_id))];
    const [users] = await pool.query('SELECT id, first_name, last_name, email FROM users WHERE id IN (?)', [[...mainIds, ...subIds]]);
    console.log('Users in team:', users);
    const [subs] = await pool.query('SELECT rs.*, sp.name as plan_name, sp.job_post_limit, sp.active_job_limit FROM recruiter_subscriptions rs JOIN subscription_plans sp ON rs.plan_id = sp.id WHERE rs.recruiter_id IN (?)', [mainIds]);
    console.log('Subscriptions:', subs);
    const [usage] = await pool.query('SELECT * FROM subscription_usage WHERE subscription_id IN (?)', [subs.map(s => s.id)]);
    console.log('Usage:', usage);
    const [jobs] = await pool.query('SELECT id, user_id, job_title, approval_status, is_closed FROM job_post WHERE user_id IN (?)', [mainIds]);
    console.log('Jobs posted by main recruiter:', jobs);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

test();
