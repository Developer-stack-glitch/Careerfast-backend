const pool = require("../config/dbConfig");
const NvitesModel = require("../models/NvitesModel");

async function runTest() {
  try {
    console.log("🔍 Checking existing users and jobs for testing...");

    // Find a recruiter user
    const [recruiters] = await pool.query(
      `SELECT id, first_name, last_name, email FROM users WHERE role_id IN (1, 3) LIMIT 1`
    );
    if (recruiters.length === 0) {
      console.log("No recruiter found to test with.");
      process.exit(0);
    }
    const recruiter = recruiters[0];
    console.log("Found recruiter:", recruiter.id, recruiter.first_name, recruiter.email);

    // Find an active job
    const [jobs] = await pool.query(
      `SELECT id, job_title, user_id FROM job_post LIMIT 1`
    );
    if (jobs.length === 0) {
      console.log("No job post found to test with.");
      process.exit(0);
    }
    const job = jobs[0];
    console.log("Found job:", job.id, job.job_title);

    // Find a candidate
    const [candidates] = await pool.query(
      `SELECT id, first_name, last_name, email FROM users WHERE (role_id = 2 OR role_id IS NULL) AND id != ? LIMIT 1`,
      [recruiter.id]
    );
    if (candidates.length === 0) {
      console.log("No candidate found to test with.");
      process.exit(0);
    }
    const candidate = candidates[0];
    console.log("Found candidate:", candidate.id, candidate.first_name, candidate.email);

    console.log("\n⚡ 1. Testing NvitesModel.sendNvites...");
    const sendRes = await NvitesModel.sendNvites({
      recruiterId: recruiter.id,
      jobId: job.id,
      candidateIds: [candidate.id],
      subject: `⚡ Career Opportunity: ${job.job_title}`,
      message: `Hi ${candidate.first_name}, we reviewed your background and would love to invite you to apply for ${job.job_title}!`,
      templateType: "standard",
      shareContact: 1,
      validityDays: 14,
    });
    console.log("✅ sendNvites result:", sendRes);

    const createdNviteId = sendRes.recipients[0]?.nviteId;

    console.log("\n📊 2. Testing NvitesModel.getRecruiterNvites...");
    const recruiterNvites = await NvitesModel.getRecruiterNvites(recruiter.id, {
      status: "all",
      page: 1,
      limit: 10,
    });
    console.log("✅ getRecruiterNvites total:", recruiterNvites.total, "stats:", recruiterNvites.stats);

    console.log("\n📬 3. Testing NvitesModel.getCandidateNvites...");
    const candNvites = await NvitesModel.getCandidateNvites(candidate.id, {
      status: "all",
    });
    console.log("✅ getCandidateNvites total:", candNvites.total);

    console.log("\n👁️ 4. Testing NvitesModel.markNviteViewed...");
    if (createdNviteId) {
      await NvitesModel.markNviteViewed(createdNviteId, candidate.id);
      console.log("✅ markNviteViewed succeeded!");
    }

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test error:", error);
    process.exit(1);
  }
}

runTest();

