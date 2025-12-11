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

### 3. Upload & Manage GPX
- **Upload**: Click "Choose Files" to upload one or more `.gpx` files.
- **Auto-Save**: Tracks are automatically saved to your browser's local storage. They will reappear when you reload the page.
- **Track List**: See all your loaded tracks in the sidebar.
- **Delete**: Click the `×` next to a track to remove it, or "Clear All Tracks" to reset.


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

