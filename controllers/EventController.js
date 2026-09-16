const EventModel = require("../models/EventModel");

const createEvent = async (req, res) => {
    try {
        const {
            title,
            type,
            category,
            about,
            mode,
            participationType,
            memberLimit,
            eligibility,
            winnerPrize,
            runnerPrize,
            logo, // base64 string or URL
        } = req.body;

        // ✅ Convert multi-select values (arrays) into comma-separated strings
        const parsedType = Array.isArray(type)
            ? type.join(", ")
            : typeof type === "string"
                ? type
                : "";

        const parsedCategory = Array.isArray(category)
            ? category.join(", ")
            : typeof category === "string"
                ? category
                : "";

        // ✅ Parse eligibility if it comes as JSON string
        const parsedEligibility = Array.isArray(eligibility)
            ? eligibility
            : JSON.parse(eligibility || "[]");

        // ✅ Prepare final data object
        const eventData = {
            logo, // base64 string
            title,
            type: parsedType,
            category: parsedCategory,
            about,
            mode,
            participationType,
            memberLimit: participationType === "Team" ? memberLimit : null,
            eligibility: parsedEligibility,
            winnerPrize,
            runnerPrize,
        };

        // ✅ Save to database
        const eventId = await EventModel.createEvent(eventData);

        res.status(201).json({
            success: true,
            message: "Event created successfully",
            data: { id: eventId },
        });
    } catch (error) {
        console.error("❌ Error creating event:", error);
        res
            .status(500)
            .json({ success: false, message: "Error creating event", details: error.message });
    }
};

const getAllEvents = async (req, res) => {
    try {
        const events = await EventModel.getAllEvents();
        res.status(200).json({
            success: true,
            message: "Events fetched successfully",
            data: events,
        });
    } catch (error) {
        console.error("❌ Error fetching events:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching events",
            details: error.message,
        });
    }
};

const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await EventModel.deleteEvent(id);

        if (!deleted)
            return res
                .status(404)
                .json({ success: false, message: "Event not found" });

        res.status(200).json({ success: true, message: "Event deleted successfully" });
    } catch (error) {
        console.error("❌ Error deleting event:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting event",
            details: error.message,
        });
    }
};

module.exports = {
    createEvent,
    getAllEvents,
    deleteEvent,
};
