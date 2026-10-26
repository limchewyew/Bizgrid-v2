// Initialize the map globals
let map;
let markers = [];
let mapInitialized = false;
let isRefreshing = false;
let markerData = [];
let activeMarker = null;
let searchResults = [];
let companiesOnMap = [];
let markerClusterGroup = null;

function setLoadingProgress(percent, statusText = '') {
    const bar = document.getElementById('loadingProgressBar');
    const status = document.getElementById('loadingStatus');

    if (bar) {
        bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }

    if (status && statusText) {
        status.textContent = statusText;
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    const mapEl = document.getElementById('map');

    if (mapEl) {
        mapEl.classList.add('map-ready');
    }

    if (overlay) {
        overlay.classList.add('hidden');
    }
}

function createMarkerClusterIcon(cluster) {
    const count = cluster.getChildCount();
    let className = 'marker-cluster-small';

    if (count >= 20) {
        className = 'marker-cluster-large';
    } else if (count >= 8) {
        className = 'marker-cluster-medium';
    }

    return new L.DivIcon({
        html: `<div><span>${count}</span></div>`,
        className: `marker-cluster ${className}`,
        iconSize: new L.Point(40, 40)
    });
}

async function initMap() {
    try {
        console.log('🗺️ Starting map initialization...');
        const mapEl = document.getElementById('map');
        if (mapEl) mapEl.classList.remove('map-ready');

        setLoadingProgress(5, 'Fetching company data...');

        console.log('⏳ Waiting for data to load...');
        await loadCompaniesFromGoogleSheets();
        setLoadingProgress(35, 'Preparing map...');

        console.log(`📍 Companies loaded: ${companiesData.length}`);

        if (companiesData.length === 0) {
            console.error('❌ No data available to display');
            const mapBox = document.getElementById('map');
            if (mapBox) {
                mapBox.innerHTML = '<p style="padding: 20px; color: red;">⚠️ Error: No companies data loaded. Check console for details.</p>';
            }
            setLoadingProgress(100, 'Data unavailable');
            hideLoadingOverlay();
            return;
        }

        map = L.map('map', {
            preferCanvas: true,
            zoomControl: true,
            attributionControl: true,
            fadeAnimation: true,
            zoomSnap: 0.5,
            zoomDelta: 0.5,
            updateWhenZooming: false,
            updateWhenIdle: true,
            worldCopyJump: true,
            renderer: L.canvas({ padding: 0.1 })
        }).setView([20, 0], 3);
        mapInitialized = true;
        console.log('✅ Map created');

        markerClusterGroup = L.markerClusterGroup({
            chunkedLoading: true,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            disableClusteringAtZoom: 10,
            maxClusterRadius: 50,
            iconCreateFunction: createMarkerClusterIcon,
            removeOutsideVisibleBounds: true,
            animate: true
        });
        map.addLayer(markerClusterGroup);

        setLoadingProgress(55, 'Loading map tiles...');

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 2,
            updateWhenIdle: true
        }).addTo(map);

        console.log('✅ Tiles loaded');

        map.on('popupopen', function(e) {
            const popupNode = e.popup._container;
            if (popupNode) {
                L.DomEvent.on(popupNode, 'click', L.DomEvent.stopPropagation);
                L.DomEvent.on(popupNode, 'mousedown', L.DomEvent.stopPropagation);
            }
        });

        map.on('zoomstart', function() {
            if (activeMarker) {
                activeMarker.closePopup();
                const bubble = activeMarker._icon?.querySelector('.company-bubble');
                if (bubble) {
                    bubble.classList.remove('highlighted');
                }
                activeMarker = null;
            }
        });

        map.whenReady(() => {
            setLoadingProgress(70, 'Placing companies on map...');
        });

        renderCompanyMarkersInBatches();
        console.log('✅ Marker render started');

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

    } catch (error) {
        console.error('❌ Error initializing map:', error);
        setLoadingProgress(100, 'Map failed to load');
        hideLoadingOverlay();
    }
}

function isImageUrl(url) {
    return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image'));
}

function clearMap() {
    console.log('🧹 Clearing markers...');
    if (markerClusterGroup) {
        markerClusterGroup.clearLayers();
    }
    if (map) {
        markers.forEach(marker => {
            map.removeLayer(marker);
        });
    }
    markers = [];
    markerData = [];
    companiesOnMap = [];
    activeMarker = null;
    console.log('✅ Markers cleared');
}

function addSingleCompanyMarker(company, index) {
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
            keyboard: false,
            opacity: 1,
            title: company.name
        });

        marker.companyIndex = index;
        marker.companyData = company;

        const tooltipContent = createTooltipContent(company);

        marker.bindPopup(tooltipContent, {
            className: 'company-popup',
            maxWidth: 300,
            closeButton: false
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

            console.log(`✅ Company selected: ${company.name}`);
        });

        if (markerClusterGroup) {
            markerClusterGroup.addLayer(marker);
        } else {
            map.addLayer(marker);
        }

        markers.push(marker);
        markerData.push(company);
        companiesOnMap.push(company);
    } catch (error) {
        console.error(`Error adding marker for ${company.name}:`, error);
    }
}

function renderCompanyMarkersInBatches() {
    if (!companiesData.length) return;

    markers = [];
    markerData = [];
    companiesOnMap = [];

    const total = companiesData.length;
    const batchSize = 25;
    let currentIndex = 0;

    const renderNextBatch = () => {
        const end = Math.min(currentIndex + batchSize, total);

        for (let i = currentIndex; i < end; i++) {
            addSingleCompanyMarker(companiesData[i], i);
        }

        currentIndex = end;
        const progress = 70 + ((currentIndex / total) * 25);
        setLoadingProgress(Math.min(95, progress), `Placing companies on map... ${currentIndex}/${total}`);

        if (currentIndex < total) {
            requestAnimationFrame(() => {
                setTimeout(renderNextBatch, 16);
            });
            return;
        }

        updateCompanyCount(companiesOnMap.length);
        setLoadingProgress(100, 'Map ready');
        setTimeout(() => hideLoadingOverlay(), 400);
        console.log(`✅ Added ${markers.length} markers to map in batches`);
    };

    renderNextBatch();
}

function addCompanyMarkers() {
    if (companiesData.length === 0) {
        console.warn('⚠️ No companies to display');
        return;
    }

    companiesData.forEach((company, index) => {
        addSingleCompanyMarker(company, index);
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

    const linkedinLink = linkedinUrl !== '#' ?
        `<a href="${linkedinUrl}" target="_blank">LinkedIn</a>` : '';

    const websiteLink = websiteUrl !== '#' ?
        `<a href="${websiteUrl}" target="_blank">Visit Website →</a>` : '';

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

        map.setView(marker.getLatLng(), 12);
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
        console.log('🔍 Search cleared');
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

    console.log(`🔍 Found ${matches.length} matching companies (showing 5)`);
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
        refreshBtn.disabled = true;
        refreshBtn.classList.add('loading');
        refreshBtn.textContent = 'Loading...';

        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }

        setLoadingProgress(10, 'Refreshing company data...');

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
            setLoadingProgress(100, 'Update failed');
            hideLoadingOverlay();
            return;
        }

        setLoadingProgress(60, 'Rebuilding map markers...');
        addCompanyMarkers();
        updateCompanyCount(companiesOnMap.length);
        setLoadingProgress(100, 'Refresh complete');
        setTimeout(() => hideLoadingOverlay(), 350);

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
