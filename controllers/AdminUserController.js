const AdminUserModel = require('../models/AdminUserModel');

const AdminUserController = {
  getAllAdminUsers: async (req, res) => {
    try {
      const filters = {
        search: req.query.search || '',
        department: req.query.department || '',
        status: req.query.status !== undefined ? req.query.status : '',
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
      };

      const data = await AdminUserModel.getAllAdminUsers(filters);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Error in AdminUserController.getAllAdminUsers:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch admin users.',
      });
    }
  },

  getAdminUserById: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await AdminUserModel.getAdminUserById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found.',
        });
      }
      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error('Error in AdminUserController.getAdminUserById:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch admin user details.',
      });
    }
  },

  createAdminUser: async (req, res) => {
    try {
      const {
        first_name,
        last_name,
        email,
        phone,
        password,
        role_title,
        department,
        is_super_admin,
        permissions,
      } = req.body;

      if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'First name, last name, email, and initial password are required.',
        });
      }

      const creatorId = req.user?.id || 1;
      const result = await AdminUserModel.createAdminUser(
        {
          first_name,
          last_name,
          email,
          phone,
          password,
          role_title,
          department,
          is_super_admin,
          permissions,
        },
        creatorId
      );

      return res.status(201).json({
        success: true,
        message: 'Admin user created successfully.',
        data: result,
      });
    } catch (error) {
      console.error('Error in AdminUserController.createAdminUser:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to create admin user.',
      });
    }
  },

  updateAdminUser: async (req, res) => {
    try {
      const { id } = req.params;
      const modifierId = req.user?.id || 1;

      await AdminUserModel.updateAdminUser(id, req.body, modifierId);

      return res.status(200).json({
        success: true,
        message: 'Admin user updated successfully.',
      });
    } catch (error) {
      console.error('Error in AdminUserController.updateAdminUser:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update admin user.',
      });
    }
  },

  toggleAdminStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { is_active } = req.body;
      const modifierId = req.user?.id || 1;

      await AdminUserModel.toggleAdminStatus(id, is_active, modifierId);

      return res.status(200).json({
        success: true,
        message: `Admin account ${is_active ? 'activated' : 'suspended'} successfully.`,
      });
    } catch (error) {
      console.error('Error in AdminUserController.toggleAdminStatus:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update admin account status.',
      });
    }
  },

  resetAdminPassword: async (req, res) => {
    try {
      const { id } = req.params;
      const { new_password } = req.body;
      const modifierId = req.user?.id || 1;

      if (!new_password) {
        return res.status(400).json({
          success: false,
          message: 'New password is required.',
        });
      }

      await AdminUserModel.resetAdminPassword(id, new_password, modifierId);

      return res.status(200).json({
        success: true,
        message: 'Admin password reset successfully.',
      });
    } catch (error) {
      console.error('Error in AdminUserController.resetAdminPassword:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to reset admin password.',
      });
    }
  },

  deleteAdminUser: async (req, res) => {
    try {
      const { id } = req.params;
      const modifierId = req.user?.id || 1;

      await AdminUserModel.deleteAdminUser(id, modifierId);

      return res.status(200).json({
        success: true,
        message: 'Admin user deleted successfully.',
      });
    } catch (error) {
      console.error('Error in AdminUserController.deleteAdminUser:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete admin user.',
      });
    }
  },
};

module.exports = AdminUserController;
