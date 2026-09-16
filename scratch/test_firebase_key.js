const fs = require('fs');
const path = require('path');

try {
  const serviceAccountPath = path.join(__dirname, '../config/firebaseServiceAccount.json');
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  if (serviceAccount.private_key) {
    const pk = serviceAccount.private_key;
    console.log('Char at 27:', pk.charCodeAt(27)); // Expected 10 for \n
    console.log('Char at 28:', pk.charCodeAt(28));
    
    const formatted = pk.replace(/\\n/g, '\n');
    console.log('Formatted Char at 27:', formatted.charCodeAt(27));
  }
} catch (e) {
  console.error(e);
}
