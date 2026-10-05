const RecruiterManagementModel = require("../models/RecruiterManagementModel");

const RecruiterManagementController = {
  getAllRecruiters: async (req, res) => {
    try {
      const filters = {
        search: req.query.search || "",
        planId: req.query.planId || "",
        status: req.query.status || "",
        subscriptionStatus: req.query.subscriptionStatus || "",
        company: req.query.company || "",
        startDate: req.query.startDate || "",
        endDate: req.query.endDate || ""
      };
      const recruiters = await RecruiterManagementModel.getAllRecruiters(filters);
      res.status(200).json({
        success: true,
        data: recruiters
      });
    } catch (error) {
      console.error("Error fetching recruiters:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch recruiters list.",
        details: error.message
      });
    }
  },

  getRecruiterDetails: async (req, res) => {
    try {
      const { id } = req.params;
      const recruiter = await RecruiterManagementModel.getRecruiterById(id);
      if (!recruiter) {
        return res.status(404).json({ success: false, message: "Recruiter not found." });
      }
      res.status(200).json({
        success: true,
        data: {
          ...recruiter,
          recruiter: recruiter,
          subscription_history: recruiter.subscription_history || [],
          payments: recruiter.payments || [],
          audit_logs: recruiter.audit_logs || []
        }
      });
    } catch (error) {
      console.error("Error fetching recruiter details:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch recruiter profile.",
        details: error.message
      });
    }
  },

  createRecruiter: async (req, res) => {
    try {
      const { company_name, email, password, recruiter_name, plan_id } = req.body;
      if (!company_name || !email || !password || !recruiter_name || !plan_id) {
        return res.status(400).json({
          success: false,
          message: "Missing mandatory fields: Company Name, Recruiter Name, Email, Password, and Plan."
        });
      }

      const adminId = req.user?.id || 1;
      const created = await RecruiterManagementModel.createRecruiterWithSubscription(req.body, adminId);

      res.status(201).json({
        success: true,
        message: "Recruiter account & subscription created successfully.",
        data: created
      });
    } catch (error) {
      console.error("Error creating recruiter:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create recruiter account.",
        details: error.message
      });
    }
  },

  changeRecruiterPlan: async (req, res) => {
    try {
      const { id } = req.params;
      const { new_plan_id, effective_type, reason } = req.body;
      if (!new_plan_id) {
        return res.status(400).json({ success: false, message: "New plan ID is required." });
      }

      const adminId = req.user?.id || 1;
      const result = await RecruiterManagementModel.changePlan(id, { new_plan_id, effective_type, reason }, adminId);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error("Error changing recruiter plan:", error);
      res.status(500).json({
        success: false,
        message: "Failed to change subscription plan.",
        details: error.message
      });
    }
  },

  updateCustomPlan: async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id || 1;
      const result = await RecruiterManagementModel.updateCustomPlan(id, req.body, adminId);
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error("Error setting custom plan limits:", error);
      res.status(500).json({
        success: false,
        message: "Failed to set custom limits.",
        details: error.message
      });
    }
  },

  extendSubscription: async (req, res) => {
    try {
      const { id } = req.params;
      const { days, reason } = req.body;
      if (!days || isNaN(days) || Number(days) <= 0) {
        return res.status(400).json({ success: false, message: "Please provide a valid number of days to extend." });
      }

      const adminId = req.user?.id || 1;
      const result = await RecruiterManagementModel.extendSubscription(id, Number(days), reason, adminId);

      res.status(200).json({
        success: true,
        message: `Subscription extended by ${days} days. New expiry: ${result.new_expiry}`,
        data: result
      });
    } catch (error) {
      console.error("Error extending subscription:", error);
      res.status(500).json({
        success: false,
        message: "Failed to extend subscription.",
        details: error.message
      });
    }
  },

  updateRecruiterStatus: async (req, res) => {
    try {
      const { id } = req.params;
      let { is_active, status } = req.body;

      if (is_active === undefined && status !== undefined) {
        is_active = (status === 'active' || status === 1 || status === true);
      }

      if (is_active === undefined) {
        return res.status(400).json({ success: false, message: "is_active boolean or status is required." });
      }

      const activeBool = Boolean(is_active);
      const adminId = req.user?.id || 1;
      await RecruiterManagementModel.updateRecruiterStatus(id, activeBool, adminId);

      res.status(200).json({
        success: true,
        message: `Recruiter account ${activeBool ? 'activated' : 'suspended'} successfully.`
      });
    } catch (error) {
      console.error("Error updating recruiter status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update status.",
        details: error.message
      });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { id } = req.params;
      const { new_password } = req.body;
      if (!new_password || new_password.length < 6) {
        return res.status(400).json({ success: false, message: "New password must be at least 6 characters long." });
      }

      const adminId = req.user?.id || 1;
      await RecruiterManagementModel.resetPassword(id, new_password, adminId);

      res.status(200).json({
        success: true,
        message: "Password reset successfully."
      });
    } catch (error) {
      console.error("Error resetting recruiter password:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset password.",
        details: error.message
      });
    }
  },

  toggleAutoApprove: async (req, res) => {
    try {
      const { id } = req.params;
      const { auto_approve } = req.body;
      
      await RecruiterManagementModel.toggleAutoApprove(id, auto_approve);

      res.status(200).json({
        success: true,
        message: `Auto approve has been ${auto_approve ? 'enabled' : 'disabled'} for this recruiter.`
      });
    } catch (error) {
      console.error("Error toggling auto approve:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle auto approve.",
        details: error.message
      });
    }
  },

  getAllSubscriptions: async (req, res) => {
    try {
      const filters = {
        status: req.query.status || "",
        planId: req.query.planId || "",
        search: req.query.search || ""
      };
      const subs = await RecruiterManagementModel.getAllSubscriptions(filters);
      res.status(200).json({
        success: true,
        data: subs
      });
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch subscriptions list.",
        details: error.message
      });
    }
  },

  getAuditLogs: async (req, res) => {
    try {
      const limit = req.query.limit || 50;
      const logs = await RecruiterManagementModel.getAuditLogs(limit);
      res.status(200).json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch audit logs.",
        details: error.message
      });
    }
  },

  loginAsRecruiter: async (req, res) => {
    try {
      const { id } = req.params;
      const data = await RecruiterManagementModel.loginAsRecruiter(id);
      res.status(200).json({
        success: true,
        message: `Successfully generated recruiter session for ${data.recruiter.first_name || data.recruiter.email}`,
        token: data.token,
        data: data.recruiter
      });
    } catch (error) {
      console.error("Error in loginAsRecruiter:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to login as recruiter.",
        details: error.message
      });
    }
  },

  deleteRecruiter: async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id || 1;
      await RecruiterManagementModel.deleteRecruiter(id, adminId);
      res.status(200).json({
        success: true,
        message: "Recruiter account deleted successfully."
      });
    } catch (error) {
      console.error("Error deleting recruiter:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete recruiter account.",
        details: error.message
      });
    }
  }
};

module.exports = RecruiterManagementController;
