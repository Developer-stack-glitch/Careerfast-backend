const pool = require('../config/dbConfig');

const faqs = [
    { 
        q: "Do I need prior coding experience to join this Full Stack program?", 
        a: "No prior coding experience is required. The program starts from the very basics of HTML, CSS, and JavaScript before progressing to advanced topics like React, Node.js, and MongoDB." 
    },
    { 
        q: "Is this Full Stack Web Development certification globally recognized?", 
        a: "Yes, our certification is recognized by top tech companies worldwide and adds significant value to your resume when applying for global remote or on-site roles." 
    },
    { 
        q: "Will I get help with job placement after completing the MERN stack course?", 
        a: "Absolutely! We provide 100% placement assistance, which includes resume building, mock interviews, portfolio creation, and direct referrals to our hiring partners." 
    },
    { 
        q: "What kind of projects will I build during the training?", 
        a: "You will build several industry-grade projects, including an E-commerce platform, a Social Media dashboard, and a real-time chat application using the complete MERN stack." 
    },
    { 
        q: "How long does it take to complete the Full Stack Development course?", 
        a: "The course typically takes 3 to 4 months to complete, depending on the batch schedule and your pace of learning. This includes hands-on projects and interview preparation." 
    },
    { 
        q: "Are the training sessions live or pre-recorded?", 
        a: "We offer interactive live training sessions with expert mentors. You will also get access to the recorded videos of your live sessions for lifetime revision." 
    },
    { 
        q: "What happens if I miss a live session?", 
        a: "If you miss a session, you don't need to worry. Recordings of all live classes are uploaded to your student portal immediately after the class ends." 
    },
    { 
        q: "Do you provide doubt-clearing sessions?", 
        a: "Yes, we have dedicated 1-on-1 doubt clearing sessions, a community support channel, and teaching assistants available to help you whenever you get stuck." 
    }
];

async function updateCourseFaqs() {
    try {
        console.log("Fetching courses...");
        const [rows] = await pool.query("SELECT id, title, content FROM courses WHERE title LIKE '%Full Stack%' OR title LIKE '%MERN%' LIMIT 1");
        
        if (rows.length === 0) {
            console.log("No matching course found.");
            process.exit(0);
        }
        
        const course = rows[0];
        let content = typeof course.content === 'string' ? JSON.parse(course.content) : course.content;
        
        // Update FAQs
        content.faqs = faqs;
        
        // Ensure certificationQs is either removed or synced so it doesn't conflict
        content.certificationQs = faqs;
        
        const updatedContent = JSON.stringify(content);
        
        await pool.query("UPDATE courses SET content = ? WHERE id = ?", [updatedContent, course.id]);
        console.log(`Successfully updated course FAQs: ${course.title} with 8 dynamic FAQs!`);
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

updateCourseFaqs();
