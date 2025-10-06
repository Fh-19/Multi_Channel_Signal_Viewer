from sentinelsat import SentinelAPI, read_geojson, geojson_to_wkt
from datetime import date
import time

# Login (replace with your Copernicus username/password)
api = SentinelAPI('nour hassan', 'Abs987654321%', 'https://apihub.copernicus.eu/apihub')

# Define area of interest
footprint = geojson_to_wkt(read_geojson('area.geojson'))

# Function to query with retries
def query_with_retries(max_retries=3, delay=10):
    for attempt in range(max_retries):
        try:
            products = api.query(
                footprint,
                date=('20230901', '20230910'),
                platformname='Sentinel-1',
                producttype='GRD',
                timeout=120  # increase timeout to 2 minutes
            )
            return products
        except Exception as e:
            print(f"Attempt {attempt+1} failed: {e}")
            if attempt < max_retries - 1:
                print(f"Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                raise

# Query products
products = query_with_retries()

print(f"Found {len(products)} products")

# Download first product
if products:
    first_id = list(products.keys())[0]
    api.download(first_id, directory_path='data')
