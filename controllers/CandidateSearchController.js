const CandidateSearchModel = require("../models/CandidateSearchModel");

const CandidateSearchController = {
  searchCandidates: async (req, res) => {
    try {
      const parseArray = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val.filter(Boolean);
        return String(val).split(',').map(s => s.trim()).filter(Boolean);
      };

      // Build parameters from query string
      const params = {
        search: req.query.search || req.query.keywords || "",
        keywordMatch: req.query.keywordMatch || "any",
        skills: parseArray(req.query.skills),
        location: parseArray(req.query.location),
        preferredLocations: parseArray(req.query.preferredLocations),
        includeRelocating: req.query.includeRelocating === 'true' || req.query.includeRelocating === true,
        experienceMin: req.query.experienceMin !== undefined ? req.query.experienceMin : req.query.expMin,
        experienceMax: req.query.experienceMax !== undefined ? req.query.experienceMax : req.query.expMax,
        jobTitle: parseArray(req.query.jobTitle),
        company: parseArray(req.query.company),
        companyMatch: req.query.companyMatch || "",
        excludedCompanies: parseArray(req.query.excludedCompanies),
        excludedKeywords: parseArray(req.query.excludedKeywords),
        industry: parseArray(req.query.industry),
        designation: req.query.designation || "",
        gender: parseArray(req.query.gender),
        education: [
          ...parseArray(req.query.education),
          ...parseArray(req.query.course),
          ...parseArray(req.query.courses),
          ...parseArray(req.query.ugQualification),
          ...parseArray(req.query.specificUG),
          ...parseArray(req.query.pgQualification),
          ...parseArray(req.query.specificPG),
          ...parseArray(req.query.doctorateQualification)
        ].filter(e => e && e !== 'Specific UG' && e !== 'Specific PG' && e !== 'No UG' && e !== 'No PG'),
        courses: parseArray(req.query.courses),
        ugQualification: req.query.ugQualification || "",
        institutes: parseArray(req.query.institutes),
        passingYearFrom: req.query.passingYearFrom || "",
        passingYearTo: req.query.passingYearTo || "",
        pgQualification: req.query.pgQualification || "",
        doctorateQualification: req.query.doctorateQualification || "",
        noticePeriod: parseArray(req.query.noticePeriod),
        salaryMin: req.query.salaryMin,
        salaryMax: req.query.salaryMax,
        salaryThousandMin: req.query.salaryThousandMin,
        salaryThousandMax: req.query.salaryThousandMax,
        salaryNotMentioned: req.query.salaryNotMentioned,
        status: req.query.status || req.query.candidateStatus || "",
        activeUpdated: req.query.activeUpdated || req.query.timePeriod || "",
        languages: parseArray(req.query.languages),
        jobType: parseArray(req.query.jobType),
        hasResume: req.query.hasResume === 'true' || req.query.hasResume === true || req.query.showWithResume === 'true',
        verifiedEmail: req.query.verifiedEmail === 'true' || req.query.verifiedEmail === true || req.query.showVerifiedEmail === 'true',
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 40,
        sortBy: req.query.sortBy || "Relevance"
      };

      const result = await CandidateSearchModel.searchCandidates(params);

      return res.status(200).json({
        success: true,
        message: "Candidates fetched successfully",
        data: result
      });
    } catch (error) {
      console.error("Error in searchCandidates:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to search candidates",
        error: error.message
      });
    }
  },

  getFilterOptions: async (req, res) => {
    try {
      const result = await CandidateSearchModel.getFilterOptions();

      return res.status(200).json({
        success: true,
        message: "Filter options fetched successfully",
        data: result
      });
    } catch (error) {
      console.error("Error in getFilterOptions:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch filter options",
        error: error.message
      });
    }
  },

  lookupCompanies: async (req, res) => {
    try {
      const query = req.query.query || req.query.q || "";
      const result = await CandidateSearchModel.lookupCompanies(query);

      return res.status(200).json({
        success: true,
        message: "Companies retrieved successfully",
        data: result
      });
    } catch (error) {
      console.error("Error in lookupCompanies:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to lookup companies",
        error: error.message
      });
    }
  },

  // ─── Folders Endpoints ─────────────────────────────────────────────────────
  getFolders: async (req, res) => {
    try {
      const recruiterId = req.user.id;
      const { tab = 'all', search = '' } = req.query;
      const result = await CandidateSearchModel.getFolders(recruiterId, { tab, search });
      return res.status(200).json({ success: true, data: result.folders, tabCounts: result.tabCounts });
    } catch (error) {
      console.error("Error in getFolders:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  createFolder: async (req, res) => {
    try {
      const recruiterId = req.user.id;
      const { name, job_id, folder_type, color, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: "Folder name is required" });
      }
      const folder = await CandidateSearchModel.createFolder(recruiterId, {
        name: name.trim(),
        job_id,
        folder_type,
        color,
        description
      });
      return res.status(200).json({ success: true, message: "Folder created successfully", data: folder });
    } catch (error) {
      console.error("Error in createFolder:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  updateFolder: async (req, res) => {
    try {
      const recruiterId = req.user.id;
      const { id } = req.params;
      const updated = await CandidateSearchModel.updateFolder(recruiterId, id, req.body);
      return res.status(200).json({ success: true, message: "Folder updated successfully", data: updated });
    } catch (error) {
      console.error("Error in updateFolder:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  deleteFolder: async (req, res) => {
    try {
      const recruiterId = req.user.id;
      const { id } = req.params;
      const result = await CandidateSearchModel.deleteFolder(recruiterId, id);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error in deleteFolder:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  getFolderCandidates: async (req, res) => {
    try {
      const recruiterId = req.user.id;
      const { id } = req.params;
      const { search = '', stage = 'all' } = req.query;
      const result = await CandidateSearchModel.getFolderCandidates(recruiterId, id, { search, stage });
      return res.status(200).json({ success: true, data: result.candidates, folder: result.folder });
    } catch (error) {
      console.error("Error in getFolderCandidates:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  updateCandidateStageInFolder: async (req, res) => {
    try {
      const recruiterId = req.user.id;
      const { id } = req.params;
      const { candidateId, stage } = req.body;
      if (!candidateId) return res.status(400).json({ success: false, message: "Candidate ID required" });

      const result = await CandidateSearchModel.updateCandidateStageInFolder(recruiterId, id, candidateId, stage);
      return res.status(200).json({ success: true, message: "Candidate stage updated", data: result });
    } catch (error) {
      console.error("Error in updateCandidateStageInFolder:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  removeCandidateFromFolder: async (req, res) => {
    try {
      const recruiterId = req.user.id;
      const { id, candidateId } = req.params;
      const result = await CandidateSearchModel.removeCandidateFromFolder(recruiterId, id, candidateId);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error in removeCandidateFromFolder:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  addCandidatesToFolder: async (req, res) => {
    try {
      const recruiterId = req.user.id;
      const { folderIdentifier, candidateIds, stage = 'prospect' } = req.body;
      if (!folderIdentifier) {
        return res.status(400).json({ success: false, message: "Folder is required" });
      }
      if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
        return res.status(400).json({ success: false, message: "No candidates selected" });
      }

      const result = await CandidateSearchModel.addCandidatesToFolder(recruiterId, folderIdentifier, candidateIds, stage);

      if (result.alreadyExists) {
        return res.status(200).json({
          success: false,
          alreadyExists: true,
          message: result.message,
          data: result
        });
      }

      return res.status(200).json({
        success: true,
        alreadyExists: false,
        message: result.message || `Successfully saved ${result.addedCount} candidate(s) to folder "${result.folderName}"`,
        data: result
      });
    } catch (error) {
      console.error("Error in addCandidatesToFolder:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = CandidateSearchController;

