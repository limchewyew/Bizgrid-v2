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
    
    const lines = parseCSV(csvText);
    
    if (lines.length < 2) {
        throw new Error(`CSV has only ${lines.length} line(s), need at least 2`);
    }

    // Clean headers for bulletproof comparison: lowercase and trim trailing spaces
    const headers = lines[0].map(h => h.toLowerCase().trim());
    console.log('✅ Headers found in your Google Sheet:', headers);

    // Map your exact columns directly
    const logoIdx = headers.indexOf('logo');
    const companyNameIdx = headers.indexOf('company name');
    const countryIdx = headers.indexOf('country');
    const descriptionIdx = headers.indexOf('description');
    const linkedinIdx = headers.indexOf('linkedin');
    const websiteIdx = headers.indexOf('website');
    const employeesIdx = headers.indexOf('number of employees');
    const foundedIdx = headers.indexOf('founded year');
    const revenueIdx = headers.indexOf('revenue range');
    const coordinatesIdx = headers.indexOf('coordinates');

    // Debugging index check
    console.log('🔍 Matching column indices:', { companyNameIdx, coordinatesIdx });

    if (companyNameIdx === -1 || coordinatesIdx === -1) {
        throw new Error(`Critical Columns Missing! The parser could not find "Company Name" or "Coordinates". Please ensure headers match exactly.`);
    }

    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i];
        
        // Skip empty rows or rows missing a company name
        if (cells.length === 0 || !cells[companyNameIdx]) continue;

        const companyName = cells[companyNameIdx].trim();
        const rawCoordinates = cells[coordinatesIdx]?.trim() || '';

        // Parse coordinates safely ("lat, long")
        let latitude = null, longitude = null;
        if (rawCoordinates) {
            const coords = rawCoordinates.split(',').map(c => parseFloat(c.trim()));
            if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                latitude = coords[0];
                longitude = coords[1];
            }
        }

        // Only add to map if valid coordinate geometry is found
        if (latitude !== null && longitude !== null && companyName) {
            let logo = logoIdx !== -1 ? cells[logoIdx].trim() : '';
            if (!logo) {
                // Generates fallback initials if logo link cell is empty
                logo = companyName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            }

            const company = {
                id: data.length + 1,
                name: companyName,
                country: countryIdx !== -1 ? cells[countryIdx].trim() : 'Unknown',
                city: countryIdx !== -1 ? cells[countryIdx].trim() : 'Unknown', // Defaults city display to country
                latitude: latitude,
                longitude: longitude,
                description: descriptionIdx !== -1 ? cells[descriptionIdx].trim() : 'No description',
                website: websiteIdx !== -1 ? cells[websiteIdx].trim() : '#',
                linkedin: linkedinIdx !== -1 ? cells[linkedinIdx].trim() : '#',
                employees: employeesIdx !== -1 ? cells[employeesIdx].trim() : 'N/A',
                founded: foundedIdx !== -1 ? parseInt(cells[foundedIdx]) || 0 : 0,
                revenueRange: revenueIdx !== -1 ? cells[revenueIdx].trim() : 'N/A',
                logo: logo,
                bubbleColor: bubbleColors[data.length % bubbleColors.length]
            };

            data.push(company);
            console.log(`✅ Fully Parsed: ${companyName} at (${latitude}, ${longitude})`);
        } else {
            if (companyName) {
                console.warn(`⚠️ Skipped line ${i + 1} (${companyName}): Invalid coordinates layout -> "${rawCoordinates}"`);
            }
        }
    }

    console.log(`📍 Total companies successfully loaded: ${data.length}`);
    if (data.length === 0) {
        throw new Error('No valid companies parsed. Ensure coordinates inside rows match standard decimal format (e.g., 1.3521, 103.8198).');
    }
    return data;
}

// Load directly from Google Sheets natively (No proxies, no fallbacks)
async function loadCompaniesFromGoogleSheets() {
    try {
        console.log('🚀 Starting native Google Sheets data load...');
        
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
        console.log('📥 Native CSV URL:', csvUrl);

        const response = await fetch(csvUrl);
        console.log(`📥 Response status: ${response.status}`);

        if (!response.ok) {
            throw new Error(`HTTP Error Status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log(`📥 Received ${csvText.length} characters`);
        
        // Prevent parsing if Google outputs standard HTML redirects (e.g. login block screens)
        if (csvText.trim().startsWith('<!DOCTYPE html>')) {
            throw new Error('Google returned HTML instead of CSV data. Verify your sheet sharing access is set to "Anyone with the link can view".');
        }

        if (!csvText || csvText.length < 50) {
            throw new Error('Response data from Google Sheets was empty.');
        }
        
        companiesData = parseCSVData(csvText);
        console.log(`✅✅✅ SUCCESS! Map dataset loaded cleanly.`);
        return companiesData;

    } catch (error) {
        console.error('❌❌❌ DATA RENDER CRITICAL FAILURE!');
        console.error('Error Details:', error.message);
        companiesData = [];
        throw error;
    }
}
