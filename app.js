// Initialize the map globals
let map;
let markers = [];
let markerCluster;
let mapInitialized = false;
let isRefreshing = false;
let markerData = []; // Store company data for search
let activeMarker = null; // Track the currently active (clicked) marker
let companiesOnMap = []; // Store companies with valid coordinates

function setLoadingState(statusText, percent) {
    const overlay = document.getElementById('loadingOverlay');
    const progressBar = document.getElementById('loadingProgressBar');
    const status = document.getElementById('loadingStatus');

    if (status) {
        status.textContent = statusText;
    }

    if (progressBar) {
        const safePercent = Math.max(0, Math.min(100, percent));
        progressBar.style.width = `${safePercent}%`;
    }

    if (overlay && percent >= 100) {
        overlay.classList.add('hidden');
    }
}

async function initMap() {
    try {
        console.log('🗺️ Starting map initialization...');
        setLoadingState('Preparing map...', 10);

        if (!window.L) {
            throw new Error('Leaflet failed to load.');
        }

        console.log('⏳ Waiting for data to load...');
        await loadCompaniesFromGoogleSheets();

        console.log(`📍 Companies loaded: ${companiesData.length}`);

        if (companiesData.length === 0) {
            console.error('❌ No data available to display');
            document.getElementById('map').innerHTML = '<p style="padding: 20px; color: red;">⚠️ Error: No companies data loaded. Check console for details.</p>';
            setLoadingState('No company data available.', 100);
            return;
        }

        setLoadingState('Building map...', 45);

        // Explicit map options prevent Leaflet runtime errors and improves interaction smoothness.
        map = L.map('map', {
            zoomSnap: 0.5,
            preferCanvas: true,
            minZoom: 2,
            maxZoom: 19,
            worldCopyJump: true
        }).setView([20, 0], 2);

        mapInitialized = true;
        console.log('✅ Map created');

        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 2,
            updateWhenIdle: true,
            keepBuffer: 2
        });
        tileLayer.addTo(map);
        console.log('✅ Tiles loaded');

        if (window.L.markerClusterGroup) {
            markerCluster = L.markerClusterGroup({
                chunkedLoading: true,
                maxClusterRadius: 45,
                showCoverageOnHover: false,
                spiderfyOnMaxZoom: true,
                zoomToBoundsOnClick: true,
                disableClusteringAtZoom: 6,
                animate: true,
                removeOutsideVisibleBounds: true
            });
            map.addLayer(markerCluster);
            console.log('✅ Marker clustering enabled');
        } else {
            console.warn('⚠️ MarkerCluster plugin unavailable; using plain markers.');
            markerCluster = null;
        }

        addCompanyMarkers();
        setLoadingState('Adding markers...', 80);
        console.log('✅ Markers added');

        updateCompanyCount(companiesOnMap.length);

        map.on('click', function() {
            if (activeMarker) {
                activeMarker.closePopup();
                const bubble = activeMarker._icon?.querySelector('.company-bubble');
                if (bubble) {
                    bubble.classList.remove('highlighted');
                }
                activeMarker = null;
            }
            closeSearchDropdown();
        });

        map.on('popupopen', function(e) {
            const popupNode = e.popup._container;
            if (popupNode) {
                L.DomEvent.on(popupNode, 'click', L.DomEvent.stopPropagation);
                L.DomEvent.on(popupNode, 'mousedown', L.DomEvent.stopPropagation);
            }
        });

        setLoadingState('Map ready', 100);
        setTimeout(() => {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.classList.add('hidden');
            }
        }, 400);

    } catch (error) {
        console.error('❌ Error initializing map:', error);
        setLoadingState('Map failed to load', 100);
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.innerHTML = '<p style="padding: 20px; color: #f87171;">⚠️ Map failed to load. Please refresh the page.</p>';
        }
    }
}

function isImageUrl(url) {
    return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image'));
}

function clearMap() {
    console.log('🧹 Clearing markers...');

    if (map && markerCluster) {
        markerCluster.clearLayers();
    } else if (map) {
        markers.forEach(marker => map.removeLayer(marker));
    }

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
            if (!company.latitude || !company.longitude) {
                console.warn(`⚠️ Skipping ${company.name} - missing coordinates`);
                return;
            }

            let logoHTML = '';
            if (isImageUrl(company.logo)) {
                logoHTML = `<img src="${company.logo}" alt="logo" style="width:70%;height:70%;object-fit:contain;border-radius:50%;">`;
            } else {
                logoHTML = `<span>${company.logo}</span>`;
            }

            const bubbleHTML = `
                <div class="company-bubble ${company.bubbleColor}">
                    ${logoHTML}
                </div>
            `;

            const customIcon = L.divIcon({
                html: bubbleHTML,
                iconSize: [32, 32],
                className: 'custom-marker'
            });

            const marker = L.marker([company.latitude, company.longitude], {
                icon: customIcon,
                riseOnHover: true,
                keyboard: false
            });

            marker.companyIndex = index;
            marker.companyData = company;

            const tooltipContent = createTooltipContent(company);
            marker.bindPopup(tooltipContent, {
                className: 'company-popup',
                maxWidth: 300,
                closeButton: false,
                autoPan: true
            });

            marker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);

                if (activeMarker && activeMarker !== this) {
                    activeMarker.closePopup();
                    const oldBubble = activeMarker._icon?.querySelector('.company-bubble');
                    if (oldBubble) {
                        oldBubble.classList.remove('highlighted');
                    }
                }

                this.openPopup();
                activeMarker = this;

                const bubble = this._icon?.querySelector('.company-bubble');
                if (bubble) {
                    bubble.classList.add('highlighted');
                }
            });

            if (markerCluster) {
                markerCluster.addLayer(marker);
            } else {
                marker.addTo(map);
            }

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
    let websiteUrl = company.website ? company.website.trim() : '#';
    if (websiteUrl !== '#' && !websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
        websiteUrl = 'https://' + websiteUrl;
    }

    let linkedinUrl = company.linkedin ? company.linkedin.trim() : '#';
    if (linkedinUrl !== '#' && !linkedinUrl.startsWith('http://') && !linkedinUrl.startsWith('https://')) {
        linkedinUrl = 'https://' + linkedinUrl;
    }

    const linkedinLink = linkedinUrl !== '#' ? `<a href="${linkedinUrl}" target="_blank" rel="noopener noreferrer">LinkedIn</a>` : '';
    const websiteLink = websiteUrl !== '#' ? `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer">Visit Website →</a>` : '';

    let logoHTML = '';
    if (isImageUrl(company.logo)) {
        logoHTML = `<img src="${company.logo}" alt="${company.name} logo" class="tooltip-logo">`;
    }

    return `
        <div class="company-tooltip">
            <div class="tooltip-header">
                ${logoHTML}
                <div class="tooltip-header-content">
                    <div class="tooltip-company-name">${company.name}</div>
                    <div class="tooltip-location">📍 ${company.city || company.country}</div>
                </div>
            </div>

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

function closeSearchDropdown() {
    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) {
        dropdown.classList.remove('visible');
        dropdown.innerHTML = '';
    }
}

function goToCompany(index) {
    const marker = markers[index];
    if (marker) {
        if (activeMarker && activeMarker !== marker) {
            activeMarker.closePopup();
            const oldBubble = activeMarker._icon?.querySelector('.company-bubble');
            if (oldBubble) {
                oldBubble.classList.remove('highlighted');
            }
        }

        map.flyTo(marker.getLatLng(), 5, { duration: 1.2, easeLinearity: 0.25 });
        marker.openPopup();
        activeMarker = marker;

        const bubble = marker._icon?.querySelector('.company-bubble');
        if (bubble) {
            bubble.classList.add('highlighted');
        }

        closeSearchDropdown();
        document.getElementById('searchInput').value = '';
        console.log(`✅ Navigated to: ${marker.companyData.name}`);
    }
}

function searchCompaniesWithDropdown(query) {
    const dropdown = document.getElementById('searchDropdown');
    query = query.toLowerCase().trim();

    markers.forEach(marker => {
        const bubble = marker._icon?.querySelector('.company-bubble');
        if (bubble) {
            bubble.classList.remove('highlighted');
        }
    });

    if (!query) {
        closeSearchDropdown();
        updateCompanyCount(companiesOnMap.length);
        return;
    }

    const matches = [];
    markerData.forEach((company, index) => {
        const nameMatch = company.name.toLowerCase().includes(query);
        const cityMatch = company.city ? company.city.toLowerCase().includes(query) : false;
        const countryMatch = company.country.toLowerCase().includes(query);

        if (nameMatch || cityMatch || countryMatch) {
            matches.push({ index, company });
        }
    });

    if (matches.length > 0) {
        const displayMatches = matches.slice(0, 5);
        dropdown.innerHTML = displayMatches.map((match) => `
            <div class="dropdown-item" onclick="goToCompany(${match.index})" data-index="${match.index}">
                <div class="dropdown-item-logo">
                    ${isImageUrl(match.company.logo) ? `<img src="${match.company.logo}" alt="logo">` : '<span>📌</span>'}
                </div>
                <div class="dropdown-item-content">
                    <div class="dropdown-item-name">${match.company.name}</div>
                    <div class="dropdown-item-location">📍 ${match.company.city || match.company.country}</div>
                </div>
            </div>
        `).join('');

        if (matches.length > 5) {
            dropdown.innerHTML += `<div class="dropdown-see-more">... and ${matches.length - 5} more results. Keep typing to filter.</div>`;
        }

        dropdown.classList.add('visible');
    } else {
        dropdown.innerHTML = '<div class="dropdown-empty">No companies found</div>';
        dropdown.classList.add('visible');
    }

    updateCompanyCount(matches.length);
}

async function refreshData() {
    if (isRefreshing) {
        console.warn('⚠️ Refresh already in progress');
        return;
    }

    try {
        isRefreshing = true;
        const refreshBtn = document.getElementById('refreshBtn');

        console.log('🔄 Starting data refresh...');
        setLoadingState('Refreshing company data...', 30);
        refreshBtn.disabled = true;
        refreshBtn.classList.add('loading');
        refreshBtn.textContent = 'Loading...';

        clearMap();
        document.getElementById('searchInput').value = '';
        closeSearchDropdown();

        await loadCompaniesFromGoogleSheets();

        if (companiesData.length === 0) {
            console.error('❌ No data received from refresh');
            alert('❌ Error: No companies data loaded. Check console for details.');
            refreshBtn.textContent = 'Refresh';
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('loading');
            isRefreshing = false;
            setLoadingState('No company data available.', 100);
            return;
        }

        addCompanyMarkers();
        updateCompanyCount(companiesOnMap.length);
        setLoadingState('Map refreshed', 100);

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
        setLoadingState('Map refresh failed', 100);
    } finally {
        isRefreshing = false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Page loaded, initializing...');
    initMap();

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
        console.log('✅ Refresh button listener attached');
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchCompaniesWithDropdown(e.target.value);
        });
        searchInput.addEventListener('blur', () => {
            setTimeout(closeSearchDropdown, 200);
        });
        searchInput.addEventListener('focus', (e) => {
            if (e.target.value.trim()) {
                searchCompaniesWithDropdown(e.target.value);
            }
        });
        console.log('✅ Search input listener attached');
    }

    document.addEventListener('click', (e) => {
        const searchWrapper = document.querySelector('.search-wrapper');
        if (searchWrapper && !searchWrapper.contains(e.target)) {
            closeSearchDropdown();
        }
    });
});

window.addEventListener('resize', function() {
    if (map && mapInitialized) {
        map.invalidateSize();
    }
});
