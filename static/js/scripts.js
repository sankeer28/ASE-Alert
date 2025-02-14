var aseLocations = [];
var soundEnabled = false;
var userStreet = null;
var cameraStreets = {};
var testMode = false;

function getLocation() {
    if (testMode) {
        console.log("Test mode active - click map to move position");
        return;
    }
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            showPosition,
            showError,
            {
                enableHighAccuracy: true, // Request high accuracy
                maximumAge: 0, // Do not use cached location
                timeout: 10000 // Allow up to 10 seconds to get location
            }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

var map = L.map('map', {
    zoomControl: true,
    doubleClickZoom: true,
    trackResize: true,
    attributionControl: false 
}).setView([43.65107, -79.347015], 16);

var Jawg_Terrain = L.tileLayer('https://tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token={accessToken}', {
    minZoom: 0,
    maxZoom: 22,
    accessToken: 'yN0ESgFsBwgdpSy0MoyaFsDI66mXptDz4cWH0wArMflMJCBK7TkuyjQY8OtqEViZ'
}).addTo(map);

var prevLat = null;
var prevLon = null;
var isFollowingUser = true;
var inactivityTimeout;

var userMarker;
var userDirection;
var aseMarkers = [];
var initialViewSet = false;
var userLat, userLon;
var streetLayer;
var activeWarning = false;

function showPosition(position) {
    userLat = position.coords.latitude;
    userLon = position.coords.longitude;
    var userHeading = position.coords.heading;
    var userSpeed = position.coords.speed;

    // Create or update radius circle
    if (!streetLayer) {
        streetLayer = L.circle([userLat, userLon], {
            radius: 200,
            color: 'lightblue',
            weight: 1,
            fillColor: '#add8e6',
            fillOpacity: 0.1
        }).addTo(map);
    }

    // Smooth transition if we have previous coordinates
    if (prevLat && prevLon && userMarker) {
        var latDiff = userLat - prevLat;
        var lonDiff = userLon - prevLon;
        var frames = 10;
        var frame = 0;

        var animate = function() {
            if (frame < frames) {
                frame++;
                var lat = prevLat + (latDiff * frame / frames);
                var lon = prevLon + (lonDiff * frame / frames);
                
                // Update user marker
                userMarker.setLatLng([lat, lon]);
                
                // Update direction marker if it exists
                if (userDirection) {
                    userDirection.setLatLng([lat, lon]);
                }
                
                // Update radius circle
                streetLayer.setLatLng([lat, lon]);
                
                if (isFollowingUser) {
                    map.panTo([lat, lon], { animate: true, duration: 0.1 });
                }
                requestAnimationFrame(animate);
            }
        };
        animate();
    } else {
        // Initial setup of markers
        if (userMarker) {
            map.removeLayer(userMarker);
        }
        if (userDirection) {
            map.removeLayer(userDirection);
        }

        userMarker = L.circleMarker([userLat, userLon], {
            radius: 8,
            color: '#4285F4',
            fillColor: '#4285F4',
            fillOpacity: 1,
            weight: 2
        }).addTo(map);

        if (userHeading !== null) {
            userDirection = L.marker([userLat, userLon], {
                icon: L.divIcon({
                    className: 'user-direction',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                    html: `<div class="user-direction" style="transform: rotate(${userHeading}deg);"></div>`
                })
            }).addTo(map);
        }

        // Update radius circle position
        streetLayer.setLatLng([userLat, userLon]);

        if (isFollowingUser) {
            map.setView([userLat, userLon], map.getZoom());
        }
    }

    // Store current position for next update
    prevLat = userLat;
    prevLon = userLon;
}

function showError(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            alert("User denied the request for Geolocation.");
            break;
        case error.POSITION_UNAVAILABLE:
            alert("Location information is unavailable.");
            break;
        case error.TIMEOUT:
            alert("The request to get user location timed out.");
            break;
        case error.UNKNOWN_ERROR:
            alert("An unknown error occurred.");
            break;
    }
}

// Add this new function to get street name from coordinates
async function getStreetName(lat, lon) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const data = await response.json();
        return data.address.road || null;
    } catch (error) {
        console.error('Error getting street name:', error);
        return null;
    }
}

// Modify the checkForCameraProximity function
async function checkForCameraProximity(userLat, userLon, camera) {
    // First check distance
    const R = 6371000;
    const φ1 = userLat * Math.PI/180;
    const φ2 = camera.latitude * Math.PI/180;
    const Δφ = (camera.latitude-userLat) * Math.PI/180;
    const Δλ = (camera.longitude-userLon) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    // If not within distance, return false immediately
    if (distance > 400) return false;

    // If within distance, check street names
    // Get user's current street name if we don't have it
    if (!userStreet) {
        userStreet = await getStreetName(userLat, userLon);
    }

    // Get camera's street name if we don't have it cached
    if (!cameraStreets[camera.id]) {
        cameraStreets[camera.id] = await getStreetName(camera.latitude, camera.longitude);
    }

    // Compare street names
    return userStreet && cameraStreets[camera.id] && 
           userStreet.toLowerCase() === cameraStreets[camera.id].toLowerCase();
}

// Modify the checkProximity function to handle async
async function checkProximity() {
    console.log("Checking proximity...");
    let inRange = false;

    // Update user's street name periodically
    userStreet = await getStreetName(userLat, userLon);

    for (const location of aseLocations) {
        if (location.status === "Active") {
            if (await checkForCameraProximity(userLat, userLon, location)) {
                inRange = true;
                break;
            }
        }
    }

    if (inRange) {
        console.log("In range of a camera on the same street");
        if (!activeWarning) {
            console.log("Slow down");
            showWarning();
        }
    } else {
        console.log("Not in range or not on same street");
        if (activeWarning) {
            console.log("Safe");
            hideWarning();
        }
    }
}

function initializeSound() {
    const warningSound = document.getElementById('warningSound');
    const enableSoundBtn = document.getElementById('enableSound');
    
    enableSoundBtn.addEventListener('click', function() {
        soundEnabled = true;
        warningSound.muted = false;
        // Play and immediately pause to initialize audio
        warningSound.play().then(() => {
            warningSound.pause();
            warningSound.currentTime = 0;
        }).catch(error => {
            console.log("Error initializing audio:", error);
        });
        enableSoundBtn.style.display = 'none';
    });
}

function showWarning() {
    activeWarning = true;
    document.body.classList.add('warning-active');
    document.getElementById('warning-banner').style.display = 'block';
    
    // Play warning sound if enabled
    if (soundEnabled) {
        const warningSound = document.getElementById('warningSound');
        warningSound.muted = false;
        warningSound.play().catch(error => {
            console.log("Error playing sound:", error);
        });
    }
    
    console.log("Slow down - Warning activated");
    
    // Vibrate if supported
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
}

function hideWarning() {
    activeWarning = false;
    document.body.classList.remove('warning-active');
    document.getElementById('warning-banner').style.display = 'none';
    
    // Stop warning sound
    const warningSound = document.getElementById('warningSound');
    warningSound.pause();
    warningSound.currentTime = 0;
    
    console.log("Safe - Warning deactivated");
}

// Refocus map to user's location
function refocusMap() {
    if (userLat && userLon) {
        map.setView([userLat, userLon], 16);
        isFollowingUser = true;
    }
}

// Add custom control button for refocusing
L.Control.Refocus = L.Control.extend({
    onAdd: function(map) {
        var div = L.DomUtil.create('div', 'leaflet-control-refocus');
        div.innerHTML = '<i class="fas fa-crosshairs"></i> Refocus';
        div.onclick = function() {
            refocusMap();
        };
        return div;
    }
});

L.control.refocus = function(opts) {
    return new L.Control.Refocus(opts);
}

L.control.refocus({ position: 'topright' }).addTo(map);

// Add drag handlers to toggle following and set inactivity timeout
map.on('dragstart', function() {
    isFollowingUser = false;
    clearTimeout(inactivityTimeout);
});

map.on('dragend', function() {
    inactivityTimeout = setTimeout(function() {
        refocusMap();
    }, 5000); // 5 seconds of inactivity
});

// Function to add ASE markers to the map
function addAseMarkers() {
    console.log("Adding ASE markers to the map...");
    aseLocations.forEach(location => {
        if (location.latitude && location.longitude) {
            var color = location.status === "Active" ? 'red' : 'yellow';
            var message = `
                <b>ID:</b> ${location.id}<br>
                <b>Location Code:</b> ${location.location_code}<br>
                <b>Ward:</b> ${location.ward}<br>
                <b>Location:</b> ${location.location}<br>
                <b>FID:</b> ${location.fid}<br>
                <b>Status:</b> ${location.status}
            `;

            // Add circle for range
            var circle = L.circle([location.latitude, location.longitude], {
                color: color,
                fillColor: color === 'red' ? '#f03' : '#ff0',
                fillOpacity: 0.2,
                radius: 200
            }).addTo(map);

            // Add camera marker
            var cameraIcon = L.divIcon({
                className: 'camera-icon',
                html: `<div style="
                    width: 10px;
                    height: 10px;
                    background-color: ${color};
                    border: 2px solid white;
                    border-radius: 50%;
                    box-shadow: 0 0 4px rgba(0,0,0,0.5);
                "></div>`,
                iconSize: [10, 10]
            });

            var marker = L.marker([location.latitude, location.longitude], {
                icon: cameraIcon
            }).addTo(map);

            // Add popup to both circle and marker
            circle.bindPopup(message);
            marker.bindPopup(message);
            
            aseMarkers.push(circle);
            aseMarkers.push(marker);
        }
    });
}

// Function to check if user is in range of any camera
// Modify the interval to use async function
setInterval(() => {
    checkProximity().catch(error => {
        console.error("Error in proximity check:", error);
    });
}, 1000);

// Fetch ASE locations once at the start
fetch('/check_location', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
})
.then(response => response.json())
.then(data => {
    console.log("ASE locations received:", data.ase_locations);
    aseLocations = data.ase_locations;
    addAseMarkers(); // Add ASE markers to the map
});

// Add this new function
function toggleTestMode() {
    testMode = !testMode;
    document.getElementById('testModeBtn').classList.toggle('btn-warning');
    document.getElementById('testModeBtn').classList.toggle('btn-secondary');
    document.getElementById('testModeStatus').textContent = testMode ? 'ON' : 'OFF';
}

// Add this new function
function simulatePosition(e) {
    if (!testMode) return;
    
    const clickLat = e.latlng.lat;
    const clickLon = e.latlng.lng;
    
    // Simulate position update
    showPosition({
        coords: {
            latitude: clickLat,
            longitude: clickLon,
            heading: 0,
            speed: 0
        }
    });
}

// Add this new function to show the test mode button
function showTestModeButton() {
    document.getElementById('testModeBtn').style.display = 'block';
}

// Update the existing automatic location start
window.onload = function() {
    getLocation();
    initializeSound();
    
    // Add map click handler
    map.on('click', simulatePosition);
    
    // Show the test mode button (for example, only in development mode)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        showTestModeButton();
    }
};
