# Norgeskart GPX Viewer

This project is a simple web application to view Norgeskart topographic maps with property borders (tomtegrenser) and overlay GPX files.

## Prerequisites
- **Python 3**: To run the local server.

## How to Run
1. Open a terminal to the project directory: `/Users/eirikmagnussen/Repos/Mapper`
2. Run the following command to start a local server:
    ```bash
    python3 -m http.server 8081
    ```
3. Open your web browser and navigate to:
    [http://localhost:8081](http://localhost:8081)

## Features & Verification

### 1. View the Map
- Loads Norgeskart Topo as the base map.
- Displays property borders (Matrikkelen) when zoomed in.

### 2. Properties Overlay
- Toggle "Property Borders" in the layer control (top-right).

### 3. Upload GPX
- Click "Choose File" to upload a `.gpx` file.
- The map automatically zooms to the track.
- Visualize your route on top of property lines.

## Troubleshooting
- **Map tiles not loading?** Ensure you have internet access.
- **CORS Errors?** Make sure you are using `http://localhost:8081` and not opening the file directly.
