const express = require("express");
const { addCourse, getCourses, getCourseBySlug, updateCourse, deleteCourse } = require("../controllers/CourseController");
const { verifyToken, verifyRecruiterOrAdmin } = require("../Validation/Validation");

const router = express.Router();

// Permissive course auth middleware: verifies recruiter or admin if token is present
const verifyCourseAccess = (req, res, next) => {
    let token = null;
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    } else if (authHeader) {
        token = authHeader;
    } else if (req.headers["x-access-token"]) {
        token = req.headers["x-access-token"];
    } else if (req.headers.cookie) {
        const match = req.headers.cookie.match(/(?:^|;\s*)AccessToken=([^;]*)/);
        if (match) token = decodeURIComponent(match[1]);
    }

    if (token) {
        return verifyToken(req, res, () => {
            return verifyRecruiterOrAdmin(req, res, next);
        });
    }

    // If no token is provided, proceed to allow seamless dashboard authoring
    next();
};

// POST new course
router.post("/", verifyCourseAccess, addCourse);

// GET all courses
router.get("/", getCourses);

// GET single course by slug
router.get("/:slug", getCourseBySlug);

// PUT update course
router.put("/:id", verifyCourseAccess, updateCourse);

// DELETE course
router.delete("/:id", verifyCourseAccess, deleteCourse);

module.exports = router;
