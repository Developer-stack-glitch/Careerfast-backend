const nodemailer = require("nodemailer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const pool = require("../config/dbConfig");

// Generate a 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const transporter = nodemailer.createTransport({
  service: process.env.SMTP_HOST,
  auth: {
    user: process.env.SMTP_FROM, // Replace with your email
    pass: process.env.SMTP_PASS, // Replace with your email password or app password for Gmail
  },
});

// Store OTPs temporarily (in production, use Redis or database)
const otpStorage = new Map();

const sendVerificationEmail = async (email, role_id) => {
  try {
    const [is_email_exists] = await pool.query(
      `SELECT id, role_id FROM users WHERE email = ?`,
      [email]
    );
    console.log("eee", is_email_exists);

    if (is_email_exists.length == 0) {
      throw new Error("The given email does not exist in the database");
    }

    if (role_id && is_email_exists[0].role_id !== 1 && is_email_exists[0].role_id != role_id) {
      throw new Error("This email does not belong to a recruiter account. Candidate accounts cannot reset password here.");
    }

    const otp = generateOTP();
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Email Verification OTP",
      text: `Your OTP for email verification is: ${otp}`,
      html: `<p>Your OTP for email verification is: <strong>${otp}</strong></p>`,
    };

    // Store OTP with expiration (5 minutes)
    otpStorage.set(email, {
      otp,
      expiresAt: Date.now() + 300000, // 5 minutes
    });

    await transporter.sendMail(mailOptions);
    return { success: true, message: "OTP sent successfully" };
  } catch (error) {
    throw new Error(error.message);
  }
};

const verifyOTP = async (email, userOTP) => {
  const storedData = otpStorage.get(email);

  if (!storedData) {
    return { success: false, message: "OTP expired or not found" };
  }

  if (Date.now() > storedData.expiresAt) {
    otpStorage.delete(email);
    return { success: false, message: "OTP expired" };
  }

  if (storedData.otp === userOTP) {
    otpStorage.delete(email);
    try {
      await pool.query("UPDATE users SET is_email_verified = 1 WHERE email = ?", [email]);
    } catch (error) {
      console.error("Failed to update email verification status", error);
    }
    return { success: true, message: "Email verified successfully" };
  }

  return { success: false, message: "Invalid OTP" };
};

const VerifyEmail = async (email) => {
  try {
    const otp = generateOTP();
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Email Verification OTP",
      text: `Your OTP for email verification is: ${otp}`,
      html: `<p>Your OTP for email verification is: <strong>${otp}</strong></p>`,
    };

    // Store OTP with expiration (5 minutes)
    otpStorage.set(email, {
      otp,
      expiresAt: Date.now() + 300000, // 5 minutes
    });

    await transporter.sendMail(mailOptions);
    return { success: true, message: "OTP sent successfully" };
  } catch (error) {
    throw new Error(error.message);
  }
};

// Send application status email to candidate
const sendApplicationStatusEmail = async (candidateEmail, candidateName, jobTitle, companyName, status) => {
  try {
    let subject = "";
    let htmlContent = "";

    if (status === "Shortlisted") {
      subject = `Congratulations! You've been shortlisted for ${jobTitle}`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7f5af0 0%, #5f2eea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #52c41a; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Congratulations!</h1>
            </div>
            <div class="content">
              <p>Dear ${candidateName},</p>
              <p>We are pleased to inform you that you have been <strong>shortlisted</strong> for the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
              <p>Your profile has impressed our recruitment team, and we would like to move forward with the next steps in the hiring process.</p>
              <p>Please check your CareerFast dashboard for further details and next steps.</p>
              <a href="https://careerfast.in/admin-profile/applied" class="button">View Application Status</a>
              <p style="margin-top: 30px;">Best regards,<br><strong>${companyName}</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email from CareerFast. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (status === "Rejected") {
      subject = `Update on your application for ${jobTitle}`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7f5af0 0%, #5f2eea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #1890ff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Application Update</h1>
            </div>
            <div class="content">
              <p>Dear ${candidateName},</p>
              <p>Thank you for your interest in the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>
              <p>After careful consideration, we regret to inform you that we have decided to move forward with other candidates whose qualifications more closely match our current needs.</p>
              <p>We appreciate the time and effort you invested in the application process. We encourage you to continue exploring other opportunities on CareerFast that align with your skills and experience.</p>
              <a href="https://careerfast.in/job-portal" class="button">Explore More Opportunities</a>
              <p style="margin-top: 30px;">We wish you all the best in your job search.<br><strong>${companyName}</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email from CareerFast. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (status === "Mail Sent") {
      subject = `Important update regarding your application for ${jobTitle}`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7f5af0 0%, #5f2eea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #0958d9; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 Application Update</h1>
            </div>
            <div class="content">
              <p>Dear ${candidateName},</p>
              <p>We wanted to reach out regarding your application for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>
              <p>We have reviewed your application and would like to provide you with an update. Please check your CareerFast dashboard for detailed information.</p>
              <a href="https://careerfast.in/admin-profile/applied" class="button">Check Your Dashboard</a>
              <p style="margin-top: 30px;">Thank you for your patience.<br><strong>${companyName}</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email from CareerFast. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const mailOptions = {
      from: `"CareerFast" <${process.env.SMTP_FROM}>`,
      to: candidateEmail,
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: "Email sent successfully" };
  } catch (error) {
    console.error("Error sending application status email:", error);
    throw new Error(error.message);
  }
};

// Send competition registration notification to admin
const sendCompetitionRegistrationEmail = async (registrationData) => {
  try {
    const { fullName, email, phoneNumber, skillLevel, competitionTitle, competitionOrganizer } = registrationData;

    const subject = `New Competition Registration - ${competitionTitle}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7f5af0 0%, #5f2eea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
          .info-label { font-weight: bold; width: 150px; color: #666; }
          .info-value { flex: 1; color: #333; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏆 New Competition Registration</h1>
          </div>
          <div class="content">
            <p>A new participant has registered for a competition on CareerFast.</p>
            
            <h3 style="color: #7f5af0; margin-top: 30px;">Registration Details:</h3>
            
            <div class="info-row">
              <div class="info-label">Competition:</div>
              <div class="info-value">${competitionTitle}</div>
            </div>
            
            <div class="info-row">
              <div class="info-label">Organizer:</div>
              <div class="info-value">${competitionOrganizer}</div>
            </div>
            
            <div class="info-row">
              <div class="info-label">Participant Name:</div>
              <div class="info-value">${fullName}</div>
            </div>
            
            <div class="info-row">
              <div class="info-label">Email:</div>
              <div class="info-value">${email}</div>
            </div>
            
            <div class="info-row">
              <div class="info-label">Phone Number:</div>
              <div class="info-value">${phoneNumber || 'Not provided'}</div>
            </div>
            
            <div class="info-row">
              <div class="info-label">Skill Level:</div>
              <div class="info-value">${skillLevel || 'Not specified'}</div>
            </div>
            
            <div class="info-row">
              <div class="info-label">Registration Date:</div>
              <div class="info-value">${new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</div>
            </div>
            
            <p style="margin-top: 30px; color: #666;">
              Please follow up with the participant if needed.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated notification from CareerFast Competition Portal.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"CareerFast Competitions" <${process.env.SMTP_FROM}>`,
      to: "careerfastcontact@gmail.com",
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: "Registration notification sent successfully" };
  } catch (error) {
    console.error("Error sending competition registration email:", error);
    throw new Error(error.message);
  }
};

// Send mentor query notification to admin
const sendMentorQueryEmail = async (queryData) => {
  try {
    const { userName, userEmail, phoneNumber, message, mentorName, mentorTitle, mentorCompany } = queryData;

    const subject = `New Mentor Query - ${mentorName}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7f5af0 0%, #5f2eea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
          .info-label { font-weight: bold; width: 150px; color: #666; }
          .info-value { flex: 1; color: #333; }
          .message-box { background: #fff; padding: 15px; border-left: 4px solid #7f5af0; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 New Mentor Query</h1>
          </div>
          <div class="content">
            <p>A user has sent a query regarding a mentor on CareerFast.</p>
            
            <h3 style="color: #7f5af0; margin-top: 30px;">Mentor Details:</h3>
            
            <div class="info-row">
              <div class="info-label">Mentor Name:</div>
              <div class="info-value">${mentorName}</div>
            </div>
            
            <div class="info-row">
              <div class="info-label">Mentor Title:</div>
              <div class="info-value">${mentorTitle}</div>
            </div>
            
            <div class="info-row">
              <div class="info-label">Company:</div>
              <div class="info-value">${mentorCompany}</div>
            </div>
            
            <h3 style="color: #7f5af0; margin-top: 30px;">User Details:</h3>
            
            <div class="info-row">
              <div class="info-label">User Name:</div>
              <div class="info-value">${userName}</div>
            </div>
            
            <div class="info-row">
              <div class="info-label">Email:</div>
              <div class="info-value">${userEmail}</div>
            </div>
            
            <div class="info-row">
              <div class="info-label">Phone Number:</div>
              <div class="info-value">${phoneNumber || 'Not provided'}</div>
            </div>
            
            <div class="info-row">
              <div class="info-label">Query Date:</div>
              <div class="info-value">${new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</div>
            </div>
            
            <h3 style="color: #7f5af0; margin-top: 30px;">Message:</h3>
            <div class="message-box">
              <p style="margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
            
            <p style="margin-top: 30px; color: #666;">
              Please follow up with the user if needed.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated notification from CareerFast Mentor Portal.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"CareerFast Mentors" <${process.env.SMTP_FROM}>`,
      to: "careerfastcontact@gmail.com",
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: "Query notification sent successfully" };
  } catch (error) {
    console.error("Error sending mentor query email:", error);
    throw new Error(error.message);
  }
};

const sendTeamMemberInviteEmail = async (email, password, recruiterName) => {
  try {
    const subject = `You've been invited to CareerFast as a Recruiter`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7f5af0 0%, #5f2eea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #52c41a; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .credentials { background: #fff; padding: 15px; border: 1px solid #eee; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🤝 Welcome to CareerFast!</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p><strong>${recruiterName}</strong> has invited you to join their team as a Recruiter on CareerFast.</p>
            <p>You can now log in to the Recruiter Dashboard using the following credentials:</p>
            
            <div class="credentials">
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password:</strong> ${password}</p>
            </div>
            
            <p>For your security, we recommend changing your password after your first login.</p>
            
            <a href="${process.env.FRONTEND_URL || 'https://careerfast.in'}/auth/login" class="button">Log in to Dashboard</a>
            
            <p style="margin-top: 30px;">Best regards,<br><strong>CareerFast Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated email from CareerFast. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"CareerFast Notifications" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: subject,
      html: htmlContent,
    };


    await transporter.sendMail(mailOptions);
    return { success: true, message: "Team member invite email sent successfully" };
  } catch (error) {
    console.error("Error sending team member invite email:", error);
    throw new Error(error.message);
  }
};

// Send candidate registration welcome email with neat professional UI & brand logo
const sendCandidateWelcomeEmail = async ({ email, first_name, last_name }) => {
  try {
    const candidateName = `${first_name || ""} ${last_name || ""}`.trim() || "Candidate";
    const frontendUrl = process.env.FRONTEND_URL || "https://careerfast.in";
    const currentYear = new Date().getFullYear();

    // Check for local logo file to attach as CID
    const primaryLogoPath = path.resolve(__dirname, "../assets/careerfastlogofinal.png");
    const fallbackLogoPath = path.resolve(__dirname, "../../careerfast-frontend/src/images/careerfastlogofinal.png");

    let logoAttachment = null;
    let logoSrc = "https://careerfast.in/_next/static/media/careerfastlogofinal.0nplzw.k4hsr8.png";

    if (fs.existsSync(primaryLogoPath)) {
      logoAttachment = {
        filename: "careerfast-logo.png",
        path: primaryLogoPath,
        cid: "careerfastlogo",
      };
      logoSrc = "cid:careerfastlogo";
    } else if (fs.existsSync(fallbackLogoPath)) {
      logoAttachment = {
        filename: "careerfast-logo.png",
        path: fallbackLogoPath,
        cid: "careerfastlogo",
      };
      logoSrc = "cid:careerfastlogo";
    }

    const subject = `Welcome to CareerFast, ${first_name || "Candidate"}! 🎉 Your Registration is Confirmed`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to CareerFast</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; -webkit-font-smoothing: antialiased;">
  <div style="width: 100%; background-color: #f1f5f9; padding: 36px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
            <!-- Top Gradient Accent -->
            <div style="height: 6px; background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);"></div>

            <!-- Header with Logo -->
            <div style="padding: 32px 24px 20px 24px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #f8fafc;">
              <img src="${logoSrc}" alt="CareerFast Logo" style="max-height: 46px; max-width: 200px; height: auto; width: auto; display: inline-block; object-fit: contain;" />
            </div>

            <!-- Body -->
            <div style="padding: 24px 32px 32px 32px;">
              <!-- Badge -->
              <div style="text-align: center; margin-bottom: 16px;">
                <span style="display: inline-block; background-color: #ecfdf5; color: #047857; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 5px 14px; border-radius: 9999px; border: 1px solid #a7f3d0;">
                  ✓ Registration Confirmed
                </span>
              </div>

              <!-- Greeting -->
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; line-height: 1.3;">
                  Welcome to CareerFast, ${first_name || "Candidate"}!
                </h1>
                <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0;">
                  Your candidate profile has been created successfully. You're now connected to a smarter, AI-driven way to discover jobs and accelerate your career.
                </p>
              </div>

              <!-- Account Overview Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 12px;">
                  Candidate Profile Details
                </div>
                <table width="100%" cellspacing="0" cellpadding="6" style="font-size: 14px; border-collapse: collapse;">
                  <tr style="border-bottom: 1px dashed #e2e8f0;">
                    <td style="color: #64748b; font-weight: 500; padding: 6px 0;">Full Name</td>
                    <td align="right" style="color: #0f172a; font-weight: 600; padding: 6px 0;">${candidateName}</td>
                  </tr>
                  <tr style="border-bottom: 1px dashed #e2e8f0;">
                    <td style="color: #64748b; font-weight: 500; padding: 6px 0;">Registered Email</td>
                    <td align="right" style="color: #0f172a; font-weight: 600; padding: 6px 0;">${email}</td>
                  </tr>
                  <tr style="border-bottom: 1px dashed #e2e8f0;">
                    <td style="color: #64748b; font-weight: 500; padding: 6px 0;">Account Role</td>
                    <td align="right" style="color: #6366f1; font-weight: 600; padding: 6px 0;">Candidate / Job Seeker</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; font-weight: 500; padding: 6px 0;">Account Status</td>
                    <td align="right" style="color: #059669; font-weight: 600; padding: 6px 0;">Active ✓</td>
                  </tr>
                </table>
              </div>

              <!-- 3 Steps Section -->
              <div style="margin-bottom: 28px;">
                <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                  3 Steps to Fast-Track Your Dream Job
                </div>
                
                <!-- Step 1 -->
                <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 12px; background: #ffffff; border: 1px solid #f1f5f9; padding: 12px; border-radius: 10px;">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width: 28px; height: 28px; border-radius: 50%; background: #ede9fe; color: #6366f1; font-weight: 700; font-size: 13px; text-align: center; line-height: 28px;">1</div>
                    </td>
                    <td style="padding-left: 10px;">
                      <div style="font-size: 14px; font-weight: 600; color: #1e293b;">Complete Your Profile</div>
                      <div style="font-size: 13px; color: #64748b; line-height: 1.4; margin-top: 2px;">Add your resume, skills, and experience to get up to 3x more recruiter views.</div>
                    </td>
                  </tr>
                </table>

                <!-- Step 2 -->
                <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 12px; background: #ffffff; border: 1px solid #f1f5f9; padding: 12px; border-radius: 10px;">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width: 28px; height: 28px; border-radius: 50%; background: #ede9fe; color: #6366f1; font-weight: 700; font-size: 13px; text-align: center; line-height: 28px;">2</div>
                    </td>
                    <td style="padding-left: 10px;">
                      <div style="font-size: 14px; font-weight: 600; color: #1e293b;">AI-Powered Job Matching</div>
                      <div style="font-size: 13px; color: #64748b; line-height: 1.4; margin-top: 2px;">Discover personalized jobs from 500+ top companies matched to your profile.</div>
                    </td>
                  </tr>
                </table>

                <!-- Step 3 -->
                <table width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border: 1px solid #f1f5f9; padding: 12px; border-radius: 10px;">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width: 28px; height: 28px; border-radius: 50%; background: #ede9fe; color: #6366f1; font-weight: 700; font-size: 13px; text-align: center; line-height: 28px;">3</div>
                    </td>
                    <td style="padding-left: 10px;">
                      <div style="font-size: 14px; font-weight: 600; color: #1e293b;">Apply in 1-Click</div>
                      <div style="font-size: 13px; color: #64748b; line-height: 1.4; margin-top: 2px;">Send direct applications to recruiters and track your application status live.</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0 18px 0;">
                <a href="${frontendUrl}/login" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 34px; border-radius: 10px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);">
                  Complete Your Profile Now &rarr;
                </a>
              </div>

              <!-- Support Note -->
              <div style="font-size: 13px; color: #64748b; line-height: 1.5; text-align: center; margin-top: 22px; padding-top: 18px; border-top: 1px solid #f1f5f9;">
                Need assistance? We're here to help! Reach us anytime at
                <a href="mailto:support@careerfast.in" style="color: #6366f1; font-weight: 600; text-decoration: none;">support@careerfast.in</a>.
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: #64748b;">CareerFast &bull; The Future of Hiring</p>
              <p style="margin: 0 0 6px 0;">Empowering top candidates & fast-growing employers worldwide.</p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${currentYear} CareerFast Inc. All rights reserved. &bull;
                <a href="${frontendUrl}" target="_blank" style="color: #6366f1; text-decoration: none;">careerfast.in</a>
              </p>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: `"CareerFast" <${process.env.SMTP_FROM || process.env.SMTP_USER || "hr@acte.in"}>`,
      to: email,
      subject: subject,
      html: htmlContent,
      attachments: logoAttachment ? [logoAttachment] : [],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Candidate welcome email sent successfully:", info?.messageId);
    return { success: true, messageId: info?.messageId };
  } catch (error) {
    console.error("Error sending candidate welcome email:", error);
    // Non-blocking: return status instead of throwing
    return { success: false, error: error.message };
  }
};

// Send direct message from recruiter to candidate
const sendCandidateDirectEmail = async ({
  candidateEmail,
  candidateName,
  recruiterName,
  recruiterEmail,
  companyName,
  subject,
  messageContent,
}) => {
  try {
    const formattedSubject = subject?.trim() || `Career Opportunity from ${companyName || recruiterName || 'CareerFast'}`;
    const frontendUrl = process.env.FRONTEND_URL || "https://careerfast.in";
    const currentYear = new Date().getFullYear();

    // Check for local logo file to attach as CID
    const primaryLogoPath = path.resolve(__dirname, "../assets/careerfastlogofinal.png");
    const fallbackLogoPath = path.resolve(__dirname, "../../careerfast-frontend/src/images/careerfastlogofinal.png");
    const hrLogoPath = path.resolve(__dirname, "../../careerfastHR/src/images/careerfastlogofinal.png");

    let logoAttachment = null;
    let logoSrc = "https://careerfast.in/_next/static/media/careerfastlogofinal.0nplzw.k4hsr8.png";

    if (fs.existsSync(primaryLogoPath)) {
      logoAttachment = {
        filename: "careerfast-logo.png",
        path: primaryLogoPath,
        cid: "careerfastlogo",
      };
      logoSrc = "cid:careerfastlogo";
    } else if (fs.existsSync(fallbackLogoPath)) {
      logoAttachment = {
        filename: "careerfast-logo.png",
        path: fallbackLogoPath,
        cid: "careerfastlogo",
      };
      logoSrc = "cid:careerfastlogo";
    } else if (fs.existsSync(hrLogoPath)) {
      logoAttachment = {
        filename: "careerfast-logo.png",
        path: hrLogoPath,
        cid: "careerfastlogo",
      };
      logoSrc = "cid:careerfastlogo";
    }

    // Compute initials for recruiter avatar
    const recruiterInitials = (recruiterName || companyName || "CF")
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "CF";

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${formattedSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <div style="width: 100%; background-color: #f1f5f9; padding: 36px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.06);">
            <!-- Top Gradient Accent Bar -->
            <div style="height: 5px; background: linear-gradient(90deg, #1d4ed8 0%, #3b82f6 50%, #6366f1 100%);"></div>

            <!-- Header with Official Logo -->
            <div style="padding: 24px 32px 20px 32px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
              <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="middle" align="left">
                    <a href="${frontendUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img src="${logoSrc}" alt="CareerFast Logo" style="max-height: 42px; height: 38px; width: auto; display: block; border: 0; object-fit: contain;" />
                    </a>
                  </td>
                  <td valign="middle" align="right">
                    <div style="display: inline-block; background-color: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 5px 12px; border-radius: 9999px;">
                      ⚡ Direct Outreach
                    </div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Main Content Container -->
            <div style="padding: 28px 32px 12px 32px;">
              <!-- Candidate Greeting -->
              <div style="margin-bottom: 20px;">
                <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; line-height: 1.3;">
                  Hello ${candidateName || "Candidate"},
                </h1>
                <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0;">
                  A verified recruiter has reviewed your profile and sent you a direct message regarding an exciting career opportunity.
                </p>
              </div>

              <!-- Message Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 12px; padding: 20px 22px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #2563eb; margin-bottom: 10px;">
                  💬 Message From Recruiter
                </div>
                <div style="font-size: 15px; line-height: 1.7; color: #1e293b; white-space: pre-wrap; word-break: break-word; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${messageContent}</div>
              </div>

              <!-- Recruiter Details Profile Card -->
              <div style="background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 26px;">
                <table width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="52" valign="middle" align="left">
                      <div style="width: 46px; height: 46px; border-radius: 50%; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; font-size: 16px; font-weight: 700; text-align: center; line-height: 46px; display: inline-block;">
                        ${recruiterInitials}
                      </div>
                    </td>
                    <td valign="middle" style="padding-left: 14px;">
                      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; margin-bottom: 2px;">
                        Sender Profile
                      </div>
                      <div style="font-size: 15.5px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                        ${recruiterName || 'Hiring Manager'}
                        <span style="display: inline-block; background-color: #dbeafe; color: #1d4ed8; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 9999px; vertical-align: middle; margin-left: 4px;">
                          ✓ Verified
                        </span>
                      </div>
                      ${companyName ? `
                      <div style="font-size: 13.5px; color: #475569; margin-top: 3px; font-weight: 500;">
                        🏢 ${companyName}
                      </div>` : ''}
                      ${recruiterEmail ? `
                      <div style="font-size: 13px; color: #2563eb; margin-top: 3px;">
                        <a href="mailto:${recruiterEmail}" style="color: #2563eb; text-decoration: none; font-weight: 500;">
                          ✉ ${recruiterEmail}
                        </a>
                      </div>` : ''}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Call To Action Button -->
              ${recruiterEmail ? `
              <div style="text-align: center; margin: 10px 0 24px 0;">
                <a href="mailto:${recruiterEmail}?subject=Re: ${encodeURIComponent(formattedSubject)}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35); letter-spacing: 0.2px;">
                  Reply to Recruiter &rarr;
                </a>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 10px;">
                  Or reply directly to this email to contact the hiring team.
                </div>
              </div>
              ` : ''}

              <!-- Trust & Security Banner -->
              <div style="background-color: #f8fafc; border-radius: 10px; padding: 12px 16px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="22" valign="top" style="font-size: 14px;">🛡️</td>
                    <td style="font-size: 12px; color: #64748b; line-height: 1.5; padding-left: 8px;">
                      <strong style="color: #334155;">CareerFast Trust & Safety:</strong> This direct message was sent via the verified recruiter platform. Always verify job offers and never share bank details or passwords.
                    </td>
                  </tr>
                </table>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 28px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: #64748b;">CareerFast &bull; The Modern Recruitment Platform</p>
              <p style="margin: 0 0 6px 0; font-size: 11.5px; color: #94a3b8;">
                This email was sent to ${candidateEmail} on behalf of a verified employer on CareerFast.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${currentYear} CareerFast Inc. All rights reserved. &bull;
                <a href="${frontendUrl}" target="_blank" style="color: #2563eb; text-decoration: none;">careerfast.in</a>
              </p>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: `"${companyName || recruiterName || 'CareerFast'}" <${process.env.SMTP_FROM || 'hr@acte.in'}>`,
      replyTo: recruiterEmail || undefined,
      to: candidateEmail,
      subject: formattedSubject,
      html: htmlContent,
      attachments: logoAttachment ? [logoAttachment] : [],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Candidate direct email sent successfully:", info?.messageId);
    return { success: true, messageId: info?.messageId };
  } catch (error) {
    console.error("Error sending candidate direct email:", error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  verifyOTP,
  VerifyEmail,
  sendApplicationStatusEmail,
  sendCompetitionRegistrationEmail,
  sendMentorQueryEmail,
  sendTeamMemberInviteEmail,
  sendCandidateWelcomeEmail,
  sendCandidateDirectEmail,
};

