// Google Sheets Integration
// CSV export URL from the 'Dataset' tab
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1R8aekz9Tx803PiGKX9AjB_z8qUD19_JU/export?format=csv&gid=1735949778';

let companiesData = [];

// Fallback mock data in case Google Sheets fails to load
const mockCompaniesData = [
    {
        id: 1,
        name: "TechCorp Industries",
        country: "United States",
        city: "San Francisco",
        latitude: 37.7749,
        longitude: -122.4194,
        description: "Leading cloud infrastructure and AI solutions provider serving Fortune 500 companies.",
        website: "https://www.techcorp.com",
        linkedin: "https://www.linkedin.com/company/techcorp",
        employees: 15000,
        founded: 2010,
        revenueRange: "$2.5B - $3B",
        logo: "TC",
        bubbleColor: "bubble-bg-1"
    },
    {
        id: 2,
        name: "GlobalFinance Solutions",
        country: "United Kingdom",
        city: "London",
        latitude: 51.5074,
        longitude: -0.1278,
        description: "Innovative fintech platform revolutionizing digital banking and payments globally.",
        website: "https://www.globalfinance.co.uk",
        linkedin: "https://www.linkedin.com/company/globalfinance",
        employees: 8500,
        founded: 2015,
        revenueRange: "$800M - $1B",
        logo: "GF",
        bubbleColor: "bubble-bg-2"
    }
];

// Color palette for bubbles
const bubbleColors = [
    'bubble-bg-1',
    'bubble-bg-2',
    'bubble-bg-3',
    'bubble-bg-4',
    'bubble-bg-5',
    'bubble-bg-6',
    'bubble-bg-7',
    'bubble-bg-8'
];

// Parse CSV data from Google Sheets
function parseCSVData(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
        console.error('CSV has no data rows');
        return [];
    }

    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    console.log('Headers found:', headers);

    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV line (handles quoted values)
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

        // Create row object
        const row = {};
        headers.forEach((header, index) => {
            row[header] = cells[index] || '';
        });

        // Parse coordinates (format: "latitude, longitude")
        let latitude, longitude;
        if (row.coordinates) {
            const coords = row.coordinates.split(',').map(c => {
                const parsed = parseFloat(c.trim());
                return isNaN(parsed) ? null : parsed;
            });
            if (coords.length === 2 && coords[0] !== null && coords[1] !== null) {
                latitude = coords[0];
                longitude = coords[1];
            }
        }

        // Only add if we have valid data
        if (latitude !== undefined && longitude !== undefined && row['company name']) {
            const companyName = row['company name'] || 'Unknown';
            const logo = row['logo'] || companyName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

            data.push({
                id: data.length + 1,
                name: companyName,
                country: row['country'] || 'Unknown',
                city: row['country'] || 'Unknown',
                latitude: latitude,
                longitude: longitude,
                description: row['description'] || 'No description available',
                website: row['website'] || '#',
                linkedin: row['linkedin'] || '#',
                employees: parseInt(row['number of employees']) || 0,
                founded: parseInt(row['founded year']) || new Date().getFullYear(),
                revenueRange: row['revenue range'] || 'N/A',
                logo: logo,
                bubbleColor: bubbleColors[data.length % bubbleColors.length]
            });

            console.log(`Added company: ${companyName} (${latitude}, ${longitude})`);
        }
    }

    return data;
}

// Load data from Google Sheets
async function loadCompaniesFromGoogleSheets() {
    try {
        console.log('🔄 Loading companies from Google Sheets...');
        
        // Use corsfix.com proxy for CORS issues
        const corsProxy = 'https://corsproxy.io/?';
        const response = await fetch(corsProxy + encodeURIComponent(GOOGLE_SHEET_URL), {
            headers: {
                'Accept': 'text/csv'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log('CSV received, parsing...');

        companiesData = parseCSVData(csvText);

        if (companiesData.length > 0) {
            console.log(`✅ Successfully loaded ${companiesData.length} companies from Google Sheets`);
            return companiesData;
        } else {
            throw new Error('No valid data parsed from Google Sheets');
        }
    } catch (error) {
        console.warn('⚠️ Error loading from Google Sheets, using fallback mock data:', error);
        companiesData = mockCompaniesData;
        return companiesData;
    }
}