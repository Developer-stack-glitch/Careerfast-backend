const Settings = require("../models/SettingsModel");

const getSettings = async (req, res) => {
    try {
        let settings = await Settings.getSettings();

        // If no settings exist, seed some default settings
        if (settings.length === 0) {
            const defaultSettings = [
                { settingKey: 'platform_name', settingValue: 'CareerFast', settingGroup: 'Platform', settingType: 'text', label: 'Platform Name' },
                { settingKey: 'maintenance_mode', settingValue: 'false', settingGroup: 'Platform', settingType: 'boolean', label: 'Maintenance Mode' },
                { settingKey: 'support_email', settingValue: 'support@careerfast.com', settingGroup: 'Contact', settingType: 'text', label: 'Support Email' },
                { settingKey: 'contact_phone', settingValue: '+91 9876543210', settingGroup: 'Contact', settingType: 'text', label: 'Contact Phone' },
                { settingKey: 'facebook_url', settingValue: 'https://facebook.com/careerfast', settingGroup: 'Social', settingType: 'text', label: 'Facebook URL' },
                { settingKey: 'linkedin_url', settingValue: 'https://linkedin.com/company/careerfast', settingGroup: 'Social', settingType: 'text', label: 'LinkedIn URL' },
            ];

            await Settings.insertSettings(defaultSettings);
            settings = await Settings.getSettings();
        }

        // Map settings to match frontend expectations (camelCase for properties since we used snake_case in db)
        const formattedSettings = settings.map(s => ({
            settingKey: s.setting_key,
            settingValue: s.setting_value,
            settingGroup: s.setting_group,
            settingType: s.setting_type,
            label: s.label
        }));

        return res.status(200).json({ success: true, data: formattedSettings });
    } catch (error) {
        console.error("Error fetching settings:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

const updateSettings = async (req, res) => {
    try {
        const { settings } = req.body; 

        if (!settings || !Array.isArray(settings)) {
            return res.status(400).json({ success: false, message: "Invalid payload. 'settings' must be an array." });
        }

        for (const item of settings) {
            // Need to handle boolean mapping to string since DB stores TEXT
            let val = item.settingValue;
            if (typeof val === 'boolean') {
                val = val ? 'true' : 'false';
            }
            await Settings.updateSetting(item.settingKey, val);
        }

        return res.status(200).json({ success: true, message: "Settings updated successfully" });
    } catch (error) {
        console.error("Error updating settings:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

module.exports = {
    getSettings,
    updateSettings
};
