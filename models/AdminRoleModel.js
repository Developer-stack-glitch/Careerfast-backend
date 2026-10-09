const pool = require('../config/dbConfig');

const DEFAULT_PORTAL_MODULES = [
  // ── DASHBOARD ──
  {
    id: 'dashboard_recruiter',
    group: 'DASHBOARD',
    name: 'Recruiters Dashboard',
    actions: ['scoreboard_kpis', 'growth_trends', 'demographics_breakdown', 'recent_activity_feed', 'export_dashboard_pdf', 'realtime_stat_refresh']
  },
  {
    id: 'dashboard_job_seekers',
    group: 'DASHBOARD',
    name: 'Job Seekers Dashboard',
    actions: ['job_seekers_kpis', 'talent_registration_chart', 'skills_education_breakdown', 'recent_talent_activity', 'export_talent_stats', 'realtime_talent_refresh']
  },

  // ── RECRUITER MANAGEMENT ──
  {
    id: 'recruiters',
    group: 'RECRUITER MANAGEMENT',
    name: 'Recruiter & Company Management',
    actions: ['view_recruiters_directory', 'add_recruiter_button', 'view_recruiter_profile', 'edit_recruiter_profile', 'toggle_recruiter_status', 'toggle_auto_approve', 'change_plan_modal', 'assign_custom_plan_modal', 'extend_subscription_modal', 'reset_recruiter_password', 'login_as_recruiter_button', 'manage_recruiter_team', 'export_recruiters_data']
  },
  {
    id: 'job_posts',
    group: 'RECRUITER MANAGEMENT',
    name: 'Job Listings & Moderation',
    actions: ['view_job_directory', 'view_pending_jobs', 'approve_single_job', 'bulk_approve_all_jobs', 'reject_job_post', 'view_job_details_modal', 'edit_job_post', 'toggle_job_active', 'expire_job_post', 'delete_job_post', 'view_job_applicants']
  },
  {
    id: 'plans',
    group: 'RECRUITER MANAGEMENT',
    name: 'Recruiter Subscriptions',
    actions: ['view_plans_table', 'add_plan_button', 'edit_plan_details', 'duplicate_plan_action', 'toggle_plan_status', 'delete_plan_action', 'view_plan_subscribers']
  },

  // ── TALENT MANAGEMENT ──
  {
    id: 'job_seekers',
    group: 'TALENT MANAGEMENT',
    name: 'Job Seekers & Talent Pool',
    actions: ['view_seekers_directory', 'view_candidate_profile_full', 'download_candidate_resume', 'verify_candidate_profile_badge', 'toggle_candidate_account_status', 'export_candidates_roster', 'delete_candidate_profile']
  },
  {
    id: 'talent_subscriptions',
    group: 'TALENT MANAGEMENT',
    name: 'Talent Subscriptions',
    actions: ['view_talent_subscriptions', 'manage_talent_tiers', 'view_talent_subscribers', 'grant_talent_pro_access', 'export_talent_subscriptions']
  },

  // ── REPORT ──
  {
    id: 'report_recruiters',
    group: 'REPORT',
    name: 'Recruiter Reports & Analytics',
    actions: ['view_growth_charts', 'recruiter_metrics', 'jobs_performance_analytics', 'applications_pipeline_funnel', 'export_analytics_excel', 'user_retention_cohorts', 'revenue_forecasts']
  },
  {
    id: 'report_job_seekers',
    group: 'REPORT',
    name: 'Job Seeker Reports',
    actions: ['view_candidate_growth_report', 'skills_demand_analytics', 'application_submission_trends', 'resume_download_audit_report', 'export_job_seekers_report']
  },

  // ── SYSTEM ──
  {
    id: 'support',
    group: 'SYSTEM',
    name: 'Support & Help Desk',
    actions: ['view_all_tickets', 'filter_by_ticket_status', 'reply_to_ticket_thread', 'change_ticket_priority_status', 'assign_ticket_to_agent', 'close_resolve_ticket', 'delete_support_ticket']
  },
  {
    id: 'user_management',
    group: 'SYSTEM',
    name: 'Users & Roles Management',
    actions: ['view_subadmin_roster', 'create_subadmin_account', 'edit_subadmin_details', 'modify_security_permissions', 'suspend_subadmin_account', 'reset_subadmin_password', 'delete_subadmin_account', 'export_audit_logs']
  },
  {
    id: 'roles_permissions',
    group: 'SYSTEM',
    name: 'Roles & Permissions',
    actions: ['view_roles_matrix', 'create_custom_role', 'edit_role_permissions', 'clone_role_template', 'delete_custom_role', 'export_roles_overview']
  },
  {
    id: 'settings',
    group: 'SYSTEM',
    name: 'Platform Settings & Configuration',
    actions: ['view_system_settings', 'modify_company_info', 'configure_smtp_email', 'manage_integrations', 'system_maintenance']
  }
];

const TOTAL_PORTAL_ACTIONS = DEFAULT_PORTAL_MODULES.reduce((sum, m) => sum + m.actions.length, 0);

const generatePresetPermissions = (type) => {
  const perms = {};
  DEFAULT_PORTAL_MODULES.forEach(mod => {
    if (type === 'super_admin') {
      const modPerms = { view: true, create_edit: true, delete: true };
      mod.actions.forEach(act => { modPerms[act] = true; });
      perms[mod.id] = modPerms;
    } else if (type === 'operations') {
      const isOperational = ['dashboard_recruiter', 'dashboard_job_seekers', 'recruiters', 'job_posts', 'plans', 'job_seekers', 'talent_subscriptions', 'support'].includes(mod.id);
      const modPerms = { view: isOperational, create_edit: isOperational, delete: false };
      mod.actions.forEach(act => {
        if (isOperational && !act.includes('delete') && !act.includes('reset')) {
          modPerms[act] = true;
        }
      });
      perms[mod.id] = modPerms;
    } else if (type === 'moderator') {
      const isMod = ['dashboard_recruiter', 'job_posts', 'job_seekers', 'support'].includes(mod.id);
      const modPerms = { view: isMod, create_edit: isMod, delete: false };
      mod.actions.forEach(act => {
        if (['view_job_directory', 'view_pending_jobs', 'approve_single_job', 'bulk_approve_all_jobs', 'reject_job_post', 'view_job_details_modal', 'view_seekers_directory', 'view_candidate_profile_full', 'verify_candidate_profile_badge', 'view_all_tickets', 'reply_to_ticket_thread', 'scoreboard_kpis'].includes(act)) {
          modPerms[act] = true;
        }
      });
      perms[mod.id] = modPerms;
    } else if (type === 'billing') {
      const isBilling = ['dashboard_recruiter', 'plans', 'talent_subscriptions', 'recruiters', 'report_recruiters'].includes(mod.id);
      const modPerms = { view: isBilling, create_edit: isBilling, delete: false };
      mod.actions.forEach(act => {
        if (['view_plans_table', 'add_plan_button', 'edit_plan_details', 'duplicate_plan_action', 'view_plan_subscribers', 'view_talent_subscriptions', 'manage_talent_tiers', 'view_talent_subscribers', 'grant_talent_pro_access', 'export_talent_subscriptions', 'change_plan_modal', 'assign_custom_plan_modal', 'extend_subscription_modal', 'export_recruiters_data', 'view_recruiters_directory', 'scoreboard_kpis', 'recruiter_metrics', 'revenue_forecasts'].includes(act)) {
          modPerms[act] = true;
        }
      });
      perms[mod.id] = modPerms;
    } else if (type === 'auditor') {
      const modPerms = { view: true, create_edit: false, delete: false };
      mod.actions.forEach(act => {
        if (act.startsWith('view_') || act.includes('metrics') || act.includes('scoreboard') || act.includes('chart') || act.includes('analytics') || act.includes('report')) {
          modPerms[act] = true;
        }
      });
      perms[mod.id] = modPerms;
    } else if (type === 'support') {
      const isSupport = ['dashboard_recruiter', 'support', 'job_seekers', 'recruiters'].includes(mod.id);
      const modPerms = { view: isSupport, create_edit: isSupport, delete: false };
      mod.actions.forEach(act => {
        if (['view_all_tickets', 'filter_by_ticket_status', 'reply_to_ticket_thread', 'change_ticket_priority_status', 'assign_ticket_to_agent', 'close_resolve_ticket', 'view_seekers_directory', 'view_candidate_profile_full', 'view_recruiters_directory', 'view_recruiter_profile', 'scoreboard_kpis'].includes(act)) {
          modPerms[act] = true;
        }
      });
      perms[mod.id] = modPerms;
    }
  });
  return perms;
};

const DEFAULT_SEEDED_ROLES = [
  {
    role_name: 'Super Admin',
    role_title: 'Full Super Admin',
    description: 'Unrestricted master access across all 5 navigation groups, modules, platform settings and user permissions.',
    department: 'Executive Management',
    is_super_admin: 1,
    is_system_role: 1,
    permissions: generatePresetPermissions('super_admin')
  },
  {
    role_name: 'Operations Manager',
    role_title: 'Operations Manager',
    description: 'Operational control over recruiters, job listings, talent pool, candidate subscriptions, and support tickets.',
    department: 'Operations',
    is_super_admin: 0,
    is_system_role: 1,
    permissions: generatePresetPermissions('operations')
  },
  {
    role_name: 'Content & Job Moderator',
    role_title: 'Content & Job Moderator',
    description: 'Dedicated to reviewing, approving, rejecting, and moderating job postings, candidate badges, and incoming tickets.',
    department: 'Moderation & Quality',
    is_super_admin: 0,
    is_system_role: 1,
    permissions: generatePresetPermissions('moderator')
  },
  {
    role_name: 'Billing & Subscriptions Admin',
    role_title: 'Billing & Subscriptions Admin',
    description: 'Manage pricing tiers, custom recruiter packages, validity extensions, and billing reports.',
    department: 'Finance & Billing',
    is_super_admin: 0,
    is_system_role: 1,
    permissions: generatePresetPermissions('billing')
  },
  {
    role_name: 'Customer Support Lead',
    role_title: 'Customer Support Lead',
    description: 'Manage user inquiries, reply to tickets, review candidate records, and resolve recruiter issues.',
    department: 'Customer Support',
    is_super_admin: 0,
    is_system_role: 1,
    permissions: generatePresetPermissions('support')
  },
  {
    role_name: 'Read-Only Auditor',
    role_title: 'Read-Only Auditor',
    description: 'View-only visibility across platform analytics, recruiter records, jobs, and candidate rosters.',
    department: 'Executive Management',
    is_super_admin: 0,
    is_system_role: 1,
    permissions: generatePresetPermissions('auditor')
  }
];

let tableInitialized = false;

const ensureTable = async () => {
  if (tableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(100) NOT NULL UNIQUE,
        role_title VARCHAR(100) NOT NULL,
        description TEXT,
        department VARCHAR(100) DEFAULT 'Operations',
        is_super_admin TINYINT(1) DEFAULT 0,
        is_system_role TINYINT(1) DEFAULT 0,
        permissions LONGTEXT,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Check if empty, seed default roles
    const [countRes] = await pool.query('SELECT COUNT(*) as cnt FROM admin_roles');
    if (countRes[0]?.cnt === 0) {
      for (const r of DEFAULT_SEEDED_ROLES) {
        await pool.query(
          `INSERT IGNORE INTO admin_roles 
           (role_name, role_title, description, department, is_super_admin, is_system_role, permissions)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            r.role_name,
            r.role_title,
            r.description,
            r.department,
            r.is_super_admin,
            r.is_system_role,
            JSON.stringify(r.permissions)
          ]
        );
      }
    }
    tableInitialized = true;
  } catch (err) {
    console.error('Error in AdminRoleModel ensureTable:', err.message);
  }
};

const AdminRoleModel = {
  getAllRoles: async () => {
    await ensureTable();
    try {
      const [roles] = await pool.query(
        `SELECT 
           r.id,
           r.role_name,
           r.role_title,
           r.description,
           r.department,
           r.is_super_admin,
           r.is_system_role,
           r.permissions,
           r.created_at,
           r.updated_at,
           (
             SELECT COUNT(*) 
             FROM admin_permissions ap 
             JOIN users u ON ap.user_id = u.id 
             WHERE u.role_id = 1 AND (ap.role_title = r.role_title OR ap.role_title = r.role_name)
           ) as user_count
         FROM admin_roles r
         ORDER BY r.is_super_admin DESC, r.is_system_role DESC, r.id ASC`
      );

      return roles.map(role => {
        let perms = {};
        try {
          perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : (role.permissions || {});
        } catch (e) {
          perms = {};
        }

        // Count action permissions
        let grantedActionsCount = 0;
        if (role.is_super_admin) {
          grantedActionsCount = TOTAL_PORTAL_ACTIONS;
        } else {
          Object.values(perms).forEach(modObj => {
            if (typeof modObj === 'object' && modObj !== null) {
              Object.entries(modObj).forEach(([k, v]) => {
                if (v === true && k !== 'view' && k !== 'create_edit' && k !== 'delete') {
                  grantedActionsCount++;
                }
              });
            }
          });
        }

        return {
          ...role,
          permissions: perms,
          granted_actions_count: grantedActionsCount
        };
      });
    } catch (error) {
      console.error('Error in AdminRoleModel.getAllRoles:', error);
      throw error;
    }
  },

  getRoleById: async (id) => {
    await ensureTable();
    try {
      const [rows] = await pool.query('SELECT * FROM admin_roles WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      const role = rows[0];
      try {
        role.permissions = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : (role.permissions || {});
      } catch (e) {
        role.permissions = {};
      }
      return role;
    } catch (error) {
      console.error('Error in AdminRoleModel.getRoleById:', error);
      throw error;
    }
  },

  createRole: async (data, creatorId = null) => {
    await ensureTable();
    try {
      const {
        role_name,
        role_title,
        description = '',
        department = 'Operations',
        is_super_admin = 0,
        permissions = {}
      } = data;

      const title = role_title || role_name;
      const name = role_name || role_title;

      // Check unique
      const [existing] = await pool.query('SELECT id FROM admin_roles WHERE role_name = ? OR role_title = ?', [name, title]);
      if (existing.length > 0) {
        throw new Error('A role with this name or title already exists.');
      }

      const [res] = await pool.query(
        `INSERT INTO admin_roles 
         (role_name, role_title, description, department, is_super_admin, is_system_role, permissions, created_by)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          name,
          title,
          description,
          department,
          is_super_admin ? 1 : 0,
          JSON.stringify(permissions || {}),
          creatorId
        ]
      );

      return { id: res.insertId, role_name: name, role_title: title, department };
    } catch (error) {
      console.error('Error in AdminRoleModel.createRole:', error);
      throw error;
    }
  },

  updateRole: async (id, data, modifierId = null) => {
    await ensureTable();
    try {
      const {
        role_name,
        role_title,
        description,
        department,
        is_super_admin,
        permissions
      } = data;

      const updates = [];
      const params = [];

      if (role_name !== undefined) {
        updates.push('role_name = ?');
        params.push(role_name);
      }
      if (role_title !== undefined) {
        updates.push('role_title = ?');
        params.push(role_title);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (department !== undefined) {
        updates.push('department = ?');
        params.push(department);
      }
      if (is_super_admin !== undefined) {
        updates.push('is_super_admin = ?');
        params.push(is_super_admin ? 1 : 0);
      }
      if (permissions !== undefined) {
        updates.push('permissions = ?');
        params.push(JSON.stringify(permissions));
      }

      if (updates.length > 0) {
        params.push(id);
        await pool.query(`UPDATE admin_roles SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      return true;
    } catch (error) {
      console.error('Error in AdminRoleModel.updateRole:', error);
      throw error;
    }
  },

  deleteRole: async (id, modifierId = null) => {
    await ensureTable();
    try {
      const [existing] = await pool.query('SELECT * FROM admin_roles WHERE id = ?', [id]);
      if (existing.length === 0) {
        throw new Error('Role not found.');
      }
      if (existing[0].is_super_admin || existing[0].id === 1) {
        throw new Error('Super Admin role cannot be deleted.');
      }

      // Check if users currently have this role
      const roleTitle = existing[0].role_title;
      const roleName = existing[0].role_name;
      const [assignedUsers] = await pool.query(
        `SELECT COUNT(*) as count FROM admin_permissions ap 
         JOIN users u ON ap.user_id = u.id 
         WHERE u.role_id = 1 AND (ap.role_title = ? OR ap.role_title = ?)`,
        [roleTitle, roleName]
      );

      if (assignedUsers[0]?.count > 0) {
        throw new Error(`Cannot delete role "${roleTitle}" because it is currently assigned to ${assignedUsers[0].count} administrator(s). Please reassign those users first.`);
      }

      await pool.query('DELETE FROM admin_roles WHERE id = ?', [id]);
      return true;
    } catch (error) {
      console.error('Error in AdminRoleModel.deleteRole:', error);
      throw error;
    }
  }
};

module.exports = AdminRoleModel;
