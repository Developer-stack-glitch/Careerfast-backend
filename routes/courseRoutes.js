const express = require("express");
const { addCourse, getCourses, getCourseBySlug, updateCourse, deleteCourse } = require("../controllers/CourseController");
const { verifyToken, verifySuperAdmin } = require("../Validation/Validation");

const router = express.Router();

// POST new course
router.post("/", verifyToken, verifySuperAdmin, addCourse);

// GET all courses
router.get("/", getCourses);

// GET single course by slug
router.get("/:slug", getCourseBySlug);

// PUT update course
router.put("/:id", verifyToken, verifySuperAdmin, updateCourse);

// DELETE course
router.delete("/:id", verifyToken, verifySuperAdmin, deleteCourse);

module.exports = router;
