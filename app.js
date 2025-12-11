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

// 3. GPX Upload Handler
const inputElement = document.getElementById('gpx-upload');

inputElement.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(e) {
        const gpxContent = e.target.result;
        
        // Use leaflet-gpx to parse and display
        new L.GPX(gpxContent, {
            async: true,
            marker_options: {
                startIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-start.png',
                endIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-end.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-shadow.png'
            }
        }).on('loaded', function(e) {
            map.fitBounds(e.target.getBounds());
            // Add to layer control if desired, or just keep on map
            // We could remove old GPX layers if we wanted to support only one at a time
        }).addTo(map);
    };

    reader.readAsText(file);
});
