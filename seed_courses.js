const db = require("./config/dbConfig");

const generateCourseContent = (course) => {
    const standardPractice = {
        title: "AI-Powered Practice Interviews",
        subtitle: "Master your interview skills with our advanced AI feedback system.",
        features: [
            "Unlimited mock interviews with AI",
            "Real-time feedback on confidence & tone",
            "Technical assessment with 500+ questions",
            "Detailed performance reports after each session"
        ]
    };

    const standardWorkflow = {
        title: "3x your chances of getting selected",
        subtitle: "Our automated workflow ensures you stand out to top recruiters.",
        steps: [
            { icon: "FaFileAlt", title: "Smart Resume Builder", desc: "Get an ATS-optimized resume tailored for your target role.", tag: "ATS READY" },
            { icon: "FaLaptopCode", title: "Skill Assessments", desc: "Prove your expertise with verified technical tests.", tag: "VERIFIED" },
            { icon: "FaRocket", title: "Priority Application", desc: "Your profile gets highlighted to our 180K+ hiring partners.", tag: "PRIORITY" }
        ]
    };

    const standardCertification = {
        title: "Professional Certification",
        description: "Receive a verified, shareable certificate that validates your expertise to employers worldwide. Our credentials are recognized by top tech giants and startups alike.",
        features: [
            "Shareable on LinkedIn & Professional Resumes",
            "Unique Verification Credential ID",
            "Endorsed by Industry Leaders",
            "PDF & Physical Certificate Options"
        ]
    };

    const standardFaqs = [
        { q: "What are the prerequisites for this course?", a: "Most of our courses start from absolute basics, so no prior experience is required. However, basic computer literacy is helpful." },
        { q: "Is this course completely online?", a: "Yes, the training is 100% online, allowing you to learn at your own pace from anywhere." },
        { q: "Will I get placement assistance?", a: "Absolutely! We provide resume building, mock interviews, and direct access to our hiring platform." },
        { q: "Can I access the content after completion?", a: "Yes, you get lifetime access to the recorded sessions and course materials." },
        { q: "What if I have doubts during the course?", a: "You can use our dedicated 24/7 doubt-clearing forum or attend live Q&A sessions with mentors." }
    ];

    const standardReviews = [
        { name: "Ananya Iyer", role: "Junior Developer at TCS", text: "The hands-on projects were a game changer. I felt confident during my interviews because I had real work to show.", img: "https://i.pravatar.cc/150?u=ananya" },
        { name: "Vikram Singh", role: "Data Analyst at Amazon", text: "Exceptional curriculum. The instructors break down complex topics into very digestible pieces. Highly recommended!", img: "https://i.pravatar.cc/150?u=vikram" },
        { name: "Sarah Khan", role: "Product Manager at Swiggy", text: "The career support team is amazing. They helped me refine my resume and prepared me for tough behavioral questions.", img: "https://i.pravatar.cc/150?u=sarah" }
    ];

    const standardHowItWorks = {
        title: "How it works?",
        subtitle: "A simple 4-step process to launch your career.",
        steps: [
            { icon: "FaLaptopCode", title: "Learn Concepts", desc: "Learn from industry experts through structured video tutorials and live masterclasses." },
            { icon: "FaRocket", title: "Build Projects", desc: "Apply your learning by building real-world projects and assignments." },
            { icon: "FaCertificate", title: "Get Certified", desc: "Clear the final exam to get your verified certificate and showcase your skills." },
            { icon: "FaBriefcase", title: "Get Placed", desc: "Get access to top internships and jobs with profile boost and placement support." }
        ]
    };

    return {
        hero: {
            subtitle: course.subtitle,
            highlights: [
                { text: "Placement Guarantee", subtext: "Get a job or 100% refund" },
                { text: "1:1 Mentorship", subtext: "Personalized guidance from experts" },
                { text: "Hands-on Projects", subtext: "Build industry-ready portfolio" }
            ],
            prices: {
                discounted: course.discountedPrice,
                original: course.originalPrice,
                expiry: "May 25th, 2026",
                benefits: ["Lifetime Access", "Industry Certificate", "Mock Interviews", "Resume Review"]
            }
        },
        benefits: {
            title: "Why this launchpad?",
            subtitle: "Everything you need to go from a beginner to a job-ready professional.",
            items: course.benefits
        },
        practice: standardPractice,
        workflow: standardWorkflow,
        curriculum: course.curriculum,
        projects: course.projects,
        comparison: {
            title: "What changes after this program?",
            subtitle: "See your transformation from a learner to an industry professional.",
            before: course.before,
            after: course.after
        },
        certification: standardCertification,
        faqs: standardFaqs,
        reviews: standardReviews,
        howItWorks: standardHowItWorks
    };
};

const rawCourses = [
    {
        title: "Master MERN Stack: Complete Full Stack Web Development Course [2026]",
        description: "Learn full stack web development from scratch. Master MongoDB, Express.js, React, and Node.js to build and deploy real-world web applications.",
        slug: "full-stack-web-development",
        category: "Tech",
        image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
        subtitle: "Become an expert full stack developer with our comprehensive MERN stack course. Learn to build scalable, high-performance web applications using MongoDB, Express, React, and Node.js.",
        discountedPrice: "4,999",
        originalPrice: "9,999",
        benefits: [
            { icon: "FaLaptopCode", title: "MERN Stack Mastery", desc: "Deep dive into frontend and backend development with JavaScript." },
            { icon: "FaRocket", title: "Real-World Projects", desc: "Build enterprise-level apps like E-commerce and Social Networks." },
            { icon: "FaUserTie", title: "Career & Placement", desc: "Get interview preparation, resume building, and priority hiring access." }
        ],
        curriculum: [
            { title: "Module 1: HTML5, CSS3 & Responsive Web Design", content: "Master UI/UX fundamentals, CSS Grid, Flexbox, and modern web design principles." },
            { title: "Module 2: Advanced JavaScript (ES6+)", content: "Deep dive into Async/Await, Promises, Closures, OOP, and DOM manipulation." },
            { title: "Module 3: React.js Frontend Development", content: "Learn React Hooks, Redux state management, React Router, and Component Architecture." },
            { title: "Module 4: Node.js & Express.js Backend API", content: "Build secure RESTful APIs, implement JWT authentication, and handle server logic." },
            { title: "Module 5: MongoDB & NoSQL Databases", content: "Master Mongoose ODM, data modeling, aggregation framework, and database performance optimization." },
            { title: "Module 6: Full Stack Deployment & DevOps", content: "Deploy MERN applications on AWS/Heroku, CI/CD pipelines, and web security best practices." }
        ],
        projects: [
            { icon: "🛍️", title: "Full-Stack E-commerce Platform", desc: "Build a scalable online store with React, Redux, Stripe payments, and Admin panel." },
            { icon: "🗨️", title: "Real-time Social Chat App", desc: "Implement Socket.io for instant messaging, user authentication, and live notifications." },
            { icon: "🎬", title: "Movie Search Engine", desc: "Integrate third-party APIs with React to create a dynamic movie discovery platform." }
        ],
        before: ["Confusion with modern JavaScript frameworks", "Struggling to connect frontend with backend", "Lack of real-world portfolio projects", "Difficulty clearing technical interviews"],
        after: ["Expert in MERN stack development", "Ability to build complete web applications independently", "Portfolio with 5+ premium full stack apps", "Confident and job-ready for developer roles"]
    },
    {
        title: "Data Science & Machine Learning",
        description: "Learn Python, R, and build predictive models.",
        slug: "data-science-machine-learning",
        category: "Tech",
        image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71",
        subtitle: "Harness the power of data. Master Python, statistics, and advanced Machine Learning algorithms.",
        discountedPrice: "5,499",
        originalPrice: "12,999",
        benefits: [
            { icon: "FaChartLine", title: "Predictive Modeling", desc: "Learn to forecast trends with high accuracy." },
            { icon: "FaLightbulb", title: "Business Insights", desc: "Turn raw data into actionable intelligence for CEOs." },
            { icon: "FaUsers", title: "Large Datasets", desc: "Work with real-world big data from Netflix and Amazon." }
        ],
        curriculum: [
            { title: "Module 1: Python for Data Science", content: "NumPy, Pandas, and Matplotlib for data processing." },
            { title: "Module 2: Statistics & Probability", content: "Core mathematical concepts for data analysis." },
            { title: "Module 3: Supervised Learning", content: "Regression, Decision Trees, and Support Vector Machines." },
            { title: "Module 4: Unsupervised Learning", content: "Clustering, PCA, and Anomaly Detection." },
            { title: "Module 5: Deep Learning Essentials", content: "Neural Networks and TensorFlow basics." },
            { title: "Module 6: Data Visualization", content: "Creating impactful stories with Tableau and Seaborn." }
        ],
        projects: [
            { icon: "📊", title: "Housing Price Predictor", desc: "ML model to predict real estate prices with 95% accuracy." },
            { icon: "🧠", title: "Sentimental Analysis", desc: "Analyze millions of tweets to gauge brand sentiment." },
            { icon: "🏥", title: "Disease Prediction", desc: "Build an AI model to detect early-stage illnesses." }
        ],
        before: ["Drowning in raw, unused data", "Manual, error-prone analysis", "No knowledge of AI/ML", "Stagnant career in analytics"],
        after: ["Certified Data Scientist", "Automated, AI-driven workflows", "Expert in predictive modeling", "High-growth career path"]
    },
    {
        title: "Digital Marketing Masterclass",
        description: "SEO, SEM, Social Media Marketing, and Analytics.",
        slug: "digital-marketing-masterclass",
        category: "Marketing",
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f",
        subtitle: "Scale businesses to new heights. Master SEO, PPC, and Social Media strategies.",
        discountedPrice: "2,999",
        originalPrice: "7,999",
        benefits: [
            { icon: "FaChartLine", title: "ROI Driven Marketing", desc: "Learn to get maximum results with minimum spend." },
            { icon: "FaUsers", title: "Social Media Growth", desc: "Master the algorithms of Instagram, TikTok, and LinkedIn." },
            { icon: "FaBriefcase", title: "Live Campaigns", desc: "Run real ads on Google and Meta during the course." }
        ],
        curriculum: [
            { title: "Module 1: Marketing Fundamentals", content: "Understanding consumer psychology and branding." },
            { title: "Module 2: SEO Masterclass", content: "Keyword research, technical SEO, and link building." },
            { title: "Module 3: Content Marketing", content: "Writing copy that converts and content strategy." },
            { title: "Module 4: Paid Search (SEM)", content: "Mastering Google Ads and PPC campaigns." },
            { title: "Module 5: Social Media Ads", content: "Scaling with Meta, LinkedIn, and Twitter Ads." },
            { title: "Module 6: Marketing Analytics", content: "Google Analytics 4 and tracking conversion goals." }
        ],
        projects: [
            { icon: "🚀", title: "Brand Launch Campaign", desc: "Plan and execute a 360-degree digital launch." },
            { icon: "🔍", title: "SEO Audit Pro", desc: "Perform a deep technical audit for a major website." },
            { icon: "💰", title: "Lead Gen Engine", desc: "Build a funnel that generates 500+ leads per month." }
        ],
        before: ["Low visibility for your brand", "Wasting money on ineffective ads", "Zero organic traffic", "Outdated marketing skills"],
        after: ["Digital Marketing Strategist", "High-ROI campaign specialist", "SEO & Content Authority", "Data-driven marketing expert"]
    },
    {
        title: "UI/UX Design Professional",
        description: "Design stunning user interfaces and experiences.",
        slug: "ui-ux-design-professional",
        category: "Design",
        image: "https://images.unsplash.com/photo-1586717791821-3f44a563eb4c",
        subtitle: "Create products that people love. Master Figma, wireframing, and user-centric design.",
        discountedPrice: "3,999",
        originalPrice: "8,999",
        benefits: [
            { icon: "FaLaptopCode", title: "Figma Mastery", desc: "Complete command over the industry's #1 design tool." },
            { icon: "FaUsers", title: "User Research", desc: "Learn to conduct interviews and usability tests." },
            { icon: "FaRocket", title: "Design Systems", desc: "Build scalable UI kits and component libraries." }
        ],
        curriculum: [
            { title: "Module 1: Intro to UX Design", content: "Core principles of user experience and empathy mapping." },
            { title: "Module 2: User Research", content: "Surveys, interviews, and persona creation." },
            { title: "Module 3: Wireframing", content: "Low-fidelity and high-fidelity wireframing in Figma." },
            { title: "Module 4: Visual Design (UI)", content: "Typography, color theory, and layout principles." },
            { title: "Module 5: Prototyping", content: "Creating interactive and animated prototypes." },
            { title: "Module 6: Portfolio Building", content: "Case study writing and Behance/Dribbble optimization." }
        ],
        projects: [
            { icon: "📱", title: "Fintech App Design", desc: "A modern banking app focused on simplicity." },
            { icon: "💻", title: "SaaS Dashboard", desc: "Complex data visualization design for enterprises." },
            { icon: "🍔", title: "Food Delivery App", desc: "End-to-end UX case study for a delivery service." }
        ],
        before: ["Ugly, unusable interfaces", "Designing without user input", "Slow design workflow", "Weak design portfolio"],
        after: ["Professional UI/UX Designer", "User-centered design approach", "Rapid Figma workflow", "Stunning portfolio with 3 case studies"]
    },
    {
        title: "Product Management 101",
        description: "Learn the art of building successful products.",
        slug: "product-management-101",
        category: "Business",
        image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
        subtitle: "Become the CEO of the product. Learn to build, launch, and scale successful tech products.",
        discountedPrice: "4,499",
        originalPrice: "10,999",
        benefits: [
            { icon: "FaBriefcase", title: "Agile Leadership", desc: "Master Scrum, Kanban, and product development cycles." },
            { icon: "FaChartLine", title: "Metrics & Growth", desc: "Learn to track North Star metrics and user retention." },
            { icon: "FaComments", title: "Stakeholder Management", desc: "Coordinate between engineering, design, and business." }
        ],
        curriculum: [
            { title: "Module 1: Product Strategy", content: "Market research, competitor analysis, and vision." },
            { title: "Module 2: User Stories & PRDs", content: "Writing detailed requirements for developers." },
            { title: "Module 3: Agile Development", content: "Working with sprints and engineering teams." },
            { title: "Module 4: Product Analytics", content: "A/B testing, Mixpanel, and data-driven decisions." },
            { title: "Module 5: Launch & GTM", content: "Go-to-market strategies and product marketing." },
            { title: "Module 6: Technical for PMs", content: "Understanding APIs, Databases, and System Design." }
        ],
        projects: [
            { icon: "📑", title: "PRD for a New Feature", desc: "Write a full Product Requirements Document." },
            { icon: "🗺️", title: "Product Roadmap", desc: "Create a 12-month strategic roadmap." },
            { icon: "📈", title: "Retention Strategy", desc: "Analyze churn and design a retention loop." }
        ],
        before: ["Confusion about PM roles", "Inability to talk to engineers", "No strategic vision", "Weak resume for tech roles"],
        after: ["Certified Product Manager", "Strategic, data-driven leader", "Confident stakeholder manager", "High-demand tech professional"]
    },
    {
        title: "Artificial Intelligence for Business",
        description: "Leverage AI to drive business growth and efficiency.",
        slug: "ai-for-business",
        category: "Business",
        image: "https://images.unsplash.com/photo-1677442136019-21780ecad995",
        subtitle: "Don't just watch the AI revolution—lead it. Transform your business with GenAI and Automation.",
        discountedPrice: "6,999",
        originalPrice: "15,999",
        benefits: [
            { icon: "FaRocket", title: "AI Automation", desc: "Automate 50% of your daily business tasks with AI." },
            { icon: "FaLightbulb", title: "GenAI Strategy", desc: "Master ChatGPT, Midjourney, and LLM integrations." },
            { icon: "FaChartLine", title: "Cost Reduction", desc: "Use AI to cut operational costs significantly." }
        ],
        curriculum: [
            { title: "Module 1: AI Fundamentals", content: "How AI, ML, and Deep Learning work." },
            { title: "Module 2: Generative AI Mastery", content: "Prompt engineering for ChatGPT, Claude, and Gemini." },
            { title: "Module 3: AI for Productivity", content: "Automating emails, reports, and scheduling." },
            { title: "Module 4: AI in Marketing & Sales", content: "AI-driven content and lead generation." },
            { title: "Module 5: Custom AI Solutions", content: "Building custom GPTs and AI workflows." },
            { title: "Module 6: AI Ethics & Future", content: "Managing bias and staying ahead of trends." }
        ],
        projects: [
            { icon: "🤖", title: "Custom AI Assistant", desc: "Build a tailored GPT for a specific industry." },
            { icon: "⚡", title: "Automation Workflow", desc: "Create an AI-driven automated sales funnel." },
            { icon: "🖼️", title: "AI Brand Kit", desc: "Generate full brand visuals using GenAI tools." }
        ],
        before: ["Fear of AI replacement", "Slow, manual business processes", "No knowledge of AI tools", "Losing competitive edge"],
        after: ["AI-First Professional", "Highly efficient automated workflow", "Expert in GenAI tools", "Leading the AI transformation"]
    },
    {
        title: "Blockchain & Web3 Development",
        description: "Build decentralized applications and smart contracts.",
        slug: "blockchain-web3-development",
        category: "Tech",
        image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0",
        subtitle: "The internet is evolving. Master Solidity, Ethereum, and build the decentralized future.",
        discountedPrice: "7,499",
        originalPrice: "18,999",
        benefits: [
            { icon: "FaLaptopCode", title: "Solidity Expertise", desc: "Write secure, optimized smart contracts." },
            { icon: "FaRocket", title: "Web3 Full Stack", desc: "Connect React frontends to the Blockchain." },
            { icon: "FaCheckCircle", title: "Security Auditing", desc: "Learn to find vulnerabilities in dApps." }
        ],
        curriculum: [
            { title: "Module 1: Blockchain Basics", content: "Bitcoin, Ethereum, and Consensus mechanisms." },
            { title: "Module 2: Solidity Programming", content: "Syntax, variables, and smart contract logic." },
            { title: "Module 3: Advanced Smart Contracts", content: "Inheritance, Libraries, and Gas optimization." },
            { title: "Module 4: Truffle & Hardhat", content: "Development environments for Ethereum." },
            { title: "Module 5: Web3.js & Ethers.js", content: "Integrating Blockchain with Web apps." },
            { title: "Module 6: DeFi & NFTs", content: "Building decentralized exchanges and NFT marketplaces." }
        ],
        projects: [
            { icon: "💎", title: "NFT Marketplace", desc: "Build a full platform to mint and trade NFTs." },
            { icon: "🏦", title: "DeFi Lending App", desc: "Create a decentralized lending protocol." },
            { icon: "🗳️", title: "DAO Voting System", desc: "A transparent governance system on-chain." }
        ],
        before: ["Only basic crypto knowledge", "Inability to code for Web3", "Missing out on high-pay tech roles", "Confused by decentralization"],
        after: ["Certified Web3 Developer", "Full Stack Blockchain engineer", "Expert in Smart Contract security", "Top-tier tech professional"]
    },
    {
        title: "Human Resource Management",
        description: "Master talent acquisition and organizational behavior.",
        slug: "human-resource-management",
        category: "Management",
        image: "https://images.unsplash.com/photo-1521791136064-7986c2923216",
        subtitle: "Master the human element. Learn modern recruitment, retention, and HR analytics.",
        discountedPrice: "2,499",
        originalPrice: "5,999",
        benefits: [
            { icon: "FaUsers", title: "Talent Acquisition", desc: "Learn to hire the best talent using AI tools." },
            { icon: "FaChartLine", title: "HR Analytics", desc: "Use data to improve employee retention." },
            { icon: "FaComments", title: "Org. Behavior", desc: "Master conflict resolution and company culture." }
        ],
        curriculum: [
            { title: "Module 1: Strategic HR", content: "Strategic Human Resource Management involves aligning HR goals with the overall business strategy to drive organizational success. In this module, you will learn how to identify critical talent needs, develop comprehensive workforce planning strategies, and implement HR initiatives that directly support the company's long-term objectives. We will cover topics like competitive advantage through people, organizational structure, and leveraging HR analytics as a strategic decision-making tool." },
            { title: "Module 2: Recruitment & Sourcing", content: "Modern sourcing on LinkedIn and AI platforms." },
            { title: "Module 3: Training & Development", content: "Building effective learning programs." },
            { title: "Module 4: Compensation & Benefits", content: "Payroll, bonuses, and statutory compliance." },
            { title: "Module 5: Employee Relations", content: "Labor laws, ethics, and workplace culture." },
            { title: "Module 6: HR Dashboarding", content: "Tracking HR metrics in Excel and PowerBI." }
        ],
        projects: [
            { icon: "📝", title: "Recruitment Strategy", desc: "Design a full hiring funnel for a startup." },
            { icon: "📊", title: "Retention Analysis", desc: "Analyze turnover data and propose solutions." },
            { icon: "🤝", title: "Cultural Handbook", desc: "Build a modern company culture manual." }
        ],
        before: ["Manual, paper-based HR", "Low employee engagement", "Traditional, slow hiring", "Lack of data in HR decisions"],
        after: ["Modern HR Leader", "Data-driven talent manager", "Expert in company culture", "Strategic HR partner"]
    },
    {
        title: "Business Analytics & Visualization",
        description: "Turn data into actionable business insights.",
        slug: "business-analytics",
        category: "Business",
        image: "https://images.unsplash.com/photo-1543286386-713bdd548da4",
        subtitle: "Bridge the gap between data and decisions. Master SQL, Tableau, and Excel.",
        discountedPrice: "4,299",
        originalPrice: "11,499",
        benefits: [
            { icon: "FaChartLine", title: "Decision Intelligence", desc: "Learn to make calls backed by hard data." },
            { icon: "FaLaptopCode", title: "Technical Stack", desc: "Master SQL, PowerBI, Tableau, and Python." },
            { icon: "FaLightbulb", title: "Storytelling", desc: "Present data in ways that convince stakeholders." }
        ],
        curriculum: [
            { title: "Module 1: Analytics Foundations", content: "Understanding business problems and data." },
            { title: "Module 2: SQL for Analytics", content: "Querying, joining, and aggregating datasets." },
            { title: "Module 3: Excel Advanced", content: "Pivot tables, VLOOKUP, and business models." },
            { title: "Module 4: Visualization with Tableau", content: "Building interactive, stunning dashboards." },
            { title: "Module 5: Visualization with PowerBI", content: "Microsoft's ecosystem for BI." },
            { title: "Module 6: Statistical Analysis", content: "Hypothesis testing and correlation in business." }
        ],
        projects: [
            { icon: "🏪", title: "Retail Sales Dashboard", desc: "Analyze sales performance across 500+ stores." },
            { icon: "💳", title: "Customer Churn Model", desc: "Identify which customers are likely to leave." },
            { icon: "🌐", title: "Market Trend Analysis", desc: "Predict future market shifts using historical data." }
        ],
        before: ["Decisions based on gut feeling", "Inability to use complex data", "Struggling with slow spreadsheets", "No visualization skills"],
        after: ["Business Analytics Expert", "Data-backed decision maker", "Master of BI tools", "Strategic growth analyst"]
    },
    {
        title: "Advanced Excel for Professionals",
        description: "Become an Excel power user for any industry.",
        slug: "advanced-excel",
        category: "Management",
        image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97",
        subtitle: "Stop wasting hours on manual tasks. Master Macros, VBA, and complex formulas.",
        discountedPrice: "1,499",
        originalPrice: "3,999",
        benefits: [
            { icon: "FaRocket", title: "Extreme Efficiency", desc: "Save 10+ hours every week with automation." },
            { icon: "FaLaptopCode", title: "VBA Programming", desc: "Learn to write code to make Excel work for you." },
            { icon: "FaChartLine", title: "Financial Modeling", desc: "Build professional valuation and budget models." }
        ],
        curriculum: [
            { title: "Module 1: Advanced Formulas", content: "INDEX-MATCH, OFFSET, and Array functions." },
            { title: "Module 2: Data Cleaning Master", content: "Power Query and Text-to-columns expert." },
            { title: "Module 3: Pivot Tables Pro", content: "Slicers, Timelines, and Calculated Fields." },
            { title: "Module 4: Introduction to VBA", content: "Recording and editing basic macros." },
            { title: "Module 5: Advanced VBA/Programming", content: "Writing custom functions and automation scripts." },
            { title: "Module 6: Dynamic Dashboards", content: "Building one-click updated reports." }
        ],
        projects: [
            { icon: "💰", title: "Automated Budget Tool", desc: "A self-updating budget manager for SMEs." },
            { icon: "🏦", title: "Investment Tracker", desc: "Live stock/crypto tracker with auto-refresh." },
            { icon: "🏭", title: "Inventory Management", desc: "Stock tracking system with low-stock alerts." }
        ],
        before: ["Hours spent on manual data entry", "Confused by complex formulas", "Static, boring spreadsheets", "No knowledge of automation"],
        after: ["Excel Power User", "Automation & Macro expert", "Professional dashboard builder", "Highly efficient office hero"]
    }
];

async function seed() {
    console.log("Seeding SUPER DETAILED full-page content...");
    for (const rawCourse of rawCourses) {
        try {
            const courseContent = generateCourseContent(rawCourse);

            const [existing] = await db.execute("SELECT id FROM courses WHERE slug = ?", [rawCourse.slug]);

            if (existing.length > 0) {
                const sql = "UPDATE courses SET title=?, description=?, category=?, image=?, content=? WHERE slug=?";
                const params = [
                    rawCourse.title,
                    rawCourse.description,
                    rawCourse.category,
                    rawCourse.image,
                    JSON.stringify(courseContent),
                    rawCourse.slug
                ];
                await db.execute(sql, params);
                console.log(`Fully Seeded: ${rawCourse.title}`);
            } else {
                const sql = "INSERT INTO courses (title, description, slug, category, image, content) VALUES (?, ?, ?, ?, ?, ?)";
                const params = [
                    rawCourse.title,
                    rawCourse.description,
                    rawCourse.slug,
                    rawCourse.category,
                    rawCourse.image,
                    JSON.stringify(courseContent)
                ];
                await db.execute(sql, params);
                console.log(`Added & Seeded: ${rawCourse.title}`);
            }
        } catch (err) {
            console.error(`Error processing ${rawCourse.title}:`, err.message);
        }
    }
    console.log("Super Seeding complete!");
    process.exit(0);
}

seed();
