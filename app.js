// Initialize map
const map = L.map('map').setView([65.0, 15.0], 5); // Approximate center of Norway

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

function saveLocalTracks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localTracks));
    } catch (e) {
        alert("Storage full! Could not save track.");
    }
}

// Add track to map
// urlOrContent: can be a URL (for server tracks) or raw XML string (for local tracks)
// id: unique identifier for the track
function loadTrackLayer(id, urlOrContent, isLocal) {
    if (loadedLayers[id]) return; // Already loaded

    // If it's content, we need to handle it slightly differently depending on usage,
    // but leaflet-gpx handles url or string content automatically usually.
    // However, for local content strings, we pass string. For server, we pass URL.

    // Note: leaflet-gpx creates a layer but doesn't add it to map until we call .addTo(map)
    // We will control .addTo(map) based on visibility state.

    const gpxOptions = {
        async: true,
        marker_options: {
            startIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-start.png',
            endIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-end.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-shadow.png'
        }
    };

    const layer = new L.GPX(urlOrContent, gpxOptions)
        .on('loaded', function (e) {
            // Optional: fit bounds only if it's the first time loading or user requested
            // For now, let's not auto-zoom on every refresh, maybe just on upload.
            // But for this simple app, auto-zoom on load is okay if it's just one.
            // If many, it might be chaotic. Let's auto-zoom only for newly uploaded local files.
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

function createTrackListItem(name, id, isLocal) {
    const li = document.createElement('li');

    // Checkbox State: Default to checked for now, or could store preference.
    // simpler: default checked.
    const isChecked = true;

    li.innerHTML = `
        <label>
            <input type="checkbox" checked>
            <span class="track-name" title="${name}">${name}</span>
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
            // For local, ID is name
            // Ensure layer is created
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
            // Try dynamic API first (local python server)
            const response = await fetch('/api/tracks');
            if (response.ok) {
                const text = await response.text();
                // If server returns HTML (e.g. standard file listing or 404 page), treat as fail
                if (text.trim().startsWith('<')) throw new Error("API returned HTML");
                files = JSON.parse(text);
            } else {
                throw new Error("API not found");
            }
        } catch (apiError) {
            console.log("API failed, trying static list.json fallback...", apiError);
            // Fallback to static JSON list (GitHub Pages or standard http server)
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
            files.forEach(filepath => {
                const filename = filepath.split('/').pop(); // Extract name
                const id = 'server_' + filename;

                // Ensure layer loaded
                if (!loadedLayers[id]) {
                    const layer = loadTrackLayer(id, filepath, false);
                    if (layer) layer.addTo(map); // Default add
                }

                serverTrackList.appendChild(createTrackListItem(filename, id, false));
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
    renderLists(); // Re-render local list
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

            // Force reload/render of this new track
            if (loadedLayers[file.name]) {
                map.removeLayer(loadedLayers[file.name]);
                delete loadedLayers[file.name];
            }
            const layer = loadTrackLayer(file.name, content, true);
            if (layer) {
                layer.addTo(map);
                layer.on('loaded', e => map.fitBounds(e.target.getBounds())); // Auto zoom on upload
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
renderLists(); // Load local
fetchServerTracks(); // Load server

// 4. Toggle Controls (Minimize/Maximize)
const toggleBtn = document.getElementById('toggle-controls');
const controlsDiv = document.getElementById('controls');

toggleBtn.addEventListener('click', () => {
    controlsDiv.classList.toggle('minimized');
    if (controlsDiv.classList.contains('minimized')) {
        toggleBtn.textContent = '+';
        toggleBtn.title = "Maximize";
    } else {
        toggleBtn.textContent = '−'; // Minus sign
        toggleBtn.title = "Minimize";
    }
});

// 5. GPS / Geolocation
const locateBtn = document.getElementById('locate-btn');
let userLocationLayer = null;

locateBtn.addEventListener('click', () => {
    locateBtn.textContent = '⏳'; // Loading state
    map.locate({ setView: true, maxZoom: 16 });
});

map.on('locationfound', (e) => {
    locateBtn.textContent = '📍';
    if (userLocationLayer) {
        map.removeLayer(userLocationLayer);
    }
    // Add a circle to show accuracy and a marker for position
    userLocationLayer = L.layerGroup([
        L.circle(e.latlng, e.accuracy / 2, { weight: 1, color: 'blue', fillColor: '#cacaca', fillOpacity: 0.2 }),
        L.circleMarker(e.latlng, { radius: 8, color: '#fff', fillColor: '#2A93EE', fillOpacity: 1, weight: 2 })
    ]).addTo(map);
});

map.on('locationerror', (e) => {
    locateBtn.textContent = '📍';
    alert("Could not access location: " + e.message);
});

// 6. No-Go Zones (Property Borders)
const nogoBtn = document.getElementById('nogo-btn');
let isNoGoMode = false;
let noGoLayers = L.layerGroup().addTo(map);
// Provide empty array default if JSON parse fails
let savedNoGoZones = [];
try {
    savedNoGoZones = JSON.parse(localStorage.getItem('nogo_zones') || '[]');
} catch (e) {
    console.error("Failed to parse saved nogo zones", e);
    savedNoGoZones = [];
}

function saveNoGoZonesToStorage() {
    localStorage.setItem('nogo_zones', JSON.stringify(savedNoGoZones));
}

function renderNoGoZones() {
    noGoLayers.clearLayers();
    savedNoGoZones.forEach((geoJson, index) => {
        L.geoJSON(geoJson, {
            style: { color: '#ff0000', weight: 2, fillColor: '#ff0000', fillOpacity: 0.35 },
            onEachFeature: (feature, layer) => {
                layer.bindTooltip("No-Go Zone (Click to delete in Edit Mode)");
                layer.on('click', (e) => {
                    if (isNoGoMode) {
                        L.DomEvent.stopPropagation(e); // Prevent map click (which would try to add a new zone)
                        if (confirm('Remove this No-Go zone?')) {
                            savedNoGoZones.splice(index, 1);
                            saveNoGoZonesToStorage();
                            renderNoGoZones();
                        }
                    }
                });
            }
        }).addTo(noGoLayers);
    });
}
renderNoGoZones();

nogoBtn.addEventListener('click', () => {
    isNoGoMode = !isNoGoMode;
    nogoBtn.classList.toggle('active', isNoGoMode);
    map.getContainer().style.cursor = isNoGoMode ? 'crosshair' : '';
});

map.on('click', async (e) => {
    if (!isNoGoMode) return;

    // Only works if server is running
    if (window.location.protocol === 'file:') {
        alert("Cannot fetch properties in file:// mode. Run python3 server.py");
        return;
    }

    try {
        const originalText = nogoBtn.textContent;
        nogoBtn.textContent = '⏳';

        const url = `/api/eiendom?lat=${e.latlng.lat}&lon=${e.latlng.lng}`;
        const res = await fetch(url);

        if (!res.ok) throw new Error('Proxy failed or returned error');

        const data = await res.json();

        if (data.features && data.features.length > 0) {
            // Find the polygon feature (sometimes it returns multiple or points)
            // The API usually returns "Teig" (parcel) polygons. 
            // We'll take the first feature that has a Polygon/MultiPolygon geometry.
            const polygonFeature = data.features.find(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');

            if (polygonFeature) {
                savedNoGoZones.push(polygonFeature);
                saveNoGoZonesToStorage();
                renderNoGoZones();
            } else {
                alert('No property boundary (polygon) found here.');
            }
        } else {
            alert('No property info found at this location.');
        }
    } catch (err) {
        console.error(err);
        alert('Error fetching property data. Ensure server.py is running.');
    } finally {
        nogoBtn.textContent = '⛔';
    }
});
