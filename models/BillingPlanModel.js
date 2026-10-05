const pool = require("../config/dbConfig");

const BillingPlanModel = {
  getAllPlans: async () => {
    try {
      const [plans] = await pool.query(
        `SELECT * FROM subscription_plans 
         WHERE status = 'active' 
           AND (plan_type != 'custom' OR plan_type IS NULL)
           AND (slug NOT LIKE 'custom-%')
         ORDER BY price ASC, id ASC`
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
