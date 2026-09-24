const IndustryModel = require("../models/IndustryModel");

const getIndustryTypes = async (request, response) => {
  try {
    const types = await IndustryModel.getIndustryTypes();
    response.status(200).json({
      message: "Industry types fetched successfully",
      data: types,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching industry types",
      details: error.message,
    });
  }
};

module.exports = {
  getIndustryTypes,
};
