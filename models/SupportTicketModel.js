const pool = require("../config/dbConfig");

const SupportTicketModel = {
  // Ensure tables exist and seed demo data if empty
  initTable: async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS support_tickets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ticket_number VARCHAR(50) NOT NULL UNIQUE,
          user_id INT NULL,
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
          INDEX idx_ticket_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

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
            name: 'Bob Smith',
            email: 'user9@example.com',
            phone: '+91 9876543219',
            category: 'Technical Issue',
            priority: 'Medium',
            status: 'Closed',
            subject: 'Email notifications not working',
            description: 'I am not receiving email notifications whenever new applicant resumes arrive for our posted job.',
            created_at: new Date(Date.now() - 3 * 86400000)
          },
          {
            ticket_number: 'TKT-1006',
            name: 'Fiona Gallagher',
            email: 'user6@example.com',
            phone: '+91 9876543216',
            category: 'Job Posting',
            priority: 'High',
            status: 'Closed',
            subject: 'Job posting rejected',
            description: 'My recent job posting for Senior Full Stack Developer was rejected. Could you please clarify what needs to be changed?',
            created_at: new Date(Date.now() - 5 * 86400000)
          },
          {
            ticket_number: 'TKT-1013',
            name: 'Evan Wright',
            email: 'user13@example.com',
            phone: '+91 9876543213',
            category: 'Billing & Payment',
            priority: 'Low',
            status: 'Open',
            subject: 'Payment failed for premium plan',
            description: 'I tried upgrading to the Pro Recruiter monthly plan but the transaction failed at the payment gateway.',
            created_at: new Date(Date.now() - 1 * 86400000)
          },
          {
            ticket_number: 'TKT-1024',
            name: 'Alice Johnson',
            email: 'alice@example.com',
            phone: '+91 9876543211',
            category: 'Account & Login',
            priority: 'Urgent',
            status: 'In Progress',
            subject: 'Cannot access my account',
            description: 'I am locked out of my corporate recruiter account after updating my work email. Please help immediately.',
            created_at: new Date(Date.now() - 2 * 3600000)
          },
          {
            ticket_number: 'TKT-1025',
            name: 'Diana Prince',
            email: 'diana@example.com',
            phone: '+91 9876543214',
            category: 'Feature Request',
            priority: 'Medium',
            status: 'Open',
            subject: 'Requesting Dark Mode on candidate search page',
            description: 'It would be great to have dark mode supported across the Candidate Search dashboard for easier night screening.',
            created_at: new Date(Date.now() - 4 * 3600000)
          }
        ];

        for (const t of demoTickets) {
          const [res] = await pool.query(`
            INSERT INTO support_tickets 
            (ticket_number, name, email, phone, category, priority, status, subject, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [t.ticket_number, t.name, t.email, t.phone, t.category, t.priority, t.status, t.subject, t.description, t.created_at]);

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
  createTicket: async ({ name, email, phone, category, priority, subject, description, user_id }) => {
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

      const [res] = await pool.query(`
        INSERT INTO support_tickets 
        (ticket_number, user_id, name, email, phone, category, priority, status, subject, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?)
      `, [
        ticket_number,
        user_id || null,
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
  getAllTickets: async ({ search = '', status = 'All', priority = 'All', category = 'All', page = 1, limit = 50, email = '' } = {}) => {
    try {
      let conditions = [];
      let params = [];

      if (search) {
        conditions.push(`(t.ticket_number LIKE ? OR t.subject LIKE ? OR t.name LIKE ? OR t.email LIKE ?)`);
        const searchWildcard = `%${search}%`;
        params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
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

      if (email) {
        conditions.push(`t.email = ?`);
        params.push(email);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM support_tickets t ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      // Data query
      const offset = (page - 1) * limit;
      const [rows] = await pool.query(`
        SELECT 
          t.*,
          (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id) as message_count
        FROM support_tickets t
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
          user: {
            name: row.name,
            email: row.email,
            phone: row.phone,
            avatar: null
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
        SELECT t.* FROM support_tickets t WHERE ${condition} LIMIT 1
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
        user: {
          name: row.name,
          email: row.email,
          phone: row.phone,
          avatar: null
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
  getTicketStats: async () => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as \`open\`,
          SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as inprogress,
          SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as \`closed\`
        FROM support_tickets
      `);

      return {
        total: rows[0].total || 0,
        open: rows[0].open || 0,
        inprogress: rows[0].inprogress || 0,
        closed: rows[0].closed || 0
      };
    } catch (error) {
      throw new Error(error.message);
    }
  }
};

module.exports = SupportTicketModel;
