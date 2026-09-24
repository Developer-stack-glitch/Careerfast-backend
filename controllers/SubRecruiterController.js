const SubRecruiterModel = require("../models/SubRecruiterModel");

const SubRecruiterController = {
  // GET /api/recruiter/team
  getTeam: async (req, res) => {
    try {
      const recruiterId = req.user?.id || req.query.recruiter_id;
      if (!recruiterId) {
        return res.status(400).json({ success: false, message: "Recruiter ID is required." });
      }

      const data = await SubRecruiterModel.getTeamByMainRecruiterId(recruiterId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("Error fetching recruiter team:", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to fetch team members." });
    }
  },

  // POST /api/recruiter/team
  createSubRecruiter: async (req, res) => {
    try {
      const mainRecruiterId = req.user?.id || req.body.main_recruiter_id;
      if (!mainRecruiterId) {
        return res.status(400).json({ success: false, message: "Main recruiter ID is required." });
      }

      const result = await SubRecruiterModel.createSubRecruiter(mainRecruiterId, req.body);
      return res.status(201).json({
        success: true,
        message: "Sub-recruiter created successfully.",
        data: result
      });
    } catch (error) {
      console.error("Error creating sub-recruiter:", error);
      return res.status(400).json({ success: false, message: error.message || "Failed to create sub-recruiter." });
    }
  },

  // PUT /api/recruiter/team/:id/permissions
  updatePermissions: async (req, res) => {
    try {
      const subRecruiterRecordId = req.params.id;
      const mainRecruiterId = req.user?.role_id === 1 ? null : req.user?.id; // Admin can update any

      const affected = await SubRecruiterModel.updatePermissions(subRecruiterRecordId, mainRecruiterId, req.body);
      if (affected === 0) {
        return res.status(404).json({ success: false, message: "Sub-recruiter record not found or no changes made." });
      }

      return res.status(200).json({
        success: true,
        message: "Sub-recruiter permissions updated successfully."
      });
    } catch (error) {
      console.error("Error updating sub-recruiter permissions:", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to update permissions." });
    }
  },

  // PATCH /api/recruiter/team/:id/status
  toggleStatus: async (req, res) => {
    try {
      const subRecruiterRecordId = req.params.id;
      const { status } = req.body;
      if (!status || !['active', 'suspended'].includes(status)) {
        return res.status(400).json({ success: false, message: "Valid status ('active' or 'suspended') is required." });
      }

      const mainRecruiterId = req.user?.role_id === 1 ? null : req.user?.id;
      await SubRecruiterModel.toggleStatus(subRecruiterRecordId, mainRecruiterId, status);

      return res.status(200).json({
        success: true,
        message: `Sub-recruiter account ${status === 'active' ? 'activated' : 'suspended'} successfully.`
      });
    } catch (error) {
      console.error("Error toggling sub-recruiter status:", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to update status." });
    }
  },

  // DELETE /api/recruiter/team/:id
  deleteSubRecruiter: async (req, res) => {
    try {
      const subRecruiterRecordId = req.params.id;
      const mainRecruiterId = req.user?.role_id === 1 ? null : req.user?.id;

      await SubRecruiterModel.deleteSubRecruiter(subRecruiterRecordId, mainRecruiterId);
      return res.status(200).json({
        success: true,
        message: "Sub-recruiter removed successfully."
      });
    } catch (error) {
      console.error("Error deleting sub-recruiter:", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to remove sub-recruiter." });
    }
  },

  // GET /api/admin/recruiters/:id/team (Super Admin oversight)
  getAdminRecruiterTeam: async (req, res) => {
    try {
      const recruiterId = req.params.id;
      const data = await SubRecruiterModel.getTeamByMainRecruiterId(recruiterId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("Error fetching admin recruiter team:", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to fetch recruiter team." });
    }
  },

  // POST /api/admin/recruiters/:id/team (Super Admin adds sub-recruiter for client)
  createAdminSubRecruiter: async (req, res) => {
    try {
      const mainRecruiterId = req.params.id;
      const result = await SubRecruiterModel.createSubRecruiter(mainRecruiterId, req.body);
      return res.status(201).json({
        success: true,
        message: "Sub-recruiter created successfully for client.",
        data: result
      });
    } catch (error) {
      console.error("Error creating sub-recruiter via admin:", error);
      return res.status(400).json({ success: false, message: error.message || "Failed to create sub-recruiter." });
    }
  }
};

module.exports = SubRecruiterController;
