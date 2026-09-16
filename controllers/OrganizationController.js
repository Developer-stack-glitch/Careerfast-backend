const { response, request } = require("express");
const OrganizationModel = require("../models/OrganizationModel");

const getOrganizationTypes = async (request, response) => {
  try {
    const types = await OrganizationModel.getOrganizationTypes();
    response.status(200).json({
      message: "Organization type fetched successfully",
      data: types,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching organization type",
      details: error.message,
    });
  }
};

module.exports = {
  getOrganizationTypes,
};
