async function test() {
  try {
    const filtersRes = await fetch('http://localhost:3006/api/candidates/filter-options');
    const filters = await filtersRes.json();
    console.log('✅ Filter Options Companies count:', filters.data.companies.length);
    console.log('✅ Filter Options Industries count:', filters.data.industries.length);
    console.log('Sample Industries:', filters.data.industries.slice(0, 6).map(i => `${i.category} (${i.count})`));

    const googleRes = await fetch('http://localhost:3006/api/candidates/companies-lookup?query=google');
    const google = await googleRes.json();
    console.log('✅ Companies Lookup for "google":', google.data.slice(0, 3));

    const acteRes = await fetch('http://localhost:3006/api/candidates/companies-lookup?query=acte');
    const acte = await acteRes.json();
    console.log('✅ Companies Lookup for "acte":', acte.data.slice(0, 3));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

test();
