const pool = require("../config/dbConfig");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

const RoleModel = {
  getRoles: async () => {
    try {
      const query = `SELECT id, name FROM role WHERE is_active = 1`;
      const [roles] = await pool.query(query);
      return roles;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertCollege: async () => {
    const fullPath = path.join(
      "C:/Users/dell/Downloads/engineering_colleges.csv/engineering_colleges_in_India.csv"
    );
    fs.createReadStream(fullPath)
      .pipe(csv())
      .on("data", async (row) => {
        await pool.query(
          "INSERT INTO college_master (name, city, state, university, is_deleted) VALUES (?, ?, ?, ?, 0)",
          [row.CollegeName, row.City, row.State, row.University || row.type]
        );
      })
      .on("end", () => console.log("Import complete."));
  },
};

module.exports = RoleModel;
