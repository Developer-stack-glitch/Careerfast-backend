const pool = require("../config/dbConfig");

// =============================
// ➕ Add Blog
// =============================
exports.addBlog = async (req, res) => {
    try {
        const { blogTitle, overview, blogImage, author, readingTime, blogDescription, userId } = req.body;

        if (!blogTitle || !overview || !blogDescription || !blogImage) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        // Validate image size (Base64 size check)
        const base64Length = blogImage.length * (3 / 4); // approx bytes
        const maxSize = 1.5 * 1024 * 1024; // 1.5MB

        if (base64Length > maxSize) {
            return res.status(400).json({ message: "Image must be less than 1.5MB" });
        }

        const sql = `
    INSERT INTO blogs 
    (blogTitle, overview, blogImage, author, readingTime, blogDescription, userId) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
`;

        const [result] = await pool.execute(sql, [
            blogTitle,
            overview,
            blogImage,
            author,
            readingTime,
            blogDescription,
            userId,
        ]);

        return res.status(200).json({
            message: "Blog added successfully",
            blogId: result.insertId,
        });

    } catch (error) {
        console.error("Error adding blog:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// =============================
// ✏️ Update Blog
// =============================
exports.updateBlog = async (req, res) => {
    try {
        const blogId = req.params.id;
        const { blogTitle, overview, blogImage, author, readingTime, blogDescription, userId } = req.body;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: No User ID provided" });
        }

        // Check if the blog belongs to the user
        const [existing] = await pool.execute("SELECT userId, blogImage FROM blogs WHERE id = ?", [blogId]);
        if (existing.length === 0) {
            return res.status(404).json({ message: "Blog not found" });
        }

        if (Number(existing[0].userId) !== Number(userId)) {
            return res.status(403).json({ message: "Forbidden: You are not the author of this blog" });
        }

        let finalImage = blogImage;
        if (blogImage && (blogImage.startsWith("/api/blogs/image/") || blogImage.includes("/api/blogs/image/"))) {
            finalImage = existing[0].blogImage;
        }

        const sql = `
  UPDATE blogs SET 
    blogTitle=?, 
    overview=?, 
    blogImage=?, 
    author=?, 
    readingTime=?, 
    blogDescription=?, 
    updatedDate=NOW()
  WHERE id=?
`;

        await pool.execute(sql, [
            blogTitle,
            overview,
            finalImage,
            author,
            readingTime,
            blogDescription,
            blogId,
        ]);

        return res.status(200).json({
            message: "Blog updated successfully",
        });

    } catch (error) {
        console.error("Error updating blog:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};


// =============================
// 📌 Get All Blogs
// =============================
exports.getBlogs = async (req, res) => {
    try {
        const sql = `SELECT id, blogTitle, overview, author, readingTime, createdDate, updatedDate, userId FROM blogs ORDER BY createdDate DESC`;
        const [rows] = await pool.execute(sql);

        const mapped = rows.map(row => ({
            ...row,
            blogImage: `/api/blogs/image/${row.id}?t=${row.updatedDate ? new Date(row.updatedDate).getTime() : ''}`
        }));

        return res.status(200).json(mapped);

    } catch (error) {
        console.error("Error fetching blogs:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// =============================
// 📌 Get Blog Image
// =============================
exports.getBlogImage = async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT blogImage FROM blogs WHERE id = ?", [req.params.id]);
        if (rows.length === 0 || !rows[0].blogImage) {
            return res.status(404).send("Not Found");
        }
        const img = rows[0].blogImage;
        if (img.startsWith("data:")) {
            const matches = img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
            if (matches && matches.length === 3) {
                const contentType = matches[1];
                const buffer = Buffer.from(matches[2], 'base64');
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache
                return res.send(buffer);
            }
        }
        if (img.startsWith("http") || img.startsWith("/")) {
            return res.redirect(img);
        }
        return res.status(400).send("Invalid image format");
    } catch (error) {
        console.error("Error fetching blog image:", error);
        return res.status(500).send("Internal server error");
    }
};


// =============================
// 📌 Get Single Blog
// =============================
exports.getBlogById = async (req, res) => {
    try {
        const sql = `SELECT * FROM blogs WHERE id = ?`;
        const [rows] = await pool.execute(sql, [req.params.id]);

        if (rows.length === 0)
            return res.status(404).json({ message: "Blog not found" });

        return res.status(200).json(rows[0]);

    } catch (error) {
        console.error("Error fetching blog:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};


// =============================
// 🗑 Delete Blog
// =============================
exports.deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: No User ID provided" });
        }

        // Check if the blog belongs to the user
        const [existing] = await pool.execute("SELECT userId FROM blogs WHERE id = ?", [id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: "Blog not found" });
        }

        if (Number(existing[0].userId) !== Number(userId)) {
            return res.status(403).json({ message: "Forbidden: You are not the author of this blog" });
        }

        console.log(`🗑 Request to delete blog ID: ${id} by user: ${userId}`);
        
        const sql = `DELETE FROM blogs WHERE id = ?`;
        const [result] = await pool.execute(sql, [id]);

        console.log("✅ Delete result:", result);

        if (result.affectedRows === 0) {
            console.warn(`⚠️ No blog found with ID: ${id}`);
            return res.status(404).json({ message: "Blog not found" });
        }

        return res.status(200).json({ message: "Blog deleted successfully" });

    } catch (error) {
        console.error("❌ Error deleting blog:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

