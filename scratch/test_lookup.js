const pool = require('../config/dbConfig');

async function lookupCompanies(query = "") {
  const cleanQuery = (query || "").trim();
  let dbCompanies = [];

  if (cleanQuery) {
    const [rows] = await pool.query(`
      SELECT DISTINCT company_name FROM (
        SELECT TRIM(company_name) as company_name FROM hr_profiles WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
        UNION
        SELECT TRIM(company_name) as company_name FROM job_post WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
        UNION
        SELECT TRIM(company_name) as company_name FROM user_professional WHERE is_deleted = 0 AND company_name IS NOT NULL AND TRIM(company_name) != ''
      ) as all_companies
      WHERE company_name LIKE ?
      ORDER BY company_name ASC
      LIMIT 30
    `, [`%${cleanQuery}%`]);
    dbCompanies = rows.map(r => r.company_name.trim()).filter(Boolean);
  } else {
    const [rows] = await pool.query(`
      SELECT DISTINCT company_name FROM (
        SELECT TRIM(company_name) as company_name FROM hr_profiles WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
        UNION
        SELECT TRIM(company_name) as company_name FROM job_post WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
        UNION
        SELECT TRIM(company_name) as company_name FROM user_professional WHERE is_deleted = 0 AND company_name IS NOT NULL AND TRIM(company_name) != ''
      ) as all_companies
      ORDER BY company_name ASC
      LIMIT 40
    `);
    dbCompanies = rows.map(r => r.company_name.trim()).filter(Boolean);
  }

  let internetCompanies = [];
  if (cleanQuery.length >= 2) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(cleanQuery)}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          internetCompanies = data.map(item => ({
            name: item.name?.trim(),
            domain: item.domain || null,
            logo: item.logo || (item.domain ? `https://logo.clearbit.com/${item.domain}` : null),
            source: "Global / Internet"
          })).filter(c => c.name);
        }
      }
    } catch (e) {}
  }

  const seen = new Set();
  const combined = [];

  dbCompanies.forEach(name => {
    const lower = name.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      combined.push({
        name,
        domain: null,
        logo: null,
        isRegistered: true,
        source: "Careerfast Registered"
      });
    }
  });

  internetCompanies.forEach(item => {
    const lower = item.name.toLowerCase();
    const existing = combined.find(c => c.name.toLowerCase() === lower);
    if (existing) {
      existing.domain = item.domain || existing.domain;
      existing.logo = item.logo || existing.logo;
    } else if (!seen.has(lower)) {
      seen.add(lower);
      combined.push({
        name: item.name,
        domain: item.domain,
        logo: item.logo,
        isRegistered: false,
        source: "Global / Internet"
      });
    }
  });

  return combined;
}

async function test() {
  console.log('--- Empty query (initial registered companies) ---');
  const emptyRes = await lookupCompanies('');
  console.log('Count:', emptyRes.length, 'Sample:', emptyRes.slice(0, 5));

  console.log('--- Query "mic" ---');
  const micRes = await lookupCompanies('mic');
  console.log('Mic count:', micRes.length, 'Sample:', micRes.slice(0, 5));

  console.log('--- Query "ACTE" ---');
  const acteRes = await lookupCompanies('ACTE');
  console.log('ACTE count:', acteRes.length, 'Results:', acteRes);

  process.exit();
}

test();
