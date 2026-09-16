const fs = require('fs');
const filepath = 'c:/Users/dell/Documents/Careerfast/careerfast-backend/models/JobsModel.js';
let content = fs.readFileSync(filepath, 'utf8');

const targetStr = `      educational_qualification,
      candidate_industry,
      hide_salary,
      languages
    ) => {`;

const replacementStr = `      educational_qualification,
      candidate_industry,
      hide_salary,
      languages,
      is_walk_in,
      walk_in_start_date,
      walk_in_end_date,
      walk_in_start_time,
      walk_in_end_time,
      recruiter_name,
      mobile_number,
      venue_address,
      google_maps_url,
      team_members
    ) => {`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(filepath, content);
    console.log("Successfully replaced parameter list in updateJobPosting");
} else {
    // Normalize newlines and try again
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const normalizedTarget = targetStr.replace(/\r\n/g, '\n');
    if (normalizedContent.includes(normalizedTarget)) {
        content = normalizedContent.replace(normalizedTarget, replacementStr.replace(/\r\n/g, '\n'));
        fs.writeFileSync(filepath, content);
        console.log("Successfully replaced parameter list in updateJobPosting (normalized)");
    } else {
        console.log("Could not find the target string.");
    }
}
