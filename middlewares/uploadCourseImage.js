const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadPath = "uploads/courses";

// Ensure upload directory exists
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: uploadPath,
    filename: (req, file, cb) => {
        const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
        cb(null, Date.now() + safeExt);
    },
});

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only JPEG, PNG, and WebP images are allowed."));
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter,
});

module.exports = upload.single("image");
