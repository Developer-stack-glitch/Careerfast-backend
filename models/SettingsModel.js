const pool = require("../config/dbConfig");

const SettingsModel = {
    getSettings: async () => {
        try {
            const [rows] = await pool.query(`SELECT * FROM settings`);
            return rows;
        } catch (error) {
            throw new Error(error.message);
        }
    },
    insertSettings: async (settingsArray) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            for (const item of settingsArray) {
                const query = `
                    INSERT INTO settings (setting_key, setting_value, setting_group, setting_type, label) 
                    VALUES (?, ?, ?, ?, ?)
                `;
                await conn.query(query, [item.settingKey, item.settingValue, item.settingGroup, item.settingType, item.label]);
            }
            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw new Error(error.message);
        } finally {
            conn.release();
        }
    },
    updateSetting: async (settingKey, settingValue) => {
        try {
            const query = `UPDATE settings SET setting_value = ? WHERE setting_key = ?`;
            const [result] = await pool.query(query, [settingValue, settingKey]);
            return result.affectedRows;
        } catch (error) {
            throw new Error(error.message);
        }
    }
};

module.exports = SettingsModel;
