const pool = require("../config/dbConfig");

const OrganizationModel = {
  getOrganizationTypes: async () => {
    try {
      const query = `SELECT id, name FROM organization_type WHERE is_active = 1`;
      const [organizations] = await pool.query(query);
      return organizations;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = OrganizationModel;
