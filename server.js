const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const Routes = require("./routes/Routes");
const pool = require("./config/dbConfig"); // your MySQL connection pool
const ensureDatabaseIndexes = require("./config/ensureIndexes");

// Verify and create database performance indexes
ensureDatabaseIndexes();

const app = express();

// =======================
// 🔧 Middleware Setup
// =======================
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);


// Request Logger
/* app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
}); */



// =======================
// 📁 Ensure Upload Directory Exists
// =======================
const uploadDir = path.join(__dirname, "uploads/events");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📁 Created uploads/events directory");
}

// =======================
// 🌐 Serve Uploaded Files Publicly
// =======================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =======================
//  API Routes
// =======================
app.use("/api", Routes);

// =======================
// 🔍 Health Check
// =======================
app.get("/", (req, res) => {
  res.status(200).send({ message: "✅ CareerFast backend running fine!" });
});

app.get("/ping", (req, res) => {
  console.log("Ping received");
  res.status(200).send("pong");
});


// =======================
// ❌ 404 Handler
// =======================
app.use((req, res) => {
  res.status(404).json({ message: "404 Not Found - Invalid route" });
});


// =======================
// 🚀 Start Server
// =======================
const PORT = 3006;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`⚡ Server running at http://0.0.0.0:${PORT}`);
});

