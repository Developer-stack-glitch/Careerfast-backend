const pool = require('../config/dbConfig');
const bcrypt = require('bcrypt');

const defaultModulePermissions = {
  dashboard: { view: true, create_edit: false, delete: false },
  analytics: { view: false, create_edit: false, delete: false },
  plans: { view: false, create_edit: false, delete: false },
  recruiters: { view: false, create_edit: false, delete: false },
  job_posts: { view: false, create_edit: false, delete: false },
  job_seekers: { view: false, create_edit: false, delete: false },
  applications: { view: false, create_edit: false, delete: false },
  support: { view: false, create_edit: false, delete: false },
  user_management: { view: false, create_edit: false, delete: false },
  settings: { view: false, create_edit: false, delete: false },
};

const AdminUserModel = {
  getAllAdminUsers: async (filters = {}) => {
    try {
      const { search = '', department = '', status = '', page = 1, limit = 20 } = filters;
      const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

      let whereClauses = ['u.role_id = 1'];
      let queryParams = [];

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        whereClauses.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR ap.role_title LIKE ?)');
        queryParams.push(term, term, term, term, term);
      }

      if (department && department !== 'all') {
        whereClauses.push('ap.department = ?');
        queryParams.push(department);
      }

      if (status !== '' && status !== 'all') {
        whereClauses.push('u.is_active = ?');
        queryParams.push(status === 'active' || status === '1' ? 1 : 0);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Count total
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total 
         FROM users u 
         LEFT JOIN admin_permissions ap ON u.id = ap.user_id 
         ${whereSql}`,
        queryParams
      );
      const total = countResult[0]?.total || 0;

      // Fetch items
       const [users] = await pool.query(
        `SELECT 
           u.id, 
           u.first_name, 
           u.last_name, 
           CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS full_name,
           u.email, 
           u.phone_code, 
           u.phone, 
           CAST(u.is_active AS UNSIGNED) AS is_active,
           u.created_date, 
           COALESCE(u.last_active, ap.updated_at, u.created_date, ap.created_at) AS last_active,
           ap.updated_at,
           u.profile_image,
           COALESCE(ap.is_super_admin, 0) AS is_super_admin,
           COALESCE(ap.role_title, 'Administrator') AS role_title,
           COALESCE(ap.department, 'Operations') AS department,
           ap.permissions,
           ap.created_at AS permission_assigned_at,
           creator.email AS created_by_email
         FROM users u
         LEFT JOIN admin_permissions ap ON u.id = ap.user_id
         LEFT JOIN users creator ON ap.created_by = creator.id
         ${whereSql}
         ORDER BY (u.id = 1) DESC, ap.is_super_admin DESC, u.id DESC
         LIMIT ? OFFSET ?`,
        [...queryParams, Number(limit), Number(offset)]
      );

      // Parse permissions JSON
      const formatted = users.map((user) => {
        let perms = null;
        if (user.permissions) {
          try {
            perms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
          } catch (e) {
            perms = null;
          }
        }
        if (!perms) {
          perms = user.is_super_admin
            ? {
                dashboard: { view: true, create_edit: true, delete: true },
                analytics: { view: true, create_edit: true, delete: true },
                plans: { view: true, create_edit: true, delete: true },
                recruiters: { view: true, create_edit: true, delete: true },
                job_posts: { view: true, create_edit: true, delete: true },
                job_seekers: { view: true, create_edit: true, delete: true },
                applications: { view: true, create_edit: true, delete: true },
                support: { view: true, create_edit: true, delete: true },
                user_management: { view: true, create_edit: true, delete: true },
                settings: { view: true, create_edit: true, delete: true },
              }
            : defaultModulePermissions;
        }
        return {
          ...user,
          permissions: perms,
        };
      });

      return {
        users: formatted,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      };
    } catch (error) {
      console.error('Error in AdminUserModel.getAllAdminUsers:', error);
      throw error;
    }
  },

  getAdminUserById: async (id) => {
    try {
      const [rows] = await pool.query(
        `SELECT 
           u.id, 
           u.first_name, 
           u.last_name, 
           u.email, 
           u.phone_code, 
           u.phone, 
           CAST(u.is_active AS UNSIGNED) AS is_active,
           u.created_date, 
           u.last_active,
           u.profile_image,
           COALESCE(ap.is_super_admin, CASE WHEN u.id = 1 THEN 1 ELSE 0 END) AS is_super_admin,
           COALESCE(ap.role_title, 'Administrator') AS role_title,
           COALESCE(ap.department, 'Operations') AS department,
           ap.permissions,
           ap.created_at AS permission_assigned_at,
           creator.email AS created_by_email
         FROM users u
         LEFT JOIN admin_permissions ap ON u.id = ap.user_id
         LEFT JOIN users creator ON ap.created_by = creator.id
         WHERE u.id = ? AND u.role_id = 1`,
        [id]
      );

      if (rows.length === 0) return null;

      const user = rows[0];
      let perms = defaultModulePermissions;
      if (user.is_super_admin) {
        perms = {
          dashboard: { view: true, create_edit: true, delete: true },
          analytics: { view: true, create_edit: true, delete: true },
          plans: { view: true, create_edit: true, delete: true },
          recruiters: { view: true, create_edit: true, delete: true },
          job_posts: { view: true, create_edit: true, delete: true },
          job_seekers: { view: true, create_edit: true, delete: true },
          applications: { view: true, create_edit: true, delete: true },
          support: { view: true, create_edit: true, delete: true },
          user_management: { view: true, create_edit: true, delete: true },
          settings: { view: true, create_edit: true, delete: true },
        };
      } else if (user.permissions) {
        try {
          perms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
        } catch (e) {
          perms = defaultModulePermissions;
        }
      }

      return {
        ...user,
        permissions: perms,
      };
    } catch (error) {
      console.error('Error in AdminUserModel.getAdminUserById:', error);
      throw error;
    }
  },

  createAdminUser: async (data, creatorId = null) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        first_name,
        last_name,
        email,
        phone,
        phone_code = '+91',
        password,
        role_title = 'Admin',
        department = 'Operations',
        is_super_admin = false,
        permissions = {},
      } = data;

      // Check if email already exists
      const [existing] = await connection.query('SELECT id, email, role_id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        throw new Error('An account with this email address already exists.');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password || 'Admin@123', 10);

      // 1. Insert into `users` table with role_id = 1 (Superadmin portal user)
      const [userResult] = await connection.query(
        `INSERT INTO users 
           (first_name, last_name, email, phone, phone_code, password, role_id, is_active, is_email_verified, created_date) 
         VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1, NOW())`,
        [first_name, last_name, email, phone || '', phone_code, hashedPassword]
      );

      const newUserId = userResult.insertId;

      // 2. Insert into `admin_permissions`
      const permissionsJson = JSON.stringify(permissions || defaultModulePermissions);
      await connection.query(
        `INSERT INTO admin_permissions 
           (user_id, is_super_admin, role_title, department, permissions, created_by) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newUserId, is_super_admin ? 1 : 0, role_title, department, permissionsJson, creatorId]
      );

      // 3. Log audit event
      try {
        await connection.query(
          `INSERT INTO admin_audit_logs (user_id, action, target_type, target_id, details, created_at)
           VALUES (?, 'CREATE_ADMIN_USER', 'users', ?, ?, NOW())`,
          [creatorId || 1, newUserId, JSON.stringify({ email, role_title, department, is_super_admin })]
        );
      } catch (logErr) {
        // Log error ignored if table structure differs
      }

      await connection.commit();
      return { id: newUserId, email, first_name, last_name };
    } catch (error) {
      await connection.rollback();
      console.error('Error in AdminUserModel.createAdminUser:', error);
      throw error;
    } finally {
      connection.release();
    }
  },

  updateAdminUser: async (id, data, modifierId = null) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        first_name,
        last_name,
        phone,
        phone_code = '+91',
        role_title,
        department,
        is_super_admin,
        permissions,
      } = data;

      // 1. Update basic user info
      let userUpdates = [];
      let userParams = [];

      if (first_name !== undefined) {
        userUpdates.push('first_name = ?');
        userParams.push(first_name);
      }
      if (last_name !== undefined) {
        userUpdates.push('last_name = ?');
        userParams.push(last_name);
      }
      if (phone !== undefined) {
        userUpdates.push('phone = ?');
        userParams.push(phone);
      }
      if (phone_code !== undefined) {
        userUpdates.push('phone_code = ?');
        userParams.push(phone_code);
      }

      if (userUpdates.length > 0) {
        userParams.push(id);
        await connection.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ? AND role_id = 1`, userParams);
      }

      // 2. Update permissions
      const finalSuperAdminFlag = is_super_admin !== undefined ? (is_super_admin ? 1 : 0) : undefined;

      let permUpdates = [];
      let permParams = [];

      if (role_title !== undefined) {
        permUpdates.push('role_title = ?');
        permParams.push(role_title);
      }
      if (department !== undefined) {
        permUpdates.push('department = ?');
        permParams.push(department);
      }
      if (finalSuperAdminFlag !== undefined) {
        permUpdates.push('is_super_admin = ?');
        permParams.push(finalSuperAdminFlag);
      }
      if (permissions !== undefined) {
        permUpdates.push('permissions = ?');
        permParams.push(JSON.stringify(permissions));
      }

      if (permUpdates.length > 0) {
        permParams.push(id);
        await connection.query(
          `INSERT INTO admin_permissions (user_id, role_title, department, is_super_admin, permissions)
           VALUES (?, COALESCE(?, 'Admin'), COALESCE(?, 'Operations'), COALESCE(?, 0), COALESCE(?, '{}'))
           ON DUPLICATE KEY UPDATE ${permUpdates.join(', ')}`,
          [
            id,
            role_title || 'Admin',
            department || 'Operations',
            finalSuperAdminFlag || 0,
            JSON.stringify(permissions || defaultModulePermissions),
            ...permParams,
          ]
        );
      }

      // 3. Log audit
      try {
        await connection.query(
          `INSERT INTO admin_audit_logs (user_id, action, target_type, target_id, details, created_at)
           VALUES (?, 'UPDATE_ADMIN_USER', 'users', ?, ?, NOW())`,
          [modifierId || 1, id, JSON.stringify({ role_title, department, is_super_admin })]
        );
      } catch (e) {}

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      console.error('Error in AdminUserModel.updateAdminUser:', error);
      throw error;
    } finally {
      connection.release();
    }
  },

  toggleAdminStatus: async (id, isActive, modifierId = null) => {
    try {
      if (Number(id) === 1) {
        throw new Error('Master Super Admin cannot be suspended.');
      }
      const newStatus = isActive ? 1 : 0;
      await pool.query('UPDATE users SET is_active = ? WHERE id = ? AND role_id = 1', [newStatus, id]);

      try {
        await pool.query(
          `INSERT INTO admin_audit_logs (user_id, action, target_type, target_id, details, created_at)
           VALUES (?, 'TOGGLE_ADMIN_STATUS', 'users', ?, ?, NOW())`,
          [modifierId || 1, id, JSON.stringify({ is_active: newStatus })]
        );
      } catch (e) {}

      return true;
    } catch (error) {
      console.error('Error in AdminUserModel.toggleAdminStatus:', error);
      throw error;
    }
  },

  resetAdminPassword: async (id, newPassword, modifierId = null) => {
    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password = ? WHERE id = ? AND role_id = 1', [hashedPassword, id]);

      try {
        await pool.query(
          `INSERT INTO admin_audit_logs (user_id, action, target_type, target_id, details, created_at)
           VALUES (?, 'RESET_ADMIN_PASSWORD', 'users', ?, ?, NOW())`,
          [modifierId || 1, id, JSON.stringify({ note: 'Password updated by admin' })]
        );
      } catch (e) {}

      return true;
    } catch (error) {
      console.error('Error in AdminUserModel.resetAdminPassword:', error);
      throw error;
    }
  },

  deleteAdminUser: async (id, modifierId = null) => {
    try {
      if (Number(id) === 1) {
        throw new Error('Master Super Admin cannot be deleted.');
      }
      if (modifierId && Number(modifierId) === Number(id)) {
        throw new Error('You cannot delete your own admin account.');
      }

      await pool.query('DELETE FROM users WHERE id = ? AND role_id = 1', [id]);

      try {
        await pool.query(
          `INSERT INTO admin_audit_logs (user_id, action, target_type, target_id, details, created_at)
           VALUES (?, 'DELETE_ADMIN_USER', 'users', ?, ?, NOW())`,
          [modifierId || 1, id, JSON.stringify({ deleted_admin_id: id })]
        );
      } catch (e) {}

      return true;
    } catch (error) {
      console.error('Error in AdminUserModel.deleteAdminUser:', error);
      throw error;
    }
  },
};

module.exports = AdminUserModel;
