const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const userController = require("../controllers/UserController");
const LoginController = require("../controllers/LoginController");
const RoleController = require("../controllers/RoleController");
const OrganizationController = require("../controllers/OrganizationController");
const IndustryController = require("../controllers/IndustryController");
const { verifyToken, verifySuperAdmin } = require("../Validation/Validation");
const JobsController = require("../controllers/JobsController");
const EmailController = require("../controllers/EmailController");
const NotificationController = require("../controllers/NotificationController");
const BillingPlanController = require("../controllers/BillingPlanController");
const SettingsController = require("../controllers/SettingsController");
const { applyJob } = require("../controllers/ApplyController");
const CandidateSearchController = require("../controllers/CandidateSearchController");
const SubscriptionPlanController = require("../controllers/SubscriptionPlanController");
const RecruiterManagementController = require("../controllers/RecruiterManagementController");
const RecruiterSubscriptionController = require("../controllers/RecruiterSubscriptionController");
const SubRecruiterController = require("../controllers/SubRecruiterController");
const authRoutes = require("./auth");
const tokenRoutes = require("./tokenRoutes");
const eventRoutes = require("./eventRoutes");
const eventRegistrationRoutes = require("./eventRegistrationRoutes");
const workshopRoutes = require("./workshopRoutes");
const workshopRegistrationRoutes = require("./workshopRegistrationRoutes");
const courseRoutes = require("./courseRoutes");
const blogRoutes = require("./blogRoutes");



// ...
router.use("/events", eventRoutes);


// Login module APIs
router.post("/login", LoginController.login);

// ==========================================
// 👑 Super Admin Subscription Plan Routes
// ==========================================
router.get("/admin/plans", verifyToken, SubscriptionPlanController.getAllPlans);
router.get("/admin/plans/:id", verifyToken, SubscriptionPlanController.getPlanById);
router.post("/admin/plans", verifyToken, verifySuperAdmin, SubscriptionPlanController.createPlan);
router.put("/admin/plans/:id", verifyToken, verifySuperAdmin, SubscriptionPlanController.updatePlan);
router.post("/admin/plans/:id/duplicate", verifyToken, verifySuperAdmin, SubscriptionPlanController.duplicatePlan);
router.put("/admin/plans/:id/status", verifyToken, verifySuperAdmin, SubscriptionPlanController.togglePlanStatus);
router.delete("/admin/plans/:id", verifyToken, verifySuperAdmin, SubscriptionPlanController.deletePlan);
router.get("/admin/plans/:id/subscribers", verifyToken, verifySuperAdmin, SubscriptionPlanController.getPlanSubscribers);

// ==========================================
// 🏢 Super Admin Recruiter Management Routes
// ==========================================
router.get("/admin/recruiters", verifyToken, verifySuperAdmin, RecruiterManagementController.getAllRecruiters);
router.get("/admin/recruiters/:id", verifyToken, verifySuperAdmin, RecruiterManagementController.getRecruiterDetails);
router.post("/admin/recruiters", verifyToken, verifySuperAdmin, RecruiterManagementController.createRecruiter);
router.post("/admin/recruiters/:id/change-plan", verifyToken, verifySuperAdmin, RecruiterManagementController.changeRecruiterPlan);
router.post("/admin/recruiters/:id/extend-subscription", verifyToken, verifySuperAdmin, RecruiterManagementController.extendSubscription);
router.put("/admin/recruiters/:id/status", verifyToken, verifySuperAdmin, RecruiterManagementController.updateRecruiterStatus);
router.post("/admin/recruiters/:id/reset-password", verifyToken, verifySuperAdmin, RecruiterManagementController.resetPassword);
router.get("/admin/subscriptions", verifyToken, verifySuperAdmin, RecruiterManagementController.getAllSubscriptions);
router.get("/admin/audit-logs", verifyToken, verifySuperAdmin, RecruiterManagementController.getAuditLogs);

// ==========================================
// 👥 Recruiter Team & Sub-Recruiter Routes
// ==========================================
router.get("/recruiter/team", verifyToken, SubRecruiterController.getTeam);
router.post("/recruiter/team", verifyToken, SubRecruiterController.createSubRecruiter);
router.put("/recruiter/team/:id/permissions", verifyToken, SubRecruiterController.updatePermissions);
router.patch("/recruiter/team/:id/status", verifyToken, SubRecruiterController.toggleStatus);
router.delete("/recruiter/team/:id", verifyToken, SubRecruiterController.deleteSubRecruiter);

// Super Admin Team Oversight
router.get("/admin/recruiters/:id/team", verifyToken, verifySuperAdmin, SubRecruiterController.getAdminRecruiterTeam);
router.post("/admin/recruiters/:id/team", verifyToken, verifySuperAdmin, SubRecruiterController.createAdminSubRecruiter);

// ==========================================
// 💼 Recruiter Dynamic Access Endpoint
// ==========================================
router.get("/recruiter/my-subscription", verifyToken, RecruiterSubscriptionController.getMySubscription);
router.post("/recruiter/subscription/consume-view", verifyToken, RecruiterSubscriptionController.consumeResumeView);
router.post("/recruiter/subscription/consume-download", verifyToken, RecruiterSubscriptionController.consumeResumeDownload);
router.post("/recruiter/candidates/send-email", verifyToken, RecruiterSubscriptionController.sendCandidateEmail);

// User module APIs
router.get("/getUsers", userController.getUsers);
router.post("/createUser", userController.createUser);
router.put("/updateUser/:id", userController.updateUser);
router.put("/user/status/:id", verifyToken, userController.updateUserStatus);
router.delete("/deleteUser/:id", userController.deleteUser);

// Role module APIs
router.get("/getRoles", RoleController.getRoles);

//Organization module APIs
router.get(
  "/organization/type/get",
  OrganizationController.getOrganizationTypes
);

// Industry module APIs
router.get("/industry/type/get", IndustryController.getIndustryTypes);
router.get("/industry-types", IndustryController.getIndustryTypes);

// Billing Plan APIs
router.get("/getBillingPlans", verifyToken, BillingPlanController.getBillingPlans);
router.put("/updateBillingPlan", verifyToken, BillingPlanController.updateBillingPlan);

// Settings APIs
router.get("/settings/get", SettingsController.getSettings);
router.put("/settings/update", verifyToken, SettingsController.updateSettings);

// Integrations APIs
const IntegrationsController = require("../controllers/IntegrationsController");
router.get("/integrations/get", verifyToken, IntegrationsController.getIntegrations);
router.put("/integrations/update", verifyToken, IntegrationsController.updateIntegrations);

//Job module APIs
router.post("/job/nature/add", verifyToken, JobsController.insertJobNature);
router.get("/job/getJobNature", verifyToken, JobsController.getJobNature);
router.get("/venue/get", verifyToken, JobsController.getVenues);
router.post("/venue/create", verifyToken, JobsController.createVenue);
router.get("/team-member/get", verifyToken, JobsController.getTeamMembers);
router.post("/team-member/create", verifyToken, JobsController.createTeamMember);
router.delete("/team-member/delete/:id", verifyToken, JobsController.deleteTeamMember);

router.post(
  "/job/workplace-type/add",
  verifyToken,
  JobsController.insertWorkPlaceType
);
router.get(
  "/job/workplace-type/get",
  verifyToken,
  JobsController.getWorkplaceType
);

router.get(
  "/job/workLocation/get",
  verifyToken,
  JobsController.getWorklocation
);

router.get(
  "/job/durationTypes/get",
  verifyToken,
  JobsController.getInternshipDuration
);

router.get("/getDuration", verifyToken, JobsController.getDurationPeriod);
router.get("/getBenefits", verifyToken, JobsController.getBenefits);
router.get("/getGender", verifyToken, JobsController.getGender);
router.get("/getEligibility", verifyToken, JobsController.getEligibility);
router.get("/getSalaryType", verifyToken, JobsController.getSalaryType);

// Job posting module start

router.get("/userAppliedJobs", userController.getUserAppliedJobs);
router.put(
  "/updateUserAppliedJobStatus",
  userController.updateUserAppliedJobStatus
);
router.get("/getUserJobPostStatus", userController.getUserJobPostStatus);
router.post("/jobPosting", verifyToken, JobsController.jobPosting);
router.put("/updateJobPosting", verifyToken, JobsController.updateJobPosting);
router.post("/applyforjob", verifyToken, JobsController.applyForJob);
router.get(
  "/getJobAppliedCandidates",
  verifyToken,
  JobsController.getJobAppliedCandidates
);
router.get(
  "/getAllAppliedCandidates",
  verifyToken,
  JobsController.getAllAppliedCandidates
);
router.get(
  "/getJobPostByUserId",
  verifyToken,
  JobsController.getJobPostByUserId
);
router.delete("/deleteJobPost", verifyToken, JobsController.deleteJobPost);
router.post("/getJobPosts", JobsController.getJobPosts);
router.get("/job/logo/:id", JobsController.getCompanyLogo);
router.put("/registrationClose", verifyToken, JobsController.registrationClose);
router.put("/makeJobActive", verifyToken, JobsController.makeJobActive);

// Job Approval Endpoints
router.get("/getPendingJobs", verifyToken, JobsController.getPendingJobs);
router.put("/approveJob/:id", verifyToken, JobsController.approveJob);
router.put("/approveAllJobs", verifyToken, JobsController.approveAllJobs);
router.put("/rejectJob/:id", verifyToken, JobsController.rejectJob);

// Job posting module end

router.get("/getYears", JobsController.getYears);
router.get("/getSkills", JobsController.getSkills);
router.get("/getJobCategories", JobsController.getJobCategories);

// Email verification
router.post("/sendOTP", EmailController.sendVerificationEmail);
router.post("/verifyOTP", EmailController.verifyOTP);
router.put("/forgotPassword", userController.forgotPassword);
router.post("/insertProfile", userController.insertProfile);
router.post("/insertHrProfile", verifyToken, userController.insertHrProfile);
router.get("/getHrProfile/:userId", verifyToken, userController.getHrProfile);
router.get("/getExperienceRange", JobsController.getExperienceRange);
router.put("/updateSocialLinks", verifyToken, userController.updateSocialLinks);
router.post("/insertProjects", verifyToken, JobsController.insertProjects);
router.put("/updateProject", verifyToken, JobsController.updateProject);
router.post("/VerifyEmail", EmailController.VerifyEmail);
router.post("/competitionRegistration", EmailController.sendCompetitionRegistration);
router.post("/mentorQuery", EmailController.sendMentorQuery);
router.put("/updateResume", verifyToken, upload.single("resume"), JobsController.updateResume);
router.put("/updateSkills", verifyToken, JobsController.updateSkills);
router.put("/updateVisibility", verifyToken, JobsController.updateVisibility);
router.put("/updateAbout", verifyToken, JobsController.updateAbout);
router.get("/getUserType", userController.getUserType);

router.get("/getClasses", JobsController.getClasses);
router.put(
  "/updateBasicDetails",
  verifyToken,
  userController.updateBasicDetails
);

router.put("/updateEducation", verifyToken, userController.updateEducation);
router.delete("/deleteEducation", verifyToken, userController.deleteEducation);
router.post("/insertEducation", verifyToken, userController.insertEducation);

router.put("/updateExperience", verifyToken, JobsController.updateExperience);
router.post("/insertExperience", verifyToken, JobsController.insertExperience);
router.delete(
  "/deleteExperience",
  verifyToken,
  JobsController.deleteExperience
);
router.get("/getUserProfile", verifyToken, userController.getUserProfile);
router.get("/getQualification", JobsController.getQualification);
router.get("/getCourses", JobsController.getCourses);
router.get("/getSpecialization", JobsController.getSpecialization);
router.get("/getColleges", JobsController.getColleges);
router.get("/getCourseType", JobsController.getCourseType);

// router.post("/insertCollege", RoleController.insertCollege);

router.delete("/deleteProject", verifyToken, JobsController.deleteProject);
router.post("/saveJobPost", verifyToken, JobsController.saveJobPost);
router.get("/getSavedJobs", verifyToken, JobsController.getSavedJobs);
router.delete("/removeSavedJobs", verifyToken, JobsController.removeSavedJobs);
router.get("/isProfileUpdated", verifyToken, userController.isProfileUpdated);

router.get("/checkIsJobApplied", verifyToken, JobsController.checkIsJobApplied);
router.get("/checkIsJobSaved", verifyToken, JobsController.checkIsJobSaved);

// HR Saved Candidates API
router.post("/job/saveCandidateHR", verifyToken, JobsController.saveCandidateHR);
router.get("/job/getSavedCandidatesHR", verifyToken, JobsController.getSavedCandidatesHR);
router.delete("/job/removeSavedCandidateHR", verifyToken, JobsController.removeSavedCandidateHR);
router.put(
  "/updateProfileImage",
  verifyToken,
  upload.single('profile_image'),
  userController.updateProfileImage
);

router.put(
  "/updateBanner",
  verifyToken,
  userController.updateBanner
);

router.put(
  "/updateJobDescription",
  verifyToken,
  JobsController.updateJobDescription
);
router.put("/updateEligibility", verifyToken, JobsController.updateEligibility);
router.post("/updateJobStatus", verifyToken, JobsController.updateJobStatus);
router.get("/searchByKeyword", JobsController.searchByKeyword);
router.put("/updateJobNature", verifyToken, JobsController.updateJobNature);
router.put(
  "/updateJobBasicDetails",
  verifyToken,
  JobsController.updateJobBasicDetails
);
router.post("/dailyStreak", LoginController.dailyStreak);
router.get("/getDailyStreak", LoginController.getDailyStreak);
router.put("/changePassword", verifyToken, LoginController.changePassword);
router.get("/getAppliedCandidatesCount", verifyToken, JobsController.getAppliedCandidatesCount);
router.get("/getHomePageStats", JobsController.getHomePageStats);
router.get("/getTrendingSearches", JobsController.getTrendingSearches);
router.get("/getUniqueCompanies", JobsController.getUniqueCompanies);
router.get("/superadmin/dashboard-stats", verifyToken, JobsController.getSuperAdminDashboardData);
router.get("/StatsOfPost", verifyToken, JobsController.StatsOfPost);
router.get("/getLocations", JobsController.getLocations);
router.get(
  "/getAllCandidateByRecruiter",
  verifyToken,
  JobsController.getAllCandidateByRecruiter
);

router.post(
  "/sendAppliedNotification",
  NotificationController.sendAppliedNotification
);
router.post("/subscribe-topic", NotificationController.subscribeToTopic);
router.post(
  "/broadcast-notification",
  NotificationController.sendTopicNotification
);

router.post("/applyJob", applyJob);

// Token management routes
router.use("/token", tokenRoutes);
router.use("/blogs", blogRoutes);

// group auth under /api/auth
router.use("/auth", authRoutes);
router.use("/events", eventRoutes);
router.use("/event-registration", eventRegistrationRoutes);
router.use("/workshops", workshopRoutes);
router.use("/workshop-registration", workshopRegistrationRoutes);
router.use("/courses", courseRoutes);

// Candidate Search Routes
router.get("/candidates/search", CandidateSearchController.searchCandidates);
router.get("/candidates/filter-options", CandidateSearchController.getFilterOptions);
router.get("/candidates/companies-lookup", CandidateSearchController.lookupCompanies);
router.get("/users/profile-image/:id", userController.getProfileImage);
router.get("/users/resume/:id", userController.getResume);
// Candidate Folders
router.get("/candidates/folders", verifyToken, CandidateSearchController.getFolders);
router.post("/candidates/folders", verifyToken, CandidateSearchController.createFolder);
router.post("/candidates/folders/add-candidates", verifyToken, CandidateSearchController.addCandidatesToFolder);
router.put("/candidates/folders/:id", verifyToken, CandidateSearchController.updateFolder);
router.delete("/candidates/folders/:id", verifyToken, CandidateSearchController.deleteFolder);
router.get("/candidates/folders/:id/candidates", verifyToken, CandidateSearchController.getFolderCandidates);
router.put("/candidates/folders/:id/candidates/stage", verifyToken, CandidateSearchController.updateCandidateStageInFolder);
router.delete("/candidates/folders/:id/candidates/:candidateId", verifyToken, CandidateSearchController.removeCandidateFromFolder);

// HR Dashboard APIs
const HrDashboardController = require("../controllers/HrDashboardController");
router.get("/hr/dashboard/summary", HrDashboardController.getDashboardSummary);
router.post("/hr/dashboard/searches", HrDashboardController.saveSearch);
router.delete("/hr/dashboard/searches/clear", HrDashboardController.clearSearches);
router.delete("/hr/dashboard/searches/:id", HrDashboardController.deleteSearch);
router.get("/hr/dashboard/campaigns", HrDashboardController.getCampaigns);
router.get("/hr/dashboard/credits", HrDashboardController.getCredits);

module.exports = router;


