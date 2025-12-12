import json
import urllib.request
import time
import os

owners_path = 'matrikkel_owners.json'
output_path = 'owners_polygons.geo.json'

print(f"Reading owners from {owners_path}...")
with open(owners_path, 'r', encoding='utf-8') as f:
    owners_data = json.load(f)

features = []
print(f"Fetching geometry for {len(owners_data)} properties...")

for i, item in enumerate(owners_data):
    matrikkel_raw = item.get('matrikkelnummer')
    owner = item.get('eier')
    
    if not matrikkel_raw: continue
    
    parts = matrikkel_raw.split('/')
    if len(parts) >= 3:
        matrikkel_id = f"{parts[0]}-{parts[1]}/{parts[2]}"
        if len(parts) > 3: matrikkel_id += f"/{parts[3]}"
        if len(parts) > 4: matrikkel_id += f"/{parts[4]}"
    else:
        matrikkel_id = matrikkel_raw

    try:
        url = f"https://api.kartverket.no/eiendom/v1/geokoding?matrikkelnummer={matrikkel_id}&utkoordsys=4258&omrade=true"
        req = urllib.request.Request(url, headers={'User-Agent': 'MapperApp/1.0'})
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                res_json = json.loads(response.read().decode('utf-8'))
                if res_json.get('features'):
                    for geo_data in res_json['features']:
                        if 'properties' not in geo_data: geo_data['properties'] = {}
                        geo_data['properties']['eier'] = owner
                        geo_data['properties']['matrikkelnummer'] = matrikkel_raw
                        features.append(geo_data)
                    print(f"[{i+1}/{len(owners_data)}] Found {len(res_json['features'])} polygons for {matrikkel_id}")
                else:
                    print(f"[{i+1}/{len(owners_data)}] No feature for {matrikkel_id}")
            else:
                 print(f"[{i+1}/{len(owners_data)}] Failed {matrikkel_id}: {response.status}")
        
        time.sleep(0.1) 
    except Exception as e:
        print(f"[{i+1}/{len(owners_data)}] Error {matrikkel_id}: {e}")

collection = {
    "type": "FeatureCollection",
    "features": features
}

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(collection, f)

print(f"Done! Saved {len(features)} polygons to {output_path}")
print("You can now modify app.js to load this file directly.")
