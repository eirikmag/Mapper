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

        elif self.path == '/api/owner_properties':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            try:
                # Load owners
                owners_path = 'matrikkel_owners.json'
                if not os.path.exists(owners_path):
                    self.wfile.write(json.dumps({"error": "matrikkel_owners.json not found"}).encode())
                    return

                with open(owners_path, 'r', encoding='utf-8') as f:
                    owners_data = json.load(f)

                # Load cache
                cache_path = 'matrikkel_cache.json'
                cache = {}
                if os.path.exists(cache_path):
                    try:
                        with open(cache_path, 'r', encoding='utf-8') as f:
                            cache = json.load(f)
                    except:
                        pass # Ignore corrupted cache

                features = []
                cache_updated = False
                
                import urllib.request
                import time

                for item in owners_data:
                    matrikkel_raw = item.get('matrikkelnummer')
                    owner = item.get('eier')
                    
                    if not matrikkel_raw: continue
                    
                    # Format: 3236/123/2 -> 3236-123/2
                    # The API expects municipality-gnr/bnr (sometimes fnr/snr)
                    # Input seems to be K/G/B. 
                    parts = matrikkel_raw.split('/')
                    if len(parts) >= 3:
                        matrikkel_id = f"{parts[0]}-{parts[1]}/{parts[2]}"
                        # Append fnr/snr if exist? 
                        # API example: 3024-190/3
                        if len(parts) > 3:
                            matrikkel_id += f"/{parts[3]}"
                        if len(parts) > 4:
                            matrikkel_id += f"/{parts[4]}"
                    else:
                        matrikkel_id = matrikkel_raw # Fallback

                    if matrikkel_id in cache:
                        geometry_data = cache[matrikkel_id]
                    else:
                        # Fetch from API
                        print(f"Fetching geometry for {matrikkel_id}...")
                        try:
                            # Use geokoding API with omrade=true to get polygons
                            url = f"https://api.kartverket.no/eiendom/v1/geokoding?matrikkelnummer={matrikkel_id}&utkoordsys=4258&omrade=true"
                            req = urllib.request.Request(url, headers={'User-Agent': 'MapperApp/1.0'})
                            with urllib.request.urlopen(req) as response:
                                if response.status == 200:
                                    res_json = json.loads(response.read().decode('utf-8'))
                                    # We take the first feature
                                    if res_json.get('features'):
                                        geometry_data = res_json['features'][0]
                                        cache[matrikkel_id] = geometry_data
                                        cache_updated = True
                                        time.sleep(0.1) # Be polite
                                    else:
                                        geometry_data = None
                                else:
                                    geometry_data = None
                        except Exception as e:
                            print(f"Error fetching {matrikkel_id}: {e}")
                            geometry_data = None
                    
                    if geometry_data:
                        # geometry_data is a GeoJSON Feature
                        # We want to add owner info to properties
                        if 'properties' not in geometry_data:
                            geometry_data['properties'] = {}
                        
                        geometry_data['properties']['eier'] = owner
                        geometry_data['properties']['matrikkelnummer'] = matrikkel_raw
                        features.append(geometry_data)

                if cache_updated:
                    with open(cache_path, 'w', encoding='utf-8') as f:
                        json.dump(cache, f)

                collection = {
                    "type": "FeatureCollection",
                    "features": features
                }
                
                self.wfile.write(json.dumps(collection).encode())

            except Exception as e:
                print(f"Error in owner_properties: {e}")
                import traceback
                traceback.print_exc()

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
