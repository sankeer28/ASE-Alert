# ASE-Alert

This project is a web application that provides notifications for Automated Speed Enforcement (ASE) locations in Toronto. The application uses Leaflet.js to display a map with ASE locations and provides real-time notifications when the user is near an active speed camera.

## Issues to Fix
- [ ] Improve accuracy of camera detection 
- [ ] Handle edge cases where cameras are not detected
- [ ] Optimize performance for faster camera data processing

## Test Mode: Enable to spoof location by clicking anywhere on map
## How It Works

The application fetches ASE location data from the City of Toronto's Open Data portal and displays the locations on a map. It uses an [api](https://github.com/sankeer28/toronto-street-api) I created to return streetname given coordinates. If user is in range o the camera and on the same street, user is alerted. If a vehicle is detected by the ASE system travelling in excess of the posted speed limit, the registered owner of the vehicle will receive a violation notice regardless of who was driving. The total payable amount is determined by Ontario Regulation 355/22 under the Highway Traffic Act and includes a Set Fine, victim fund component, and a provincial licence plate access fee. No demerit points will be issued by the Ministry of Transportation and no one’s driving record will be impacted.

As of December 2022, Toronto's Automated Speed Enforcement (ASE) program had collected $34 million in fines from speed cameras.

## Libraries Used

- Flask (Python web framework)
- Leaflet.js (Interactive maps)
- Bootstrap (UI components)
- [toronto-street-api (Street name detection)](https://github.com/sankeer28/toronto-street-api)
- City of Toronto Open Data API (Camera locations)

<div style="display: flex; justify-content: center; gap: 20px; margin: 20px 0;">
  <img src="https://github.com/user-attachments/assets/0acf7aa8-c406-498d-9336-3f574a3ad80c" width="300" style="max-width: 45%;">
  <img src="https://github.com/user-attachments/assets/40998321-1d45-491b-a8e7-b6b71db7fa16" width="300" style="max-width: 45%;">
</div>


#### Yellow 🟨 - Cameras coming soon
#### Red 🟥 - Active Cameras
#### When in range and on same street (200m radius from your location and 200m radius from camera radius overlaps) page will flash red 🟥 with optional audio alert 🔊.
## Data Source

The ASE location data is obtained from the City of Toronto's Open Data portal. The dataset can be found at [Automated Speed Enforcement Locations](https://open.toronto.ca/dataset/automated-speed-enforcement-locations/).

## How to Use

1. Open the application in your browser.
2. Allow the application to access your location.
3. The map will display ASE locations in Toronto.
4. If you are near an active speed camera, the site will flash red.

## How It Works

### Street Name Detection System

The application uses a street name matching system that you can monitor through the browser console:

```
--- Checking proximity ---
Street name normalization: "Beverley Street" -> "beverley street"
Current location (normalized): beverley street (original: Beverley Street) [Confidence: 26] [Confirmed: beverley street]
Camera in range: Beverley St. Near D'Arcy St. (46m)
Checking camera: "Beverley St. Near D'Arcy St." at 46m
Street name normalization: "Beverley St. Near D'Arcy St." -> "beverley street"
Comparing normalized streets: "beverley street" with "beverley street"
MATCH! On same street as camera: Beverley St. Near D'Arcy St., distance: 46m
Warning activated - Street confidence: 26
```

#### Understanding the Output:

1. **Street Normalization**
   - Original street names are normalized to remove variations
   - Example: `"Beverley Street" -> "beverley street"`
   - Removes periods, standardizes abbreviations (St. -> Street)

2. **Confidence System**
   - `[Confidence: 26]` shows how many consecutive times you've been on this street
   - Higher confidence means more reliable detection
   - `[Confirmed: beverley street]` shows the current confirmed street name

3. **Camera Detection**
   - Shows nearby cameras within 200m radius
   - Example: `Camera in range: Beverley St. Near D'Arcy St. (46m)`
   - Distance is shown in meters

4. **Street Matching**
   - Compares normalized street names for matches
   - Shows both the original and normalized versions
   - Must match exactly after normalization

### Common Console Messages

- `"No location data available"` - GPS position not yet received
- `"Invalid street name detected"` - Location returned a business name or invalid street
- `"Street changed from X to Y"` - Detected movement to a different street
- `"Safe - Warning deactivated"` - No longer near any cameras

### Troubleshooting

If you see these patterns in the console:

1. **Rapid Street Changes**
   ```
   Current location: Street A [Confidence: 1]
   Current location: Street B [Confidence: 0]
   Current location: Street A [Confidence: 0]
   ```
   This indicates unstable GPS readings. Stay still for better accuracy.

2. **Low Confidence Numbers**
   ```
   Current location: Street A [Confidence: 0]
   ```
   The system isn't sure about your location yet. Wait for confidence to build up.

3. **Multiple Cameras**
   ```
   Camera in range: Street A (100m)
   Camera in range: Street A (150m)
   ```
   You're in range of multiple cameras. The closest one will be used for alerts.

