const AdminRoleModel = require('../models/AdminRoleModel');

const AdminRoleController = {
  getAllRoles: async (req, res) => {
    try {
      const data = await AdminRoleModel.getAllRoles();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Error in AdminRoleController.getAllRoles:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch admin roles.',
      });
    }
  },

  getRoleById: async (req, res) => {
    try {
      const { id } = req.params;
      const role = await AdminRoleModel.getRoleById(id);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found.',
        });
      }
      return res.status(200).json({
        success: true,
        data: role,
      });
    } catch (error) {
      console.error('Error in AdminRoleController.getRoleById:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch role details.',
      });
    }
  },

  createRole: async (req, res) => {
    try {
      const {
        role_name,
        role_title,
        description,
        department,
        is_super_admin,
        permissions,
      } = req.body;

      if (!role_title && !role_name) {
        return res.status(400).json({
          success: false,
          message: 'Role title / name is required.',
        });
      }

      const creatorId = req.user?.id || 1;
      const result = await AdminRoleModel.createRole(
        {
          role_name: role_name || role_title,
          role_title: role_title || role_name,
          description,
          department,
          is_super_admin,
          permissions,
        },
        creatorId
      );

      return res.status(201).json({
        success: true,
        message: 'Admin role created successfully.',
        data: result,
      });
    } catch (error) {
      console.error('Error in AdminRoleController.createRole:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to create admin role.',
      });
    }
  },

  updateRole: async (req, res) => {
    try {
      const { id } = req.params;
      const modifierId = req.user?.id || 1;

      await AdminRoleModel.updateRole(id, req.body, modifierId);

      return res.status(200).json({
        success: true,
        message: 'Admin role updated successfully.',
      });
    } catch (error) {
      console.error('Error in AdminRoleController.updateRole:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update admin role.',
      });
    }
  },

  deleteRole: async (req, res) => {
    try {
      const { id } = req.params;
      const modifierId = req.user?.id || 1;

      await AdminRoleModel.deleteRole(id, modifierId);

      return res.status(200).json({
        success: true,
        message: 'Admin role deleted successfully.',
      });
    } catch (error) {
      console.error('Error in AdminRoleController.deleteRole:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete admin role.',
      });
    }
  },
};

module.exports = AdminRoleController;
