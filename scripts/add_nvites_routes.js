const fs = require("fs");
const path = require("path");

const routesPath = path.join(__dirname, "../routes/Routes.js");
let content = fs.readFileSync(routesPath, "utf8");

if (content.includes("NvitesController")) {
  console.log("NvitesController already registered in Routes.js");
  process.exit(0);
}

// 1. Add require at top
content = content.replace(
  'const LocationController = require("../controllers/LocationController");',
  'const LocationController = require("../controllers/LocationController");\nconst NvitesController = require("../controllers/NvitesController");'
);

// 2. Add routes section
const nviteRoutesCode = `
// ==========================================
// ⚡ Naukri-style Nvites (Job Invitations) APIs
// ==========================================
router.post("/nvites/send", verifyToken, NvitesController.sendNvites);
router.get("/nvites/recruiter", verifyToken, NvitesController.getRecruiterNvites);
router.get("/nvites/candidate", verifyToken, NvitesController.getCandidateNvites);
router.post("/nvites/:id/view", verifyToken, NvitesController.markNviteViewed);
router.post("/nvites/:id/accept", verifyToken, NvitesController.acceptNvite);
router.post("/nvites/:id/decline", verifyToken, NvitesController.declineNvite);
router.post("/nvites/:id/resend", verifyToken, NvitesController.resendNvite);
`;

content = content.replace(
  'router.post("/recruiter/candidates/record-whatsapp", verifyToken, RecruiterSubscriptionController.recordCandidateWhatsApp);',
  'router.post("/recruiter/candidates/record-whatsapp", verifyToken, RecruiterSubscriptionController.recordCandidateWhatsApp);\n' + nviteRoutesCode
);

fs.writeFileSync(routesPath, content, "utf8");
console.log("✅ Successfully added Nvites routes to Routes.js");

