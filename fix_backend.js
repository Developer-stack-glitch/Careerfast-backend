const fs = require('fs');
const pathC = 'c:\\Users\\dell\\Documents\\Careerfast\\careerfast-backend\\controllers\\JobsController.js';
const pathM = 'c:\\Users\\dell\\Documents\\Careerfast\\careerfast-backend\\models\\JobsModel.js';

let controllerContent = fs.readFileSync(pathC, 'utf8');
if (!controllerContent.includes('locality')) {
    // Add to destructured req.body
    controllerContent = controllerContent.replace('last_date_to_apply', 'last_date_to_apply, locality, internship_perks');
    // Add to JobsModel.createJobPost params
    controllerContent = controllerContent.replace('last_date_to_apply)', 'last_date_to_apply, locality, internship_perks)');
    fs.writeFileSync(pathC, controllerContent, 'utf8');
    console.log("Updated JobsController.js");
}

let modelContent = fs.readFileSync(pathM, 'utf8');
if (!modelContent.includes('locality')) {
    // Add to function parameters
    modelContent = modelContent.replace('last_date_to_apply)', 'last_date_to_apply, locality, internship_perks)');
    
    // Add to the query string. This is a bit trickier, but usually there's a list of columns
    // like (..., last_date_to_apply) VALUES (..., ?)
    modelContent = modelContent.replace('last_date_to_apply)', 'last_date_to_apply, locality, internship_perks)');
    modelContent = modelContent.replace(', ?)', ', ?, ?, ?)');
    
    // Add to query values array
    modelContent = modelContent.replace(', last_date_to_apply]', ', last_date_to_apply, locality, JSON.stringify(internship_perks || [])]');
    
    fs.writeFileSync(pathM, modelContent, 'utf8');
    console.log("Updated JobsModel.js");
    
    // We should also run an ALTER TABLE to add the new columns!
    const mysqlScript = `
const mysql = require('mysql2');
const db = require('./config/db'); // Adjust path to db.js if needed
const pool = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'careerfast' });

pool.query("ALTER TABLE job_post ADD COLUMN locality VARCHAR(255) DEFAULT NULL", (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') console.log(err);
    else console.log("locality column added or exists");
});

pool.query("ALTER TABLE job_post ADD COLUMN internship_perks JSON DEFAULT NULL", (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') console.log(err);
    else console.log("internship_perks column added or exists");
});
    `;
    fs.writeFileSync('c:\\Users\\dell\\Documents\\Careerfast\\careerfast-backend\\add_columns.js', mysqlScript, 'utf8');
}
