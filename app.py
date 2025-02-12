from flask import Flask, render_template, request, jsonify
import requests
import json
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)

# Global variable to store ASE locations
ase_locations = []

# Fetch ASE location data
def fetch_ase_locations():
    global ase_locations
    base_url = "https://ckan0.cf.opendata.inter.prod-toronto.ca"
    url = base_url + "/api/3/action/package_show"
    params = {"id": "automated-speed-enforcement-locations"}
    logging.info("Fetching ASE locations from CKAN API...")
    try:
        package = requests.get(url, params=params).json()
        ase_locations = []

        for resource in package["result"]["resources"]:
            if resource["datastore_active"]:
                url = base_url + "/api/3/action/datastore_search"
                p = {"id": resource["id"], "limit": 100, "offset": 0}
                while True:
                    resource_search_data = requests.get(url, params=p).json()["result"]
                    records = resource_search_data["records"]
                    for record in records:
                        geometry = json.loads(record["geometry"])
                        coordinates = geometry["coordinates"]
                        ase_locations.append({
                            "latitude": coordinates[1],
                            "longitude": coordinates[0],
                            "id": record["_id"],
                            "location_code": record["Location_Code"],
                            "ward": record["ward"],
                            "location": record["location"],
                            "fid": record["FID"],
                            "status": record["Status"]
                        })
                    if len(records) < 100:
                        break
                    p["offset"] += 100
        logging.info("ASE locations fetched successfully.")
    except Exception as e:
        logging.error(f"Error fetching ASE locations: {e}")

    return ase_locations

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/check_location', methods=['POST'])
def check_location():
    user_location = request.json
    return jsonify({"message": "Check completed", "ase_locations": ase_locations})

if __name__ == '__main__':
    fetch_ase_locations()  # Fetch ASE locations once at the start
    app.run(debug=True)
