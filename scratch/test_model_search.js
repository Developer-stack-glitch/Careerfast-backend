require('dotenv').config();
const CandidateSearchModel = require('../models/CandidateSearchModel');

(async () => {
  try {
    const res = await CandidateSearchModel.searchCandidates({
      search: 'React Node.js Sales',
      sortBy: 'Relevance',
      limit: 10
    });
    console.log('Total found:', res.total);
    console.log('Candidates:', res.candidates.map(c => ({ id: c.id, name: c.name, skills: c.skills?.slice(0, 5) })));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
