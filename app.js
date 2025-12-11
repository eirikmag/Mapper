// Initialize map
const map = L.map('map').setView([65.0, 15.0], 5); // Approximate center of Norway

// 1. Topographic Map Layer (Statens Kartverk Cache)
const topoLayer = L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', {
    attribution: '&copy; <a href="http://www.kartverket.no/">Kartverket</a>',
    maxZoom: 18
}).addTo(map);

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
    "Topographic Map": topoLayer
};

const overlayMaps = {
    "Property Borders": propertyLayer
};

L.control.layers(baseMaps, overlayMaps).addTo(map);

// 3. GPX Storage and Management
const STORAGE_KEY = 'gpx_tracks';
let tracks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const loadedLayers = {}; // Keep track of Leaflet layers by filename

// Initialize UI
const inputElement = document.getElementById('gpx-upload');
const trackListElement = document.getElementById('track-list');
const clearAllBtn = document.getElementById('clear-all-btn');

function saveTracks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
    } catch (e) {
        alert("Storage full! Could not save track. Please delete some old tracks.");
    }
}

function addTrackToMap(filename, gpxContent) {
    if (loadedLayers[filename]) return; // Already on map

    const gpxLayer = new L.GPX(gpxContent, {
        async: true,
        marker_options: {
            startIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-start.png',
            endIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-end.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-shadow.png'
        }
    }).on('loaded', function (e) {
        map.fitBounds(e.target.getBounds());
    }).addTo(map);

    loadedLayers[filename] = gpxLayer;
}

function removeTrack(filename) {
    // Remove from map
    if (loadedLayers[filename]) {
        map.removeLayer(loadedLayers[filename]);
        delete loadedLayers[filename];
    }
    // Remove from storage
    delete tracks[filename];
    saveTracks();
    // Update UI
    renderTrackList();
}

function renderTrackList() {
    trackListElement.innerHTML = '';
    const filenames = Object.keys(tracks);

    if (filenames.length === 0) {
        trackListElement.innerHTML = '<li style="color:#999; font-style:italic;">No tracks loaded</li>';
        clearAllBtn.style.display = 'none';
        return;
    }

    clearAllBtn.style.display = 'block';

    filenames.forEach(filename => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span title="${filename}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${filename}</span>
            <button class="delete-btn" title="Remove track">×</button>
        `;

        li.querySelector('.delete-btn').onclick = () => removeTrack(filename);
        trackListElement.appendChild(li);
    });
}

function loadSavedTracks() {
    Object.entries(tracks).forEach(([filename, content]) => {
        addTrackToMap(filename, content);
    });
    renderTrackList();
}

// Event Listeners
inputElement.addEventListener('change', function (event) {
    const files = event.target.files;
    if (!files.length) return;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;
            tracks[file.name] = content;
            saveTracks();
            addTrackToMap(file.name, content);
            renderTrackList();
        };
        reader.readAsText(file);
    });

    // Reset input so same file can be selected again if needed
    inputElement.value = '';
});

clearAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all tracks?')) {
        Object.keys(loadedLayers).forEach(filename => {
            map.removeLayer(loadedLayers[filename]);
        });
        for (const prop of Object.getOwnPropertyNames(loadedLayers)) {
            delete loadedLayers[prop];
        }
        tracks = {};
        saveTracks();
        renderTrackList();
    }
});

// Initial Load
loadSavedTracks();
