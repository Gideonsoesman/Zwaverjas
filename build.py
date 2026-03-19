#!/usr/bin/env python3
"""Build script: assembles the final index.html from parts + photos."""
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))

# Load photos
with open(os.path.join(BASE, 'photos_data.json')) as f:
    photos = json.load(f)

# Build PHOTOS JS object
photos_js = "const PHOTOS = {\n"
for name, data in photos.items():
    photos_js += f"  {name}:'{data}',\n"
photos_js += "};\n"

# Read the template
with open(os.path.join(BASE, 'src', 'app.html')) as f:
    template = f.read()

# Insert photos
output = template.replace('/* __PHOTOS_PLACEHOLDER__ */', photos_js)

# Write final
with open(os.path.join(BASE, 'index.html'), 'w') as f:
    f.write(output)

print(f"Built index.html ({len(output):,} bytes)")
