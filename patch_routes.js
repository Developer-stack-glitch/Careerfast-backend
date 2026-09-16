const fs = require('fs');
const file = 'routes/Routes.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('/updateJobPosting')) {
  content = content.replace(
    /router\.post\("\/jobPosting", verifyToken, JobsController\.jobPosting\);/,
    'router.post("/jobPosting", verifyToken, JobsController.jobPosting);\nrouter.put("/updateJobPosting", verifyToken, JobsController.updateJobPosting);'
  );
  fs.writeFileSync(file, content);
  console.log('patched Routes');
} else {
  console.log('already patched');
}
