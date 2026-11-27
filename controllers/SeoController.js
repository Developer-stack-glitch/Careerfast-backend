const pool = require("../config/dbConfig");

let sitemapCache = null;
let sitemapCacheTime = 0;
const SITEMAP_CACHE_TTL = 5 * 60 * 1000;

const safeParseField = (val) => {
  if (!val) return val;
  if (typeof val === "string" && (val.startsWith("[") || val.startsWith("{"))) {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
};

exports.getSitemapData = async (req, res) => {
  try {
    const now = Date.now();
    if (sitemapCache && now - sitemapCacheTime < SITEMAP_CACHE_TTL) {
      return res.status(200).json({ success: true, data: sitemapCache, cached: true });
    }

    const jobsQuery = `
      SELECT
        job_post.id,
        job_post.job_title,
        job_post.job_nature,
        job_post.employment_type,
        job_post.work_location,
        job_post.workplace_type,
        job_post.experience_type,
        job_post.experience_required,
        job_post.created_at,
        job_post.approved_at,
        COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name) AS company_name
      FROM job_post
      LEFT JOIN hr_profiles ON job_post.user_id = hr_profiles.user_id
      WHERE job_post.approval_status = 'approved'
        AND (job_post.is_closed = 0 OR job_post.is_closed IS NULL)
        AND (job_post.expires_at IS NULL OR job_post.expires_at > NOW())
      ORDER BY job_post.id DESC
      LIMIT 5000
    `;

    const blogsQuery = `
      SELECT id, blogTitle, createdDate, updatedDate
      FROM blogs
      ORDER BY createdDate DESC
    `;

    const coursesQuery = `
      SELECT id, title, slug, created_at
      FROM courses
      ORDER BY id DESC
    `;

    const [[jobRows], [blogRows], [courseRows]] = await Promise.all([
      pool.query(jobsQuery),
      pool.query(blogsQuery),
      pool.query(coursesQuery),
    ]);

    const jobs = (jobRows || []).map((row) => ({
      id: row.id,
      job_title: row.job_title,
      job_nature: row.job_nature,
      employment_type: row.employment_type,
      work_location: safeParseField(row.work_location),
      workplace_type: row.workplace_type,
      experience_type: row.experience_type,
      experience_required: safeParseField(row.experience_required),
      company_name: row.company_name,
      created_at: row.created_at,
      approved_at: row.approved_at,
    }));

    const payload = {
      jobs,
      blogs: blogRows || [],
      courses: courseRows || [],
    };

    sitemapCache = payload;
    sitemapCacheTime = now;

    return res.status(200).json({ success: true, data: payload, cached: false });
  } catch (error) {
    console.error("Error generating SEO sitemap data:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch sitemap data" });
  }
};
