const EventRegistrationModel = require("../models/EventRegistrationModel");

const EventRegistrationController = {
    registerForEvent: async (req, res) => {
        try {
            const { userId, eventId, userDetails } = req.body;

            if (!userId || !eventId || !userDetails) {
                return res.status(400).json({
                    success: false,
                    message: "User ID, Event ID, and User Details are required",
                });
            }

            const registration = await EventRegistrationModel.registerForEvent({
                userId,
                eventId,
                userDetails,
            });

            res.status(201).json({
                success: true,
                message: "Successfully registered for the event 🎉",
                data: registration,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message || "Failed to register for event",
            });
        }
    },

    getUserRegistrations: async (req, res) => {
        try {
            const { userId } = req.params;
            const data = await EventRegistrationModel.getUserRegistrations(userId);
            res.status(200).json({ success: true, data });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || "Error fetching user registrations",
            });
        }
    },

    checkIsRegistered: async (req, res) => {
        try {
            const { userId, eventId } = req.query;

            if (!userId || !eventId) {
                return res
                    .status(400)
                    .json({ success: false, message: "User ID and Event ID are required" });
            }

            const isRegistered = await EventRegistrationModel.checkIsRegistered(
                userId,
                eventId
            );

            res.status(200).json({
                success: true,
                registered: isRegistered,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || "Error checking registration status",
            });
        }
    },

};

module.exports = EventRegistrationController;
