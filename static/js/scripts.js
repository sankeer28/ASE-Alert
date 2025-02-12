var aseLocations = [];

function getLocation() {
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

function checkForCameraProximity(userLat, userLon, camera) {
    // Calculate distance between user and camera
    const R = 6371000; // Earth's radius in meters
    const φ1 = userLat * Math.PI/180;
    const φ2 = camera.latitude * Math.PI/180;
    const Δφ = (camera.latitude-userLat) * Math.PI/180;
    const Δλ = (camera.longitude-userLon) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance <= 400; // 200m + 200m = circles are touching
}

function showWarning() {
    activeWarning = true;
    document.body.classList.add('warning-active');
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

            var circle = L.circle([location.latitude, location.longitude], {
                color: color,
                fillColor: color === 'red' ? '#f03' : '#ff0',
                fillOpacity: 0.5,
                radius: 200
            }).addTo(map)
            .bindPopup(message);
            aseMarkers.push(circle);
        }
    });
}

// Function to check if user is in range of any camera
function checkProximity() {
    console.log("Checking proximity...");
    let inRange = false;
    aseLocations.forEach(location => {
        if (location.status === "Active" && checkForCameraProximity(userLat, userLon, location)) {
            inRange = true;
        }
    });

    if (inRange) {
        console.log("In range of a camera");
        if (!activeWarning) {
            console.log("Slow down");
            showWarning();
        }
    } else {
        console.log("Not in range of any camera");
        if (activeWarning) {
            console.log("Safe");
            hideWarning();
        }
    }
}

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

// Check proximity every second
setInterval(checkProximity, 1000);

// Update the existing automatic location start
window.onload = function() {
    getLocation();
};
