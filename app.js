// Initialize the map
let map;
let markers = [];

function initMap() {
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
}

function addCompanyMarkers() {
    companiesData.forEach(company => {
        // Create custom HTML for the bubble
        const bubbleHTML = `
            <div class="company-bubble ${company.bubbleColor}">
                ${company.name.split(' ')[0][0]}${company.name.split(' ')[1][0]}
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

        // Click to open in new tab
        marker.on('click', function() {
            window.open(company.website, '_blank');
        });

        markers.push(marker);
    });
}

function createTooltipContent(company) {
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
                <span class="tooltip-value">${company.employees.toLocaleString()}</span>
            </div>
            
            <div class="tooltip-row">
                <span class="tooltip-label">📅 Founded:</span>
                <span class="tooltip-value">${company.founded}</span>
            </div>
            
            <div class="tooltip-row">
                <span class="tooltip-label">💰 Revenue:</span>
                <span class="tooltip-value">${company.revenueRange}</span>
            </div>
            
            <div class="tooltip-website">
                <a href="${company.website}" target="_blank">Visit Website →</a>
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