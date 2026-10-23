-- =====================================================================
-- CareerFast Database Migration Script for Live Database
-- Generated: 2026-10-22
-- Purpose: Bring Live DB in sync with current codebase changes
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CRITICAL MISSING COLUMN
-- ---------------------------------------------------------------------
-- Required by UserModel.js, JobSeekers.jsx, and ensureIndexes.js
ALTER TABLE `users` 
  ADD COLUMN `profile_completion` INT NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------
-- 2. MISSING PERFORMANCE INDEXES & CONSTRAINTS
-- ---------------------------------------------------------------------

-- Accelerates candidate profile completion filtering in admin dashboard
ALTER TABLE `users` 
  ADD INDEX `idx_users_role_comp` (`role_id`, `profile_completion`);

-- Accelerates candidate applications lookup per job posting
ALTER TABLE `applied_jobs` 
  ADD INDEX `idx_applied_postId` (`postId`);

-- Speeds up recruiter job lookups and dashboard queries
ALTER TABLE `job_post` 
  ADD INDEX `idx_job_post_user` (`user_id`);

-- Speeds up support ticket ordering in SupportTicketModel.js
ALTER TABLE `support_tickets` 
  ADD INDEX `idx_ticket_created_at` (`created_at`);

-- Prevents duplicate social link entries per candidate
ALTER TABLE `user_social_links` 
  ADD UNIQUE INDEX `uniq_user_id` (`user_id`);

-- ---------------------------------------------------------------------
-- 3. COLUMN TYPE FIXES (Matches Local DB & Prevents Crashes)
-- ---------------------------------------------------------------------

-- Matches users.id BIGINT(20) and allows NULL when admin posts jobs
ALTER TABLE `job_post` 
  MODIFY COLUMN `user_id` BIGINT(20) NULL DEFAULT NULL;

-- Replaces rigid ENUMs with VARCHAR(50) to prevent fatal errors on payment webhook statuses
ALTER TABLE `recruiter_payments` 
  MODIFY COLUMN `payment_status` VARCHAR(50) DEFAULT 'Paid';

ALTER TABLE `recruiter_subscriptions` 
  MODIFY COLUMN `status` VARCHAR(50) DEFAULT 'Active',
  MODIFY COLUMN `payment_status` VARCHAR(50) DEFAULT 'Paid';

-- ---------------------------------------------------------------------
-- 4. ONE-TIME BACKFILL: Recalculate Profile Completion for Existing Candidates
-- ---------------------------------------------------------------------
UPDATE users u
LEFT JOIN (
  SELECT user_id FROM user_education WHERE is_deleted = 0 GROUP BY user_id
) ue ON u.id = ue.user_id
SET u.profile_completion = (
  (CASE WHEN NULLIF(TRIM(u.first_name), '') IS NOT NULL AND NULLIF(TRIM(u.email), '') IS NOT NULL AND NULLIF(TRIM(u.phone), '') IS NOT NULL THEN 20 
        WHEN NULLIF(TRIM(u.first_name), '') IS NOT NULL AND (NULLIF(TRIM(u.email), '') IS NOT NULL OR NULLIF(TRIM(u.phone), '') IS NOT NULL) THEN 10 ELSE 0 END) +
  (CASE WHEN u.profile_image IS NOT NULL AND u.profile_image != '' AND u.profile_image != 'null' AND u.profile_image != '#' THEN 10 ELSE 0 END) +
  (CASE WHEN u.location IS NOT NULL AND u.location != '' AND u.location != 'null' AND u.location != 'Not Specified' AND u.location != 'Location N/A' THEN 10 ELSE 0 END) +
  (CASE WHEN (u.about IS NOT NULL AND u.about != '') OR (u.headline IS NOT NULL AND u.headline != '') THEN 10 ELSE 0 END) +
  (CASE WHEN (u.experince_type IS NOT NULL AND u.experince_type != '') OR u.total_years > 0 THEN 15 ELSE 0 END) +
  (CASE WHEN ue.user_id IS NOT NULL OR NULLIF(u.course, '') IS NOT NULL OR NULLIF(u.class, '') IS NOT NULL THEN 15 ELSE 0 END) +
  (CASE WHEN u.skills IS NOT NULL AND u.skills != '' AND u.skills != '[]' AND u.skills != 'null' THEN 10 ELSE 0 END) +
  (CASE WHEN u.resume IS NOT NULL AND u.resume != '' AND u.resume != '#' AND u.resume != 'null' AND u.resume != 'Resume' THEN 10 ELSE 0 END)
)
WHERE u.role_id = 2;
