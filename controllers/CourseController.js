const CourseModel = require("../models/CourseModel");

const addCourse = async (req, res) => {
    try {
        const { title, description, link, imageBase64, content, slug, category } = req.body;

        if (!title || !slug) {
            return res.status(400).json({ error: "Title and Slug are required" });
        }

        const params = [
            title || null,
            description || null,
            link || "",
            imageBase64 || null,
            content ? JSON.stringify(content) : null,
            slug || null,
            category || null
        ].map(p => p === undefined ? null : p);

        const result = await CourseModel.create(...params);

        if (result.success) {
            res.status(201).json({ message: result.message });
        } else {
            res.status(500).json({ error: result.message });
        }
    } catch (error) {
        res.status(500).json({
            message: "Error while adding course",
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
            res.status(500).json({ error: result.message });
        }
    } catch (error) {
        res.status(500).json({
            message: "Error fetching courses",
            details: error.message,
        });
    }
};

const getCourseBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const result = await CourseModel.getBySlug(slug);
        if (result.success) {
            const course = result.data;
            if (course.content) {
                try {
                    course.content = typeof course.content === 'string' ? JSON.parse(course.content) : course.content;
                } catch (e) {
                    console.error("JSON Parse Error for course slug", slug, e);
                }
            }
            res.status(200).json(course);
        } else {
            res.status(404).json({ error: result.message });
        }
    } catch (error) {
        res.status(500).json({
            message: "Error fetching course",
            details: error.message,
        });
    }
};

const deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await CourseModel.deleteById(id);
        if (result.success) {
            res.status(200).json({ message: result.message });
        } else {
            res.status(500).json({ error: result.message });
        }
    } catch (error) {
        res.status(500).json({
            message: "Error deleting course",
            details: error.message,
        });
    }
};

const updateCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, link, imageBase64, content, slug, category } = req.body;

        if (!title || !slug) {
            return res.status(400).json({ error: "Title and Slug are required" });
        }

        // Preserve existing image if no new one is provided
        let finalImage = imageBase64;
        if (!finalImage && id) {
            const current = await CourseModel.getBySlug(slug); // Try by slug or id
            if (current.success) {
                finalImage = current.data.image;
            }
        }

        const params = [
            id,
            title || null,
            description || null,
            link || "",
            finalImage || null,
            content ? JSON.stringify(content) : null,
            slug || null,
            category || null
        ].map(p => p === undefined ? null : p);

        const result = await CourseModel.update(...params);

        if (result.success) {
            res.status(200).json({ message: result.message });
        } else {
            res.status(500).json({ error: result.message });
        }
    } catch (error) {
        res.status(500).json({
            message: "Error updating course",
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
