const pool = require('../config/dbConfig');

const BASE_INDUSTRIES = [
  {
    category: "BPM / ITES",
    subcategories: ["Analytics / KPO / Research", "BPM / BPO", "Customer Experience & Support", "Financial Process Outsourcing", "Technical Support & Helpdesk", "Data Annotation & AI Labeling", "Medical Transcription"]
  },
  {
    category: "IT Services & Consulting",
    subcategories: ["Software Services", "Cloud Consulting", "Systems Integration", "Managed IT Services", "Cybersecurity Consulting", "ERP & CRM Implementation", "Quality Assurance & Testing"]
  },
  {
    category: "Software Product & SaaS",
    subcategories: ["Enterprise SaaS", "B2B Applications", "B2C Mobile & Web Apps", "Cloud Platforms", "Developer Tools", "Productivity Software", "FinTech Platforms", "EdTech Platforms", "HRTech Platforms"]
  },
  {
    category: "Technology & Emerging Tech",
    subcategories: ["AI / Machine Learning", "Generative AI & LLMs", "Data Science & Big Data", "Cloud Architecture & DevOps", "Cybersecurity & InfoSec", "Blockchain & Web3", "AR / VR Development", "Robotics & Automation", "IoT & Connected Devices"]
  },
  {
    category: "Hardware & Semiconductors",
    subcategories: ["VLSI & Chip Design", "Embedded Systems", "Hardware Design", "Semiconductor Fabrication", "ASIC / FPGA Development", "PCB Design", "Microelectronics"]
  },
  {
    category: "Electronics & Electrical Manufacturing",
    subcategories: ["Consumer Electronics", "Industrial Electronics", "Power Electronics", "Smart Appliances", "Automation Systems", "Electrical Equipment", "Semiconductor Devices"]
  },
  {
    category: "Banking & Financial Services",
    subcategories: ["FinTech & Digital Payments", "Commercial & Retail Banking", "Investment Banking", "Wealth Management & Private Banking", "Insurance (Life, General, Health)", "NBFC & Microfinance", "Asset Management", "Risk Management & Compliance", "Credit & Lending", "Stock Broking & Trading"]
  },
  {
    category: "Healthcare & Hospitals",
    subcategories: ["Hospitals & Healthcare Centers", "Physicians & Surgeons", "Nursing & Patient Care", "Medical Diagnostics & Pathology", "Telemedicine & Digital Health", "Healthcare Administration", "Medical Devices & Equipment"]
  },
  {
    category: "Pharmaceuticals & Biotechnology",
    subcategories: ["Drug Discovery & Development", "Clinical Research (CRO)", "Formulation & Manufacturing", "Regulatory Affairs & QA", "Biotechnology & Genomics", "API & Bulk Drugs"]
  },
  {
    category: "E-Commerce & Retail",
    subcategories: ["Online Marketplaces & D2C", "Retail Store Operations", "Quick Commerce & Delivery", "Category Management & Merchandising", "Fashion & Apparel", "Consumer Electronics Retail", "Supermarkets & FMCG Retail"]
  },
  {
    category: "Consumer Goods & FMCG",
    subcategories: ["Packaged Foods & Beverages", "Personal Care & Cosmetics", "Household Cleaning Products", "Consumer Durables", "Brand Marketing & Distribution"]
  },
  {
    category: "Automotive & Transportation",
    subcategories: ["Automobile OEMs", "Electric Vehicles (EV) & Battery Tech", "Auto Components & Parts", "Autonomous Driving Systems", "Two-Wheelers & Commercial Vehicles", "Fleet Management"]
  },
  {
    category: "Engineering, Manufacturing & Industrial",
    subcategories: ["Heavy Machinery & Equipment", "Mechanical & Plant Engineering", "Precision Tooling & Fabrication", "Process Manufacturing", "Industrial Automation & PLC", "Metallurgy & Steel"]
  },
  {
    category: "Telecommunications & Networking",
    subcategories: ["5G / 4G Telecom Service Providers", "Optical Fiber & Network Infrastructure", "Network Engineering & RF", "Satellite Communications", "Unified Communications & VoIP"]
  },
  {
    category: "Education, EdTech & Academia",
    subcategories: ["EdTech & Online Learning Platforms", "Higher Education & Universities", "K-12 Schools & Institutes", "Vocational & Skill Training", "Corporate Training & Coaching", "Academic Research"]
  },
  {
    category: "Media, Entertainment & Gaming",
    subcategories: ["Digital Media & Publishing", "Film & TV Production", "OTT & Streaming Platforms", "Video Game Development", "Animation & VFX", "Advertising & Creative Agencies", "Public Relations (PR)"]
  },
  {
    category: "Construction, Real Estate & Architecture",
    subcategories: ["Architecture & Interior Design", "Residential Real Estate", "Commercial Real Estate", "Civil Engineering & Infrastructure", "Property & Facility Management", "Urban Planning"]
  },
  {
    category: "Logistics, Supply Chain & Warehousing",
    subcategories: ["3PL & 4PL Logistics", "Freight Forwarding & Cargo", "Warehousing & Cold Chain", "Port & Marine Shipping", "Express Courier & Last-Mile Delivery"]
  },
  {
    category: "Energy, Power, Oil & Gas",
    subcategories: ["Renewable Energy (Solar & Wind)", "Oil & Gas Exploration (Upstream)", "Petroleum Refining & Petrochemicals", "Power Generation & Grid Distribution", "CleanTech & Sustainability"]
  },
  {
    category: "Aerospace & Aviation",
    subcategories: ["Commercial Aviation & Airlines", "Aircraft Maintenance (MRO)", "Aerospace Engineering", "Space Technology & Satellites", "Airport Operations & Ground Handling"]
  },
  {
    category: "Hospitality, Travel & Tourism",
    subcategories: ["Hotels, Resorts & Hospitality", "Travel Agencies & Tour Operators", "Aviation Hospitality", "Food & Beverage (F&B) / Restaurants", "Events & Conferences (MICE)"]
  },
  {
    category: "Professional Consulting & Legal",
    subcategories: ["Strategy & Management Consulting", "Legal Practices & Law Firms", "Corporate Taxation & Auditing", "HR & Executive Recruitment", "Intellectual Property (IP) & Patents"]
  },
  {
    category: "Agriculture, Dairy & Food Processing",
    subcategories: ["AgriTech & Smart Farming", "Crop Protection & Fertilizers", "Dairy & Livestock Farming", "Food Processing & Cold Storage", "Organic Agriculture"]
  },
  {
    category: "Government, Defense & Non-Profit",
    subcategories: ["Public Sector Undertakings (PSU)", "Defense & Military Equipment", "Non-Governmental Organizations (NGO)", "Foundations & Social Impact", "Regulatory & Standards Bodies"]
  }
];

async function run() {
  const [jobCat] = await pool.query('SELECT category_name FROM job_categories WHERE category_name IS NOT NULL');
  const catNames = jobCat.map(c => c.category_name.trim()).filter(Boolean);

  const formatted = BASE_INDUSTRIES.map(ind => ({
    category: ind.category,
    count: ind.subcategories.length,
    subcategories: ind.subcategories
  }));

  // Also create a "Domain Specializations & Job Roles" category with the DB categories
  const dbSubcategories = Array.from(new Set(catNames)).sort();
  formatted.push({
    category: "Other Specialized Domains",
    count: dbSubcategories.length,
    subcategories: dbSubcategories
  });

  console.log('Total industry categories:', formatted.length);
  console.log('Categories list:', formatted.map(f => `${f.category} (${f.count})`));
  process.exit();
}

run();
