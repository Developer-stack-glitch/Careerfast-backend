const pool = require("../config/dbConfig");

const IndustryModel = {
  getIndustryTypes: async () => {
    try {
      const query = `SELECT id, name FROM industry_types WHERE is_active = 1 ORDER BY name ASC`;
      const [rows] = await pool.query(query);
      return rows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = IndustryModel;
