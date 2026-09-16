const pool = require("../config/dbConfig");

const BillingPlanModel = {
  getAllPlans: async () => {
    try {
      const [plans] = await pool.query(
        `SELECT * FROM billing_plans WHERE is_active = 1 ORDER BY id`
      );
      return plans;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updatePlanPrice: async (plan_id, monthly_price, annual_price) => {
    try {
      const query = `
        UPDATE billing_plans 
        SET monthly_price = ?, annual_price = ?
        WHERE plan_id = ?
      `;
      const [result] = await pool.query(query, [monthly_price, annual_price, plan_id]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  }
};

module.exports = BillingPlanModel;
