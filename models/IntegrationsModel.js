const db = require('../config/dbConfig');

const IntegrationsModel = {
    getAllIntegrations: async () => {
        try {
            const [rows] = await db.query(`
                SELECT id, provider_name, integration_key, integration_value, is_enabled, label, input_type
                FROM integrations
                ORDER BY provider_name, id ASC
            `);
            return rows;
        } catch (error) {
            throw error;
        }
    },

    updateIntegration: async (integration_key, integration_value, is_enabled) => {
        try {
            const [result] = await db.query(
                `UPDATE integrations 
                 SET integration_value = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE integration_key = ?`,
                [integration_value, is_enabled, integration_key]
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw error;
        }
    }
};

module.exports = IntegrationsModel;
