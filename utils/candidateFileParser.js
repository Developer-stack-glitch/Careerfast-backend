const xlsx = require('xlsx');
let PDFParse;
try {
  const pdfModule = require('pdf-parse');
  PDFParse = pdfModule.PDFParse || pdfModule;
} catch (e) {
  // pdf-parse optional fallback
}

// ── Value Normalizers ──

function cleanEmail(val) {
  if (!val) return '';
  const str = String(val).replace(/\s+/g, '').trim();
  const match = str.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match ? match[1].toLowerCase() : '';
}

function cleanPhone(val) {
  if (!val) return { phone_code: '+91', phone: '' };
  let str = String(val).trim();
  let digits = str.replace(/\D/g, '');

  let phone_code = '+91';
  let phone = '';

  if (digits.length === 10) {
    phone = digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    phone = digits.substring(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    phone_code = '+91';
    phone = digits.substring(2);
  } else if (digits.length > 10) {
    phone = digits.slice(-10);
    const codeDigits = digits.slice(0, digits.length - 10);
    if (codeDigits) phone_code = '+' + codeDigits;
  } else {
    phone = digits;
  }

  return { phone_code, phone };
}

function cleanName(val, fallbackEmail = '') {
  if (!val && !fallbackEmail) return { first_name: '', last_name: '' };
  let str = String(val || '')
    .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s+/i, '')
    .replace(/\.([a-zA-Z])/g, ' $1')
    .replace(/[^\w\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If no name from cell, derive from email prefix
  if (!str && fallbackEmail) {
    const prefix = fallbackEmail.split('@')[0].replace(/[0-9._-]+/g, ' ').trim();
    if (prefix) str = prefix;
    else str = 'Candidate';
  }

  const parts = str.split(' ').filter(Boolean);
  if (parts.length === 0) return { first_name: 'Candidate', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  const first_name = parts[0];
  const last_name = parts.slice(1).join(' ');
  return { first_name, last_name };
}

function cleanExperience(val) {
  if (!val && val !== 0) {
    return { experince_type: 'Fresher', total_years: '0', total_months: '0' };
  }
  const str = String(val).trim().toLowerCase();

  if (str === 'fresher' || str === '0' || str === '0.0' || str === 'none') {
    return { experince_type: 'Fresher', total_years: '0', total_months: '0' };
  }

  // Naukri format: e.g. "2Y 6 M" or "0Y 0 M" or "3 Years 2 Months"
  const yMatch = str.match(/(\d+)\s*(?:y|yr|years?)/i);
  const mMatch = str.match(/(\d+)\s*(?:m|mo|months?)/i);

  if (yMatch || mMatch) {
    const years = yMatch ? parseInt(yMatch[1], 10) : 0;
    const months = mMatch ? parseInt(mMatch[1], 10) : 0;
    const isFresher = years === 0 && months === 0;
    return {
      experince_type: isFresher ? 'Fresher' : 'Experience',
      total_years: isFresher ? '0' : `${years} Years`,
      total_months: isFresher ? '0' : `${months} Months`
    };
  }

  // Decimal number e.g. "1.5" or "3.0" (Foundit format)
  const num = parseFloat(str);
  if (!isNaN(num)) {
    if (num <= 0) {
      return { experince_type: 'Fresher', total_years: '0', total_months: '0' };
    }
    const years = Math.floor(num);
    const months = Math.round((num - years) * 12);
    return {
      experince_type: 'Experience',
      total_years: `${years} Years`,
      total_months: `${months} Months`
    };
  }

  return { experince_type: 'Experience', total_years: '1 Years', total_months: '0' };
}

function cleanSalary(val) {
  if (!val && val !== 0) return '0';
  let str = String(val).trim();
  if (str === '0' || str === '0.0' || str.toLowerCase() === 'inr 0.0 l') return '0';

  const lMatch = str.match(/(?:inr|rs\.?)?\s*([\d.]+)\s*(?:l|lacs|lakhs?)/i);
  if (lMatch) {
    const num = parseFloat(lMatch[1]);
    return num > 0 ? `${num.toFixed(1)} Lakhs` : '0';
  }

  const num = parseFloat(str.replace(/[^\d.]/g, ''));
  if (!isNaN(num) && num > 0) {
    if (num < 100) {
      return `${num.toFixed(1)} Lakhs`;
    } else {
      const inLakhs = num / 100000;
      return `${inLakhs.toFixed(1)} Lakhs`;
    }
  }

  return str || '0';
}

function cleanDob(val) {
  if (!val) return null;
  if (typeof val === 'number' && val > 20000 && val < 60000) {
    try {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    } catch (e) {
      return null;
    }
  }

  const str = String(val).trim();
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  // Pattern: "21 y (06 Nov 2005)" or "21 y\n(06 Nov 2005)"
  const bracketMatch = str.match(/\(([0-9]{1,2})\s+([A-Za-z]{3,9})\s+([0-9]{4})\)/);
  if (bracketMatch) {
    const mStr = bracketMatch[2].toLowerCase();
    const mm = monthMap[mStr];
    if (mm) {
      const dd = bracketMatch[1].padStart(2, '0');
      const yyyy = bracketMatch[3];
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // Pattern: "31-Aug-2004" or "31-August-2004" or "31/08/2004"
  const dmyMatch = str.match(/^([0-9]{1,2})[-/]([A-Za-z]{3,9}|[0-9]{1,2})[-/]([0-9]{4})$/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mPart = dmyMatch[2].toLowerCase();
    const mm = monthMap[mPart] || mPart.padStart(2, '0');
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // Standard YYYY-MM-DD
  const ymdMatch = str.match(/^([0-9]{4})[-/]([0-9]{1,2})[-/]([0-9]{1,2})$/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = ymdMatch[2].padStart(2, '0');
    const dd = ymdMatch[3].padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function cleanSkills(val, headline) {
  const skillList = [];
  if (val) {
    if (Array.isArray(val)) {
      val.forEach(s => {
        const item = String(s).trim();
        if (item && !skillList.includes(item)) skillList.push(item);
      });
    } else if (typeof val === 'string') {
      const parts = val.split(/[,|;\n]/).map(p => p.trim()).filter(Boolean);
      parts.forEach(s => {
        if (s.length > 1 && s.length < 50 && !skillList.includes(s)) skillList.push(s);
      });
    }
  }

  if (skillList.length === 0 && headline) {
    const knownSkills = [
      'Java', 'Python', 'JavaScript', 'TypeScript', 'C++', 'C#', 'SQL', 'MySQL', 'PostgreSQL',
      'MongoDB', 'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Spring Boot', 'Django',
      'HTML', 'CSS', 'PHP', 'Laravel', 'AWS', 'Azure', 'Docker', 'Kubernetes', 'Git',
      'Manual Testing', 'Automation Testing', 'Selenium', 'Data Analytics', 'Power BI',
      'Tableau', 'Excel', 'Pandas', 'Numpy', 'Machine Learning', 'Data Science', 'SAP',
      'SAP MM', 'SAP FICO', 'DevOps', 'REST API', 'DSA', 'OOP'
    ];
    knownSkills.forEach(k => {
      const regex = new RegExp(`\\b${k.replace(/[+.]/g, '\\$&')}\\b`, 'i');
      if (regex.test(headline) && !skillList.includes(k)) {
        skillList.push(k);
      }
    });
  }

  return skillList;
}

function cleanEducation(eduStr, ugStr, pgStr) {
  let qualification = '';
  let course = '';
  let specialization = '';
  let college = '';

  const combined = [eduStr, ugStr, pgStr].filter(Boolean).join(' | ');

  if (!combined) {
    return { qualification: '', course: '', specialization: '', college: '' };
  }

  if (/m\.tech|mca|mba|m\.sc|m\.e|master|post\s*grad/i.test(combined)) {
    qualification = 'Post Graduation';
  } else if (/b\.tech|b\.e|be\b|bca|b\.sc|bba|b\.com|bachelor|under\s*grad/i.test(combined)) {
    qualification = 'Graduation';
  } else if (/diploma/i.test(combined)) {
    qualification = 'Diploma';
  } else {
    qualification = 'Graduation';
  }

  const courseMatch = combined.match(/\b(B\.Tech|B\.E|BE|BCA|B\.Sc|BBA|B\.Com|M\.Tech|M\.E|MCA|MBA|M\.Sc)\b/i);
  if (courseMatch) {
    course = courseMatch[1].toUpperCase();
  } else if (ugStr) {
    course = ugStr.slice(0, 50).trim();
  } else if (eduStr) {
    course = eduStr.slice(0, 50).trim();
  }

  const specMatch = combined.match(/(?:computer science|information technology|mechanical|civil|electrical|electronics|data science|artificial intelligence|software engineering|finance|marketing|hr)/i);
  if (specMatch) {
    specialization = specMatch[0];
  }

  const instMatch = combined.match(/(?:Institute\s*:\s*|College\s*:\s*|University\s*:\s*)([^|,\n]+)/i);
  if (instMatch) {
    college = instMatch[1].trim();
  } else if (/college|institute|university/i.test(combined)) {
    const collegeMatch = combined.match(/([A-Za-z0-9\s.&'-]+(?:college|institute|university)[A-Za-z0-9\s.&'-]*)/i);
    if (collegeMatch) college = collegeMatch[1].trim();
  }

  return { qualification, course, specialization, college };
}

// ── Source Detector ──

function detectSource(headers = [], rawText = '') {
  const normHeaders = headers.map(h => String(h).toLowerCase().trim());
  const headerStr = normHeaders.join(' ');

  // 1. Naukri signatures
  if (
    headerStr.includes('candidate name') ||
    headerStr.includes('contact no') ||
    headerStr.includes('u.g. course') ||
    headerStr.includes('p. g. course') ||
    headerStr.includes('work exp') ||
    (rawText && (rawText.includes('Downloaded from cs') || rawText.includes('# Candidate Name')))
  ) {
    return 'naukri';
  }

  // 2. Foundit signatures
  if (
    headerStr.includes('resume uuid') ||
    headerStr.includes('candidate type') ||
    headerStr.includes('exp. (yrs)') ||
    headerStr.includes('current annual salary (rs. in lacs)') ||
    (rawText && (rawText.includes('comp tn') || rawText.includes('Resume UUID') || rawText.includes('Date of Download:')))
  ) {
    return 'foundit';
  }

  return 'generic';
}

// ── Parse Excel / CSV with Dynamic Header Detection ──

function parseExcelOrCsv(buffer, requestedSource = 'auto') {
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true, dense: false });

  // Try each sheet in the workbook
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert sheet to array of rows (2D array) to find the actual header row
    const rawMatrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (!rawMatrix || rawMatrix.length === 0) continue;

    // Find the header row by searching for candidate keyword columns
    let headerRowIdx = 0;
    let maxKeywordMatches = 0;

    const candidateKeywords = [
      'name', 'candidate', 'email', 'phone', 'mobile', 'contact',
      'resume', 'experience', 'exp', 'salary', 'skills', 'qualification', 'location'
    ];

    for (let r = 0; r < Math.min(rawMatrix.length, 25); r++) {
      const row = rawMatrix[r] || [];
      const rowStr = row.map(cell => String(cell).toLowerCase().trim()).join(' ');
      let matches = 0;
      candidateKeywords.forEach(kw => {
        if (rowStr.includes(kw)) matches++;
      });
      if (matches > maxKeywordMatches) {
        maxKeywordMatches = matches;
        headerRowIdx = r;
      }
    }

    const headerRow = rawMatrix[headerRowIdx] || [];
    const headers = headerRow.map(h => String(h || '').trim());
    if (headers.filter(Boolean).length === 0) continue;

    const dataMatrix = rawMatrix.slice(headerRowIdx + 1);
    if (!dataMatrix || dataMatrix.length === 0) continue;

    const rawRows = dataMatrix.map(rowArr => {
      const obj = {};
      headers.forEach((h, colIdx) => {
        if (h) {
          obj[h] = rowArr[colIdx] !== undefined ? rowArr[colIdx] : '';
        }
      });
      return obj;
    });
    if (rawRows.length === 0) continue;

    const detected = detectSource(headers);
    const source = requestedSource && requestedSource !== 'auto' ? requestedSource : detected;

    const headerMap = {};
    headers.forEach(h => {
      const key = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      headerMap[key] = h;
    });

    const getVal = (row, ...keys) => {
      for (const k of keys) {
        const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        const mappedHeader = headerMap[cleanKey];
        if (mappedHeader && row[mappedHeader] !== undefined && row[mappedHeader] !== null && String(row[mappedHeader]).trim() !== '') {
          return row[mappedHeader];
        }
        for (const rowKey of Object.keys(row)) {
          if (rowKey.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanKey) {
            if (row[rowKey] !== undefined && row[rowKey] !== null && String(row[rowKey]).trim() !== '') {
              return row[rowKey];
            }
          }
        }
      }
      return '';
    };

    const candidates = rawRows.map((row, idx) => {
      const email = cleanEmail(getVal(row,
        'email', 'emailid', 'emailaddress', 'mail', 'e-mail', 'candidateemail',
        'additionalemail', 'primaryemail', 'contactemail'
      ));

      const rawName = getVal(row,
        'candidatename', 'name', 'fullname', 'candidate', 'applicantname',
        'nameofcandidate', 'applicant', 'studentname', 'personname', 'employee'
      ) || `${getVal(row, 'firstname', 'first', 'fname')} ${getVal(row, 'lastname', 'last', 'lname')}`.trim();

      const { first_name, last_name } = cleanName(rawName, email);

      const rawPhone = getVal(row,
        'contactno', 'contactnumber', 'phone', 'phoneno', 'phonenumber',
        'mobile', 'mobilenumber', 'mobileno', 'contact', 'cell', 'whatsapp', 'tel'
      );
      const { phone_code, phone } = cleanPhone(rawPhone);

      const headline = String(getVal(row, 'resumetitle', 'headline', 'title', 'summary', 'profiletitle')).trim();

      const expVal = getVal(row, 'workexp', 'exp(yrs)', 'expyrs', 'experience', 'totalexperience', 'exp', 'totalexp');
      const { experince_type, total_years, total_months } = cleanExperience(expVal);

      const salVal = getVal(row, 'annualsalary', 'currentannualsalary(rsinlacs)', 'currentannualsalary', 'salary', 'ctc', 'currentsalary', 'currentctc');
      const current_salary = cleanSalary(salVal);

      const location = String(getVal(row, 'currentlocation', 'location', 'city', 'residence', 'currentcity')).trim();
      const preferred_locations = String(getVal(row, 'preferredlocation', 'preferredlocations', 'preflocation')).trim();

      const company_name = String(getVal(row, 'currentemployer', 'company', 'companyname', 'currentcompany', 'employer', 'organization')).trim();

      const designation = String(getVal(row, 'designation', 'currentdesignation', 'jobtitle', 'role', 'position')).trim();

      const ugCourse = getVal(row, 'ugcourse', 'ugdegree', 'ug');
      const pgCourse = getVal(row, 'pgcourse', 'pgdegree', 'pg');
      const eduStr = getVal(row, 'education', 'highestdegree', 'degree', 'qualification', 'course');
      const eduParsed = cleanEducation(eduStr, ugCourse, pgCourse);

      const dobVal = getVal(row, 'age/dateofbirth', 'dateofbirth', 'dob', 'birthdate', 'birth_date', 'age');
      const dob = cleanDob(dobVal);

      const skillsVal = getVal(row, 'keyskills', 'skills', 'itskills', 'technicalskills', 'skillset');
      const skills = cleanSkills(skillsVal, headline);

      const notice_period = String(getVal(row, 'noticeperiod', 'notice', 'availability')).trim();

      return {
        index: idx + 1,
        first_name,
        last_name,
        full_name: `${first_name} ${last_name}`.trim(),
        email,
        phone_code,
        phone,
        headline,
        experince_type,
        total_years,
        total_months,
        current_salary,
        location,
        preferred_locations,
        company_name,
        designation,
        education: eduParsed,
        dob,
        skills,
        notice_period,
        source
      };
    }).filter(c => (c.first_name || c.last_name) && (c.email || c.phone));

    if (candidates.length > 0) {
      return {
        source,
        headers,
        total: candidates.length,
        candidates
      };
    }
  }

  return { source: 'empty', total: 0, candidates: [] };
}

// ── Parse PDF Dump with Fallback ──

async function parsePdfDump(buffer, requestedSource = 'auto') {
  if (!PDFParse) {
    throw new Error('PDF parsing module not available');
  }

  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const rawText = result.text || '';

  const detected = detectSource([], rawText);

  // If source is requested, try that first; but if it returns 0 candidates, fallback to other parsers!
  let candidates = [];
  let finalSource = requestedSource && requestedSource !== 'auto' ? requestedSource : detected;

  if (finalSource === 'naukri') {
    const res = parseNaukriPdfDump(rawText);
    candidates = res.candidates || [];
    if (candidates.length === 0) {
      // Fallback to Foundit
      const fallbackRes = parseFounditPdfDump(rawText);
      if (fallbackRes.candidates && fallbackRes.candidates.length > 0) {
        candidates = fallbackRes.candidates;
        finalSource = 'foundit';
      }
    }
  } else if (finalSource === 'foundit') {
    const res = parseFounditPdfDump(rawText);
    candidates = res.candidates || [];
    if (candidates.length === 0) {
      // Fallback to Naukri
      const fallbackRes = parseNaukriPdfDump(rawText);
      if (fallbackRes.candidates && fallbackRes.candidates.length > 0) {
        candidates = fallbackRes.candidates;
        finalSource = 'naukri';
      }
    }
  } else {
    // Auto or Generic: try Naukri then Foundit
    const resNaukri = parseNaukriPdfDump(rawText);
    if (resNaukri.candidates && resNaukri.candidates.length > 0) {
      candidates = resNaukri.candidates;
      finalSource = 'naukri';
    } else {
      const resFoundit = parseFounditPdfDump(rawText);
      if (resFoundit.candidates && resFoundit.candidates.length > 0) {
        candidates = resFoundit.candidates;
        finalSource = 'foundit';
      }
    }
  }

  // Universal Fallback for any other PDF format (generic lines with phone and email)
  if (candidates.length === 0) {
    candidates = parseGenericPdfLines(rawText);
    finalSource = 'generic';
  }

  return {
    source: finalSource,
    total: candidates.length,
    candidates
  };
}

function parseNaukriPdfDump(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const titleKeywordsRegex = /\s+(?:I\s+am|i\s+am|Fresher|Seeking|Aspiring|Currently|B\.Tech|B\.E|BE\b|BCA\b|SAP\b|Java\b|Data\b|Software|Full\s+Stack|Web\b|Looking|Trainee|Graduate|Passionate)\b/i;

  const rawCandidates = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('Downloaded from') || line.startsWith('# Candidate Name')) continue;

    const match = line.match(/^([1-9]\d{0,3})\s+([A-Za-z].*)$/);

    if (match) {
      if (current) rawCandidates.push(current);
      current = {
        number: parseInt(match[1], 10),
        firstLine: match[2],
        lines: [match[2]]
      };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) rawCandidates.push(current);

  const candidates = rawCandidates.map((c, idx) => {
    const rawAll = c.lines.join(' ');
    const phoneMatch = rawAll.match(/\b([6-9]\d{9})\b/);
    const phone = phoneMatch ? phoneMatch[1] : '';

    let email = '';
    if (phone) {
      const phoneIdx = rawAll.lastIndexOf(phone);
      const afterPhone = rawAll.slice(phoneIdx + phone.length).replace(/\s+/g, '');
      const em = afterPhone.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (em) email = em[1].toLowerCase();
    }
    if (!email) {
      const em = rawAll.replace(/\s+/g, '').match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (em) email = em[1].toLowerCase();
    }

    const splitPos = c.firstLine.search(titleKeywordsRegex);
    let rawName = '';
    let startOfTitle = '';
    if (splitPos !== -1) {
      rawName = c.firstLine.slice(0, splitPos).trim();
      startOfTitle = c.firstLine.slice(splitPos).trim();
    } else {
      const words = c.firstLine.split(/\s+/);
      rawName = words.slice(0, 2).join(' ');
      startOfTitle = words.slice(2).join(' ');
    }
    rawName = rawName.replace(/\.([a-zA-Z])/g, ' $1').replace(/[^a-zA-Z\s.]/g, '').trim();

    const { first_name, last_name } = cleanName(rawName, email);

    let headline = (startOfTitle + ' ' + c.lines.slice(1).join(' ')).trim();
    if (phone) headline = headline.replace(phone, '');
    if (email) headline = headline.replace(new RegExp(email, 'i'), '');
    headline = headline.replace(/\s+/g, ' ').trim();

    const { experince_type, total_years, total_months } = cleanExperience(headline);
    const skills = cleanSkills(null, headline);
    const eduParsed = cleanEducation(headline, '', '');

    return {
      index: c.number || (idx + 1),
      first_name,
      last_name,
      full_name: `${first_name} ${last_name}`.trim(),
      email,
      phone_code: '+91',
      phone,
      headline,
      experince_type,
      total_years,
      total_months,
      current_salary: '0',
      location: 'Chennai',
      preferred_locations: '',
      company_name: '',
      designation: '',
      education: eduParsed,
      dob: null,
      skills,
      notice_period: '',
      source: 'naukri'
    };
  }).filter(c => (c.first_name || c.last_name) && (c.email || c.phone));

  return {
    source: 'naukri',
    total: candidates.length,
    candidates
  };
}

function parseFounditPdfDump(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const phoneRegex = /(?:\+?91)?([6-9]\d{9})/;

  const contacts = [];
  lines.forEach(line => {
    const emailMatch = line.match(emailRegex);
    const phoneMatch = line.match(phoneRegex);
    if (emailMatch && phoneMatch) {
      contacts.push({
        email: emailMatch[1].toLowerCase(),
        phone: phoneMatch[1]
      });
    }
  });

  const nameLines = [];
  let inNameSection = false;
  lines.forEach(line => {
    if (line.includes('Resume UUID') && line.includes('Name')) {
      inNameSection = true;
      return;
    }
    if (line.includes('Resume Title Education') || line.includes('Shortlisted Prospect')) {
      inNameSection = false;
      return;
    }
    if (inNameSection) {
      if (line.startsWith('Registered') || line.startsWith('Shortlisted')) {
        const afterStatus = line.replace(/^(Registered|Shortlisted)\s+/, '').trim();
        const dobMatch = afterStatus.match(/(\d{1,2}-[A-Za-z]{3}-\d{4})/);
        const dob = dobMatch ? cleanDob(dobMatch[1]) : null;
        let nameOnly = afterStatus.replace(/\d{1,2}-[A-Za-z]{3}-\d{4}/, '').trim();
        if (nameOnly) nameLines.push({ name: nameOnly, dob });
      }
    }
  });

  const count = Math.max(contacts.length, nameLines.length);
  const candidates = [];

  for (let i = 0; i < count; i++) {
    const contact = contacts[i] || {};
    const nameInfo = nameLines[i] || {};
    const rawName = nameInfo.name || `Candidate ${i + 1}`;
    const { first_name, last_name } = cleanName(rawName, contact.email);

    if (contact.email || contact.phone || nameInfo.name) {
      candidates.push({
        index: i + 1,
        first_name,
        last_name,
        full_name: `${first_name} ${last_name}`.trim(),
        email: contact.email || '',
        phone_code: '+91',
        phone: contact.phone || '',
        headline: '',
        experince_type: 'Fresher',
        total_years: '0',
        total_months: '0',
        current_salary: '0',
        location: '',
        preferred_locations: '',
        company_name: '',
        designation: '',
        education: { qualification: 'Graduation', course: 'B.Tech', specialization: '', college: '' },
        dob: nameInfo.dob || null,
        skills: [],
        notice_period: '',
        source: 'foundit'
      });
    }
  }

  return {
    source: 'foundit',
    total: candidates.length,
    candidates
  };
}

// Universal scanner for general candidate PDFs
function parseGenericPdfLines(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const phoneRegex = /(?:\+?91)?([6-9]\d{9})/;
  const candidates = [];

  lines.forEach((line, idx) => {
    const emailMatch = line.match(emailRegex);
    const phoneMatch = line.match(phoneRegex);
    if (emailMatch || phoneMatch) {
      const email = emailMatch ? emailMatch[1].toLowerCase() : '';
      const phone = phoneMatch ? phoneMatch[1] : '';

      // Clean name from the line by stripping phone and email
      let namePart = line;
      if (email) namePart = namePart.replace(emailMatch[0], '');
      if (phone) namePart = namePart.replace(phoneMatch[0], '');
      namePart = namePart.replace(/\+91/g, '').replace(/[^a-zA-Z\s.]/g, ' ').replace(/\s+/g, ' ').trim();

      const { first_name, last_name } = cleanName(namePart, email);

      candidates.push({
        index: idx + 1,
        first_name,
        last_name,
        full_name: `${first_name} ${last_name}`.trim(),
        email,
        phone_code: '+91',
        phone,
        headline: '',
        experince_type: 'Fresher',
        total_years: '0',
        total_months: '0',
        current_salary: '0',
        location: '',
        preferred_locations: '',
        company_name: '',
        designation: '',
        education: { qualification: 'Graduation', course: '', specialization: '', college: '' },
        dob: null,
        skills: [],
        notice_period: '',
        source: 'generic'
      });
    }
  });

  return candidates;
}

// ── Master Entrypoint ──

async function parseCandidateFile(fileBuffer, originalFilename, requestedSource = 'auto') {
  const ext = (originalFilename || '').split('.').pop().toLowerCase();

  if (ext === 'pdf') {
    return await parsePdfDump(fileBuffer, requestedSource);
  } else {
    // Excel or CSV
    return parseExcelOrCsv(fileBuffer, requestedSource);
  }
}

module.exports = {
  parseCandidateFile,
  parseExcelOrCsv,
  parsePdfDump,
  detectSource,
  cleanEmail,
  cleanPhone,
  cleanName,
  cleanExperience,
  cleanSalary,
  cleanDob,
  cleanSkills,
  cleanEducation
};
