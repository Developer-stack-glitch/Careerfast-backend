const CourseModel = require("../models/CourseModel");

const generateSlug = (text) => {
    if (!text) return "";
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const extractCleanDescription = (content, fallback = "") => {
    try {
        if (!content) return fallback;
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        if (parsed?.aboutCourse?.description) {
            return String(parsed.aboutCourse.description).replace(/<[^>]+>/g, '').trim().slice(0, 300);
        }
    } catch (e) { }
    return fallback;
};

const addCourse = async (req, res) => {
    try {
        const { title, description, link, imageBase64, content, slug, category } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: "Course title is required", 
                message: "Course title is required" 
            });
        }

        // Auto-generate slug if missing
        let baseSlug = generateSlug(slug || title);
        if (!baseSlug) {
            baseSlug = `course-${Date.now()}`;
        }

        // Ensure slug is unique
        let finalSlug = baseSlug;
        let suffix = 1;
        while (await CourseModel.checkSlugExists(finalSlug)) {
            finalSlug = `${baseSlug}-${suffix}`;
            suffix++;
        }

        // Handle content serialization safely
        const finalContent = content 
            ? (typeof content === 'string' ? content : JSON.stringify(content))
            : null;

        // Ensure description is never null or empty if aboutCourse description exists
        const safeDescription = (description && description.trim()) 
            ? description.trim() 
            : extractCleanDescription(content, "");

        const params = [
            title.trim(),
            safeDescription,
            link || "",
            imageBase64 || null,
            finalContent,
            finalSlug,
            category || null
        ].map(p => p === undefined ? null : p);

        const result = await CourseModel.create(...params);

        if (result.success) {
            res.status(201).json({ 
                success: true, 
                message: result.message || "Course added successfully",
                id: result.id,
                slug: finalSlug
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: result.message || "Failed to add course",
                message: result.message || "Failed to add course",
                details: result.message
            });
        }
    } catch (error) {
        console.error("addCourse error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Error while adding course",
            message: error.message || "Error while adding course",
            details: error.message,
        });
    }
};

const getCourses = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10);
        const result = await CourseModel.getAll(!isNaN(limit) && limit > 0 ? limit : null);
        if (result.success) {
            let courses = result.data.map(course => {
                let parsedContent = null;
                if (course.content) {
                    try {
                        parsedContent = typeof course.content === 'string' ? JSON.parse(course.content) : course.content;
                    } catch (e) {
                        console.error("JSON Parse Error for course ID", course.id, e);
                    }
                }
                return {
                    ...course,
                    content: parsedContent
                };
            });

            res.status(200).json(courses);
        } else {
            res.status(500).json({ 
                success: false, 
                error: result.message || "Failed to fetch courses",
                message: result.message || "Failed to fetch courses"
            });
        }
    } catch (error) {
        console.error("getCourses error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Error fetching courses",
            message: error.message || "Error fetching courses",
            details: error.message,
        });
    }
};

const getCourseBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        let result = null;
        if (!isNaN(slug)) {
            result = await CourseModel.getById(slug);
        }
        if (!result || !result.success) {
            result = await CourseModel.getBySlug(slug);
        }
        if (result && result.success) {
            const course = result.data;
            if (course.content) {
                try {
                    course.content = typeof course.content === 'string' ? JSON.parse(course.content) : course.content;
                } catch (e) {
                    console.error("JSON Parse Error for course identifier", slug, e);
                }
            }
            res.status(200).json(course);
        } else {
            res.status(404).json({ 
                success: false, 
                error: "Course not found", 
                message: "Course not found" 
            });
        }
    } catch (error) {
        console.error("getCourseBySlug error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Error fetching course",
            message: error.message || "Error fetching course",
            details: error.message,
        });
    }
};

const deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await CourseModel.deleteById(id);
        if (result.success) {
            res.status(200).json({ 
                success: true, 
                message: result.message || "Course deleted successfully" 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: result.message || "Failed to delete course", 
                message: result.message || "Failed to delete course" 
            });
        }
    } catch (error) {
        console.error("deleteCourse error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Error deleting course",
            message: error.message || "Error deleting course",
            details: error.message,
        });
    }
};

const updateCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, link, imageBase64, content, slug, category } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: "Course title is required", 
                message: "Course title is required" 
            });
        }

        // Auto-generate slug if missing
        let baseSlug = generateSlug(slug || title);
        if (!baseSlug) {
            baseSlug = `course-${id}`;
        }

        // Ensure unique slug excluding current course id
        let finalSlug = baseSlug;
        let suffix = 1;
        while (await CourseModel.checkSlugExists(finalSlug, id)) {
            finalSlug = `${baseSlug}-${suffix}`;
            suffix++;
        }

        // Preserve existing image if no new one is provided
        let finalImage = imageBase64;
        if (!finalImage && id) {
            const current = await CourseModel.getById(id);
            if (current && current.success) {
                finalImage = current.data.image;
            }
        }

        const finalContent = content 
            ? (typeof content === 'string' ? content : JSON.stringify(content))
            : null;

        const safeDescription = (description && description.trim()) 
            ? description.trim() 
            : extractCleanDescription(content, "");

        const params = [
            id,
            title.trim(),
            safeDescription,
            link || "",
            finalImage || null,
            finalContent,
            finalSlug,
            category || null
        ].map(p => p === undefined ? null : p);

        const result = await CourseModel.update(...params);

        if (result.success) {
            res.status(200).json({ 
                success: true, 
                message: result.message || "Course updated successfully",
                id: id,
                slug: finalSlug
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: result.message || "Failed to update course", 
                message: result.message || "Failed to update course",
                details: result.message
            });
        }
    } catch (error) {
        console.error("updateCourse error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Error updating course",
            message: error.message || "Error updating course",
            details: error.message,
        });
    }
};

module.exports = {
    addCourse,
    getCourses,
    getCourseBySlug,
    updateCourse,
    deleteCourse
};
