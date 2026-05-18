import urllib.request
import re

file_id = '1PpRY8g6GUrcjKzeK4BVlEHsPkJiEICA4'
url = f'https://api.codetabs.com/v1/proxy?quest=https://drive.google.com/uc?export=download&id={file_id}'

req = urllib.request.Request(url)
res = urllib.request.urlopen(req)
data = res.read().decode('utf-8', errors='ignore')

if '<html' in data:
    # Look for confirm parameter
    match = re.search(r'confirm=([a-zA-Z0-9_-]+)', data)
    if match:
        confirm_code = match.group(1)
        real_url = f'https://api.codetabs.com/v1/proxy?quest=https://drive.google.com/uc?export=download&id={file_id}&confirm={confirm_code}'
        print("Found confirm code. Fetching:", real_url)
        req2 = urllib.request.Request(real_url)
        res2 = urllib.request.urlopen(req2)
        pdf_data = res2.read(20)
        print("Second request data:", pdf_data)
    else:
        print("No confirm code found in HTML.")
        # Print a bit of the HTML
        print(data[:500])
else:
    print("Got direct file:", data[:20])
