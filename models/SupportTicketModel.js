const pool = require("../config/dbConfig");

const userTypeExpr = `COALESCE(
  t.user_type,
  CASE 
    WHEN u.role_id = 3 THEN 'recruiter'
    WHEN u.role_id = 2 THEN 'candidate'
    WHEN t.category IN ('Recruiter Verification', 'Job Posting', 'Billing & Payment', 'Payment & Billing', 'Employer / Verification', 'Employer Verification') THEN 'recruiter'
    ELSE 'candidate'
  END
)`;

const SupportTicketModel = {
  // Ensure tables exist and seed demo data if empty
  initTable: async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS support_tickets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ticket_number VARCHAR(50) NOT NULL UNIQUE,
          user_id INT NULL,
          user_type VARCHAR(50) DEFAULT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50) NULL,
          category VARCHAR(100) DEFAULT 'General Inquiry',
          priority ENUM('Low', 'Medium', 'High', 'Urgent') DEFAULT 'Medium',
          status ENUM('Open', 'In Progress', 'Closed') DEFAULT 'Open',
          subject VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_ticket_status (status),
          INDEX idx_ticket_priority (priority),
          INDEX idx_ticket_number (ticket_number),
          INDEX idx_ticket_email (email),
          INDEX idx_ticket_user_type (user_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      // Ensure user_type column exists
      try {
        await pool.query(`ALTER TABLE support_tickets ADD COLUMN user_type VARCHAR(50) DEFAULT NULL AFTER user_id`);
      } catch (colErr) {
        // column already exists
      }

      await pool.query(`
        CREATE TABLE IF NOT EXISTS ticket_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ticket_id INT NOT NULL,
          sender ENUM('User', 'Admin', 'Support') DEFAULT 'User',
          sender_name VARCHAR(255) NOT NULL,
          text TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_ticket_msg_ticket_id (ticket_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      // Check if table is empty to seed initial demo tickets
      const [rows] = await pool.query(`SELECT COUNT(*) as count FROM support_tickets`);
      if (rows[0].count === 0) {
        const demoTickets = [
          {
            ticket_number: 'TKT-1009',
            name: 'Subaash PM',
            email: 'subaash@gradlearn.in',
            phone: '+91 9876543219',
            category: 'Technical Issue',
            priority: 'Medium',
            status: 'Closed',
            user_type: 'recruiter',
            subject: 'Email notifications not working',
            description: 'I am not receiving email notifications whenever new applicant resumes arrive for our posted job.',
            created_at: new Date(Date.now() - 3 * 86400000)
          },
          {
            ticket_number: 'TKT-1006',
            name: 'Lakshmi B',
            email: 'lakshmi.b@ptechnosoft.com',
            phone: '+91 9876543216',
            category: 'Job Posting',
            priority: 'High',
            status: 'Open',
            user_type: 'recruiter',
            subject: 'Assistance with Senior Tech Lead job posting review',
            description: 'My recent job posting for Senior Full Stack Developer was drafted. Could you please clarify what needs to be verified?',
            created_at: new Date(Date.now() - 1 * 86400000)
          },
          {
            ticket_number: 'TKT-1013',
            name: 'Demo Testing',
            email: 'balaji@actetechnologies.com',
            phone: '+91 9876543213',
            category: 'Billing & Payment',
            priority: 'Medium',
            status: 'In Progress',
            user_type: 'recruiter',
            subject: 'Invoice query regarding Enterprise plan renewal',
            description: 'Could you send the GST-compliant invoice for our quarterly subscription renewal?',
            created_at: new Date(Date.now() - 2 * 86400000)
          },
          {
            ticket_number: 'TKT-1024',
            name: 'Santhosh kathirvel',
            email: 'actewpdeveloper1@gmail.com',
            phone: '+91 9876543211',
            category: 'Account & Login',
            priority: 'Urgent',
            status: 'Open',
            user_type: 'candidate',
            subject: 'Cannot update profile resume file',
            description: 'I am experiencing an issue while uploading my new PDF resume on candidate dashboard.',
            created_at: new Date(Date.now() - 2 * 3600000)
          },
          {
            ticket_number: 'TKT-1025',
            name: 'Santhosh kathirvel',
            email: 'actewpdeveloper1@gmail.com',
            phone: '+91 9876543214',
            category: 'Feature Request',
            priority: 'Medium',
            status: 'Closed',
            user_type: 'candidate',
            subject: 'Requesting Dark Mode on candidate job search',
            description: 'It would be great to have dark mode supported across the Candidate Search dashboard for easier night screening.',
            created_at: new Date(Date.now() - 4 * 3600000)
          }
        ];

        for (const t of demoTickets) {
          const [res] = await pool.query(`
            INSERT INTO support_tickets 
            (ticket_number, user_type, name, email, phone, category, priority, status, subject, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [t.ticket_number, t.user_type, t.name, t.email, t.phone, t.category, t.priority, t.status, t.subject, t.description, t.created_at]);

          // Seed default messages
          await pool.query(`
            INSERT INTO ticket_messages (ticket_id, sender, sender_name, text, created_at)
            VALUES (?, 'User', ?, ?, ?)
          `, [res.insertId, t.name, t.description, t.created_at]);

          if (t.status !== 'Open') {
            await pool.query(`
              INSERT INTO ticket_messages (ticket_id, sender, sender_name, text, created_at)
              VALUES (?, 'Admin', 'Support Team', 'We have reviewed your request and our team is handling this.', ?)
            `, [res.insertId, new Date(t.created_at.getTime() + 1800000)]);
          }
        }
        console.log("⚡ [Support Tickets] Initial demo tickets seeded successfully");
      }
    } catch (err) {
      console.warn("⚠️ [Support Tickets] initTable check:", err.message);
    }
  },

  // Create new ticket
  createTicket: async ({ name, email, phone, category, priority, subject, description, user_id, user_type }) => {
    try {
      // Find next sequential ticket number
      const [lastRow] = await pool.query(`
        SELECT ticket_number FROM support_tickets ORDER BY id DESC LIMIT 1
      `);
      let nextNum = 1001;
      if (lastRow.length > 0 && lastRow[0].ticket_number) {
        const match = lastRow[0].ticket_number.match(/TKT-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        } else {
          nextNum = Math.floor(1000 + Math.random() * 9000);
        }
      }
      const ticket_number = `TKT-${nextNum}`;

      // Resolve user_type dynamically if not provided
      let resolvedType = user_type;
      if (!resolvedType) {
        if (user_id) {
          const [uRows] = await pool.query(`SELECT role_id FROM users WHERE id = ?`, [user_id]);
          if (uRows.length > 0) {
            resolvedType = uRows[0].role_id === 3 ? 'recruiter' : 'candidate';
          }
        }
        if (!resolvedType && email) {
          const [uRows] = await pool.query(`SELECT role_id FROM users WHERE email = ?`, [email]);
          if (uRows.length > 0) {
            resolvedType = uRows[0].role_id === 3 ? 'recruiter' : 'candidate';
          }
        }
        if (!resolvedType) {
          const recruiterCats = ['Recruiter Verification', 'Job Posting', 'Billing & Payment', 'Payment & Billing', 'Employer / Verification', 'Employer Verification'];
          resolvedType = recruiterCats.includes(category) ? 'recruiter' : 'candidate';
        }
      }

      const [res] = await pool.query(`
        INSERT INTO support_tickets 
        (ticket_number, user_id, user_type, name, email, phone, category, priority, status, subject, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?)
      `, [
        ticket_number,
        user_id || null,
        resolvedType,
        name || 'Anonymous User',
        email,
        phone || null,
        category || 'General Inquiry',
        priority || 'Medium',
        subject,
        description
      ]);

      const ticketId = res.insertId;

      // Add initial user message
      await pool.query(`
        INSERT INTO ticket_messages (ticket_id, sender, sender_name, text)
        VALUES (?, 'User', ?, ?)
      `, [ticketId, name || 'User', description]);

      return {
        id: ticket_number,
        ticket_id: ticketId,
        ticket_number,
        user_type: resolvedType,
        name,
        email,
        phone,
        category,
        priority: priority || 'Medium',
        status: 'Open',
        subject,
        description,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // Get all tickets with pagination and filtering
  getAllTickets: async ({ search = '', status = 'All', priority = 'All', category = 'All', user_type = 'All', page = 1, limit = 50, email = '' } = {}) => {
    try {
      let conditions = [];
      let params = [];

      if (search) {
        conditions.push(`(t.ticket_number LIKE ? OR t.subject LIKE ? OR t.name LIKE ? OR t.email LIKE ? OR u.organization LIKE ?)`);
        const searchWildcard = `%${search}%`;
        params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard);
      }

      if (status && status !== 'All') {
        conditions.push(`t.status = ?`);
        params.push(status);
      }

      if (priority && priority !== 'All') {
        conditions.push(`t.priority = ?`);
        params.push(priority);
      }

      if (category && category !== 'All') {
        conditions.push(`t.category = ?`);
        params.push(category);
      }

      if (user_type && user_type !== 'All') {
        conditions.push(`${userTypeExpr} = ?`);
        params.push(user_type.toLowerCase());
      }

      if (email) {
        conditions.push(`t.email = ?`);
        params.push(email);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total 
         FROM support_tickets t 
         LEFT JOIN users u ON (t.user_id = u.id OR (t.user_id IS NULL AND t.email = u.email))
         ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      // Data query
      const offset = (page - 1) * limit;
      const [rows] = await pool.query(`
        SELECT 
          t.*,
          ${userTypeExpr} AS computed_user_type,
          u.role_id,
          u.organization,
          u.profile_image,
          (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id) as message_count
        FROM support_tickets t
        LEFT JOIN users u ON (t.user_id = u.id OR (t.user_id IS NULL AND t.email = u.email))
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

      // Format row objects for frontend
      const tickets = await Promise.all(rows.map(async (row) => {
        const [messages] = await pool.query(`
          SELECT sender, sender_name, text, created_at as time
          FROM ticket_messages 
          WHERE ticket_id = ? 
          ORDER BY created_at ASC
        `, [row.id]);

        return {
          id: row.ticket_number,
          db_id: row.id,
          _id: row.id.toString(),
          ticket_number: row.ticket_number,
          subject: row.subject,
          category: row.category,
          user_type: row.computed_user_type || row.user_type || 'candidate',
          user: {
            name: row.name,
            email: row.email,
            phone: row.phone,
            avatar: row.profile_image || null,
            role_id: row.role_id,
            organization: row.organization || null
          },
          status: row.status,
          priority: row.priority,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          description: row.description,
          messages: messages.map(m => ({
            sender: m.sender,
            sender_name: m.sender_name,
            text: m.text,
            time: m.time
          }))
        };
      }));

      return {
        tickets,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // Get single ticket by ID or Ticket Number
  getTicketById: async (idOrNumber) => {
    try {
      const isNum = !isNaN(Number(idOrNumber)) && !String(idOrNumber).startsWith('TKT-');
      const condition = isNum ? `t.id = ?` : `t.ticket_number = ?`;

      const [rows] = await pool.query(`
        SELECT 
          t.*,
          ${userTypeExpr} AS computed_user_type,
          u.role_id,
          u.organization,
          u.profile_image
        FROM support_tickets t 
        LEFT JOIN users u ON (t.user_id = u.id OR (t.user_id IS NULL AND t.email = u.email))
        WHERE ${condition} 
        LIMIT 1
      `, [idOrNumber]);

      if (rows.length === 0) return null;
      const row = rows[0];

      const [messages] = await pool.query(`
        SELECT id, sender, sender_name, text, created_at as time
        FROM ticket_messages 
        WHERE ticket_id = ? 
        ORDER BY created_at ASC
      `, [row.id]);

      return {
        id: row.ticket_number,
        db_id: row.id,
        _id: row.id.toString(),
        ticket_number: row.ticket_number,
        subject: row.subject,
        category: row.category,
        user_type: row.computed_user_type || row.user_type || 'candidate',
        user: {
          name: row.name,
          email: row.email,
          phone: row.phone,
          avatar: row.profile_image || null,
          role_id: row.role_id,
          organization: row.organization || null
        },
        status: row.status,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        description: row.description,
        messages: messages.map(m => ({
          id: m.id,
          sender: m.sender,
          sender_name: m.sender_name,
          text: m.text,
          time: m.time
        }))
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // Update status
  updateTicketStatus: async (idOrNumber, status) => {
    try {
      const isNum = !isNaN(Number(idOrNumber)) && !String(idOrNumber).startsWith('TKT-');
      const condition = isNum ? `id = ?` : `ticket_number = ?`;

      const [res] = await pool.query(`
        UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE ${condition}
      `, [status, idOrNumber]);

      return res.affectedRows > 0;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // Add message to ticket
  addTicketMessage: async (idOrNumber, { sender = 'User', sender_name = 'User', text }) => {
    try {
      const isNum = !isNaN(Number(idOrNumber)) && !String(idOrNumber).startsWith('TKT-');
      const condition = isNum ? `id = ?` : `ticket_number = ?`;

      const [rows] = await pool.query(`SELECT id FROM support_tickets WHERE ${condition} LIMIT 1`, [idOrNumber]);
      if (rows.length === 0) throw new Error('Ticket not found');

      const ticketId = rows[0].id;
      const [res] = await pool.query(`
        INSERT INTO ticket_messages (ticket_id, sender, sender_name, text)
        VALUES (?, ?, ?, ?)
      `, [ticketId, sender, sender_name, text]);

      // If user replies and ticket was closed, we can optionally change status or keep
      await pool.query(`UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [ticketId]);

      return {
        id: res.insertId,
        ticket_id: ticketId,
        sender,
        sender_name,
        text,
        time: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // Delete ticket
  deleteTicket: async (idOrNumber) => {
    try {
      const isNum = !isNaN(Number(idOrNumber)) && !String(idOrNumber).startsWith('TKT-');
      const condition = isNum ? `id = ?` : `ticket_number = ?`;

      const [rows] = await pool.query(`SELECT id FROM support_tickets WHERE ${condition} LIMIT 1`, [idOrNumber]);
      if (rows.length === 0) return false;

      const ticketId = rows[0].id;
      await pool.query(`DELETE FROM ticket_messages WHERE ticket_id = ?`, [ticketId]);
      const [res] = await pool.query(`DELETE FROM support_tickets WHERE id = ?`, [ticketId]);

      return res.affectedRows > 0;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // Get ticket stats
  getTicketStats: async (user_type = 'All') => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN t.status = 'Open' THEN 1 ELSE 0 END) as \`open\`,
          SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) as inprogress,
          SUM(CASE WHEN t.status = 'Closed' THEN 1 ELSE 0 END) as \`closed\`,

          SUM(CASE WHEN ${userTypeExpr} = 'recruiter' THEN 1 ELSE 0 END) as recruiter_total,
          SUM(CASE WHEN ${userTypeExpr} = 'recruiter' AND t.status = 'Open' THEN 1 ELSE 0 END) as recruiter_open,
          SUM(CASE WHEN ${userTypeExpr} = 'recruiter' AND t.status = 'In Progress' THEN 1 ELSE 0 END) as recruiter_inprogress,
          SUM(CASE WHEN ${userTypeExpr} = 'recruiter' AND t.status = 'Closed' THEN 1 ELSE 0 END) as recruiter_closed,

          SUM(CASE WHEN ${userTypeExpr} = 'candidate' THEN 1 ELSE 0 END) as candidate_total,
          SUM(CASE WHEN ${userTypeExpr} = 'candidate' AND t.status = 'Open' THEN 1 ELSE 0 END) as candidate_open,
          SUM(CASE WHEN ${userTypeExpr} = 'candidate' AND t.status = 'In Progress' THEN 1 ELSE 0 END) as candidate_inprogress,
          SUM(CASE WHEN ${userTypeExpr} = 'candidate' AND t.status = 'Closed' THEN 1 ELSE 0 END) as candidate_closed
        FROM support_tickets t
        LEFT JOIN users u ON (t.user_id = u.id OR (t.user_id IS NULL AND t.email = u.email))
      `);

      const r = rows[0] || {};
      const fullStats = {
        total: Number(r.total) || 0,
        open: Number(r.open) || 0,
        inprogress: Number(r.inprogress) || 0,
        closed: Number(r.closed) || 0,
        recruiter: {
          total: Number(r.recruiter_total) || 0,
          open: Number(r.recruiter_open) || 0,
          inprogress: Number(r.recruiter_inprogress) || 0,
          closed: Number(r.recruiter_closed) || 0
        },
        candidate: {
          total: Number(r.candidate_total) || 0,
          open: Number(r.candidate_open) || 0,
          inprogress: Number(r.candidate_inprogress) || 0,
          closed: Number(r.candidate_closed) || 0
        }
      };

      if (user_type && user_type.toLowerCase() === 'recruiter') {
        return {
          ...fullStats,
          total: fullStats.recruiter.total,
          open: fullStats.recruiter.open,
          inprogress: fullStats.recruiter.inprogress,
          closed: fullStats.recruiter.closed
        };
      } else if (user_type && user_type.toLowerCase() === 'candidate') {
        return {
          ...fullStats,
          total: fullStats.candidate.total,
          open: fullStats.candidate.open,
          inprogress: fullStats.candidate.inprogress,
          closed: fullStats.candidate.closed
        };
      }

      return fullStats;
    } catch (error) {
      throw new Error(error.message);
    }
  }
};

module.exports = SupportTicketModel;
