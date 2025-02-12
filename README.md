# ASE-Alert

This project is a web application that provides notifications for Automated Speed Enforcement (ASE) locations in Toronto. The application uses Leaflet.js to display a map with ASE locations and provides real-time notifications when the user is near an active speed camera.

## How It Works

The application fetches ASE location data from the City of Toronto's Open Data portal and displays the locations on a map. If a vehicle is detected by the ASE system travelling in excess of the posted speed limit, the registered owner of the vehicle will receive a violation notice regardless of who was driving. The total payable amount is determined by Ontario Regulation 355/22 under the Highway Traffic Act and includes a Set Fine, victim fund component, and a provincial licence plate access fee. No demerit points will be issued by the Ministry of Transportation and no one’s driving record will be impacted.

As of December 2022, Toronto's Automated Speed Enforcement (ASE) program had collected $34 million in fines from speed cameras.

![image](https://github.com/user-attachments/assets/8183030b-2671-4167-9983-ff228ce3f8ff)

#### Yellow 🟨 - Cameras coming soon
#### Red 🟥 - Active Cameras
#### When in range (200 m radius from your locationa nd 200m radius rom camera radius overlaps) page will flash red 🟥.
## Data Source

The ASE location data is obtained from the City of Toronto's Open Data portal. The dataset can be found at [Automated Speed Enforcement Locations](https://open.toronto.ca/dataset/automated-speed-enforcement-locations/).

## How to Use

1. Open the application in your browser.
2. Allow the application to access your location.
3. The map will display ASE locations in Toronto.
4. If you are near an active speed camera, the site will flash red.
