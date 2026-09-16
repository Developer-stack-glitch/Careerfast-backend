const WorkshopModel = require("../models/WorkshopModel");

const createWorkshop = async (req, res) => {
    try {
        const {
            title,
            type, // 👈 add this
            category,
            about,
            mode,
            participationType,
            memberLimit,
            eligibility,
            logo,
            startDate,
            endDate,
            venue,
            organizer,
            contactEmail,
            contactNumber,
            registrationLink,
        } = req.body;

        const parsedEligibility = Array.isArray(eligibility)
            ? eligibility
            : JSON.parse(eligibility || "[]");

        const workshopData = {
            title,
            type, // 👈 add this
            category,
            about,
            mode,
            participationType,
            memberLimit: participationType === "Team" ? memberLimit : null,
            eligibility: parsedEligibility,
            logo,
            startDate,
            endDate,
            venue,
            organizer,
            contactEmail,
            contactNumber,
            registrationLink,
        };

        const workshopId = await WorkshopModel.createWorkshop(workshopData);

        res.status(201).json({
            success: true,
            message: "Workshop created successfully",
            data: { id: workshopId },
        });
    } catch (error) {
        console.error("❌ Error creating workshop:", error);
        res.status(500).json({
            success: false,
            message: "Error creating workshop",
            details: error.message,
        });
    }
};

const getAllWorkshops = async (req, res) => {
    try {
        const workshops = await WorkshopModel.getAllWorkshops();
        res.status(200).json({
            success: true,
            message: "Workshops fetched successfully",
            data: workshops,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching workshops",
            details: error.message,
        });
    }
};

const deleteWorkshop = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await WorkshopModel.deleteWorkshop(id);

        if (!deleted)
            return res.status(404).json({ success: false, message: "Workshop not found" });

        res.status(200).json({ success: true, message: "Workshop deleted successfully" });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error deleting workshop",
            details: error.message,
        });
    }
};

module.exports = {
    createWorkshop,
    getAllWorkshops,
    deleteWorkshop,
};
