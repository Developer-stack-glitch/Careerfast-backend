const SupportTicketModel = require('../models/SupportTicketModel');

const SupportTicketController = {
  // Create a new support ticket (public / user)
  createTicket: async (req, res) => {
    try {
      const { name, email, phone, category, priority, subject, description } = req.body;

      if (!name || !email || !subject || !description) {
        return res.status(400).json({
          success: false,
          message: 'Please provide all required fields: name, email, subject, and description.'
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address.'
        });
      }

      const user_id = req.user?.id || req.user?.user_id || null;

      const ticket = await SupportTicketModel.createTicket({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        category: category || 'General Inquiry',
        priority: priority || 'Medium',
        subject: subject.trim(),
        description: description.trim(),
        user_id
      });

      return res.status(201).json({
        success: true,
        message: `Ticket #${ticket.ticket_number} created successfully! Our team will respond shortly.`,
        data: ticket
      });
    } catch (error) {
      console.error('Error in createTicket:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create support ticket.',
        error: error.message
      });
    }
  },

  // Get all tickets (with filters, search, pagination)
  getAllTickets: async (req, res) => {
    try {
      const {
        search = '',
        status = 'All',
        priority = 'All',
        category = 'All',
        page = 1,
        limit = 50,
        email = ''
      } = req.query;

      const result = await SupportTicketModel.getAllTickets({
        search,
        status,
        priority,
        category,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 50,
        email
      });

      return res.status(200).json({
        success: true,
        data: result.tickets,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('Error in getAllTickets:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch support tickets.',
        error: error.message
      });
    }
  },

  // Get ticket stats summary
  getStats: async (req, res) => {
    try {
      const stats = await SupportTicketModel.getTicketStats();
      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error in getStats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch ticket statistics.',
        error: error.message
      });
    }
  },

  // Get single ticket by ID or Ticket Number
  getTicketById: async (req, res) => {
    try {
      const { id } = req.params;
      const ticket = await SupportTicketModel.getTicketById(id);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: `Ticket ${id} not found.`
        });
      }

      return res.status(200).json({
        success: true,
        data: ticket
      });
    } catch (error) {
      console.error('Error in getTicketById:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch ticket details.',
        error: error.message
      });
    }
  },

  // Update ticket status
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['Open', 'In Progress', 'Closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const updated = await SupportTicketModel.updateTicketStatus(id, status);
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: `Ticket ${id} not found.`
        });
      }

      return res.status(200).json({
        success: true,
        message: `Ticket ${id} status updated to ${status}.`
      });
    } catch (error) {
      console.error('Error in updateStatus:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update ticket status.',
        error: error.message
      });
    }
  },

  // Add message / reply to ticket discussion thread
  addMessage: async (req, res) => {
    try {
      const { id } = req.params;
      const { text, sender = 'User', sender_name } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Message text cannot be empty.'
        });
      }

      const msgSenderName = sender_name || (sender === 'Admin' ? 'Support Admin' : 'User');

      const message = await SupportTicketModel.addTicketMessage(id, {
        sender,
        sender_name: msgSenderName,
        text: text.trim()
      });

      return res.status(201).json({
        success: true,
        message: 'Message posted successfully.',
        data: message
      });
    } catch (error) {
      console.error('Error in addMessage:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to post message.',
        error: error.message
      });
    }
  },

  // Delete ticket
  deleteTicket: async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await SupportTicketModel.deleteTicket(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: `Ticket ${id} not found.`
        });
      }

      return res.status(200).json({
        success: true,
        message: `Ticket ${id} deleted successfully.`
      });
    } catch (error) {
      console.error('Error in deleteTicket:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete ticket.',
        error: error.message
      });
    }
  }
};

module.exports = SupportTicketController;
