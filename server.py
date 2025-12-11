import http.server
import socketserver
import json
import os
import glob

PORT = 8081
TRACKS_DIR = 'tracks'

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/tracks':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            tracks = []
            if os.path.exists(TRACKS_DIR):
                # patterns: look for .gpx and .GPX
                files = []
                for ext in ('*.gpx', '*.GPX'):
                    files.extend(glob.glob(os.path.join(TRACKS_DIR, ext)))
                
                # Get filenames relative to TRACKS_DIR, but we want to serve them relative to root for Leaflet
                # Actually, simpleHTTPRequestHandler serves from root.
                # So if we return "tracks/filename.gpx", the frontend can fetch it.
                tracks = [f for f in files]
            
            self.wfile.write(json.dumps(tracks).encode())
        elif self.path.startswith('/api/eiendom'):
            from urllib.parse import urlparse, parse_qs
            import urllib.request
            
            try:
                query = urlparse(self.path).query
                params = parse_qs(query)
                lat = params.get('lat', [None])[0]
                lon = params.get('lon', [None])[0]
                
                if lat and lon:
                    # Kartverket API: ost=lon, nord=lat, koordsys=4258 (approx WGS84)
                    target_url = f"https://api.kartverket.no/eiendom/v1/punkt/omrader?ost={lon}&nord={lat}&koordsys=4258"
                    
                    # Add User-Agent as good practice
                    req = urllib.request.Request(target_url, headers={'User-Agent': 'MapperApp/1.0'})
                    
                    with urllib.request.urlopen(req) as response:
                        self.send_response(response.status)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(response.read())
                else:
                    self.send_error(400, "Missing lat or lon parameters")
            except Exception as e:
                print(f"Proxy error: {e}")
                self.send_error(500, f"Proxy error: {e}")

        else:
            super().do_GET()

if __name__ == "__main__":
    if not os.path.exists(TRACKS_DIR):
        os.makedirs(TRACKS_DIR)
        print(f"Created directory: {TRACKS_DIR}")

    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        print(f"Server-side tracks directory: {os.path.abspath(TRACKS_DIR)}")
        httpd.serve_forever()
