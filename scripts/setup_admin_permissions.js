const pool = require('../config/dbConfig');

async function setup() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT(20) NOT NULL UNIQUE,
        is_super_admin TINYINT(1) DEFAULT 0,
        role_title VARCHAR(100) DEFAULT 'Admin',
        department VARCHAR(100) DEFAULT 'Operations',
        permissions LONGTEXT NOT NULL,
        created_by BIGINT(20) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ admin_permissions table ready');

    const fullPermissions = JSON.stringify({
      dashboard: { view: true, create_edit: true, delete: true },
      analytics: { view: true, create_edit: true, delete: true },
      plans: { view: true, create_edit: true, delete: true },
      recruiters: { view: true, create_edit: true, delete: true },
      job_posts: { view: true, create_edit: true, delete: true },
      job_seekers: { view: true, create_edit: true, delete: true },
      applications: { view: true, create_edit: true, delete: true },
      support: { view: true, create_edit: true, delete: true },
      user_management: { view: true, create_edit: true, delete: true },
      settings: { view: true, create_edit: true, delete: true }
    });

    const [superAdmins] = await pool.query('SELECT id FROM users WHERE role_id = 1');
    for (const admin of superAdmins) {
      await pool.query(`
        INSERT INTO admin_permissions (user_id, is_super_admin, role_title, department, permissions)
        VALUES (?, 1, 'Master Super Admin', 'Executive Management', ?)
        ON DUPLICATE KEY UPDATE is_super_admin = 1, role_title = 'Master Super Admin', permissions = ?
      `, [admin.id, fullPermissions, fullPermissions]);
    }

    console.log('✅ Seeded existing superadmin permissions successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin_permissions table:', err);
    process.exit(1);
  }
}

setup();
