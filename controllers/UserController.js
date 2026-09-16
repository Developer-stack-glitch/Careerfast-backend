const userModel = require("../models/UserModel");
const admin = require("../config/firebase");
const { sendApplicationStatusEmail } = require("../models/EmailModel");
const pool = require("../config/dbConfig");

const getUsers = async (request, response) => {
  try {
    const { page, limit, search, status, role } = request.query;
    const usersData = await userModel.getUsers(page, limit, search, status, role);
    
    response.status(200).json({
      message: "Users data fetched successfully",
      data: usersData, // Could be the array, or the paginated object { users, total, totalPages, currentPage }
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching users",
      details: error.message,
    });
  }
};

const createUser = async (request, response) => {
  const {
    first_name,
    last_name,
    phone_code,
    phone,
    email,
    password,
    organization,
    organization_type_id,
    role_id,
  } = request.body;

  if (
    !first_name ||
    !last_name ||
    !phone_code ||
    !phone ||
    !email ||
    !password ||
    !role_id
  ) {
    return response.status(400).json({
      message: "Missing required fields",
      required: [
        "first_name",
        "last_name",
        "phone_code",
        "phone",
        "email",
        "password",
        "role_id",
      ],
    });
  }

  // Recruiter role strictly requires an official corporate work email
  if (role_id == 3) {
    const domain = (email || "").split("@")[1]?.toLowerCase();
    const blockedPersonalDomains = [
      "gmail.com",
      "googlemail.com",
      "yahoo.com",
      "yahoo.co.in",
      "yahoo.co.uk",
      "outlook.com",
      "hotmail.com",
      "live.com",
      "msn.com",
      "icloud.com",
      "me.com",
      "mac.com",
      "aol.com",
      "zoho.com",
      "protonmail.com",
      "proton.me",
      "mail.com",
      "gmx.com",
      "yandex.com",
      "rediffmail.com",
    ];
    if (blockedPersonalDomains.includes(domain)) {
      return response.status(400).json({
        message:
          "Personal email addresses (@gmail, @yahoo, @outlook, etc.) are not allowed for recruiters. Please enter your official company work email.",
      });
    }
  }
  try {
    const result = await userModel.createUser(
      first_name,
      last_name,
      phone_code,
      phone,
      email,
      password,
      organization,
      organization_type_id,
      role_id
    );
    response.status(201).json({
      message: "User created successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error creating user",
      details: error.message,
    });
  }
};

const updateUser = async (request, response) => {
  const { id, name, email, gender } = request.body;
  try {
    const result = await userModel.updateUser(
      request.params.id,
      name,
      email,
      gender
    );
    response.status(200).json({
      message: "User updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error updating user",
      details: error.message,
    });
  }
};

const deleteUser = async (request, response) => {
  try {
    const result = await userModel.deleteUser(request.params.id);
    response.status(200).json({
      message: "User has been deleted",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error deleting user",
      details: error.message,
    });
  }
};

const forgotPassword = async (request, response) => {
  const { email, password, role_id } = request.body;
  try {
    const result = await userModel.forgotPassword(email, password, role_id);
    response.status(200).json({
      message: "Password changed successfully",
      data: result,
    });
  } catch (error) {
    response.status(400).json({
      message: "Error while changing password",
      details: error.message,
    });
  }
};

const insertProfile = async (request, response) => {
  const {
    profile_image,
    user_id,
    country,
    state,
    city,
    pincode,
    address,
    professional,
    is_email_verified,
    user_type,
    experince_type,
    total_years,
    total_months,
    classes,
    course,
    start_year,
    end_year,
    gender,
    resume,
  } = request.body;

  console.log("Received profile data:", request.body);

  const missingFields = [];
  if (!profile_image) missingFields.push("profile_image");
  if (user_id === undefined || user_id === null) missingFields.push("user_id");
  if (!country) missingFields.push("country");
  if (!state) missingFields.push("state");
  if (!city) missingFields.push("city");
  if (!pincode) missingFields.push("pincode");
  if (!address) missingFields.push("address");
  if (!user_type) missingFields.push("user_type");
  if (!experince_type) missingFields.push("experince_type");
  if (!gender) missingFields.push("gender");
  if (!resume) missingFields.push("resume");

  if (missingFields.length > 0) {
    return response.status(400).json({
      message: "Missing required fields",
      required: missingFields,
    });
  }
  const formattedProfessional = Array.isArray(professional)
    ? professional
    : [professional];

  try {
    const result = await userModel.insertProfile(
      profile_image,
      user_id,
      country,
      state,
      city,
      pincode,
      address,
      formattedProfessional,
      is_email_verified,
      user_type,
      experince_type,
      total_years,
      total_months,
      classes,
      course,
      start_year,
      end_year,
      gender,
      resume
    );

    response.status(201).json({
      message: "Profile inserted successfully!",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while inserting profile",
      details: error.message,
    });
  }
};

const getHrProfile = async (request, response) => {
  const { userId } = request.params;
  try {
    const profile = await userModel.getHrProfile(userId);
    if (profile) {
      response.status(200).json({ message: "HR Profile retrieved successfully", data: profile });
    } else {
      response.status(404).json({ message: "HR Profile not found" });
    }
  } catch (error) {
    response.status(500).json({ message: "Error fetching HR Profile", details: error.message });
  }
};

const insertHrProfile = async (request, response) => {
  const {
    user_id,
    profile_image,
    banner_image,
    company_name,
    about_us,
    organization_type,
    industry_type,
    team_size,
    year_established,
    website_url,
    vision,
    social_links,
    map_location,
    contact_phone,
    contact_email
  } = request.body;

  try {
    await userModel.insertHrProfile(
      user_id,
      profile_image,
      banner_image,
      company_name,
      about_us,
      organization_type,
      industry_type,
      team_size,
      year_established,
      website_url,
      vision,
      social_links,
      map_location,
      contact_phone,
      contact_email
    );

    response.status(201).json({
      message: "HR Profile inserted successfully!",
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while inserting HR profile",
      details: error.message,
    });
  }
};

const updateSocialLinks = async (request, response) => {
  const { linkedin, facebook, instagram, twitter, dribble, behance, user_id } = request.body;
  try {
    const result = await userModel.updateSocialLinks(
      linkedin,
      facebook,
      instagram,
      twitter,
      dribble,
      behance,
      user_id
    );
    response.status(200).json({
      message: "Social links updated successfully!",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while updating social links",
      details: error.message,
    });
  }
};

// Get applied job list for candidate
const getUserAppliedJobs = async (request, response) => {
  const { userId } = request.query;

  try {
    const result = await userModel.getUserAppliedJobs(userId);

    const formattedResult = result.map(({ id, applied_job_id, ...item }) => {
      return {
        ...item,
        id: applied_job_id,
        duration_period: JSON.parse(item.duration_period),
        skills: JSON.parse(item.skills),
        experience_required: JSON.parse(item.experience_required),
        diversity_hiring: JSON.parse(item.diversity_hiring),
        job_category: JSON.parse(item.job_category),
        benefits: JSON.parse(item.benefits),
      };
    });

    return response.status(200).send({
      message: "applied jobs fetched successfully",
      data: formattedResult,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while get applied job post",
      details: error.message,
    });
  }
};

const updateUserAppliedJobStatus = async (request, response) => {
  const { post_id, user_id, status } = request.body;

  try {
    const result = await userModel.updateUserAppliedJobStatus(
      post_id,
      user_id,
      status
    );

    // ✅ Get candidate and job details for email
    let candidateEmail = "";
    let candidateName = "";
    let jobTitle = "";
    let companyName = "";

    try {
      // Fetch candidate details
      const [candidateRows] = await pool.query(
        `SELECT first_name, last_name, email FROM users WHERE id = ?`,
        [user_id]
      );

      if (candidateRows.length > 0) {
        candidateEmail = candidateRows[0].email;
        candidateName = `${candidateRows[0].first_name} ${candidateRows[0].last_name}`;
      }

      // Fetch job details
      const [jobRows] = await pool.query(
        `SELECT job_title, company_name FROM job_post WHERE id = ?`,
        [post_id]
      );

      if (jobRows.length > 0) {
        jobTitle = jobRows[0].job_title;
        companyName = jobRows[0].company_name;
      }
    } catch (fetchErr) {
      console.error("⚠️ Failed to fetch candidate/job details:", fetchErr.message);
    }

    // ✅ Send Email Notification
    if (candidateEmail && candidateName && jobTitle && companyName) {
      try {
        await sendApplicationStatusEmail(
          candidateEmail,
          candidateName,
          jobTitle,
          companyName,
          status
        );
        console.log(`✅ Email sent to ${candidateEmail} for status: ${status}`);
      } catch (emailErr) {
        console.error("⚠️ Failed to send email:", emailErr.message);
      }
    }

    // ✅ Send Push Notification
    try {
      const candidateToken = await userModel.getFcmToken(user_id);
      if (candidateToken) {
        let title = "Application Update";
        let body = `Your application status has been updated to: ${status}`;

        if (status === "Shortlisted") {
          title = "Congratulations! You are Shortlisted 🎉";
          body = "You have been shortlisted for the job. Check your dashboard for next steps.";
        } else if (status === "Rejected") {
          title = "Application Update";
          body = "Thank you for your interest. Unfortunately, you were not selected at this time.";
        }

        const message = {
          notification: { title, body },
          token: candidateToken,
          webpush: {
            fcm_options: {
              link: "https://careerfast.in/admin-profile"
            }
          }
        };

        await admin.messaging().send(message);
        console.log(`✅ Push notification sent to user ${user_id}`);
      }
    } catch (notifyErr) {
      console.error("⚠️ Failed to send push notification:", notifyErr.message);
    }

    return response
      .status(200)
      .send({ message: "Status changed and notifications sent", data: result });
  } catch (error) {
    response.status(500).send({
      message: "Error while update applied job status",
      details: error.message,
    });
  }
};

const getUserJobPostStatus = async (request, response) => {
  const { applied_job_id } = request.query;

  try {
    const result = await userModel.getUserJobPostStatus(applied_job_id);
    return response
      .status(200)
      .send({ message: "job status get successfully", data: result });
  } catch (error) {
    response.status(500).send({
      message: "Error while get applied job status",
      details: error.message,
    });
  }
};

const getUserType = async (request, response) => {
  try {
    const result = await userModel.getUserType();
    response.status(200).send({
      message: "User types fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching user types",
      details: error.message,
    });
  }
};

const updateBasicDetails = async (request, response) => {
  const {
    first_name,
    last_name,
    gender,
    user_type,
    classes,
    course,
    start_year,
    end_year,
    experince_type,
    total_years,
    total_months,
    location,
    user_id,
  } = request.body;
  try {
    const result = await userModel.updateBasicDetails(
      first_name,
      last_name,
      gender,
      user_type,
      classes,
      course,
      start_year,
      end_year,
      experince_type,
      total_years,
      total_months,
      location,
      user_id
    );
    response.status(200).send({
      message: "Updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating",
      details: error.message,
    });
  }
};

const updateEducation = async (request, response) => {
  const {
    qualification,
    course,
    specialization,
    college,
    start_date,
    end_date,
    course_type,
    percentage,
    cgpa,
    roll_number,
    lateral_entry,
    user_id,
    id,
  } = request.body;
  try {
    const result = await userModel.updateEducation(
      qualification,
      course,
      specialization,
      college,
      start_date,
      end_date,
      course_type,
      percentage,
      cgpa,
      roll_number,
      lateral_entry,
      user_id,
      id
    );
    response.status(200).send({
      message: "Updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating",
      details: error.message,
    });
  }
};

const deleteEducation = async (request, response) => {
  const { id } = request.query;
  try {
    const result = await userModel.deleteEducation(id);
    response.status(200).send({
      message: "Education has been deleted",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while deleting",
      details: error.message,
    });
  }
};

const insertEducation = async (request, response) => {
  const {
    user_id,
    qualification,
    course,
    specialization,
    college,
    start_date,
    end_date,
    course_type,
    percentage,
    cgpa,
    roll_number,
    lateral_entry,
  } = request.body;
  try {
    const result = await userModel.insertEducation(
      user_id,
      qualification,
      course,
      specialization,
      college,
      start_date,
      end_date,
      course_type,
      percentage,
      cgpa,
      roll_number,
      lateral_entry
    );
    response.status(201).send({
      message: "Education inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while inserting education",
      details: error.message,
    });
  }
};

const getUserProfile = async (request, response) => {
  const { user_id } = request.query;
  try {
    const result = await userModel.getUserProfile(user_id);
    response.status(200).send({
      message: "User profile fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching user profile",
      details: error.message,
    });
  }
};

const isProfileUpdated = async (request, response) => {
  const { email } = request.query;
  try {
    const result = await userModel.isProfileUpdated(email);
    response.status(200).send({
      message: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const updateProfileImage = async (request, response) => {
  const { user_id, profile_image } = request.body;
  try {
    const result = await userModel.updateProfileImage(user_id, profile_image);
    response.status(200).send({
      message: "Profile image updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating profile image",
      details: error.message,
    });
  }
};

const updateBanner = async (request, response) => {
  const { user_id, banner_color, banner_image } = request.body;
  try {
    const result = await userModel.updateBanner(user_id, banner_color, banner_image);
    response.status(200).send({
      message: "Banner updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating banner",
      details: error.message,
    });
  }
};

const updateUserStatus = async (request, response) => {
  const { id } = request.params;
  const { is_active } = request.body;
  try {
    const result = await userModel.updateUserStatus(id, is_active);
    response.status(200).send({
      message: "User status updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while updating user status",
      details: error.message,
    });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  forgotPassword,
  insertProfile,
  getHrProfile,
  insertHrProfile,
  getUserAppliedJobs,
  updateUserAppliedJobStatus,
  getUserJobPostStatus,
  updateSocialLinks,
  getUserType,
  updateBasicDetails,
  updateEducation,
  deleteEducation,
  insertEducation,
  getUserProfile,
  isProfileUpdated,
  updateProfileImage,
  updateBanner,
  updateUserStatus,
};
