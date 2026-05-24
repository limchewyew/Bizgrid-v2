// Google Sheets Integration - REAL DATA ONLY, NO FALLBACK
const SHEET_ID = '1R8aekz9Tx803PiGKX9AjB_z8qUD19_JU';

let companiesData = [];

const bubbleColors = [
    'bubble-bg-1', 'bubble-bg-2', 'bubble-bg-3', 'bubble-bg-4',
    'bubble-bg-5', 'bubble-bg-6', 'bubble-bg-7', 'bubble-bg-8'
];

// Properly parse CSV with quoted field support
function parseCSV(csvText) {
    const lines = [];
    let currentLine = '';
    let insideQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                // Escaped quote
                currentLine += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                insideQuotes = !insideQuotes;
            }
        } else if (char === '\n' && !insideQuotes) {
            // End of line
            if (currentLine.trim()) {
                lines.push(currentLine);
            }
            currentLine = '';
        } else {
            currentLine += char;
        }
    }

    if (currentLine.trim()) {
        lines.push(currentLine);
    }

    return lines.map(line => {
        const cells = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                cells.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        cells.push(current.trim());

        return cells;
    });
}

// Parse CSV data
function parseCSVData(csvText) {
    console.log('📊 Parsing CSV...');
    console.log('First 500 chars:', csvText.substring(0, 500));
    
    const lines = parseCSV(csvText);
    
    if (lines.length < 2) {
        throw new Error(`CSV has only ${lines.length} line(s), need at least 2`);
    }

    const headers = lines[0].map(h => h.toLowerCase());
    console.log('✅ Headers found:', headers);

    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i];
        if (cells.length === 0) continue;

        const row = {};
        headers.forEach((header, index) => {
            row[header] = cells[index] || '';
        });

        console.log(`Row ${i}:`, row);

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
                employees: row['number of employees'] ? row['number of employees'].trim() : 'N/A',
                founded: row['founded year'] ? parseInt(row['founded year']) : 0,
                revenueRange: row['revenue range'] ? row['revenue range'].trim() : 'N/A',
                logo: logo,
                bubbleColor: bubbleColors[data.length % bubbleColors.length]
            };

            data.push(company);
            console.log(`✅ Added: ${companyName} at (${latitude}, ${longitude})`);
        }
    }

    console.log(`📍 Total companies parsed: ${data.length}`);
    if (data.length === 0) {
        throw new Error('No valid companies found in CSV. Check coordinates and company names.');
    }
    return data;
}

// Load from Google Sheets
async function loadCompaniesFromGoogleSheets() {
    try {
        console.log('🚀 Starting Google Sheets data load...');
        
        // Direct CSV export URL
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
        console.log('📥 CSV URL:', csvUrl);

        // Try multiple proxies
        const proxies = [
            { name: 'corsproxy.io', url: 'https://corsproxy.io/?' },
            { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' },
            { name: 'thingproxy', url: 'https://thingproxy.freeboard.io/fetch/' }
        ];

        for (let proxy of proxies) {
            try {
                console.log(`🔗 Trying ${proxy.name}...`);
                const proxyUrl = proxy.url + encodeURIComponent(csvUrl);
                console.log(`  Full URL: ${proxyUrl.substring(0, 100)}...`);
                
                const response = await fetch(proxyUrl, {
                    headers: { 'Accept': 'text/csv' }
                });

                console.log(`  Response status: ${response.status}`);

                if (response.ok) {
                    const csvText = await response.text();
                    console.log(`  Received ${csvText.length} characters`);
                    
                    if (!csvText || csvText.length < 50) {
                        console.warn(`  ⚠️ Response too short: ${csvText.length} chars`);
                        continue;
                    }
                    
                    console.log(`✅ Got valid response from ${proxy.name}`);
                    companiesData = parseCSVData(csvText);

                    if (companiesData.length > 0) {
                        console.log(`✅✅✅ SUCCESS! Loaded ${companiesData.length} companies from Google Sheets`);
                        return companiesData;
                    }
                } else {
                    console.warn(`  ⚠️ HTTP ${response.status}`);
                }
            } catch (error) {
                console.warn(`❌ ${proxy.name} failed:`, error.message);
            }
        }

        throw new Error('All proxies failed or returned invalid data');

    } catch (error) {
        console.error('❌❌❌ FATAL ERROR - Cannot load Google Sheets!');
        console.error('Error:', error.message);
        console.error('\n📋 CHECKLIST:');
        console.error('1. ✓ Is sheet publicly shared? (File → Share → Anyone with link)');
        console.error('2. ✓ Column names EXACT match: Logo, Company Name, Country, Description, LinkedIn, Website, Number of employees, Founded year, Revenue range, Coordinates');
        console.error('3. ✓ At least 1 company with valid coordinates (e.g. 37.7749, -122.4194)');
        console.error('4. ✓ Check Network tab (F12) for CORS errors');
        console.error('5. ✓ Verify Dataset tab exists and has data');
        
        companiesData = [];
        throw error;
    }
}
