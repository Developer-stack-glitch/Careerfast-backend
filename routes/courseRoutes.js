const express = require("express");
const { addCourse, getCourses, getCourseBySlug, updateCourse, deleteCourse } = require("../controllers/CourseController");

const router = express.Router();

// POST new course
router.post("/", addCourse);

// GET all courses
router.get("/", getCourses);

// GET single course by slug
router.get("/:slug", getCourseBySlug);

// PUT update course
router.put("/:id", updateCourse);

// DELETE course
router.delete("/:id", deleteCourse);

module.exports = router;
