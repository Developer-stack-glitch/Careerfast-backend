const fs = require("fs");
const path = require("path");

const emailModelPath = path.join(__dirname, "../models/EmailModel.js");
let file = fs.readFileSync(emailModelPath, "utf8");

if (file.includes("sendJobNviteEmail")) {
  console.log("sendJobNviteEmail already exists in EmailModel.js");
  process.exit(0);
}

const nviteCode = `
/**
 * ⚡ Send Naukri-style Job Nvite (Invitation to Apply) to Candidate
 */
const sendJobNviteEmail = async ({
  candidateEmail,
  candidateName = "Candidate",
  recruiterName = "Hiring Lead",
  recruiterEmail = "",
  recruiterPhone = "",
  companyName = "Hiring Partner",
  companyLogo = "",
  jobTitle = "Open Position",
  jobNature = "Full Time",
  location = "Not Specified",
  workplaceType = "Onsite",
  minSalary = "",
  maxSalary = "",
  currency = "₹",
  salaryType = "Per Annum",
  experienceRequired = "",
  skills = [],
  customMessage = "",
  validityDays = 14,
  nviteId = null,
  jobId = null
}) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || "https://careerfast.in";
    const currentYear = new Date().getFullYear();
    const invitesUrl = \`\${frontendUrl}/candidate-profile/invites?nviteId=\${nviteId || ""}\`;
    const jobUrl = jobId ? \`\${frontendUrl}/job-details/\${jobId}\` : \`\${frontendUrl}/jobs\`;

    // Format salary display
    let salaryText = "";
    if (minSalary && maxSalary) {
      salaryText = \`\${currency}\${minSalary} - \${currency}\${maxSalary} \${salaryType || ""}\`.trim();
    } else if (minSalary) {
      salaryText = \`\${currency}\${minSalary}+ \${salaryType || ""}\`.trim();
    }

    // Parse skills into array
    let skillsList = [];
    if (Array.isArray(skills)) {
      skillsList = skills;
    } else if (typeof skills === "string") {
      try {
        const parsed = JSON.parse(skills);
        skillsList = Array.isArray(parsed) ? parsed : skills.split(",");
      } catch (e) {
        skillsList = skills.split(",");
      }
    }
    skillsList = skillsList.map((s) => String(s).trim()).filter(Boolean).slice(0, 5);

    // Compute initials for recruiter avatar
    const recruiterInitials = (recruiterName || companyName || "HR")
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "HR";

    // Assets setup
    const logoPath = path.join(__dirname, "../assets/careerfast-logo.png");
    let logoAttachment = null;
    let logoSrc = "https://careerfast.in/favicon.png";

    if (fs.existsSync(logoPath)) {
      logoAttachment = {
        filename: "careerfast-logo.png",
        path: logoPath,
        cid: "careerfastlogo",
      };
      logoSrc = "cid:careerfastlogo";
    }

    const emailSubject = \`⚡ Job Nvite: \${jobTitle} at \${companyName || "Top Employer"}\`;

    const htmlContent = \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>\${emailSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <div style="width: 100%; background-color: #f1f5f9; padding: 32px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 16px 36px -8px rgba(15, 23, 42, 0.08);">
            
            <div style="height: 6px; background: linear-gradient(90deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%);"></div>

            <div style="padding: 24px 32px 20px 32px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
              <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="middle" align="left">
                    <a href="\${frontendUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img src="\${logoSrc}" alt="CareerFast Logo" style="max-height: 40px; height: 36px; width: auto; display: block; border: 0; object-fit: contain;" />
                    </a>
                  </td>
                  <td valign="middle" align="right">
                    <div style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; padding: 6px 14px; border-radius: 9999px; box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25);">
                      ⚡ JOB NVITE
                    </div>
                  </td>
                </tr>
              </table>
            </div>

            <div style="background: linear-gradient(180deg, #faf5ff 0%, #ffffff 100%); padding: 28px 32px 20px 32px; border-bottom: 1px solid #f3e8ff;">
              <div style="font-size: 13px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">
                Direct Recruiter Invitation
              </div>
              <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; line-height: 1.35;">
                Hello \${candidateName}, you've received a Job Nvite!
              </h1>
              <p style="font-size: 14.5px; line-height: 1.6; color: #475569; margin: 0;">
                <strong>\${recruiterName}</strong> from <strong>\${companyName}</strong> reviewed your CareerFast profile and found your background to be a strong match for an open role.
              </p>
            </div>

            <div style="padding: 24px 32px;">
              <div style="background: #ffffff; border: 2px solid #e0e7ff; border-radius: 16px; padding: 22px; box-shadow: 0 8px 20px -4px rgba(79, 70, 229, 0.08); margin-bottom: 22px;">
                
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-size: 12px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.5px;">
                    🎯 Opportunity Overview
                  </span>
                  <span style="font-size: 12px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 3px 8px; border-radius: 6px;">
                    \${jobNature}
                  </span>
                </div>

                <h2 style="font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0 0 4px 0;">
                  \${jobTitle}
                </h2>
                <div style="font-size: 15px; font-weight: 600; color: #475569; margin-bottom: 14px;">
                  🏢 \${companyName}
                </div>

                <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 14px; font-size: 13.5px; color: #334155;">
                  <tr>
                    <td style="padding: 6px 0; width: 50%;">
                      <strong>📍 Location:</strong> \${location} \${workplaceType ? "(" + workplaceType + ")" : ""}
                    </td>
                    <td style="padding: 6px 0; width: 50%;">
                      <strong>💼 Experience:</strong> \${experienceRequired || "Any Experience"}
                    </td>
                  </tr>
                  \${salaryText ? \`
                  <tr>
                    <td colspan="2" style="padding: 6px 0;">
                      <strong>💰 Compensation:</strong> <span style="color: #059669; font-weight: 700;">\${salaryText}</span>
                    </td>
                  </tr>\` : ""}
                </table>

                \${skillsList.length > 0 ? \`
                <div style="padding-top: 10px; border-top: 1px dashed #e2e8f0;">
                  <div style="font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase;">
                    Key Required Skills:
                  </div>
                  <div>
                    \${skillsList.map((skill) => \`
                      <span style="display: inline-block; background-color: #ede9fe; color: #6d28d9; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; margin: 2px 4px 2px 0;">
                        \${skill}
                      </span>
                    \`).join("")}
                  </div>
                </div>\` : ""}

              </div>

              \${customMessage ? \`
              <div style="background-color: #f8fafc; border-left: 4px solid #7c3aed; border-radius: 0 12px 12px 0; padding: 16px 20px; margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                  Personal Message from \${recruiterName}:
                </div>
                <div style="font-size: 14.5px; line-height: 1.65; color: #1e293b; white-space: pre-wrap; font-style: italic;">
                  "\${customMessage}"
                </div>
              </div>\` : ""}

              <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px;">
                <table width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="24" valign="top" style="font-size: 16px;">⏳</td>
                    <td style="font-size: 13px; color: #92400e; line-height: 1.5; padding-left: 8px;">
                      <strong>Invitation Validity:</strong> This Nvite is valid for <strong>\${validityDays} days</strong>. Please accept or decline to notify the recruiter of your interest.
                    </td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin: 16px 0 28px 0;">
                <table width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center">
                      <a href="\${invitesUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff !important; text-decoration: none; font-size: 15.5px; font-weight: 700; padding: 15px 38px; border-radius: 12px; box-shadow: 0 6px 18px rgba(124, 58, 237, 0.35); letter-spacing: 0.3px;">
                        ⚡ Review & Accept Nvite &rarr;
                      </a>
                    </td>
                  </tr>
                  \${jobId ? \`
                  <tr>
                    <td align="center" style="padding-top: 12px;">
                      <a href="\${jobUrl}" target="_blank" style="font-size: 13px; color: #6366f1; text-decoration: underline; font-weight: 600;">
                        Or view complete job posting & requirements
                      </a>
                    </td>
                  </tr>\` : ""}
                </table>
              </div>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 20px; margin-bottom: 20px;">
                <table width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="48" valign="middle" align="left">
                      <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-align: center; line-height: 44px; display: inline-block;">
                        \${recruiterInitials}
                      </div>
                    </td>
                    <td valign="middle" style="padding-left: 14px;">
                      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">
                        Sent By Recruiter
                      </div>
                      <div style="font-size: 15px; font-weight: 700; color: #0f172a;">
                        \${recruiterName}
                        <span style="display: inline-block; background-color: #dcfce7; color: #15803d; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 9999px; margin-left: 4px;">
                          ✓ Verified
                        </span>
                      </div>
                      <div style="font-size: 13px; color: #64748b;">
                        \${companyName}
                        \${recruiterEmail ? \` &bull; <a href="mailto:\${recruiterEmail}" style="color: #4f46e5; text-decoration: none;">\${recruiterEmail}</a>\` : ""}
                        \${recruiterPhone ? \` &bull; <span>\${recruiterPhone}</span>\` : ""}
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #f8fafc; border-radius: 10px; padding: 12px 16px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="20" valign="top" style="font-size: 13px;">🛡️</td>
                    <td style="font-size: 12px; color: #64748b; line-height: 1.5; padding-left: 8px;">
                      <strong style="color: #334155;">CareerFast Nvites Guarantee:</strong> This job invitation was generated directly through the verified CareerFast Recruiter Portal. No recruiter will ever ask for payment or sensitive banking credentials.
                    </td>
                  </tr>
                </table>
              </div>

            </div>

            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 28px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: #64748b;">CareerFast &bull; The Modern Recruitment Platform</p>
              <p style="margin: 0 0 6px 0; font-size: 11.5px; color: #94a3b8;">
                This Nvite was delivered to \${candidateEmail}. To manage your job invitation preferences, visit your CareerFast Candidate Dashboard.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; \${currentYear} CareerFast Inc. All rights reserved. &bull;
                <a href="\${frontendUrl}" target="_blank" style="color: #7c3aed; text-decoration: none;">careerfast.in</a>
              </p>
            </div>

          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
    \`;

    const mailOptions = {
      from: \`"\${companyName || recruiterName || "CareerFast"} (via CareerFast Nvites)" <\${process.env.SMTP_FROM || process.env.SMTP_USER || "careerfastcontact@gmail.com"}>\`,
      replyTo: recruiterEmail || undefined,
      to: candidateEmail,
      subject: emailSubject,
      html: htmlContent,
      attachments: logoAttachment ? [logoAttachment] : [],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(\`[EmailModel] Job Nvite email sent to \${candidateEmail}:\`, info?.messageId);
    return { success: true, messageId: info?.messageId };
  } catch (error) {
    console.error(\`[EmailModel] Error sending Job Nvite email to \${candidateEmail}:\`, error);
    return { success: false, error: error.message };
  }
};
`;

file = file.replace(
  "module.exports = {",
  nviteCode + "\nmodule.exports = {\n  sendJobNviteEmail,"
);

fs.writeFileSync(emailModelPath, file, "utf8");
console.log("✅ Successfully added sendJobNviteEmail to EmailModel.js");

