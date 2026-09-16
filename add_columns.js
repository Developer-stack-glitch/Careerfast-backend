const pool = require('./config/dbConfig');

pool.query("ALTER TABLE job_post ADD COLUMN locality VARCHAR(255) DEFAULT NULL", (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') console.log(err);
    else console.log("locality column added or exists");
});

pool.query("ALTER TABLE job_post ADD COLUMN internship_perks JSON DEFAULT NULL", (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') console.log(err);
    else console.log("internship_perks column added or exists");
    
    setTimeout(() => process.exit(0), 1000);
});