// Initialize the map globals
let map;
let markers = [];
let mapInitialized = false;
let isRefreshing = false;
let markerData = []; // Store company data for search
let activeMarker = null; // Track the currently active (clicked) marker
let searchResults = []; // Store search result marker indices
let companiesOnMap = []; // Store companies with valid coordinates

async function initMap() {
    try {
        console.log('🗺️ Starting map initialization...');
        
        // Load data from Google Sheets natively via data.js
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

        // CRITICAL FIX: Safe click context capture inside Leaflet Tooltip elements.
        // Prevents Leaflet map handlers from capturing pointer clicks on hyperlinks inside popups.
        map.on('popupopen', function(e) {
            const popupNode = e.popup._container;
            if (popupNode) {
                L.DomEvent.on(popupNode, 'click', L.DomEvent.stopPropagation);
                L.DomEvent.on(popupNode, 'mousedown', L.DomEvent.stopPropagation);
            }
        });

        // Add company markers to the map layer
        addCompanyMarkers();
        console.log('✅ Markers added');
        
        // Update company count with companies that have coordinates
        updateCompanyCount(companiesOnMap.length);
        
        // CRITICAL FIX: Safe click binding. Listens to map canvas clicks to deselect active items
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
    companiesOnMap = [];
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
            // Check if company has valid coordinates
            if (!company.latitude || !company.longitude) {
                console.warn(`⚠️ Skipping ${company.name} - missing coordinates`);
                return;
            }

            // Render logo as an image if a valid URL exists
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

            // Create custom Leaflet DivIcon
            const customIcon = L.divIcon({
                html: bubbleHTML,
                iconSize: [32, 32],
                className: 'custom-marker'
            });

            // Create marker instance
            const marker = L.marker([company.latitude, company.longitude], {
                icon: customIcon
            }).addTo(map);

            // Store marker parameters for search matching
            marker.companyIndex = index;
            marker.companyData = company;

            // Generate popup content structure
            const tooltipContent = createTooltipContent(company);

            // Bind popup UI container to marker
            marker.bindPopup(tooltipContent, {
                className: 'company-popup',
                maxWidth: 300,
                closeButton: false
            });

            // Show preview content card on hover
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

            // Handle pinning selection on click
            marker.on('click', function(e) {
                // CRITICAL FIX: Stops the click event from bubbling up to the map canvas layer
                L.DomEvent.stopPropagation(e);
                
                // Clear state of any previously clicked marker
                if (activeMarker && activeMarker !== this) {
                    activeMarker.closePopup();
                    const oldBubble = activeMarker._icon?.querySelector('.company-bubble');
                    if (oldBubble) {
                        oldBubble.classList.remove('highlighted');
                    }
                }
                
                // Pin open new marker popup card
                this.openPopup();
                activeMarker = this;
                
                // Highlight the specific bubble element node
                const bubble = this._icon?.querySelector('.company-bubble');
                if (bubble) {
                    bubble.classList.add('highlighted');
                }
                
                console.log(`✅ Company selected: ${company.name}`);
            });

            markers.push(marker);
            markerData.push(company);
            companiesOnMap.push(company);
        } catch (error) {
            console.error(`Error adding marker for ${company.name}:`, error);
        }
    });
    
    console.log(`✅ Added ${markers.length} markers to map`);
}

function createTooltipContent(company) {
    // AUTOMATIC SEARCH GUARD FOR PROTOCOLS (e.g. fixes missing http/https strings from spreadsheet cells)
    let websiteUrl = company.website ? company.website.trim() : '#';
    if (websiteUrl !== '#' && !websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
        websiteUrl = 'https://' + websiteUrl;
    }

    let linkedinUrl = company.linkedin ? company.linkedin.trim() : '#';
    if (linkedinUrl !== '#' && !linkedinUrl.startsWith('http://') && !linkedinUrl.startsWith('https://')) {
        linkedinUrl = 'https://' + linkedinUrl;
    }

    const linkedinLink = linkedinUrl !== '#' ? 
        `<a href="${linkedinUrl}" target="_blank">LinkedIn</a>` : '';
    
    const websiteLink = websiteUrl !== '#' ? 
        `<a href="${websiteUrl}" target="_blank">Visit Website →</a>` : '';

    return `
        <div class="company-tooltip">
            <div class="tooltip-company-name">${company.name}</div>
            <div class="tooltip-location">📍 ${company.city || company.country}</div>
            
            <div class="tooltip-divider"></div>
            
            <div class="tooltip-description">
                "${company.description}"
            </div>
            
            <div class="tooltip-divider"></div>
            
            <div class="tooltip-row">
                <span class="tooltip-label"> Employees:</span>
                <span class="tooltip-value">${company.employees || 'N/A'}</span>
            </div>
            
            <div class="tooltip-row">
                <span class="tooltip-label"> Founded:</span>
                <span class="tooltip-value">${company.founded || 'N/A'}</span>
            </div>
            
            <div class="tooltip-row">
                <span class="tooltip-label"> Revenue:</span>
                <span class="tooltip-value">${company.revenueRange || 'N/A'}</span>
            </div>
            
            <div class="tooltip-website">
                ${websiteLink}
                ${linkedinLink ? ' | ' + linkedinLink : ''}
            </div>
        </div>
    `;
}

function updateCompanyCount(count) {
    const countElement = document.getElementById('companyCount');
    if (countElement) {
        countElement.textContent = count;
    }
}

// Global text queries search mapping matching functionality
function searchCompanies(query) {
    query = query.toLowerCase().trim();
    
    // Clear out previous query match highlight elements
    markers.forEach(marker => {
        const bubble = marker._icon?.querySelector('.company-bubble');
        if (bubble) {
            bubble.classList.remove('highlighted');
        }
    });
    
    if (!query) {
        console.log('🔍 Search cleared');
        searchResults = [];
        updateCompanyCount(companiesOnMap.length);
        return;
    }

    // Loop parameters searching structural metadata strings
    searchResults = [];
    markerData.forEach((company, index) => {
        const nameMatch = company.name.toLowerCase().includes(query);
        const cityMatch = company.city ? company.city.toLowerCase().includes(query) : false;
        const countryMatch = company.country.toLowerCase().includes(query);
        
        if (nameMatch || cityMatch || countryMatch) {
            searchResults.push(index);
            // Highlight matching bubble node properties
            const bubble = markers[index]._icon?.querySelector('.company-bubble');
            if (bubble) {
                bubble.classList.add('highlighted');
            }
        }
    });

    console.log(`🔍 Found ${searchResults.length} matching companies`);
    updateCompanyCount(searchResults.length);
    
    // Auto bounding pan zoom adjustment views depending on the volume of match instances
    if (searchResults.length === 1) {
        const markerIndex = searchResults[0];
        const marker = markers[markerIndex];
        map.setView(marker.getLatLng(), 25);
    } else if (searchResults.length > 1) {
        const group = new L.featureGroup(searchResults.map(i => markers[i]));
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
}

// Refresh data action command execution context properties
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
        refreshBtn.textContent = 'Loading...';

        // Wipe visual markers layer stack array references prior to fetching
        clearMap();
        document.getElementById('searchInput').value = '';

        // Trigger dynamic spreadsheet content reloading endpoint reference
        await loadCompaniesFromGoogleSheets();

        if (companiesData.length === 0) {
            console.error('❌ No data received from refresh');
            alert('❌ Error: No companies data loaded. Check console for details.');
            refreshBtn.textContent = 'Refresh';
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('loading');
            isRefreshing = false;
            return;
        }

        // Reassemble canvas marker element stack references
        addCompanyMarkers();
        updateCompanyCount(companiesOnMap.length);

        console.log('✅ Refresh completed successfully');
        refreshBtn.textContent = 'Refresh';
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('loading');

    } catch (error) {
        console.error('❌ Error refreshing data:', error);
        alert('❌ Error refreshing data. Please try again.');
        
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.textContent = 'Refresh';
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('loading');
        
    } finally {
        isRefreshing = false;
    }
}

// Base operational standard DOM lifecycle listener context block
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Page loaded, initializing...');
    
    // Core map runtime execution launch
    initMap();

    // Event listener connection context assignments
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
        console.log('✅ Refresh button listener attached');
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchCompanies(e.target.value);
        });
        console.log('✅ Search input listener attached');
    }
});

// Structural browser element resizing display update recalculations handlers
window.addEventListener('resize', function() {
    if (map && mapInitialized) {
        map.invalidateSize();
    }
});
