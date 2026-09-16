const IntegrationsModel = require('../models/IntegrationsModel');

const getIntegrations = async (req, res) => {
    try {
        const integrations = await IntegrationsModel.getAllIntegrations();
        
        // Group by provider_name
        const groupedIntegrations = integrations.reduce((acc, curr) => {
            if (!acc[curr.provider_name]) {
                acc[curr.provider_name] = [];
            }
            acc[curr.provider_name].push(curr);
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            message: "Integrations retrieved successfully",
            data: groupedIntegrations
        });
    } catch (error) {
        console.error("Error in getIntegrations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve integrations",
            error: error.message
        });
    }
};

const updateIntegrations = async (req, res) => {
    try {
        const { updates } = req.body;
        
        if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({
                success: false,
                message: "Updates must be an array of objects with integration_key, integration_value, and is_enabled."
            });
        }

        let updatedCount = 0;
        for (const update of updates) {
            const success = await IntegrationsModel.updateIntegration(
                update.integration_key, 
                update.integration_value, 
                update.is_enabled
            );
            if (success) updatedCount++;
        }

        res.status(200).json({
            success: true,
            message: `Successfully updated ${updatedCount} integrations.`,
        });
    } catch (error) {
        console.error("Error in updateIntegrations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update integrations",
            error: error.message
        });
    }
};

module.exports = {
    getIntegrations,
    updateIntegrations
};
