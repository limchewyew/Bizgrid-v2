// Initialize the map
let map;
let markers = [];
let mapInitialized = false;

async function initMap() {
    try {
        console.log('🗺️ Starting map initialization...');
        
        // Load data from Google Sheets
        console.log('⏳ Waiting for data to load...');
        await loadCompaniesFromGoogleSheets();
        
        console.log(`📍 Companies loaded: ${companiesData.length}`);
        
        // Only initialize map if we have data
        if (companiesData.length === 0) {
            console.error('❌ No data available to display');
            document.getElementById('map').innerHTML = '<p style="padding: 20px; color: red;">⚠️ Error: No companies data loaded. Check console for details.</p>';
            return;
        }

        // Create map centered on world
        map = L.map('map').setView([20, 0], 3);
        mapInitialized = true;
        console.log('✅ Map created');

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 2
        }).addTo(map);
        console.log('✅ Tiles loaded');

        // Add company markers
        addCompanyMarkers();
        console.log('✅ Markers added');
        
    } catch (error) {
        console.error('❌ Error initializing map:', error);
    }
}

function isImageUrl(url) {
    return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image'));
}

function addCompanyMarkers() {
    if (companiesData.length === 0) {
        console.warn('⚠️ No companies to display');
        return;
    }

    companiesData.forEach(company => {
        try {
            // Render logo as an image if possible
            let logoHTML = '';
            if (isImageUrl(company.logo)) {
                logoHTML = `<img src="${company.logo}" alt="logo" style="width:70%;height:70%;object-fit:contain;border-radius:50%;">`;
            } else {
                logoHTML = `<span>${company.logo}</span>`;
            }

            // Create custom HTML for the bubble
            const bubbleHTML = `
                <div class="company-bubble ${company.bubbleColor}">
                    ${logoHTML}
                </div>
            `;

            // Create custom icon (smaller size)
            const customIcon = L.divIcon({
                html: bubbleHTML,
                iconSize: [32, 32],
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

            // Click to open website
            marker.on('click', function() {
                if (company.website && company.website !== '#') {
                    window.open(company.website, '_blank');
                }
            });

            markers.push(marker);
        } catch (error) {
            console.error(`Error adding marker for ${company.name}:`, error);
        }
    });
    
    console.log(`✅ Added ${markers.length} markers to map`);
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
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Page loaded, initializing...');
    initMap();
});

// Handle window resize
window.addEventListener('resize', function() {
    if (map && mapInitialized) {
        map.invalidateSize();
    }
});