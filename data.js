// Google Sheets Integration - Updated with better debugging
const SHEET_ID = '1R8aekz9Tx803PiGKX9AjB_z8qUD19_JU';
const SHEET_GID = '1735949778'; // Dataset tab ID

let companiesData = [];

// Fallback mock data
const mockCompaniesData = [
    {
        id: 1,
        name: "TechCorp Industries",
        country: "United States",
        city: "San Francisco",
        latitude: 37.7749,
        longitude: -122.4194,
        description: "Leading cloud infrastructure and AI solutions provider.",
        website: "https://www.techcorp.com",
        linkedin: "https://www.linkedin.com/company/techcorp",
        employees: 15000,
        founded: 2010,
        revenueRange: "$2.5B - $3B",
        logo: "TC",
        bubbleColor: "bubble-bg-1"
    }
];

const bubbleColors = [
    'bubble-bg-1', 'bubble-bg-2', 'bubble-bg-3', 'bubble-bg-4',
    'bubble-bg-5', 'bubble-bg-6', 'bubble-bg-7', 'bubble-bg-8'
];

// Parse CSV data
function parseCSVData(csvText) {
    console.log('📊 Parsing CSV data...');
    const lines = csvText.trim().split('\n');
    
    if (lines.length < 2) {
        console.error('❌ CSV has no data rows');
        return [];
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    console.log('✅ Headers:', headers);

    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV with proper quote handling
        const cells = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                cells.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        cells.push(current.trim().replace(/^"|"$/g, ''));

        const row = {};
        headers.forEach((header, index) => {
            row[header] = cells[index] || '';
        });

        // Parse coordinates
        let latitude = null, longitude = null;
        if (row.coordinates) {
            const coords = row.coordinates.split(',').map(c => parseFloat(c.trim()));
            if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                latitude = coords[0];
                longitude = coords[1];
            }
        }

        // Add company if valid
        if (latitude !== null && longitude !== null && row['company name']) {
            const companyName = row['company name'].trim();
            const logo = row['logo'] ? row['logo'].trim() : companyName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

            const company = {
                id: data.length + 1,
                name: companyName,
                country: row['country'] ? row['country'].trim() : 'Unknown',
                city: row['country'] ? row['country'].trim() : 'Unknown',
                latitude: latitude,
                longitude: longitude,
                description: row['description'] ? row['description'].trim() : 'No description',
                website: row['website'] ? row['website'].trim() : '#',
                linkedin: row['linkedin'] ? row['linkedin'].trim() : '#',
                employees: row['number of employees'] ? parseInt(row['number of employees']) : 0,
                founded: row['founded year'] ? parseInt(row['founded year']) : 0,
                revenueRange: row['revenue range'] ? row['revenue range'].trim() : 'N/A',
                logo: logo,
                bubbleColor: bubbleColors[data.length % bubbleColors.length]
            };

            data.push(company);
            console.log(`✅ Added: ${companyName} at (${latitude}, ${longitude})`);
        } else {
            console.warn(`⚠️ Skipped row ${i}:`, row);
        }
    }

    return data;
}

// Method 1: Using CSV Export URL with different proxies
async function loadCompaniesFromGoogleSheetsCSV() {
    try {
        console.log('🔄 Attempting to load from Google Sheets CSV...');
        
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
        console.log('📥 CSV URL:', csvUrl);

        // Try different proxies
        const proxies = [
            'https://corsproxy.io/?',
            'https://api.allorigins.win/raw?url=',
            'https://thingproxy.freeboard.io/fetch/'
        ];

        for (let proxy of proxies) {
            try {
                console.log(`🔗 Trying proxy: ${proxy}`);
                const response = await fetch(proxy + encodeURIComponent(csvUrl), {
                    headers: { 'Accept': 'text/csv' }
                });

                if (response.ok) {
                    const csvText = await response.text();
                    console.log('✅ CSV fetched successfully');
                    companiesData = parseCSVData(csvText);

                    if (companiesData.length > 0) {
                        console.log(`✅ Loaded ${companiesData.length} companies`);
                        return companiesData;
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Proxy failed: ${proxy}`, error.message);
            }
        }

        throw new Error('All proxies failed');
    } catch (error) {
        console.error('❌ Error loading from Google Sheets CSV:', error);
        return null;
    }
}

// Load data from Google Sheets
async function loadCompaniesFromGoogleSheets() {
    try {
        console.log('🚀 Starting Google Sheets data load...');
        
        // Try CSV method first
        let result = await loadCompaniesFromGoogleSheetsCSV();
        
        if (result && result.length > 0) {
            console.log('✅ Successfully loaded real data from Google Sheets!');
            return result;
        }

        // Fall back to mock data
        console.warn('⚠️ Could not load from Google Sheets, using mock data');
        companiesData = mockCompaniesData;
        return companiesData;

    } catch (error) {
        console.error('❌ Fatal error:', error);
        companiesData = mockCompaniesData;
        return companiesData;
    }
}