// Google Sheets Integration - Native Fetch (No Proxies, No Fallback)
const SHEET_ID = '1R8aekz9Tx803PiGKX9AjB_z8qUD19_JU';

let companiesData = [];

const bubbleColors = [
    'bubble-bg-1', 'bubble-bg-2', 'bubble-bg-3', 'bubble-bg-4',
    'bubble-bg-5', 'bubble-bg-6', 'bubble-bg-7', 'bubble-bg-8'
];

// Robust CSV parser that handles quotes and embedded commas flawlessly
function parseCSV(csvText) {
    const lines = [];
    let currentLine = [];
    let currentCell = '';
    let insideQuotes = false;

    // Normalize line endings
    const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText[i];
        const nextChar = normalizedText[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentCell += '"';
                i++; // Skip escaped quote
            } else {
                insideQuotes = !insideQuotes; // Toggle quote context
            }
        } else if (char === ',' && !insideQuotes) {
            currentLine.push(currentCell.trim());
            currentCell = '';
        } else if (char === '\n' && !insideQuotes) {
            currentLine.push(currentCell.trim());
            if (currentLine.some(cell => cell !== '')) {
                lines.push(currentLine);
            }
            currentLine = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }

    // Push trailing leftovers
    if (currentCell || currentLine.length > 0) {
        currentLine.push(currentCell.trim());
        lines.push(currentLine);
    }

    return lines;
}

// Parse CSV data safely using dynamic object row mapping
function parseCSVData(csvText) {
    console.log('📊 Parsing CSV data...');
    
    const lines = parseCSV(csvText);
    if (lines.length < 2) {
        throw new Error(`CSV has only ${lines.length} line(s), need at least 2`);
    }

    // Standardize header strings
    const headers = lines[0].map(h => h.toLowerCase().trim());
    console.log('✅ Standardized headers:', headers);

    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i];
        if (cells.length === 0 || cells.length !== headers.length) continue;

        // Build a dynamic dictionary row object matching column values to headers
        const row = {};
        headers.forEach((header, index) => {
            row[header] = cells[index] || '';
        });

        const companyName = row['company name']?.trim();
        const rawCoordinates = row['coordinates']?.trim();

        if (!companyName) continue;

        // Extract coordinates safely
        let latitude = null, longitude = null;
        if (rawCoordinates) {
            // Strips out any accidental wrap-around quote properties inside strings
            const cleanCoords = rawCoordinates.replace(/"/g, '');
            const coords = cleanCoords.split(',').map(c => parseFloat(c.trim()));
            if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                latitude = coords[0];
                longitude = coords[1];
            }
        }

        // Push valid objects directly onto the leaflet layer target array
        if (latitude !== null && longitude !== null) {
            let logo = row['logo']?.trim() || '';
            if (!logo) {
                logo = companyName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            }

            const company = {
                id: data.length + 1,
                name: companyName,
                country: row['country']?.trim() || 'Unknown',
                city: row['city']?.trim() || row['country']?.trim() || 'Unknown',
                latitude: latitude,
                longitude: longitude,
                description: row['description']?.trim() || 'No description',
                website: row['website']?.trim() || '#',
                linkedin: row['linkedin']?.trim() || '#',
                employees: row['number of employees']?.trim() || 'N/A',
                founded: parseInt(row['founded year']) || 0,
                revenueRange: row['revenue range']?.trim() || 'N/A',
                logo: logo,
                bubbleColor: bubbleColors[data.length % bubbleColors.length]
            };

            data.push(company);
        }
    }

    console.log(`📍 Total companies successfully parsed: ${data.length}`);
    if (data.length === 0) {
        throw new Error('No valid companies found in CSV. Verify coordinate row parameters.');
    }
    return data;
}

// Load directly from Google Sheets natively (No proxies, no fallbacks)
async function loadCompaniesFromGoogleSheets() {
    try {
        console.log('🚀 Starting native Google Sheets data load...');
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
        
        const response = await fetch(csvUrl);
        console.log(`📥 Response status: ${response.status}`);

        if (!response.ok) {
            throw new Error(`HTTP Error Status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log(`📥 Received ${csvText.length} characters`);
        
        if (csvText.trim().startsWith('<!DOCTYPE html>')) {
            throw new Error('Google returned HTML instead of CSV data. Verify your sheet sharing settings.');
        }

        companiesData = parseCSVData(csvText);
        console.log(`✅✅✅ SUCCESS! Map markers dataset built.`);
        return companiesData;

    } catch (error) {
        console.error('❌❌❌ DATA RENDER CRITICAL FAILURE!');
        console.error('Error Details:', error.message);
        companiesData = [];
        throw error;
    }
}
