# Norgeskart GPX Viewer

This project is a simple web application to view Norgeskart topographic maps with property borders (tomtegrenser) and overlay GPX files.

## Prerequisites
- **Python 3**: To run the local server.

## How to Run
1. Open a terminal to the project directory: `/Users/eirikmagnussen/Repos/Mapper`
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

