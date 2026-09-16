const dbConfig = require('./config/dbConfig');

const createTableQuery = `
CREATE TABLE IF NOT EXISTS integrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider_name VARCHAR(100) NOT NULL,
    integration_key VARCHAR(255) NOT NULL UNIQUE,
    integration_value TEXT,
    is_enabled BOOLEAN DEFAULT false,
    label VARCHAR(255) NOT NULL,
    input_type VARCHAR(50) DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`;

const seedDataQuery = `
INSERT IGNORE INTO integrations (provider_name, integration_key, integration_value, is_enabled, label, input_type) VALUES 
('Google Auth', 'google_client_id', '', false, 'Client ID', 'text'),
('Google Auth', 'google_client_secret', '', false, 'Client Secret', 'password'),
('Razorpay', 'razorpay_key_id', '', false, 'Key ID', 'text'),
('Razorpay', 'razorpay_key_secret', '', false, 'Key Secret', 'password'),
('AWS S3', 'aws_access_key', '', false, 'Access Key', 'text'),
('AWS S3', 'aws_secret_key', '', false, 'Secret Key', 'password'),
('AWS S3', 'aws_region', 'ap-south-1', false, 'Region', 'text'),
('AWS S3', 'aws_bucket_name', '', false, 'Bucket Name', 'text')
`;

async function initDB() {
    try {
        await dbConfig.query(createTableQuery);
        console.log("Integrations table created successfully.");
        
        await dbConfig.query(seedDataQuery);
        console.log("Default integrations seeded successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

initDB();
