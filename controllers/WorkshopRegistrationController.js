const WorkshopRegistrationModel = require("../models/WorkshopRegistrationModel");

const WorkshopRegistrationController = {
    // ✅ Register for a workshop
    registerForWorkshop: async (req, res) => {
        try {
            const { userId, workshopId, userDetails } = req.body;

            if (!userId || !workshopId || !userDetails) {
                return res.status(400).json({
                    success: false,
                    message: "User ID, Workshop ID, and User Details are required",
                });
            }

            const registration = await WorkshopRegistrationModel.registerForWorkshop({
                userId,
                workshopId,
                userDetails,
            });

            res.status(201).json({
                success: true,
                message: "Successfully registered for the workshop 🎉",
                data: registration,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message || "Failed to register for workshop",
            });
        }
    },

    // ✅ Get all registered workshops for a user
    getUserRegisteredWorkshops: async (req, res) => {
        try {
            const { userId } = req.params;
            const data = await WorkshopRegistrationModel.getUserRegisteredWorkshops(userId);
            res.status(200).json({ success: true, data });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || "Error fetching registered workshops",
            });
        }
    },

    // ✅ Check if already registered
    checkIsRegisteredWorkshop: async (req, res) => {
        try {
            const { userId, workshopId } = req.query;

            if (!userId || !workshopId) {
                return res.status(400).json({
                    success: false,
                    message: "User ID and Workshop ID are required",
                });
            }

            const isRegistered = await WorkshopRegistrationModel.checkIsRegisteredWorkshop(
                userId,
                workshopId
            );

            res.status(200).json({
                success: true,
                registered: isRegistered,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || "Error checking workshop registration",
            });
        }
    },
};

module.exports = WorkshopRegistrationController;
