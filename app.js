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
        polyline_options: {
            pane: 'gpxPane',
            color: 'blue',
            weight: 5
        },
        marker_options: {
            startIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-start.png',
            endIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-end.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-shadow.png',
            pane: 'gpxPane' // Also put markers on top
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
            // Auto-zoom to the first track found
            if (files.length > 0) {
                // We need to wait for the first one to load to get bounds.
                // Since loadTrackLayer is async/callback based for bounds, we can attach a one-time listener to it.
                // OR, since we are iterating, we can pick the first id.
                const firstId = 'server_' + files[0].split('/').pop();

                // We'll set up a one-time listener on the map or the layer
                // Actually simplest is to modify loadTrackLayer or do it here if possible.
                // But the layer is created inside loadTrackLayer and data is fetched async by leaflet-gpx.

                // Let's modify the creation of the first layer specifically
            }

            files.forEach((filepath, index) => {
                const filename = filepath.split('/').pop(); // Extract name
                const id = 'server_' + filename;

                // Ensure layer loaded
                if (!loadedLayers[id]) {
                    const layer = loadTrackLayer(id, filepath, false);
                    if (layer) {
                        layer.addTo(map);

                        // If this is the first track, zoom to it once loaded
                        if (index === 0) {
                            layer.on('loaded', function (e) {
                                map.fitBounds(e.target.getBounds());
                            });
                        }
                    }
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

// 7. Owner Overlay
const ownerBtn = document.getElementById('owner-btn');
const ownerLegend = document.getElementById('owner-legend');
let isOwnerMode = false;
let ownerLayer = null;
let ownerData = null; // Cache
let matrikkelStatus = {};

async function fetchMatrikkelStatus() {
    try {
        // Try fetching the static file directly first (works on GitHub Pages and local server)
        let res = await fetch('matrikkel_status.json');

        // If that fails or isn't a valid JSON, try the API
        if (!res.ok) {
            res = await fetch('/api/load_status');
        }

        if (res.ok) {
            matrikkelStatus = await res.json();
        }
    } catch (e) {
        console.warn("Could not load matrikkel status, might be first run or static hosting without file.", e);
    }
}

async function setMatrikkelStatus(id, status) {
    if (status === 'reset') {
        delete matrikkelStatus[id];
    } else {
        matrikkelStatus[id] = status;
    }

    // Update layer styles
    if (ownerLayer) {
        ownerLayer.setStyle(ownerLayer.options.style);
    }

    // Save to server
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

// Create a defs container for gradients
// We place this at the start of the body to ensure it exists
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
    // Use golden angle approximation to distribute colors evenly and distinctly
    // 137.508... is the golden angle in degrees
    const hue = Math.abs((hash * 137.508) % 360);
    // Return HSL for vibrant, distinct colors (Saturation 80%, Lightness 45%)
    return `hsl(${hue}, 80%, 45%)`;
}

function ensureGradient(owner, color) {
    const defs = document.getElementById('owner-gradients');
    // Sanitize owner name for ID
    const safeId = 'grad-' + owner.replace(/[^a-zA-Z0-9]/g, '_');

    if (document.getElementById(safeId)) return safeId;

    const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    grad.setAttribute('id', safeId);
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '100%');

    // Create a nice gradient: Color -> Lighter version -> Color
    const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', color);
    stop1.setAttribute('stop-opacity', '0.7');

    const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop2.setAttribute('offset', '50%');
    stop2.setAttribute('stop-color', color);
    stop2.setAttribute('stop-opacity', '0.1'); // lighter/transparent middle

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
    ownerLegend.innerHTML = '<strong>Owners</strong>';
    const owners = new Set();
    features.forEach(f => {
        if (f.properties && f.properties.eier) owners.add(f.properties.eier);
    });

    // Sort owners alphabetically
    Array.from(owners).sort().forEach(owner => {
        const color = stringToColor(owner);
        // Ensure gradient exists just in case, though usually main loop does it
        ensureGradient(owner, color);

        const div = document.createElement('div');
        div.className = 'legend-item';
        // Show solid block for legend
        div.innerHTML = `<span class="legend-color" style="background-color: ${color}"></span>${owner}`;
        ownerLegend.appendChild(div);
    });
}

ownerBtn.addEventListener('click', async () => {
    isOwnerMode = !isOwnerMode;
    ownerBtn.classList.toggle('active', isOwnerMode);

    if (isOwnerMode) {
        ownerLegend.style.display = 'block';
        await fetchMatrikkelStatus(); // Load latest status
        if (!ownerLayer) {
            // Fetch data
            ownerBtn.textContent = '⏳';
            try {
                // Try static file first (works without server)
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

                            const owner = feature.properties.eier;
                            const color = stringToColor(owner);
                            const gradId = ensureGradient(owner, color);

                            return {
                                color: 'black',        // Border color
                                weight: 2,
                                opacity: 0.8,
                                fillColor: `url(#${gradId})`, // Helper for SVG patterns
                                fillOpacity: 1 // Must be 1 so gradient opacity controls it
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

                    // Fit bounds to show all properties
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
