const pool = require("../config/dbConfig");
const bcrypt = require("bcrypt");

async function main() {
  try {
    const email = "Superadmin@careerfast.com";
    const plainPassword = "Careerfast@123";
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    console.log("Checking if user already exists with email: " + email);
    const [rows] = await pool.query("SELECT id, phone FROM users WHERE email = ?", [email]);

    if (rows.length > 0) {
      console.log(`User ${email} already exists. Updating credentials and setting role to SUPER-ADMIN...`);
      const userId = rows[0].id;
      const [updateResult] = await pool.query(
        `UPDATE users SET 
          role_id = 1, 
          first_name = 'Super', 
          last_name = 'Admin', 
          phone_code = '+91', 
          phone = ?, 
          password = ?, 
          is_email_verified = 1, 
          is_active = 1 
        WHERE id = ?`,
        [rows[0].phone || "9999999999", hashedPassword, userId]
      );
      console.log("✅ Superadmin user updated successfully!");
    } else {
      console.log(`Creating a brand new Superadmin user (${email})...`);
      
      // Let's make sure we don't violate the unique phone check if phone is already used by checking
      let phone = "9999999999";
      const [phoneRows] = await pool.query("SELECT id FROM users WHERE phone_code = '+91' AND phone = ?", [phone]);
      if (phoneRows.length > 0) {
        // If 9999999999 is taken, generate a random one to avoid application conflict
        phone = "9" + Math.floor(100000000 + Math.random() * 900000000).toString();
        console.log(`Phone 9999999999 was taken, using alternative number: ${phone}`);
      }

      const [insertResult] = await pool.query(
        `INSERT INTO users (
          role_id, 
          first_name, 
          last_name, 
          phone_code, 
          phone, 
          email, 
          password, 
          is_email_verified, 
          is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          1, // SUPER-ADMIN role_id
          "Super",
          "Admin",
          "+91",
          phone,
          email,
          hashedPassword,
          1, // is_email_verified (bit(1) as 1)
          1  // is_active (bit(1) as 1)
        ]
      );
      console.log("✅ Superadmin user created successfully with ID:", insertResult.insertId);
    }
    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting up Superadmin:", error);
    process.exit(1);
  }
}

main();
