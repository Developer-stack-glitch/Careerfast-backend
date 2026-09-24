const pool = require('./config/dbConfig');

async function createHrDashboardTables() {
    try {
        console.log("Creating HR dashboard tables...");

        // 1. recruiter_searches table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recruiter_searches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                recruiter_id INT NOT NULL,
                search_type ENUM('recent', 'saved') NOT NULL DEFAULT 'recent',
                query_title VARCHAR(500) NOT NULL,
                query_params JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_recruiter_type (recruiter_id, search_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("✅ recruiter_searches table ready.");

        // 2. hr_campaigns table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS hr_campaigns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                recruiter_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                channel ENUM('whatsapp', 'email', 'sms') NOT NULL DEFAULT 'email',
                status ENUM('Draft', 'Live', 'Finished') NOT NULL DEFAULT 'Draft',
                opened_count INT NOT NULL DEFAULT 0,
                responded_count INT NOT NULL DEFAULT 0,
                total_sent INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_recruiter_campaigns (recruiter_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("✅ hr_campaigns table ready.");

        // 3. hr_credits_breakdown table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS hr_credits_breakdown (
                id INT AUTO_INCREMENT PRIMARY KEY,
                recruiter_id INT NOT NULL UNIQUE,
                profile_usage_used INT NOT NULL DEFAULT 45300,
                profile_usage_total INT NOT NULL DEFAULT 720000,
                profile_views INT NOT NULL DEFAULT 1300,
                excel_downloads INT NOT NULL DEFAULT 0,
                job_posting_used INT NOT NULL DEFAULT 23,
                job_posting_total INT NOT NULL DEFAULT 450,
                jobs_posted INT NOT NULL DEFAULT 2,
                outreach_used INT NOT NULL DEFAULT 1400000,
                outreach_total INT NOT NULL DEFAULT 10800000,
                email_count INT NOT NULL DEFAULT 0,
                whatsapp_count INT NOT NULL DEFAULT 0,
                sms_count INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("✅ hr_credits_breakdown table ready.");

        // Note: recruiter_searches table will be populated dynamically by real user searches.

        const [campaignRows] = await pool.query(`SELECT COUNT(*) as count FROM hr_campaigns`);
        if (campaignRows[0].count === 0) {
            const seedCampaigns = [
                {
                    recruiter_id: 2,
                    title: 'ACTE Technologies',
                    channel: 'whatsapp',
                    status: 'Draft',
                    opened_count: 0,
                    responded_count: 0,
                    total_sent: 0,
                    updated_at: '2025-12-10 13:08:00'
                },
                {
                    recruiter_id: 2,
                    title: 'SMO EXECUTIVE',
                    channel: 'email',
                    status: 'Finished',
                    opened_count: 107,
                    responded_count: 24,
                    total_sent: 320,
                    updated_at: '2025-11-09 16:11:00'
                },
                {
                    recruiter_id: 2,
                    title: 'SMO Executive',
                    channel: 'whatsapp',
                    status: 'Live',
                    opened_count: 18,
                    responded_count: 0,
                    total_sent: 50,
                    updated_at: '2025-11-07 12:24:00'
                },
                {
                    recruiter_id: 2,
                    title: 'TALENT HUNT',
                    channel: 'email',
                    status: 'Finished',
                    opened_count: 0,
                    responded_count: 0,
                    total_sent: 200,
                    updated_at: '2025-07-26 19:52:00'
                }
            ];

            for (const c of seedCampaigns) {
                await pool.query(
                    `INSERT INTO hr_campaigns (recruiter_id, title, channel, status, opened_count, responded_count, total_sent, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [c.recruiter_id, c.title, c.channel, c.status, c.opened_count, c.responded_count, c.total_sent, c.updated_at]
                );
            }
            console.log("✅ Seeded initial campaigns.");
        }

        const [creditRows] = await pool.query(`SELECT COUNT(*) as count FROM hr_credits_breakdown`);
        if (creditRows[0].count === 0) {
            await pool.query(`
                INSERT INTO hr_credits_breakdown 
                (recruiter_id, profile_usage_used, profile_usage_total, profile_views, excel_downloads, job_posting_used, job_posting_total, jobs_posted, outreach_used, outreach_total, email_count, whatsapp_count, sms_count)
                VALUES (2, 45300, 720000, 1300, 0, 23, 450, 2, 1400000, 10800000, 0, 0, 0)
            `);
            console.log("✅ Seeded initial credit breakdown.");
        }

        console.log("🎉 All HR Dashboard database tables and seed data created successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error setting up HR Dashboard tables:", error);
        process.exit(1);
    }
}

createHrDashboardTables();
