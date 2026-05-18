import urllib.request
import re

url = 'https://drive.google.com/drive/folders/1GTOS137cRgfACFLANPKFGWLGGULThrDD?usp=sharing'
html = urllib.request.urlopen(url).read().decode('utf-8')

# Try to find the file ID pattern near the filename
filenames = ['chem.pdf', 'phy.pdf', 'bio.pdf', 'econ.pdf', 'econal.pdf', 'accal.pdf', 'accol.pdf', 'chemcr.pdf', 'chemal.pdf', 'phycr.pdf', 'phyal.pdf', 'biocr.pdf', 'bioal.pdf']
results = {}

for fn in filenames:
    # Look for the ID (28-33 chars) nearby the filename in the HTML
    match = re.search(r'([a-zA-Z0-9_-]{28,33}).{1,100}?' + re.escape(fn), html)
    if match:
        results[fn] = match.group(1)

print("Found IDs:")
for k, v in results.items():
    print(f"{k}: {v}")
