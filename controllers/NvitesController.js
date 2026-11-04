const NvitesModel = require("../models/NvitesModel");
const SubRecruiterModel = require("../models/SubRecruiterModel");

const NvitesController = {
  /**
   * ⚡ Recruiter sends Nvites to selected candidates
   */
  sendNvites: async (req, res) => {
    try {
      const recruiterId = req.user?.id;
      if (!recruiterId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      // Check sub-recruiter permissions if applicable
      const subRecruiter = await SubRecruiterModel.getSubRecruiterByUserId(recruiterId);
      if (subRecruiter) {
        const perms = subRecruiter.permissions || {};
        if (perms.can_contact_candidates === false) {
          return res.status(403).json({
            success: false,
            message: "Permission Denied: Your sub-recruiter account does not have permission to send Nvites.",
          });
        }
      }

      const {
        jobId,
        candidateIds,
        subject,
        message,
        templateType,
        shareContact,
        validityDays,
      } = req.body;

      if (!jobId) {
        return res.status(400).json({ success: false, message: "Please select an active job for the Nvite." });
      }

      if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
        return res.status(400).json({ success: false, message: "Please select at least one candidate to invite." });
      }

      const result = await NvitesModel.sendNvites({
        recruiterId,
        jobId,
        candidateIds,
        subject,
        message,
        templateType,
        shareContact: shareContact !== undefined ? shareContact : 1,
        validityDays: validityDays || 14,
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error("NvitesController.sendNvites error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to send Nvites",
      });
    }
  },

  /**
   * 📊 Get Recruiter's sent Nvites list + KPI stats
   */
  getRecruiterNvites: async (req, res) => {
    try {
      const recruiterId = req.user?.id;
      if (!recruiterId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      const result = await NvitesModel.getRecruiterNvites(recruiterId, req.query);
      return res.status(200).json(result);
    } catch (error) {
      console.error("NvitesController.getRecruiterNvites error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch sent Nvites",
      });
    }
  },

  /**
   * 📬 Get Candidate's received Nvites
   */
  getCandidateNvites: async (req, res) => {
    try {
      const candidateId = req.user?.id;
      if (!candidateId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      const result = await NvitesModel.getCandidateNvites(candidateId, req.query);
      return res.status(200).json(result);
    } catch (error) {
      console.error("NvitesController.getCandidateNvites error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch candidate invitations",
      });
    }
  },

  /**
   * 👁️ Candidate marks Nvite as viewed
   */
  markNviteViewed: async (req, res) => {
    try {
      const candidateId = req.user?.id;
      const nviteId = req.params.id;
      if (!candidateId || !nviteId) {
        return res.status(400).json({ success: false, message: "Invalid parameters" });
      }

      const result = await NvitesModel.markNviteViewed(nviteId, candidateId);
      return res.status(200).json(result);
    } catch (error) {
      console.error("NvitesController.markNviteViewed error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to mark Nvite as viewed",
      });
    }
  },

  /**
   * ✅ Candidate accepts Nvite & applies to job
   */
  acceptNvite: async (req, res) => {
    try {
      const candidateId = req.user?.id;
      const nviteId = req.params.id;
      if (!candidateId || !nviteId) {
        return res.status(400).json({ success: false, message: "Invalid parameters" });
      }

      const result = await NvitesModel.acceptNvite(nviteId, candidateId);
      return res.status(200).json(result);
    } catch (error) {
      console.error("NvitesController.acceptNvite error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to accept job invitation",
      });
    }
  },

  /**
   * ❌ Candidate declines Nvite
   */
  declineNvite: async (req, res) => {
    try {
      const candidateId = req.user?.id;
      const nviteId = req.params.id;
      const { reason, note } = req.body;
      if (!candidateId || !nviteId) {
        return res.status(400).json({ success: false, message: "Invalid parameters" });
      }

      const result = await NvitesModel.declineNvite(nviteId, candidateId, { reason, note });
      return res.status(200).json(result);
    } catch (error) {
      console.error("NvitesController.declineNvite error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to decline job invitation",
      });
    }
  },

  /**
   * 🔄 Recruiter resends an Nvite
   */
  resendNvite: async (req, res) => {
    try {
      const recruiterId = req.user?.id;
      const nviteId = req.params.id;
      if (!recruiterId || !nviteId) {
        return res.status(400).json({ success: false, message: "Invalid parameters" });
      }

      const result = await NvitesModel.resendNvite(nviteId, recruiterId);
      return res.status(200).json(result);
    } catch (error) {
      console.error("NvitesController.resendNvite error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to resend Nvite",
      });
    }
  },
};

module.exports = NvitesController;

