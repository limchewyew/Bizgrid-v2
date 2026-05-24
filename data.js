// Google Sheets Integration - Native Fetch (No Proxies, No Fallback)
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

// Parse CSV data into JSON objects
function parseCSVData(csvText) {
    console.log('📊 Parsing CSV...');
    console.log('First 500 chars:', csvText.substring(0, 500));
    
    const lines = parseCSV(csvText);
    
    if (lines.length < 2) {
        throw new Error(`CSV has only ${lines.length} line(s), need at least 2`);
    }

    const headers = lines[0].map(h => h.toLowerCase().trim());
    console.log('✅ Headers found:', headers);

    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i];
        if (cells.length === 0 || !cells[0]) continue;

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
                city: row['city'] ? row['city'].trim() : (row['country'] ? row['country'].trim() : 'Unknown'),
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
        }
    }

    console.log(`📍 Total companies parsed: ${data.length}`);
    if (data.length === 0) {
        throw new Error('No valid companies found in CSV. Check coordinates and company names.');
    }
    return data;
}

// Load directly from Google Sheets natively (No proxies, no fallbacks)
async function loadCompaniesFromGoogleSheets() {
    try {
        console.log('🚀 Starting native Google Sheets data load...');
        
        // Direct CSV export URL - Google natively handles CORS for this endpoint on public sheets
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
        console.log('📥 Native CSV URL:', csvUrl);

        const response = await fetch(csvUrl);
        console.log(`📥 Response status: ${response.status}`);

        if (!response.ok) {
            throw new Error(`HTTP Error Status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log(`📥 Received ${csvText.length} characters`);
        
        // Check if returned content looks like HTML instead of CSV (e.g., Google login page redirection)
        if (csvText.trim().startsWith('<!DOCTYPE html>')) {
            throw new Error('Google returned HTML instead of CSV data. Ensure your sheet sharing settings are set to "Anyone with the link can view".');
        }

        if (!csvText || csvText.length < 50) {
            throw new Error('Response data from Google Sheets was too short or empty.');
        }
        
        companiesData = parseCSVData(csvText);
        console.log(`✅✅✅ SUCCESS! Loaded ${companiesData.length} companies natively from Google Sheets.`);
        return companiesData;

    } catch (error) {
        console.error('❌❌❌ NATIVE FETCH FAILED!');
        console.error('Error Details:', error.message);
        console.error('\n📋 REMINDER CHECKLIST:');
        console.error('1. Go to your Google Sheet -> Click "Share" -> Change General Access to "Anyone with the link can view".');
        console.error('2. Ensure your headers exactly match your row parser variables.');
        
        // Clear global array and re-throw the error so app.js can stop rendering cleanly
        companiesData = [];
        throw error;
    }
}
