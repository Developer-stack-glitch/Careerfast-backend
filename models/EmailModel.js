const nodemailer = require("nodemailer");
const crypto = require("crypto");
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

module.exports = { sendVerificationEmail, verifyOTP, VerifyEmail, sendApplicationStatusEmail, sendCompetitionRegistrationEmail, sendMentorQueryEmail, sendTeamMemberInviteEmail };
