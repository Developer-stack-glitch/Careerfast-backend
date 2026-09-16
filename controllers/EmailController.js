const { request, response } = require("express");
const EmailModel = require("../models/EmailModel");

const sendVerificationEmail = async (request, response) => {
  const { email, role_id } = request.body;
  if (!email) {
    return response.status(400).json({ error: "Email is required" });
  }
  try {
    const result = await EmailModel.sendVerificationEmail(email, role_id);
    if (result.success) {
      response.json({ message: result.message });
    } else {
      response.status(500).json({ error: result.message });
    }
  } catch (error) {
    response.status(400).send({
      message: "Error while sending email",
      details: error.message,
    });
  }
};

const verifyOTP = async (request, response) => {
  const { email, otp } = request.body;
  if (!email || !otp) {
    return response.status(400).json({ error: "Email and OTP are required" });
  }
  try {
    const result = await EmailModel.verifyOTP(email, otp);
    if (result.success) {
      response.status(200).send({ message: result.message });
    } else {
      response.status(400).json({ error: result.message });
    }
  } catch (error) {
    response.status(500).send({
      message: "Error verifying otp",
      details: error.message,
    });
  }
};

const VerifyEmail = async (request, response) => {
  const { email } = request.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  try {
    const result = await EmailModel.VerifyEmail(email);
    if (result.success) {
      response.json({ message: result.message });
    } else {
      response.status(500).json({ error: result.message });
    }
  } catch (error) {
    response.status(500).send({
      message: "Error while sending email",
      details: error.message,
    });
  }
};

const sendCompetitionRegistration = async (request, response) => {
  const { fullName, email, phoneNumber, skillLevel, competitionTitle, competitionOrganizer } = request.body;

  if (!fullName || !email || !competitionTitle || !competitionOrganizer) {
    return response.status(400).json({
      error: "Full name, email, competition title, and organizer are required"
    });
  }

  try {
    const result = await EmailModel.sendCompetitionRegistrationEmail({
      fullName,
      email,
      phoneNumber,
      skillLevel,
      competitionTitle,
      competitionOrganizer
    });

    if (result.success) {
      response.status(200).json({ message: result.message });
    } else {
      response.status(500).json({ error: result.message });
    }
  } catch (error) {
    response.status(500).send({
      message: "Error while sending competition registration email",
      details: error.message,
    });
  }
};

const sendMentorQuery = async (request, response) => {
  const { userName, userEmail, phoneNumber, message, mentorName, mentorTitle, mentorCompany } = request.body;

  if (!userName || !userEmail || !message || !mentorName) {
    return response.status(400).json({
      error: "User name, email, message, and mentor name are required"
    });
  }

  try {
    const result = await EmailModel.sendMentorQueryEmail({
      userName,
      userEmail,
      phoneNumber,
      message,
      mentorName,
      mentorTitle,
      mentorCompany
    });

    if (result.success) {
      response.status(200).json({ message: result.message });
    } else {
      response.status(500).json({ error: result.message });
    }
  } catch (error) {
    response.status(500).send({
      message: "Error while sending mentor query email",
      details: error.message,
    });
  }
};

module.exports = {
  sendVerificationEmail,
  verifyOTP,
  VerifyEmail,
  sendCompetitionRegistration,
  sendMentorQuery,
};
