const SubscriptionPlanModel = require("../models/SubscriptionPlanModel");
const pool = require("../config/dbConfig");

// Helper to record audit log
async function logAdminAction(adminId, action, targetType, targetId, oldValue, newValue, ip) {
  try {
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, old_value, new_value, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        adminId || 1,
        action,
        targetType,
        String(targetId),
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ip || "127.0.0.1"
      ]
    );
  } catch (err) {
    console.error("⚠️ Audit log error:", err.message);
  }
}

const SubscriptionPlanController = {
  getAllPlans: async (req, res) => {
    try {
      const plans = await SubscriptionPlanModel.getAllPlans();
      res.status(200).json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch subscription plans.",
        details: error.message
      });
    }
  },

  getPlanById: async (req, res) => {
    try {
      const { id } = req.params;
      const plan = await SubscriptionPlanModel.getPlanById(id);
      if (!plan) {
        return res.status(404).json({ success: false, message: "Plan not found." });
      }
      res.status(200).json({
        success: true,
        data: plan
      });
    } catch (error) {
      console.error("Error fetching plan by ID:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch plan details.",
        details: error.message
      });
    }
  },

  createPlan: async (req, res) => {
    try {
      const { name, price } = req.body;
      if (!name || price === undefined) {
        return res.status(400).json({
          success: false,
          message: "Plan name and price are required."
        });
      }

      const planId = await SubscriptionPlanModel.createPlan(req.body);
      await logAdminAction(req.user?.id, "Admin Created Plan", "plan", planId, null, req.body, req.ip);

      res.status(201).json({
        success: true,
        message: "Subscription plan created successfully.",
        data: { plan_id: planId }
      });
    } catch (error) {
      console.error("Error creating subscription plan:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create subscription plan.",
        details: error.message
      });
    }
  },

  updatePlan: async (req, res) => {
    try {
      const { id } = req.params;
      const oldPlan = await SubscriptionPlanModel.getPlanById(id);
      if (!oldPlan) {
        return res.status(404).json({ success: false, message: "Plan not found." });
      }

      const affected = await SubscriptionPlanModel.updatePlan(id, req.body);
      await logAdminAction(req.user?.id, "Admin Edited Plan", "plan", id, oldPlan, req.body, req.ip);

      res.status(200).json({
        success: true,
        message: "Subscription plan updated successfully.",
        affected
      });
    } catch (error) {
      console.error("Error updating subscription plan:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update subscription plan.",
        details: error.message
      });
    }
  },

  duplicatePlan: async (req, res) => {
    try {
      const { id } = req.params;
      const newPlanId = await SubscriptionPlanModel.duplicatePlan(id);
      await logAdminAction(req.user?.id, "Admin Duplicated Plan", "plan", newPlanId, { duplicated_from: id }, null, req.ip);

      res.status(201).json({
        success: true,
        message: "Subscription plan duplicated successfully.",
        data: { plan_id: newPlanId }
      });
    } catch (error) {
      console.error("Error duplicating plan:", error);
      res.status(500).json({
        success: false,
        message: "Failed to duplicate plan.",
        details: error.message
      });
    }
  },

  togglePlanStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status || !['active', 'inactive'].includes(status)) {
        return res.status(400).json({ success: false, message: "Status must be 'active' or 'inactive'." });
      }

      const oldPlan = await SubscriptionPlanModel.getPlanById(id);
      await SubscriptionPlanModel.togglePlanStatus(id, status);
      const actionName = status === 'active' ? 'Admin Activated Plan' : 'Admin Deactivated Plan';
      await logAdminAction(req.user?.id, actionName, "plan", id, { status: oldPlan?.status }, { status }, req.ip);

      res.status(200).json({
        success: true,
        message: `Plan ${status === 'active' ? 'activated' : 'deactivated'} successfully.`
      });
    } catch (error) {
      console.error("Error toggling plan status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update plan status.",
        details: error.message
      });
    }
  },

  deletePlan: async (req, res) => {
    try {
      const { id } = req.params;
      const oldPlan = await SubscriptionPlanModel.getPlanById(id);
      if (!oldPlan) {
        return res.status(404).json({ success: false, message: "Plan not found." });
      }

      await SubscriptionPlanModel.deletePlan(id);
      await logAdminAction(req.user?.id, "Admin Deleted Plan", "plan", id, oldPlan, null, req.ip);

      res.status(200).json({
        success: true,
        message: "Subscription plan deleted successfully."
      });
    } catch (error) {
      console.error("Error deleting plan:", error);
      if (error.code === 'ACTIVE_SUBSCRIPTIONS_EXIST') {
        return res.status(400).json({
          success: false,
          code: 'ACTIVE_SUBSCRIPTIONS_EXIST',
          message: error.message,
          activeCount: error.activeCount
        });
      }
      res.status(500).json({
        success: false,
        message: "Failed to delete plan.",
        details: error.message
      });
    }
  },

  getPlanSubscribers: async (req, res) => {
    try {
      const { id } = req.params;
      const plan = await SubscriptionPlanModel.getPlanById(id);
      if (!plan) {
        return res.status(404).json({ success: false, message: "Plan not found." });
      }
      const subscribers = await SubscriptionPlanModel.getSubscribersByPlanId(id);
      res.status(200).json({
        success: true,
        plan,
        data: subscribers
      });
    } catch (error) {
      console.error("Error fetching plan subscribers:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch plan subscribers.",
        details: error.message
      });
    }
  }
};

module.exports = SubscriptionPlanController;
