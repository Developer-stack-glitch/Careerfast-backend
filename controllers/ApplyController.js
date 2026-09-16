// controllers/ApplyController.js
const admin = require("../config/firebase");
const pool = require("../config/dbConfig.js");

const applyJob = async (req, res) => {
    const { postId, userId } = req.body;

    if (!postId || !userId) {
        return res.status(400).json({
            success: false,
            error: "postId and userId are required",
        });
    }

    try {
        console.log(`📝 Application received: User ${userId} applying for Job ${postId}`);

        // 1️⃣ Get recruiter + job info
        const [rows] = await pool.query(
            `SELECT jp.job_title, jp.job_nature, u.fcm_token, u.id as recruiterId, u.first_name, u.last_name
             FROM job_post jp
             INNER JOIN users u ON jp.user_id = u.id
             WHERE jp.id = ?`,
            [postId]
        );

        if (!rows.length) {
            console.error(`❌ Job ${postId} not found`);
            return res.status(404).json({
                success: false,
                error: "Job or recruiter not found",
            });
        }

        const jobTitle = rows[0].job_title;
        const jobNature = rows[0].job_nature;
        const recruiterId = rows[0].recruiterId;
        const recruiterToken = rows[0].fcm_token;
        const recruiterName = `${rows[0].first_name} ${rows[0].last_name}`;

        console.log(`👤 Recruiter: ${recruiterName} (ID: ${recruiterId})`);
        console.log(`📋 Job: ${jobTitle} (${jobNature})`);

        // 2️⃣ Get candidate info
        const [cand] = await pool.query(
            `SELECT first_name, last_name FROM users WHERE id = ?`,
            [userId]
        );
        const candidateName = cand[0]
            ? `${cand[0].first_name} ${cand[0].last_name}`
            : "A candidate";

        console.log(`👨‍💼 Candidate: ${candidateName} (ID: ${userId})`);

        // 3️⃣ Check if user is applying to their own job
        if (parseInt(userId) === parseInt(recruiterId)) {
            console.log("⚠️ User is applying to their own job - skipping notification");
            return res.json({
                success: true,
                message: "Application submitted (self-application, no notification sent).",
            });
        }

        // 4️⃣ Send push to recruiter if token exists
        if (recruiterToken) {
            console.log(`🔔 Sending notification to recruiter (Token: ${recruiterToken.substring(0, 20)}...)`);

            const message = {
                notification: {
                    title: "New Job Application! 🎯",
                    body: `${candidateName} just applied for ${jobTitle}. Review their profile now!`,
                },
                webpush: {
                    notification: {
                        icon: "/favicon.png",
                        requireInteraction: true,
                    },
                    fcm_options: {
                        link: "https://careerfast.in/admin-profile/applied",
                    },
                },
                token: recruiterToken,
            };

            try {
                const response = await admin.messaging().send(message);
                console.log("✅ Recruiter notified successfully!");
                console.log("📨 Firebase response:", response);
            } catch (err) {
                console.error("❌ Recruiter notification failed:", err.message);
                console.error("Full error:", err);
                // Don't fail the application if notification fails
            }
        } else {
            console.warn(`⚠️ Recruiter ${recruiterName} has no FCM token - cannot send notification`);
            console.warn("💡 Recruiter needs to log in and grant notification permissions");
        }

        // 5️⃣ Respond to candidate
        res.json({
            success: true,
            message: "Application submitted. Recruiter notified.",
        });
    } catch (error) {
        console.error("❌ Error in applyJob notification:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { applyJob };
