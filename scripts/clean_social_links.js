const pool = require('../config/dbConfig');

async function cleanSocialLinks() {
  try {
    const [dups] = await pool.query(`
      SELECT user_id, COUNT(*) as count 
      FROM user_social_links 
      GROUP BY user_id 
      HAVING count > 1
    `);
    console.log(`Found ${dups.length} users with duplicate social links.`);

    for (const d of dups) {
      const [rows] = await pool.query(
        `SELECT * FROM user_social_links WHERE user_id = ? ORDER BY id DESC`,
        [d.user_id]
      );
      // Pick the row with the most non-null/non-empty values, or the latest (highest id)
      let bestRow = rows[0];
      let maxFilled = -1;

      for (const r of rows) {
        let filledCount = 0;
        ['linkedin', 'facebook', 'instagram', 'twitter', 'dribble', 'behance'].forEach(col => {
          if (r[col] && r[col].trim() !== '') filledCount++;
        });
        if (filledCount > maxFilled) {
          maxFilled = filledCount;
          bestRow = r;
        }
      }

      // Merge any other non-empty fields into bestRow
      const merged = { ...bestRow };
      for (const r of rows) {
        ['linkedin', 'facebook', 'instagram', 'twitter', 'dribble', 'behance'].forEach(col => {
          if ((!merged[col] || merged[col].trim() === '') && r[col] && r[col].trim() !== '') {
            merged[col] = r[col];
          }
        });
      }

      // Update bestRow with merged data
      await pool.query(
        `UPDATE user_social_links SET linkedin = ?, facebook = ?, instagram = ?, twitter = ?, dribble = ?, behance = ? WHERE id = ?`,
        [merged.linkedin, merged.facebook, merged.instagram, merged.twitter, merged.dribble, merged.behance, bestRow.id]
      );

      // Delete all other rows for this user_id
      const otherIds = rows.filter(r => r.id !== bestRow.id).map(r => r.id);
      if (otherIds.length > 0) {
        await pool.query(`DELETE FROM user_social_links WHERE id IN (?)`, [otherIds]);
      }
    }

    console.log('Duplicates cleaned successfully.');

    // Add unique key on user_id if not present
    try {
      await pool.query(`ALTER TABLE user_social_links ADD UNIQUE KEY uniq_user_id (user_id)`);
      console.log('Added UNIQUE KEY uniq_user_id (user_id) successfully.');
    } catch (idxErr) {
      if (idxErr.code === 'ER_DUP_KEYNAME') {
        console.log('UNIQUE KEY already exists.');
      } else {
        console.warn('Note on index:', idxErr.message);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error cleaning social links:', err);
    process.exit(1);
  }
}

cleanSocialLinks();
