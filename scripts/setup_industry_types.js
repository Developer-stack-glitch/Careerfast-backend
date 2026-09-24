const pool = require("../config/dbConfig");

const WORLDWIDE_INDUSTRIES = [
  "IT & Software",
  "Information Technology & Services",
  "Software Product & SaaS",
  "Artificial Intelligence & Machine Learning",
  "Banking, Financial Services & Insurance (BFSI)",
  "FinTech & Digital Payments",
  "Investment Banking & Venture Capital",
  "Healthcare & Hospitals",
  "Pharmaceuticals & Biotechnology",
  "Medical Devices & Diagnostics",
  "E-Commerce & Digital Marketplaces",
  "Retail & Wholesale Trade",
  "Consumer Goods & FMCG",
  "Automotive & Electric Vehicles",
  "Aerospace & Aviation",
  "Manufacturing, Industrial & Heavy Machinery",
  "Civil Engineering & Construction",
  "Real Estate & Property Management",
  "Architecture & Interior Design",
  "Telecommunications & Networking",
  "Electronics & Semiconductor Manufacturing",
  "Education, EdTech & Academia",
  "Higher Education & Research Institutes",
  "Energy, Power & Utilities",
  "Oil, Gas & Petroleum Exploration",
  "Renewable Energy & CleanTech",
  "Logistics, Supply Chain & Warehousing",
  "Freight Forwarding & Maritime Shipping",
  "Media, Entertainment & Publishing",
  "Gaming, Animation & VFX",
  "Advertising, Marketing & Public Relations",
  "Hospitality, Travel & Tourism",
  "Restaurants & Food Services",
  "Food Production & Processing",
  "Agriculture, Farming & AgriTech",
  "Management Consulting & Strategy",
  "Legal Services & Law Practice",
  "Accounting, Auditing & Taxation",
  "Human Resources & Staffing Services",
  "Non-Profit, NGO & Social Impact",
  "Government Administration & Public Policy",
  "Defense & Military Technology",
  "Security & Surveillance Systems",
  "Chemicals & Petrochemicals",
  "Mining, Metals & Metallurgy",
  "Textiles, Apparel & Fashion",
  "Environmental Services & Waste Management"
];

async function setupIndustryTypes() {
  try {
    console.log("Creating `industry_types` table if not exists...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS industry_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        is_active BIT(1) DEFAULT b'1',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log("Seeding worldwide industry types...");
    for (const name of WORLDWIDE_INDUSTRIES) {
      await pool.query(
        `INSERT IGNORE INTO industry_types (name, is_active) VALUES (?, b'1')`,
        [name]
      );
    }

    const [rows] = await pool.query(`SELECT COUNT(*) as count FROM industry_types`);
    console.log(`✅ Success! Total industry types in table: ${rows[0].count}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting up industry types:", error);
    process.exit(1);
  }
}

setupIndustryTypes();
