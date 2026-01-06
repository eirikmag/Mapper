// Initialize map
console.log("App v2 loaded - Gradients Enabled");
const map = L.map('map').setView([65.0, 15.0], 5); // Approximate center of Norway

// Custom Pane for GPX Tracks to ensure they are on top
map.createPane('gpxPane');
map.getPane('gpxPane').style.zIndex = 650; // Above markers (600) and overlays (400)

// 1. Topographic Map Layer (Statens Kartverk Cache)
const topoLayer = L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', {
    attribution: '&copy; <a href="http://www.kartverket.no/">Kartverket</a>',
    maxZoom: 18
}).addTo(map);

// 1b. Aerial Map Layer (Norge i bilder)
const aerialLayer = L.tileLayer('https://opencache.statkart.no/gatekeeper/gk/gk.open_nib_web_mercator_wmts_v2?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=Nibcache_web_mercator_v2&STYLE=default&FORMAT=image/png&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', {
    attribution: '&copy; <a href="http://www.norgeibilder.no/">Norge i bilder</a> / <a href="http://www.kartverket.no/">Kartverket</a>',
    maxZoom: 18
});

// 2. Property Borders Layer (Matrikkelen WMS)
const propertyLayer = L.tileLayer.wms('https://wms.geonorge.no/skwms1/wms.matrikkel', {
    layers: 'matrikkel_WMS', // Based on GetCapabilities
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    attribution: '&copy; <a href="http://www.kartverket.no/">Kartverket</a>',
    zIndex: 10 // Ensure it sits on top of the base map
}).addTo(map);

// Layer Control
const baseMaps = {
    "Topographic Map": topoLayer,
    "Aerial Photo (NiB)": aerialLayer
};

const overlayMaps = {
    "Property Borders": propertyLayer
};

L.control.layers(baseMaps, overlayMaps).addTo(map);

// 3. GPX Storage and Management
const STORAGE_KEY = 'gpx_tracks';
let localTracks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const loadedLayers = {}; // Key: filename/url, Value: Leaflet Layer

// UI Elements
const inputElement = document.getElementById('gpx-upload');
const serverTrackList = document.getElementById('server-track-list');
const localTrackList = document.getElementById('local-track-list');
const clearAllBtn = document.getElementById('clear-all-btn');
const noServerTracksMsg = document.getElementById('no-server-tracks');

// --- Helper Functions ---

function getTrackColor(type) {
    switch (type) {
        case 'hiking': return '#d9534f'; // Red
        case 'skiing': return '#4169e1'; // Royal Blue
        default: return '#4169e1'; // Default Blue
    }
}

function saveLocalTracks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localTracks));
    } catch (e) {
        alert("Storage full! Could not save track.");
    }
}

// Add track to map
// urlOrContent: can be a URL (for server tracks), a raw XML string (for local tracks), or an object {url, type}
// id: unique identifier for the track
function loadTrackLayer(id, urlOrContent, isLocal) {
    if (loadedLayers[id]) return; // Already loaded

    const gpxOptions = {
        async: true,
        polyline_options: {
            pane: 'gpxPane',
            pane: 'gpxPane',
            color: getTrackColor(urlOrContent.type || 'default'),
            weight: 5
        },
        marker_options: {
            startIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-start.png',
            endIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-end.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-shadow.png',
            pane: 'gpxPane' // Also put markers on top
        }
    };

    const trackSource = (typeof urlOrContent === 'object' && urlOrContent.url) ? urlOrContent.url : urlOrContent;
    const trackType = (typeof urlOrContent === 'object' && urlOrContent.type) ? urlOrContent.type : 'default';

    // Override color logic in options
    gpxOptions.polyline_options.color = getTrackColor(trackType);

    const layer = new L.GPX(trackSource, gpxOptions)
        .on('loaded', function (e) {
            // Optional: fit bounds only if it's the first time loading or user requested
        });

    loadedLayers[id] = layer;
    return layer;
}

function toggleTrackVisibility(id, isVisible) {
    const layer = loadedLayers[id];
    if (!layer) return;

    if (isVisible) {
        layer.addTo(map);
    } else {
        map.removeLayer(layer);
    }
}

// --- UI Rendering ---

function createTrackListItem(name, id, isLocal, metadata = {}) {
    const li = document.createElement('li');
    const type = metadata.type || 'default';
    const badgeText = type === 'skiing' ? 'Ski' : type === 'hiking' ? 'Hike' : '';

    li.innerHTML = `
        <label>
            <input type="checkbox" checked>
            <span class="track-name" title="${name}">${name}</span>
            ${badgeText ? `<span class="track-badge ${type}">${badgeText}</span>` : ''}
        </label>
        ${isLocal ? '<button class="delete-btn" title="Remove track">×</button>' : ''}
    `;

    // Event Listeners
    const checkbox = li.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
        toggleTrackVisibility(id, e.target.checked);
    });

    if (isLocal) {
        li.querySelector('.delete-btn').onclick = () => removeLocalTrack(name);
    }

    return li;
}

function renderLists() {
    // 1. Local Tracks
    localTrackList.innerHTML = '';
    const localNames = Object.keys(localTracks);

    if (localNames.length === 0) {
        localTrackList.innerHTML = '<li class="empty-msg">No local tracks</li>';
        clearAllBtn.style.display = 'none';
    } else {
        clearAllBtn.style.display = 'block';
        localNames.forEach(name => {
            if (!loadedLayers[name]) {
                const layer = loadTrackLayer(name, localTracks[name], true);
                if (layer) layer.addTo(map); // Default add
            }
            localTrackList.appendChild(createTrackListItem(name, name, true));
        });
    }
}

async function fetchServerTracks() {
    if (window.location.protocol === 'file:') {
        noServerTracksMsg.innerHTML = "Server tracks disabled.<br><small>Cannot load files when opening index.html directly. Please use a local server (python3 server.py).</small>";
        noServerTracksMsg.style.display = 'block';
        return;
    }

    try {
        let files = [];
        try {
            const response = await fetch('/api/tracks');
            if (response.ok) {
                const text = await response.text();
                if (text.trim().startsWith('<')) throw new Error("API returned HTML");
                files = JSON.parse(text);
            } else {
                throw new Error("API not found");
            }
        } catch (apiError) {
            console.log("API failed, trying static list.json fallback...", apiError);
            const staticResponse = await fetch('tracks/list.json');
            if (!staticResponse.ok) throw new Error("Static list not found");
            files = await staticResponse.json();
        }

        serverTrackList.innerHTML = '';
        if (!files || files.length === 0) {
            noServerTracksMsg.style.display = 'block';
            noServerTracksMsg.textContent = "No tracks found in tracks/list.json.";
        } else {
            noServerTracksMsg.style.display = 'none';
            files.forEach((filepath, index) => {
                const url = (typeof filepath === 'string') ? filepath : filepath.url;
                const filename = url.replace(/\\/g, '/').split('/').pop();
                const id = 'server_' + filename;

                if (!loadedLayers[id]) {
                    // Support both string paths and object with metadata
                    const trackData = (typeof filepath === 'string')
                        ? { url: filepath, type: 'default' }
                        : filepath;

                    const layer = loadTrackLayer(id, trackData, false);
                    if (layer) {
                        layer.addTo(map);
                        if (index === 0) {
                            layer.on('loaded', function (e) {
                                map.fitBounds(e.target.getBounds());
                            });
                        }
                    }
                }
                serverTrackList.appendChild(createTrackListItem(filename, id, false, typeof filepath === 'object' ? filepath : {}));
            });
        }

    } catch (e) {
        console.warn("Could not fetch tracks (neither API nor static list work)", e);
        noServerTracksMsg.innerHTML = "Could not load tracks.<br><small>Make sure 'server.py' is running or 'tracks/list.json' exists.</small>";
        noServerTracksMsg.style.display = 'block';
    }
}

// --- Local Track Management ---

function removeLocalTrack(name) {
    if (loadedLayers[name]) {
        map.removeLayer(loadedLayers[name]);
        delete loadedLayers[name];
    }
    delete localTracks[name];
    saveLocalTracks();
    renderLists();
}

inputElement.addEventListener('change', function (event) {
    const files = event.target.files;
    if (!files.length) return;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;
            localTracks[file.name] = content;
            saveLocalTracks();

            if (loadedLayers[file.name]) {
                map.removeLayer(loadedLayers[file.name]);
                delete loadedLayers[file.name];
            }
            const layer = loadTrackLayer(file.name, content, true);
            if (layer) {
                layer.addTo(map);
                layer.on('loaded', e => map.fitBounds(e.target.getBounds()));
            }

            renderLists();
        };
        reader.readAsText(file);
    });
    inputElement.value = '';
});

clearAllBtn.addEventListener('click', () => {
    if (confirm('Delete all local tracks?')) {
        Object.keys(localTracks).forEach(name => {
            if (loadedLayers[name]) {
                map.removeLayer(loadedLayers[name]);
                delete loadedLayers[name];
            }
        });
        localTracks = {};
        saveLocalTracks();
        renderLists();
    }
});

// Init
renderLists();
fetchServerTracks();

// 4. Toggle Controls (Minimize/Maximize)
const toggleBtn = document.getElementById('toggle-controls');
const controlsDiv = document.getElementById('controls');

toggleBtn.addEventListener('click', () => {
    controlsDiv.classList.toggle('minimized');
    if (controlsDiv.classList.contains('minimized')) {
        toggleBtn.textContent = '+';
        toggleBtn.title = "Maximize";
    } else {
        toggleBtn.textContent = '−';
        toggleBtn.title = "Minimize";
    }
});

// 5. GPS / Geolocation
const locateBtn = document.getElementById('locate-btn');
const recenterBtn = document.getElementById('recenter-btn');
let userLocationLayer = null;
let isTracking = false;
let userPath = [];
let shouldAutoCenter = true;
let currentLatLng = null;

let userPathLayer = L.polyline([], {
    color: '#28a745',
    weight: 5,
    opacity: 0.8,
    pane: 'gpxPane'
}).addTo(map);

function setAutoCenter(active) {
    shouldAutoCenter = active;
    if (recenterBtn) recenterBtn.classList.toggle('active', active);
}

locateBtn.addEventListener('click', () => {
    if (isTracking) {
        map.stopLocate();
        isTracking = false;
        locateBtn.textContent = '📍';
        locateBtn.classList.remove('active');
        if (recenterBtn) recenterBtn.style.display = 'none';
        if (userLocationLayer) map.removeLayer(userLocationLayer);
    } else {
        isTracking = true;
        userPath = [];
        userPathLayer.setLatLngs([]);
        setAutoCenter(true);
        if (recenterBtn) recenterBtn.style.display = 'flex';

        locateBtn.textContent = '🛰️';
        locateBtn.classList.add('active');
        map.locate({
            watch: true,
            setView: false,
            maxZoom: 16,
            enableHighAccuracy: true
        });
    }
});

if (recenterBtn) {
    recenterBtn.addEventListener('click', () => {
        setAutoCenter(true);
        if (currentLatLng) {
            map.panTo(currentLatLng);
        }
    });
}

map.on('dragstart zoomstart mousedown touchstart', () => {
    if (isTracking) setAutoCenter(false);
});

map.on('locationfound', (e) => {
    if (!isTracking) return;
    currentLatLng = e.latlng;

    userPath.push(e.latlng);
    userPathLayer.setLatLngs(userPath);

    if (shouldAutoCenter) {
        map.panTo(e.latlng);
    }

    if (userLocationLayer) {
        map.removeLayer(userLocationLayer);
    }

    const heading = e.heading || 0;
    const hasHeading = e.heading !== null && e.heading !== undefined;

    const arrowIcon = L.divIcon({
        className: 'location-marker',
        html: `
            <div class="accuracy-circle" style="width: ${e.accuracy}px; height: ${e.accuracy}px;"></div>
            <div class="user-dot">
                ${hasHeading ? `<div class="heading-arrow" style="transform: rotate(${heading}deg)"></div>` : ''}
            </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    userLocationLayer = L.marker(e.latlng, { icon: arrowIcon }).addTo(map);
});

map.on('locationerror', (e) => {
    isTracking = false;
    locateBtn.textContent = '📍';
    locateBtn.classList.remove('active');
    if (recenterBtn) recenterBtn.style.display = 'none';
    alert("Could not access location: " + e.message);
});

// 7. Owner Overlay
const ownerBtn = document.getElementById('owner-btn');
const ownerLegend = document.getElementById('owner-legend');
let isOwnerMode = false;
let ownerLayer = null;
let ownerData = null;
let matrikkelStatus = {};

async function fetchMatrikkelStatus() {
    try {
        let res = await fetch('matrikkel_status.json');
        if (!res.ok) {
            res = await fetch('/api/load_status');
        }
        if (res.ok) {
            matrikkelStatus = await res.json();
        }
    } catch (e) {
        console.warn("Could not load matrikkel status", e);
    }
}

async function setMatrikkelStatus(id, status) {
    if (status === 'reset') {
        delete matrikkelStatus[id];
    } else {
        matrikkelStatus[id] = status;
    }

    if (ownerLayer) {
        ownerLayer.setStyle(ownerLayer.options.style);
    }
    if (ownerData) renderOwnerLegend(ownerData.features);

    try {
        await fetch('/api/save_status', {
            method: 'POST',
            body: JSON.stringify(matrikkelStatus),
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error("Failed to save status", e);
    }
}
window.setMatrikkelStatus = setMatrikkelStatus;

const svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
svgDefs.setAttribute('aria-hidden', 'true');
svgDefs.style.position = 'absolute';
svgDefs.style.width = '0';
svgDefs.style.height = '0';
svgDefs.style.overflow = 'hidden';
document.body.appendChild(svgDefs);

const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
defs.id = 'owner-gradients';
svgDefs.appendChild(defs);

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs((hash * 137.508) % 360);
    return `hsl(${hue}, 80%, 45%)`;
}

function ensureGradient(owner, color) {
    const defs = document.getElementById('owner-gradients');
    const safeId = 'grad-' + owner.replace(/[^a-zA-Z0-9]/g, '_');

    if (document.getElementById(safeId)) return safeId;

    const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    grad.setAttribute('id', safeId);
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '100%');

    const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', color);
    stop1.setAttribute('stop-opacity', '0.7');

    const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop2.setAttribute('offset', '50%');
    stop2.setAttribute('stop-color', color);
    stop2.setAttribute('stop-opacity', '0.1');

    const stop3 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop3.setAttribute('offset', '100%');
    stop3.setAttribute('stop-color', color);
    stop3.setAttribute('stop-opacity', '0.7');

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    grad.appendChild(stop3);
    defs.appendChild(grad);

    return safeId;
}

function renderOwnerLegend(features) {
    ownerLegend.innerHTML = '<strong>Owners (Click to zoom)</strong>';

    const ownerGroups = {};
    features.forEach(f => {
        const owner = f.properties.eier;
        if (!owner) return;
        if (!ownerGroups[owner]) ownerGroups[owner] = [];
        ownerGroups[owner].push(f.properties.matrikkelnummer);
    });

    Object.keys(ownerGroups).sort().forEach(owner => {
        const matrikkels = ownerGroups[owner];
        let color = '#9d7edb';

        const hasConflict = matrikkels.some(m => matrikkelStatus[m] === 'conflict');
        const allGood = matrikkels.every(m => matrikkelStatus[m] === 'good');

        if (hasConflict) {
            color = '#dc3545';
        } else if (allGood) {
            color = '#28a745';
        }

        const div = document.createElement('div');
        div.className = 'legend-item clickable';
        div.innerHTML = `<span class="legend-color" style="background-color: ${color}"></span>${owner}`;

        div.addEventListener('click', () => {
            if (!ownerLayer) return;

            const targetBounds = L.latLngBounds([]);
            let firstLayer = null;

            ownerLayer.eachLayer(layer => {
                if (layer.feature && layer.feature.properties && layer.feature.properties.eier === owner) {
                    targetBounds.extend(layer.getBounds());
                    if (!firstLayer) firstLayer = layer;
                }
            });

            if (firstLayer) {
                map.fitBounds(targetBounds, { padding: [50, 50], maxZoom: 16 });
                setTimeout(() => {
                    firstLayer.openPopup();
                }, 300);
            }
        });

        ownerLegend.appendChild(div);
    });
}

ownerBtn.addEventListener('click', async () => {
    isOwnerMode = !isOwnerMode;
    ownerBtn.classList.toggle('active', isOwnerMode);

    if (isOwnerMode) {
        ownerLegend.style.display = 'block';
        await fetchMatrikkelStatus();
        if (!ownerLayer) {
            ownerBtn.textContent = '⏳';
            try {
                let res = await fetch('owners_polygons.geo.json');
                if (!res.ok) {
                    console.warn("Static polygons not found, trying API...");
                    res = await fetch('/api/owner_properties');
                }

                if (!res.ok) throw new Error("Failed to fetch owners");
                ownerData = await res.json();

                if (ownerData && ownerData.features) {
                    ownerLayer = L.geoJSON(ownerData, {
                        renderer: L.svg(),
                        style: function (feature) {
                            const mat_id = feature.properties.matrikkelnummer;
                            const status = matrikkelStatus[mat_id];

                            if (status === 'good') {
                                return { color: '#28a745', weight: 3, opacity: 1, fillColor: '#28a745', fillOpacity: 0.4 };
                            } else if (status === 'conflict') {
                                return { color: '#dc3545', weight: 4, opacity: 1, fillColor: '#dc3545', fillOpacity: 0.5 };
                            }

                            const purpleColor = '#9d7edb';
                            const gradId = ensureGradient('default-purple', purpleColor);

                            return {
                                color: '#4b0082',
                                weight: 2,
                                opacity: 0.8,
                                fillColor: `url(#${gradId})`,
                                fillOpacity: 1
                            };
                        },
                        onEachFeature: function (feature, layer) {
                            if (feature.properties && feature.properties.eier) {
                                const mat_id = feature.properties.matrikkelnummer;
                                const currentStatus = matrikkelStatus[mat_id] || 'None';

                                const popupContent = document.createElement('div');
                                popupContent.className = 'matrikkel-popup';
                                popupContent.innerHTML = `
                                    <strong>Owner:</strong> ${feature.properties.eier}<br>
                                    <strong>Matrikkel:</strong> ${mat_id}<br>
                                    <strong>Status:</strong> <span class="status-badge ${currentStatus}">${currentStatus}</span>
                                    <div class="status-controls">
                                        <button class="status-btn good" onclick="setMatrikkelStatus('${mat_id}', 'good'); this.closest('.leaflet-popup').remove();">Good to go!</button>
                                        <button class="status-btn conflict" onclick="setMatrikkelStatus('${mat_id}', 'conflict'); this.closest('.leaflet-popup').remove();">Conflict</button>
                                        <button class="status-btn reset" onclick="setMatrikkelStatus('${mat_id}', 'reset'); this.closest('.leaflet-popup').remove();">Reset</button>
                                    </div>
                                `;
                                layer.bindPopup(popupContent);
                            }
                        }
                    }).addTo(map);

                    renderOwnerLegend(ownerData.features);

                    if (ownerLayer.getLayers().length > 0) {
                        map.fitBounds(ownerLayer.getBounds());
                    }
                }
            } catch (e) {
                console.error(e);
                alert("Could not load owner properties. Ensure server.py is running.");
                isOwnerMode = false;
                ownerBtn.classList.remove('active');
                ownerLegend.style.display = 'none';
            } finally {
                ownerBtn.textContent = '👥';
            }
        } else {
            ownerLayer.addTo(map);
        }
    } else {
        ownerLegend.style.display = 'none';
        if (ownerLayer) {
            map.removeLayer(ownerLayer);
        }
    }
});
