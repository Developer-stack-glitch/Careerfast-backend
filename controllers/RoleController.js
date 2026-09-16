const RoleModel = require("../models/RoleModel");
console.log("RoleController loaded");

const getRoles = async (request, response) => {
  console.log("Entering getRoles controller");
  try {
    const roles = await RoleModel.getRoles();
    console.log("Roles fetched:", roles.length);
    response.status(200).json({
      message: "Roles data fetched successfully",
      data: roles,
    });
  } catch (error) {
    console.error("Error in getRoles controller:", error.message);
    response.status(500).json({
      message: "Error while fetching roles",
      details: error.message,
    });
  }
};

const insertCollege = async (request, response) => {
  await RoleModel.insertCollege();
};

module.exports = {
  getRoles,
  insertCollege,
};
