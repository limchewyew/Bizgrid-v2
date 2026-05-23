// Initialize the map
let map;
let markers = [];
let mapInitialized = false;
let isRefreshing = false;
let markerData = []; // Store company data for search
let activeMarker = null; // Track the currently active (clicked) marker
let searchResults = []; // Store search result marker indices

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

function clearMap() {
    console.log('🧹 Clearing markers...');
    markers.forEach(marker => {
        map.removeLayer(marker);
    });
    markers = [];
    markerData = [];
    activeMarker = null;
    console.log('✅ Markers cleared');
}

function addCompanyMarkers() {
    if (companiesData.length === 0) {
        console.warn('⚠️ No companies to display');
        return;
    }

    companiesData.forEach((company, index) => {
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

            // Store marker data for search
            marker.companyIndex = index;
            marker.companyData = company;

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
                if (activeMarker !== this) {
                    this.openPopup();
                }
            });

            marker.on('mouseout', function() {
                if (activeMarker !== this) {
                    this.closePopup();
                }
            });

            // Keep tooltip open on click (don't navigate)
            marker.on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Close previous active marker
                if (activeMarker && activeMarker !== this) {
                    activeMarker.closePopup();
                    const oldBubble = activeMarker._icon?.querySelector('.company-bubble');
                    if (oldBubble) {
                        oldBubble.classList.remove('highlighted');
                    }
                }
                
                // Open new marker popup
                this.openPopup();
                activeMarker = this;
                
                // Highlight the bubble
                const bubble = this._icon?.querySelector('.company-bubble');
                if (bubble) {
                    bubble.classList.add('highlighted');
                }
                
                console.log(`✅ Company selected: ${company.name}`);
            });

            markers.push(marker);
            markerData.push(company);
        } catch (error) {
            console.error(`Error adding marker for ${company.name}:`, error);
        }
    });
    
    console.log(`✅ Added ${markers.length} markers to map`);
}

function createTooltipContent(company) {
    const linkedinLink = company.linkedin && company.linkedin !== '#' ? 
        `<a href="${company.linkedin}" target="_blank" onclick="event.stopPropagation()">LinkedIn</a>` : '';
    
    const websiteLink = company.website && company.website !== '#' ? 
        `<a href="${company.website}" target="_blank" onclick="event.stopPropagation()">Visit Website →</a>` : '';

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

// Search functionality
function searchCompanies(query) {
    const searchInput = document.getElementById('searchInput');
    query = query.toLowerCase().trim();
    
    // Clear previous highlights
    markers.forEach(marker => {
        const bubble = marker._icon?.querySelector('.company-bubble');
        if (bubble) {
            bubble.classList.remove('highlighted');
        }
    });
    
    if (!query) {
        console.log('🔍 Search cleared');
        searchResults = [];
        return;
    }

    // Search through companies
    searchResults = [];
    markerData.forEach((company, index) => {
        const nameMatch = company.name.toLowerCase().includes(query);
        const cityMatch = company.city.toLowerCase().includes(query);
        const countryMatch = company.country.toLowerCase().includes(query);
        
        if (nameMatch || cityMatch || countryMatch) {
            searchResults.push(index);
            // Highlight matching bubble
            const bubble = markers[index]._icon?.querySelector('.company-bubble');
            if (bubble) {
                bubble.classList.add('highlighted');
            }
        }
    });

    console.log(`🔍 Found ${searchResults.length} matching companies`);
    
    // If only one result, center on it
    if (searchResults.length === 1) {
        const markerIndex = searchResults[0];
        const marker = markers[markerIndex];
        map.setView(marker.getLatLng(), 6);
    } else if (searchResults.length > 1) {
        // Fit map to all results
        const group = new L.featureGroup(searchResults.map(i => markers[i]));
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
}

// Refresh data on demand
async function refreshData() {
    if (isRefreshing) {
        console.warn('⚠️ Refresh already in progress');
        return;
    }

    try {
        isRefreshing = true;
        const refreshBtn = document.getElementById('refreshBtn');
        
        console.log('🔄 Starting data refresh...');
        refreshBtn.disabled = true;
        refreshBtn.classList.add('loading');
        refreshBtn.textContent = '⏳ Loading...';

        // Clear existing markers and search
        clearMap();
        document.getElementById('searchInput').value = '';

        // Reload data from Google Sheets
        console.log('⏳ Fetching updated data...');
        await loadCompaniesFromGoogleSheets();

        if (companiesData.length === 0) {
            console.error('❌ No data received from refresh');
            alert('❌ Error: No companies data loaded. Check console for details.');
            refreshBtn.textContent = '🔄 Refresh';
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('loading');
            isRefreshing = false;
            return;
        }

        // Re-add markers
        addCompanyMarkers();

        console.log('✅ Refresh completed successfully');
        refreshBtn.textContent = '🔄 Refresh';
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('loading');

    } catch (error) {
        console.error('❌ Error refreshing data:', error);
        alert('❌ Error refreshing data. Please try again.');
        
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.textContent = '🔄 Refresh';
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('loading');
        
    } finally {
        isRefreshing = false;
    }
}

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Page loaded, initializing...');
    initMap();

    // Add refresh button event listener
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
        console.log('✅ Refresh button listener attached');
    }

    // Add search input event listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchCompanies(e.target.value);
        });
        console.log('✅ Search input listener attached');
    }

    // Close active marker when clicking on map
    map.on('click', function() {
        if (activeMarker) {
            activeMarker.closePopup();
            const bubble = activeMarker._icon?.querySelector('.company-bubble');
            if (bubble) {
                bubble.classList.remove('highlighted');
            }
            activeMarker = null;
        }
    });
});

// Handle window resize
window.addEventListener('resize', function() {
    if (map && mapInitialized) {
        map.invalidateSize();
    }
});
