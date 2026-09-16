const BillingPlanModel = require("../models/BillingPlanModel");

const BillingPlanController = {
  getBillingPlans: async (req, res) => {
    try {
      const plans = await BillingPlanModel.getAllPlans();
      res.status(200).json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error("Error fetching billing plans:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch billing plans."
      });
    }
  },

  updateBillingPlan: async (req, res) => {
    const { plan_id, monthly_price, annual_price } = req.body;
    
    if (!plan_id || monthly_price === undefined || annual_price === undefined) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
      const affectedRows = await BillingPlanModel.updatePlanPrice(plan_id, monthly_price, annual_price);
      if (affectedRows > 0) {
        res.status(200).json({ success: true, message: "Billing plan updated successfully." });
      } else {
        res.status(404).json({ success: false, message: "Plan not found." });
      }
    } catch (error) {
      console.error("Error updating billing plan:", error);
      res.status(500).json({ success: false, message: "Failed to update billing plan." });
    }
  }
};

module.exports = BillingPlanController;
