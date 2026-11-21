const express = require("express");
const {
    addBlog,
    updateBlog,
    getBlogs,
    getBlogById,
    deleteBlog,
    getBlogImage
} = require("../controllers/blogController");
const { verifyToken, verifySuperAdmin } = require("../Validation/Validation");

const router = express.Router();

// Create
router.post("/add", verifyToken, verifySuperAdmin, addBlog);

// Update
router.put("/update/:id", verifyToken, verifySuperAdmin, updateBlog);

// Read
router.get("/all-blogs", getBlogs);
router.get("/image/:id", getBlogImage);
router.get("/:id", getBlogById);

// Delete
router.delete("/delete/:id", verifyToken, verifySuperAdmin, deleteBlog);

module.exports = router;
