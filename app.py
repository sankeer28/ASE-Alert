from flask import Flask, render_template, request, jsonify
import requests
import json
import logging
from math import radians, sin, cos, sqrt, atan2
from tenacity import retry, stop_after_attempt, wait_fixed

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)

# Global variable to store ASE locations
ase_locations = []

# Helper to get street name with retry
@retry(stop=stop_after_attempt(3), wait=wait_fixed(1))
def get_street_name(lat, lng):
    try:
        response = requests.get(
            "https://toronto-street-api.vercel.app/api",
            params={"lat": lat, "lng": lng}, timeout=5
        )
        data = response.json()
        return data.get("street", "").lower()
    except Exception as e:
        logging.error(f"Error fetching street name for ({lat}, {lng}): {e}")
        return ""

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
                        lat, lng = coordinates[1], coordinates[0]
                        # Try to cache street name, but don't block if it fails
                        try:
                            street_name = get_street_name(lat, lng)
                        except Exception as e:
                            logging.warning(f"Could not fetch street name for camera at ({lat}, {lng}): {e}")
                            street_name = ""
                        ase_locations.append({
                            "latitude": lat,
                            "longitude": lng,
                            "id": record["_id"],
                            "location_code": record["Location_Code"],
                            "ward": record["ward"],
                            "location": record["location"],
                            "fid": record["FID"],
                            "status": record["Status"],
                            "street_name": street_name
                        })
                    if len(records) < 100:
                        break
                    p["offset"] += 100
        logging.info("ASE locations fetched successfully.")
    except Exception as e:
        logging.error(f"Error fetching ASE locations: {e}")

    return ase_locations

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth's radius in kilometers
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c * 1000  # Convert to meters

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/check_location', methods=['POST'])
def check_location():
    global ase_locations
    user_location = request.json
    user_lat = user_location.get('latitude')
    user_lng = user_location.get('longitude')
    ALERT_DISTANCE = 300  # Alert when within 300 meters
    
    # If ase_locations is empty, try to fetch again (fallback)
    if not ase_locations:
        fetch_ase_locations()
    try:
        # Get user's street name
        user_street_response = requests.get(
            f"https://toronto-street-api.vercel.app/api",
            params={"lat": user_lat, "lng": user_lng}
        )
        user_street_data = user_street_response.json()
        user_street = user_street_data.get("street", "").lower()
        
        nearby_alerts = []
        for camera in ase_locations:
            camera_lat = camera['latitude']
            camera_lng = camera['longitude']
            distance = calculate_distance(user_lat, user_lng, camera_lat, camera_lng)
            if distance <= ALERT_DISTANCE:
                # Use cached street name
                camera_street = camera.get('street_name', '').lower()
                if user_street == camera_street:
                    nearby_alerts.append({
                        "location": camera['location'],
                        "street": camera_street,
                        "distance": round(distance),
                        "latitude": camera_lat,
                        "longitude": camera_lng,
                        "status": camera['status']
                    })
        return jsonify({
            "message": "Check completed",
            "ase_locations": ase_locations,  # Include full list for map markers
            "your_street": user_street,
            "alerts": nearby_alerts,
            "total_alerts": len(nearby_alerts)
        })
        
    except Exception as e:
        logging.error(f"Error checking location: {e}")
        return jsonify({
            "message": "Check completed",
            "ase_locations": ase_locations,  # Include even on error for map markers
            "error": str(e)
        })

@app.route('/get_street_name', methods=['GET'])
def get_street_name():
    lat = request.args.get('lat')
    lng = request.args.get('lng')
    
    try:
        response = requests.get(
            "https://toronto-street-api.vercel.app/api",
            params={"lat": lat, "lng": lng}
        )
        return jsonify(response.json())
    except Exception as e:
        logging.error(f"Error getting street name: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    fetch_ase_locations()  # Fetch ASE locations once at the start
    app.run(debug=True)
