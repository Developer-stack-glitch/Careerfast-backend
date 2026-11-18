const pool = require("../config/dbConfig");
const bcrypt = require("bcrypt");
const xlsx = require("xlsx");
const UserModel = require("../models/UserModel");
const { parseCandidateFile } = require("../utils/candidateFileParser");

const DEFAULT_CANDIDATE_PASSWORD = "CareerFast@2026";

const BulkCandidateUploadController = {
  /**
   * Preview candidates from uploaded Excel (.xlsx, .xls), CSV, or PDF export
   * Returns detected source, column mappings, validation stats, duplicate counts, and sample records
   */
  previewCandidates: async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        console.warn("previewCandidates: No file uploaded");
        return res.status(400).json({
          success: false,
          message: "Please upload an Excel (.xlsx, .xls), CSV (.csv), or PDF file."
        });
      }

      console.log("previewCandidates received file:", {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        source: req.body.source
      });

      const requestedSource = req.body.source || "auto";
      const parsedData = await parseCandidateFile(
        req.file.buffer,
        req.file.originalname,
        requestedSource
      );

      console.log("previewCandidates parsedData:", {
        source: parsedData.source,
        headers: parsedData.headers,
        totalCandidates: parsedData.candidates ? parsedData.candidates.length : 0
      });

      if (!parsedData.candidates || parsedData.candidates.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No candidate records could be parsed from the uploaded file."
        });
      }

      // Fetch existing candidate emails and phones to check duplicates
      const [existingUsers] = await pool.query(
        "SELECT email, phone FROM users WHERE role_id = 2"
      );

      const existingEmails = new Set(
        existingUsers
          .map((u) => (u.email ? u.email.toLowerCase().trim() : ""))
          .filter(Boolean)
      );
      const existingPhones = new Set(
        existingUsers
          .map((u) => (u.phone ? String(u.phone).slice(-10) : ""))
          .filter(Boolean)
      );

      let duplicateCount = 0;
      let newCount = 0;
      let validCount = 0;

      const candidatesWithStatus = parsedData.candidates.map((c) => {
        const emailLower = (c.email || "").toLowerCase().trim();
        const phoneTen = (c.phone || "").slice(-10);

        const emailExists = emailLower && existingEmails.has(emailLower);
        const phoneExists = phoneTen && existingPhones.has(phoneTen);
        const isDuplicate = Boolean(emailExists || phoneExists);

        if (isDuplicate) duplicateCount++;
        else newCount++;

        const isValid = Boolean(
          (c.first_name || c.last_name) && (c.email || c.phone)
        );
        if (isValid) validCount++;

        return {
          ...c,
          isDuplicate,
          duplicateReason: emailExists
            ? "Email already exists"
            : phoneExists
            ? "Phone already exists"
            : null
        };
      });

      return res.status(200).json({
        success: true,
        preview: {
          filename: req.file.originalname,
          source: parsedData.source,
          totalRows: parsedData.candidates.length,
          validRows: validCount,
          newCount,
          duplicateCount,
          sampleCandidates: candidatesWithStatus.slice(0, 15),
          allCandidates: candidatesWithStatus
        }
      });
    } catch (err) {
      console.error("BulkCandidateUploadController.previewCandidates error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to parse candidate file."
      });
    }
  },

  /**
   * Execute bulk candidate upload
   * Inserts candidates into users, user_education, user_professional, user_address
   * Handles deduplication & optional updating of existing candidate profiles
   */
  uploadCandidates: async (req, res) => {
    let connection;
    try {
      let candidates = [];
      const updateExisting =
        req.body.updateExisting === true ||
        req.body.updateExisting === "true" ||
        req.body.updateExisting === 1 ||
        req.body.updateExisting === "1";

      const requestedSource = req.body.source || "auto";

      // 1. Support either raw file upload OR pre-parsed candidates JSON
      if (req.file && req.file.buffer) {
        const parsed = await parseCandidateFile(
          req.file.buffer,
          req.file.originalname,
          requestedSource
        );
        candidates = parsed.candidates || [];
      } else if (req.body.candidates) {
        candidates =
          typeof req.body.candidates === "string"
            ? JSON.parse(req.body.candidates)
            : req.body.candidates;
      }

      if (!candidates || candidates.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No candidates provided for upload."
        });
      }

      // Hash default password once for new candidates
      const defaultPasswordHash = await bcrypt.hash(DEFAULT_CANDIDATE_PASSWORD, 10);

      // Fetch existing candidates to build fast index
      const [existingUsers] = await pool.query(
        "SELECT id, email, phone FROM users WHERE role_id = 2"
      );

      const emailToIdMap = new Map();
      const phoneToIdMap = new Map();

      existingUsers.forEach((u) => {
        if (u.email) {
          emailToIdMap.set(u.email.toLowerCase().trim(), u.id);
        }
        if (u.phone) {
          phoneToIdMap.set(String(u.phone).slice(-10), u.id);
        }
      });

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const errors = [];
      const insertedUserIds = [];

      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const emailLower = (c.email || "").toLowerCase().trim();
        const phoneTen = (c.phone || "").slice(-10);

        // Basic validation: must have a name or contact
        if (!c.first_name && !c.last_name && !emailLower && !phoneTen) {
          skippedCount++;
          continue;
        }

        const existingId =
          (emailLower && emailToIdMap.get(emailLower)) ||
          (phoneTen && phoneToIdMap.get(phoneTen)) ||
          null;

        if (existingId) {
          if (!updateExisting) {
            skippedCount++;
            continue;
          }

          // UPDATE EXISTING CANDIDATE
          try {
            const updates = [];
            const params = [];

            if (c.first_name) {
              updates.push("first_name = COALESCE(NULLIF(first_name, ''), ?)");
              params.push(c.first_name);
            }
            if (c.last_name) {
              updates.push("last_name = COALESCE(NULLIF(last_name, ''), ?)");
              params.push(c.last_name);
            }
            if (c.location) {
              updates.push("location = COALESCE(NULLIF(location, ''), ?)");
              params.push(c.location);
            }
            if (c.headline) {
              updates.push("headline = COALESCE(NULLIF(headline, ''), ?)");
              params.push(c.headline);
            }
            if (c.experince_type) {
              updates.push("experince_type = ?");
              params.push(c.experince_type);
            }
            if (c.total_years && c.total_years !== "0") {
              updates.push("total_years = ?");
              params.push(c.total_years);
            }
            if (c.total_months && c.total_months !== "0") {
              updates.push("total_months = ?");
              params.push(c.total_months);
            }
            if (c.current_salary && c.current_salary !== "0") {
              updates.push("current_salary = ?");
              params.push(c.current_salary);
            }
            if (c.dob) {
              updates.push("dob = COALESCE(dob, ?)");
              params.push(c.dob);
            }
            if (c.skills && Array.isArray(c.skills) && c.skills.length > 0) {
              updates.push("skills = ?");
              params.push(JSON.stringify(c.skills));
            }
            if (c.notice_period) {
              updates.push("notice_period = COALESCE(NULLIF(notice_period, ''), ?)");
              params.push(c.notice_period);
            }

            if (updates.length > 0) {
              params.push(existingId);
              await pool.query(
                `UPDATE users SET ${updates.join(", ")}, updated_date = CURRENT_TIMESTAMP WHERE id = ?`,
                params
              );
            }

            // Sub-tables check and upsert
            if (c.education && (c.education.course || c.education.college)) {
              const [existingEdu] = await pool.query(
                "SELECT id FROM user_education WHERE user_id = ? AND is_deleted = 0 LIMIT 1",
                [existingId]
              );
              if (existingEdu.length === 0) {
                await pool.query(
                  `INSERT INTO user_education (user_id, qualification, course, specialization, college, is_deleted)
                   VALUES (?, ?, ?, ?, ?, 0)`,
                  [
                    existingId,
                    c.education.qualification || "Graduation",
                    c.education.course || "",
                    c.education.specialization || "",
                    c.education.college || ""
                  ]
                );
              }
            }

            if (c.company_name || c.designation) {
              const [existingProf] = await pool.query(
                "SELECT id FROM user_professional WHERE user_id = ? AND is_deleted = 0 LIMIT 1",
                [existingId]
              );
              if (existingProf.length === 0) {
                await pool.query(
                  `INSERT INTO user_professional (user_id, job_title, company_name, designation, currently_working, is_deleted)
                   VALUES (?, ?, ?, ?, 1, 0)`,
                  [
                    existingId,
                    c.designation || c.headline || "Professional",
                    c.company_name || "",
                    c.designation || ""
                  ]
                );
              }
            }

            if (c.location) {
              const [existingAddr] = await pool.query(
                "SELECT id FROM user_address WHERE user_id = ? AND is_deleted = 0 LIMIT 1",
                [existingId]
              );
              if (existingAddr.length === 0) {
                await pool.query(
                  `INSERT INTO user_address (user_id, city, is_deleted, created_date)
                   VALUES (?, ?, 0, NOW())`,
                  [existingId, c.location]
                );
              }
            }

            await UserModel.recalculateProfileCompletion(existingId);
            updatedCount++;
          } catch (updateErr) {
            console.error(`Error updating candidate #${i + 1}:`, updateErr.message);
            errorCount++;
            errors.push({
              index: i + 1,
              name: c.full_name || c.first_name,
              error: updateErr.message
            });
          }
        } else {
          // INSERT NEW CANDIDATE
          try {
            const firstName = c.first_name || (c.last_name ? c.last_name : "Candidate");
            const lastName = c.last_name || "";
            const phoneCode = c.phone_code || "+91";
            const phone = c.phone || "";
            const email = emailLower || `candidate_${Date.now()}_${i}@careerfast.local`;
            const skillsJson =
              c.skills && Array.isArray(c.skills) && c.skills.length > 0
                ? JSON.stringify(c.skills)
                : null;

            const userType =
              c.experince_type === "Experience" ? "Experienced" : "Fresher";

            const [insertRes] = await pool.query(
              `INSERT INTO users (
                role_id, first_name, last_name, phone_code, phone, email,
                password, headline, about, skills, organization,
                experince_type, total_years, total_months, location,
                preferred_locations, current_salary, dob, notice_period,
                user_type, is_active, is_email_verified, created_date,
                updated_date, last_active, last_login
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW(), NOW(), NOW())`,
              [
                2, // role_id: CANDIDATE
                firstName,
                lastName,
                phoneCode,
                phone,
                email,
                defaultPasswordHash,
                c.headline || "",
                c.headline || "",
                skillsJson,
                c.company_name || "",
                c.experince_type || "Fresher",
                c.total_years || "0",
                c.total_months || "0",
                c.location || "",
                c.preferred_locations || "",
                c.current_salary || "0",
                c.dob || null,
                c.notice_period || "",
                userType
              ]
            );

            const newUserId = insertRes.insertId;
            insertedUserIds.push(newUserId);

            // Record into maps to prevent duplicate within the same batch
            if (emailLower) emailToIdMap.set(emailLower, newUserId);
            if (phoneTen) phoneToIdMap.set(phoneTen, newUserId);

            // Insert Education
            if (c.education && (c.education.course || c.education.college || c.education.qualification)) {
              await pool.query(
                `INSERT INTO user_education (user_id, qualification, course, specialization, college, is_deleted)
                 VALUES (?, ?, ?, ?, ?, 0)`,
                [
                  newUserId,
                  c.education.qualification || "Graduation",
                  c.education.course || "",
                  c.education.specialization || "",
                  c.education.college || ""
                ]
              );
            }

            // Insert Professional
            if (c.company_name || c.designation) {
              await pool.query(
                `INSERT INTO user_professional (user_id, job_title, company_name, designation, currently_working, is_deleted)
                 VALUES (?, ?, ?, ?, 1, 0)`,
                [
                  newUserId,
                  c.designation || c.headline || "Professional",
                  c.company_name || "",
                  c.designation || ""
                ]
              );
            }

            // Insert Address
            if (c.location) {
              await pool.query(
                `INSERT INTO user_address (user_id, city, is_deleted, created_date)
                 VALUES (?, ?, 0, NOW())`,
                [newUserId, c.location]
              );
            }

            // Recalculate candidate profile completion
            await UserModel.recalculateProfileCompletion(newUserId);
            insertedCount++;
          } catch (insertErr) {
            console.error(`Error inserting candidate #${i + 1}:`, insertErr.message);
            errorCount++;
            errors.push({
              index: i + 1,
              name: c.full_name || c.first_name,
              error: insertErr.message
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: `Bulk candidate upload finished: ${insertedCount} created, ${updatedCount} updated, ${skippedCount} skipped.`,
        stats: {
          total: candidates.length,
          inserted: insertedCount,
          updated: updatedCount,
          skipped: skippedCount,
          errors: errorCount,
          errorList: errors.slice(0, 10)
        }
      });
    } catch (err) {
      console.error("BulkCandidateUploadController.uploadCandidates error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to execute bulk candidate upload."
      });
    }
  },

  /**
   * Download sample Excel template for Naukri, Foundit, or Standard format
   */
  downloadSampleTemplate: async (req, res) => {
    try {
      const type = (req.query.type || "standard").toLowerCase();
      let sampleData = [];
      let filename = "careerfast_candidate_template_standard.xlsx";

      if (type === "naukri") {
        filename = "naukri_candidates_template.xlsx";
        sampleData = [
          {
            "Candidate Name": "Boopathi D",
            "Resume Title": "SAP MM Fresher with knowledge of Procurement, Inventory Management, PR, PO",
            "Contact No.": "9344979208",
            "Email": "boopathy1817@gmail.com",
            "Work Exp": "0Y 0 M",
            "Annual Salary": "INR 0.0 L",
            "Current Location": "Chennai",
            "Preferred Location": "Chennai, Bangalore",
            "Current Employer": "",
            "Designation": "",
            "U.G. Course": "B.E Mechanical Engineering",
            "P. G. Course": "",
            "Age/Date of Birth": "21 y (06 Nov 2004)",
            "Key Skills": "SAP MM, Procurement, Inventory, Material Master, PO"
          },
          {
            "Candidate Name": "Rishi M",
            "Resume Title": "B.Tech Computer Science Fresher skilled in Java, OOP, and Web Development",
            "Contact No.": "9042236192",
            "Email": "rishim6347@gmail.com",
            "Work Exp": "0Y 0 M",
            "Annual Salary": "INR 0.0 L",
            "Current Location": "Chennai",
            "Preferred Location": "Chennai",
            "Current Employer": "",
            "Designation": "",
            "U.G. Course": "B.Tech Computer Science",
            "P. G. Course": "",
            "Age/Date of Birth": "22 y (14 May 2003)",
            "Key Skills": "Java, OOP, SQL, HTML, CSS, JavaScript"
          }
        ];
      } else if (type === "foundit") {
        filename = "foundit_candidates_template.xlsx";
        sampleData = [
          {
            "Name": "Sandhya Bandi",
            "Mobile": "+919392764704",
            "Email": "bandisandhya712@gmail.com",
            "Resume Title": "Software Engineer Fresher | Java, Spring, React",
            "Key Skills": "Java, Spring, React, SQL, HTML, CSS",
            "Exp. (Yrs)": "0.0",
            "Current Location": "Hyderabad",
            "Current Annual Salary (Rs. in Lacs)": "0.0",
            "Designation": "",
            "Current Employer": "",
            "Education": "Bachelor Of Technology (B.Tech) Computer Science",
            "Date of Birth": "14-Nov-2003",
            "Notice Period": "Immediate"
          },
          {
            "Name": "Karthik Raja",
            "Mobile": "+919988776655",
            "Email": "karthik.raja@example.com",
            "Resume Title": "Data Analyst with 2 years hands-on experience in SQL & Power BI",
            "Key Skills": "Python, SQL, Pandas, Power BI, Excel",
            "Exp. (Yrs)": "2.0",
            "Current Location": "Chennai",
            "Current Annual Salary (Rs. in Lacs)": "5.5",
            "Designation": "Data Analyst",
            "Current Employer": "TCS",
            "Education": "Bachelor of Computer Applications (BCA)",
            "Date of Birth": "12-Jan-2002",
            "Notice Period": "30 Days"
          }
        ];
      } else {
        filename = "careerfast_standard_template.xlsx";
        sampleData = [
          {
            "First Name": "Aarav",
            "Last Name": "Sharma",
            "Email": "aarav.sharma@example.com",
            "Phone": "9876543210",
            "Location": "Chennai",
            "Experience": "Fresher",
            "Headline": "Full Stack Java Developer Fresher with Spring Boot and React",
            "Skills": "Java, Spring Boot, React, MySQL, Git",
            "Qualification": "Graduation",
            "Course": "B.Tech",
            "Specialization": "Computer Science",
            "College": "Anna University",
            "Salary": "0",
            "Date of Birth": "2004-08-15"
          },
          {
            "First Name": "Priya",
            "Last Name": "Patel",
            "Email": "priya.patel@example.com",
            "Phone": "9123456789",
            "Location": "Bangalore",
            "Experience": "3 Years",
            "Headline": "Frontend Developer with 3 years experience in React & TypeScript",
            "Skills": "React, TypeScript, Redux, TailwindCSS",
            "Company": "Infosys",
            "Designation": "Software Engineer",
            "Qualification": "Graduation",
            "Course": "B.E",
            "Specialization": "Information Technology",
            "College": "IIT Madras",
            "Salary": "8.5 Lakhs",
            "Date of Birth": "2001-03-22"
          }
        ];
      }

      const ws = xlsx.utils.json_to_sheet(sampleData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Candidates");
      const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.status(200).send(excelBuffer);
    } catch (err) {
      console.error("BulkCandidateUploadController.downloadSampleTemplate error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to generate sample template."
      });
    }
  }
};

module.exports = BulkCandidateUploadController;
