// Initialize the map
let map;
let markers = [];

async function initMap() {
    // Load data from Google Sheets first
    await loadCompaniesFromGoogleSheets();

    // Create map centered on world
    map = L.map('map').setView([20, 0], 3);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 2
    }).addTo(map);

    // Add company markers
    addCompanyMarkers();

    // Show loading message
    showLoadingMessage();
}

function showLoadingMessage() {
    if (companiesData.length === 0) {
        console.warn('No companies data loaded');
    } else {
        console.log(`Map loaded with ${companiesData.length} companies`);
    }
}

function addCompanyMarkers() {
    companiesData.forEach(company => {
        // Create custom HTML for the bubble
        const bubbleHTML = `
            <div class="company-bubble ${company.bubbleColor}">
                ${company.logo}
            </div>
        `;

        // Create custom icon
        const customIcon = L.divIcon({
            html: bubbleHTML,
            iconSize: [50, 50],
            className: 'custom-marker'
        });

        // Create marker
        const marker = L.marker([company.latitude, company.longitude], {
            icon: customIcon
        }).addTo(map);

        // Create tooltip content
        const tooltipContent = createTooltipContent(company);

        // Bind popup to marker
        marker.bindPopup(tooltipContent, {
            className: 'company-popup',
            maxWidth: 300,
            closeButton: false
        });

        // Show tooltip on hover
        marker.on('mouseover', function() {
            this.openPopup();
        });

        marker.on('mouseout', function() {
            this.closePopup();
        });

        // Click to open website in new tab
        marker.on('click', function() {
            if (company.website && company.website !== '#') {
                window.open(company.website, '_blank');
            }
        });

        markers.push(marker);
    });
}

function createTooltipContent(company) {
    const linkedinLink = company.linkedin && company.linkedin !== '#' ? 
        `<a href="${company.linkedin}" target="_blank">LinkedIn</a>` : '';
    
    const websiteLink = company.website && company.website !== '#' ? 
        `<a href="${company.website}" target="_blank">Visit Website →</a>` : '';

    return `
        <div class="company-tooltip">
            <div class="tooltip-company-name">${company.name}</div>
            <div class="tooltip-location">📍 ${company.city}, ${company.country}</div>
            
            <div class="tooltip-divider"></div>
            
            <div class="tooltip-description">
                "${company.description}"
            </div>
            
            <div class="tooltip-divider"></div>
            
            <div class="tooltip-row">
                <span class="tooltip-label">👥 Employees:</span>
                <span class="tooltip-value">${company.employees ? company.employees.toLocaleString() : 'N/A'}</span>
            </div>
            
            <div class="tooltip-row">
                <span class="tooltip-label">📅 Founded:</span>
                <span class="tooltip-value">${company.founded || 'N/A'}</span>
            </div>
            
            <div class="tooltip-row">
                <span class="tooltip-label">💰 Revenue:</span>
                <span class="tooltip-value">${company.revenueRange || 'N/A'}</span>
            </div>
            
            <div class="tooltip-website">
                ${websiteLink}
                ${linkedinLink ? ' | ' + linkedinLink : ''}
            </div>
        </div>
    `;
}

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', initMap);

// Handle window resize
window.addEventListener('resize', function() {
    if (map) {
        map.invalidateSize();
    }
});