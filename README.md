# Elgkollen løyper
## Goal & Purpose
The primary purpose of this tool is to facilitate the **planning of new cross-country ski tracks**. 

It serves as a visualization aid to:
1.  **Map Proposed Routes**: Overlay GPX tracks of potential new ski trails on top of detailed topographic and satellite maps.
2.  **Identify Property Owners**: Visualize property boundaries (Matrikkelen) and identify the specific landowners (e.g., "Jevnaker Almenning", private owners) for each segment of the track.
3.  **Coordinate Permissions**: Use the color-coded owner overlay to quickly see which areas are cleared for use and which owners need to be contacted for discussion and permission.

This overview helps streamline the process of establishing new recreational routes by clearly connecting geographic paths with land ownership data.

## Overview
This project is a simple web application to view Norgeskart topographic maps with property borders (tomtegrenser) and overlay GPX files.

## Prerequisites
- **Python 3**: To run the local server.

## How to Run
1. Open a terminal to the project directory: `/Users/eirikmag/Repos/Mapper`
2. Run the custom server script (required for loading tracks from folder):
    ```bash
    python3 server.py
    ```
3. Open your web browser and navigate to:
    [http://localhost:8081](http://localhost:8081)

## Features & Verification

### 1. View the Map
- **Switch Layers**: Use the layer control (top-right) to switch between **Topographic Map** and **Aerial Photo**.
- Displays property borders (Matrikkelen) when zoomed in.

### 2. Properties Overlay
- Toggle "Property Borders" in the layer control (top-right).

### 3. Track Management
- **Server Tracks**: Place `.gpx` files in the `tracks/` folder. They will automatically appear in the "Server Tracks" list.
- **Local Tracks**: Upload files via the "Choose Files" button. These are saved in your browser.
- **Visibility**: Use the checkboxes to show/hide specific tracks without deleting them.
- **Deletion**: Local tracks can be deleted permanently. Server tracks must be removed from the folder.

### Important for GitHub Pages (Online)
Since GitHub Pages is a static site host, it cannot automatically scan the `tracks/` folder. 
If you add new files to `tracks/` and want them to appear online, you must manually update `tracks/list.json`:
```json
[
  "tracks/MyNewHike.gpx",
  "tracks/OldHike.gpx"
]
```
Locally (with `server.py`), this file is ignored and the folder is scanned automatically.


## Troubleshooting
- **Map tiles not loading?** Ensure you have internet access.
- **CORS Errors?** Make sure you are using `http://localhost:8081` and not opening the file directly.

## Deployment (GitHub Pages)

You can host this app for free using [GitHub Pages](https://pages.github.com/).

1.  Push this repository to GitHub.
2.  Go to the repository **Settings**.
3.  Click on **Pages** in the left sidebar.
4.  Under **Build and deployment** > **Branch**, select `main` and click **Save**.
5.  Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

