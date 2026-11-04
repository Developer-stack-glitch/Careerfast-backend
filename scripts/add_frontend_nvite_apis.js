const fs = require("fs");
const path = require("path");

// HR API
const hrPath = path.join(__dirname, "../../careerfastHR/src/ApiService/action.js");
let hrCode = fs.readFileSync(hrPath, "utf8");
if (!hrCode.includes("sendNvitesAPI")) {
  const hrAddition = `
// ==========================================
// ⚡ Naukri-style Nvites (Job Invitations) APIs
// ==========================================
export const sendNvitesAPI = async (payload) => {
  try {
    const response = await api.post("/api/nvites/send", payload);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getRecruiterNvitesAPI = async (params = {}) => {
  try {
    const response = await api.get("/api/nvites/recruiter", { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const resendNviteAPI = async (id) => {
  try {
    const response = await api.post(\`/api/nvites/\${id}/resend\`);
    return response.data;
  } catch (error) {
    throw error;
  }
};
`;
  hrCode += "\n" + hrAddition;
  fs.writeFileSync(hrPath, hrCode, "utf8");
  console.log("✅ Added Nvites APIs to careerfastHR");
} else {
  console.log("sendNvitesAPI already in careerfastHR");
}

// Frontend Candidate API
const fePath = path.join(__dirname, "../../careerfast-frontend/src/ApiService/action.js");
let feCode = fs.readFileSync(fePath, "utf8");
if (!feCode.includes("getCandidateNvitesAPI")) {
  const feAddition = `
// ==========================================
// ⚡ Naukri-style Nvites (Job Invitations) APIs
// ==========================================
export const getCandidateNvitesAPI = async (params = {}) => {
  try {
    const response = await api.get("/api/nvites/candidate", { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const markNviteViewedAPI = async (id) => {
  try {
    const response = await api.post(\`/api/nvites/\${id}/view\`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const acceptNviteAPI = async (id) => {
  try {
    const response = await api.post(\`/api/nvites/\${id}/accept\`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const declineNviteAPI = async (id, payload = {}) => {
  try {
    const response = await api.post(\`/api/nvites/\${id}/decline\`, payload);
    return response.data;
  } catch (error) {
    throw error;
  }
};
`;
  feCode += "\n" + feAddition;
  fs.writeFileSync(fePath, feCode, "utf8");
  console.log("✅ Added Nvites APIs to careerfast-frontend");
} else {
  console.log("getCandidateNvitesAPI already in careerfast-frontend");
}

