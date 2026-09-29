const mysql = require('mysql2/promise');
async function run() {
  const con = await mysql.createConnection({host:'localhost', user:'root', database:'career_fast'});
  const [rows] = await con.query("SELECT location, description FROM user_professional WHERE company_name LIKE '%Markerz%'");
  console.log(rows);
  process.exit(0);
}
run().catch(console.error);
