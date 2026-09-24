-- =====================================================================
-- CareerFast Database Migration Script for Live Database (MySQL 8.0+)
-- Generated: 2026-09-24T11:29:05.864Z
--
-- Contents:
--   1. CREATE TABLE statements for all 12 tables missing in live_db
--   2. Essential seed data for subscription_plans and industry_types
--   3. ALTER TABLE statements for missing columns in hr_profiles, job_post, users
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- =====================================================================
-- SECTION 1: CREATE MISSING TABLES (12 TABLES)
-- =====================================================================

-- 1. Table: industry_types
CREATE TABLE IF NOT EXISTS `industry_types` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `is_active` BIT(1) DEFAULT b'1',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Table: subscription_plans
CREATE TABLE IF NOT EXISTS `subscription_plans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT DEFAULT NULL,
  `plan_type` ENUM('monthly', 'yearly', 'custom') DEFAULT 'monthly',
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) DEFAULT 'INR',
  `validity_days` INT NOT NULL DEFAULT 30,
  `job_post_limit` INT NOT NULL DEFAULT 5,
  `active_job_limit` INT NOT NULL DEFAULT 3,
  `featured_job_limit` INT NOT NULL DEFAULT 0,
  `urgent_job_limit` INT NOT NULL DEFAULT 0,
  `sub_recruiter_limit` INT NOT NULL DEFAULT 1,
  `resume_view_limit` INT NOT NULL DEFAULT 50,
  `resume_download_limit` INT NOT NULL DEFAULT 10,
  `candidate_search` TINYINT(1) DEFAULT 0,
  `candidate_contact` TINYINT(1) DEFAULT 0,
  `resume_database` TINYINT(1) DEFAULT 0,
  `interview_management` TINYINT(1) DEFAULT 1,
  `application_management` TINYINT(1) DEFAULT 1,
  `shortlisting` TINYINT(1) DEFAULT 1,
  `company_profile` TINYINT(1) DEFAULT 1,
  `recruiter_dashboard` TINYINT(1) DEFAULT 1,
  `email_notifications` TINYINT(1) DEFAULT 1,
  `company_branding` TINYINT(1) DEFAULT 0,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Table: recruiter_subscriptions
CREATE TABLE IF NOT EXISTS `recruiter_subscriptions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `recruiter_id` BIGINT NOT NULL,
  `company_id` INT DEFAULT NULL,
  `plan_id` INT NOT NULL,
  `billing_cycle` ENUM('monthly', 'yearly', 'custom') DEFAULT 'monthly',
  `price_paid` DECIMAL(10, 2) DEFAULT 0.00,
  `start_date` DATETIME NOT NULL,
  `expiry_date` DATETIME NOT NULL,
  `status` ENUM('Trial', 'Active', 'Expiring Soon', 'Expired', 'Suspended', 'Cancelled') DEFAULT 'Active',
  `payment_status` ENUM('Paid', 'Pending', 'Failed', 'Refunded') DEFAULT 'Paid',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_recruiter_status` (`recruiter_id`, `status`),
  INDEX `idx_plan` (`plan_id`),
  INDEX `idx_expiry` (`expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Table: subscription_usage
CREATE TABLE IF NOT EXISTS `subscription_usage` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `subscription_id` INT NOT NULL,
  `recruiter_id` BIGINT NOT NULL,
  `billing_period_start` DATETIME NOT NULL,
  `billing_period_end` DATETIME NOT NULL,
  `job_posts_used` INT DEFAULT 0,
  `resume_views_used` INT DEFAULT 0,
  `resume_downloads_used` INT DEFAULT 0,
  `featured_jobs_used` INT DEFAULT 0,
  `urgent_jobs_used` INT DEFAULT 0,
  `candidate_contacts_used` INT DEFAULT 0,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_subscription_recruiter` (`subscription_id`, `recruiter_id`),
  INDEX `idx_billing_period` (`billing_period_start`, `billing_period_end`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. Table: subscription_history
CREATE TABLE IF NOT EXISTS `subscription_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `subscription_id` INT NOT NULL,
  `recruiter_id` BIGINT NOT NULL,
  `old_plan_id` INT DEFAULT NULL,
  `new_plan_id` INT NOT NULL,
  `change_type` VARCHAR(50) NOT NULL,
  `effective_type` VARCHAR(50) DEFAULT 'immediately',
  `previous_expiry` DATETIME DEFAULT NULL,
  `new_expiry` DATETIME DEFAULT NULL,
  `reason` TEXT DEFAULT NULL,
  `changed_by_admin_id` BIGINT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_recruiter_history` (`recruiter_id`),
  INDEX `idx_sub_history` (`subscription_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 6. Table: recruiter_payments
CREATE TABLE IF NOT EXISTS `recruiter_payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_id` VARCHAR(100) NOT NULL UNIQUE,
  `recruiter_id` BIGINT NOT NULL,
  `company_id` INT DEFAULT NULL,
  `plan_id` INT NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `payment_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `payment_method` VARCHAR(50) DEFAULT 'Admin Manual / Bank Transfer',
  `transaction_id` VARCHAR(100) DEFAULT NULL,
  `payment_status` ENUM('Paid', 'Pending', 'Failed', 'Refunded') DEFAULT 'Paid',
  `billing_period_start` DATETIME NOT NULL,
  `billing_period_end` DATETIME NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_recruiter_payments` (`recruiter_id`),
  INDEX `idx_invoice` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 7. Table: recruiter_resume_access
CREATE TABLE IF NOT EXISTS `recruiter_resume_access` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `recruiter_id` BIGINT NOT NULL,
  `subscription_id` INT NOT NULL,
  `candidate_id` BIGINT NOT NULL,
  `action_type` ENUM('view', 'download') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_rec_sub_cand_action` (`recruiter_id`, `subscription_id`, `candidate_id`, `action_type`),
  INDEX `idx_recruiter_action` (`recruiter_id`, `action_type`),
  INDEX `idx_sub_action` (`subscription_id`, `action_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 8. Table: sub_recruiters
CREATE TABLE IF NOT EXISTS `sub_recruiters` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `main_recruiter_id` BIGINT NOT NULL,
  `sub_recruiter_id` BIGINT NOT NULL,
  `company_id` INT DEFAULT NULL,
  `designation` VARCHAR(100) DEFAULT 'Recruiter',
  `role_preset` ENUM('team_admin', 'recruiter', 'sourcer', 'custom') DEFAULT 'recruiter',
  `permissions` JSON NOT NULL,
  `status` ENUM('active', 'suspended') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_main` (`main_recruiter_id`),
  INDEX `idx_sub` (`sub_recruiter_id`),
  INDEX `idx_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 9. Table: admin_audit_logs
CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id` BIGINT NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(50) NOT NULL,
  `target_id` VARCHAR(100) NOT NULL,
  `old_value` JSON DEFAULT NULL,
  `new_value` JSON DEFAULT NULL,
  `ip_address` VARCHAR(50) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_admin_actions` (`admin_id`, `created_at`),
  INDEX `idx_target` (`target_type`, `target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 10. Table: recruiter_searches
CREATE TABLE IF NOT EXISTS `recruiter_searches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `recruiter_id` INT NOT NULL,
  `search_type` ENUM('recent', 'saved') NOT NULL DEFAULT 'recent',
  `query_title` VARCHAR(500) NOT NULL,
  `query_params` JSON DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_recruiter_type` (`recruiter_id`, `search_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 11. Table: hr_campaigns
CREATE TABLE IF NOT EXISTS `hr_campaigns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `recruiter_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `channel` ENUM('whatsapp', 'email', 'sms') NOT NULL DEFAULT 'email',
  `status` ENUM('Draft', 'Live', 'Finished') NOT NULL DEFAULT 'Draft',
  `opened_count` INT NOT NULL DEFAULT 0,
  `responded_count` INT NOT NULL DEFAULT 0,
  `total_sent` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_recruiter_campaigns` (`recruiter_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 12. Table: hr_credits_breakdown
CREATE TABLE IF NOT EXISTS `hr_credits_breakdown` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `recruiter_id` INT NOT NULL UNIQUE,
  `profile_usage_used` INT NOT NULL DEFAULT 45300,
  `profile_usage_total` INT NOT NULL DEFAULT 720000,
  `profile_views` INT NOT NULL DEFAULT 1300,
  `excel_downloads` INT NOT NULL DEFAULT 0,
  `job_posting_used` INT NOT NULL DEFAULT 23,
  `job_posting_total` INT NOT NULL DEFAULT 450,
  `jobs_posted` INT NOT NULL DEFAULT 2,
  `outreach_used` INT NOT NULL DEFAULT 1400000,
  `outreach_total` INT NOT NULL DEFAULT 10800000,
  `email_count` INT NOT NULL DEFAULT 0,
  `whatsapp_count` INT NOT NULL DEFAULT 0,
  `sms_count` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================================
-- SECTION 2: SEED DATA FOR NEW TABLES
-- =====================================================================

-- Seed Subscription Plans (Basic, Professional, Premium)
INSERT INTO `subscription_plans` (
  `id`, `name`, `slug`, `description`, `plan_type`, `price`, `currency`, `validity_days`,
  `job_post_limit`, `active_job_limit`, `featured_job_limit`, `urgent_job_limit`, `sub_recruiter_limit`,
  `resume_view_limit`, `resume_download_limit`, `candidate_search`, `candidate_contact`, `resume_database`,
  `interview_management`, `application_management`, `shortlisting`, `company_profile`, `recruiter_dashboard`,
  `email_notifications`, `company_branding`, `status`
) VALUES
(1, 'Basic', 'basic', 'Essential recruitment plan for hiring entry-level candidates and startups.', 'monthly', 4999.00, 'INR', 30, 5, 3, 0, 0, 1, 50, 10, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 'active'),
(2, 'Professional', 'professional', 'Designed for growing companies with regular recruitment requirements.', 'monthly', 9999.00, 'INR', 30, 15, 10, 2, 2, 3, 250, 50, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 'active'),
(3, 'Premium', 'premium', 'High-volume hiring suite with candidate database search, featured postings and priority visibility.', 'monthly', 19999.00, 'INR', 30, 30, 20, 5, 5, 10, 1000, 250, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 'active')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Seed Worldwide Industry Types (47 standard industries)
INSERT INTO `industry_types` (`name`, `is_active`) VALUES
  ('IT & Software', b'1'),
  ('Information Technology & Services', b'1'),
  ('Software Product & SaaS', b'1'),
  ('Artificial Intelligence & Machine Learning', b'1'),
  ('Banking, Financial Services & Insurance (BFSI)', b'1'),
  ('FinTech & Digital Payments', b'1'),
  ('Investment Banking & Venture Capital', b'1'),
  ('Healthcare & Hospitals', b'1'),
  ('Pharmaceuticals & Biotechnology', b'1'),
  ('Medical Devices & Diagnostics', b'1'),
  ('E-Commerce & Digital Marketplaces', b'1'),
  ('Retail & Wholesale Trade', b'1'),
  ('Consumer Goods & FMCG', b'1'),
  ('Automotive & Electric Vehicles', b'1'),
  ('Aerospace & Aviation', b'1'),
  ('Manufacturing, Industrial & Heavy Machinery', b'1'),
  ('Civil Engineering & Construction', b'1'),
  ('Real Estate & Property Management', b'1'),
  ('Architecture & Interior Design', b'1'),
  ('Telecommunications & Networking', b'1'),
  ('Electronics & Semiconductor Manufacturing', b'1'),
  ('Education, EdTech & Academia', b'1'),
  ('Higher Education & Research Institutes', b'1'),
  ('Energy, Power & Utilities', b'1'),
  ('Oil, Gas & Petroleum Exploration', b'1'),
  ('Renewable Energy & CleanTech', b'1'),
  ('Logistics, Supply Chain & Warehousing', b'1'),
  ('Freight Forwarding & Maritime Shipping', b'1'),
  ('Media, Entertainment & Publishing', b'1'),
  ('Gaming, Animation & VFX', b'1'),
  ('Advertising, Marketing & Public Relations', b'1'),
  ('Hospitality, Travel & Tourism', b'1'),
  ('Restaurants & Food Services', b'1'),
  ('Food Production & Processing', b'1'),
  ('Agriculture, Farming & AgriTech', b'1'),
  ('Management Consulting & Strategy', b'1'),
  ('Legal Services & Law Practice', b'1'),
  ('Accounting, Auditing & Taxation', b'1'),
  ('Human Resources & Staffing Services', b'1'),
  ('Non-Profit, NGO & Social Impact', b'1'),
  ('Government Administration & Public Policy', b'1'),
  ('Defense & Military Technology', b'1'),
  ('Security & Surveillance Systems', b'1'),
  ('Chemicals & Petrochemicals', b'1'),
  ('Mining, Metals & Metallurgy', b'1'),
  ('Textiles, Apparel & Fashion', b'1'),
  ('Environmental Services & Waste Management', b'1')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- =====================================================================
-- SECTION 3: ADD MISSING COLUMNS TO EXISTING TABLES (Standard MySQL)
-- =====================================================================

-- 1. Table: hr_profiles (add gst_number)
ALTER TABLE `hr_profiles` ADD COLUMN `gst_number` VARCHAR(50) NULL AFTER `map_location`;

-- 2. Table: job_post (add views_count)
ALTER TABLE `job_post` ADD COLUMN `views_count` INT(11) DEFAULT 0;

-- 3. Table: users (candidate settings, privacy, and profile fields)
ALTER TABLE `users` 
  ADD COLUMN `languages` TEXT NULL,
  ADD COLUMN `visa_status` VARCHAR(255) NULL,
  ADD COLUMN `preferred_job_type` TEXT NULL,
  ADD COLUMN `dob` DATE NULL,
  ADD COLUMN `company_headcount` VARCHAR(255) NULL,
  ADD COLUMN `visibility_mode` VARCHAR(20) DEFAULT 'Limited',
  ADD COLUMN `hidden_companies` LONGTEXT NULL,
  ADD COLUMN `allow_contact` TINYINT(1) DEFAULT 1,
  ADD COLUMN `show_in_search` TINYINT(1) DEFAULT 1;

SET FOREIGN_KEY_CHECKS = 1;
