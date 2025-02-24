var aseLocations = [];
var soundEnabled = false;
var userStreet = null;
var cameraStreets = {};
var testMode = false;
var lastKnownStreet = null;
var lastStreetConfidence = 0;
var streetConfidence = 0;
var lastCheckedLocation = { lat: null, lon: null };
var cameraStreetsCache = {};
var previousStreets = [];
var streetChangeBuffer = 3; // Need this many consecutive different readings to change streets
var sameStreetCount = 0;

// Add these new variables at the top
var streetConfidenceThreshold = 2; // Number of confirmations needed to change streets
var streetHistory = [];
var currentConfirmedStreet = null;
var temporaryStreetCount = 0;

// Update getLocation function with better error handling
function getLocation() {
    if (testMode) {
        console.log("Test mode active - click map to move position");
        return;
    }

    if (!navigator.geolocation) {
        console.error("Geolocation is not supported by this browser.");
        alert("Geolocation is not supported by this browser.");
        return;
    }

    const options = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000 // Increased timeout to 10 seconds
    };

    try {
        console.log("Requesting geolocation...");
        navigator.geolocation.getCurrentPosition(
            // Success callback
            (position) => {
                console.log("Initial position received:", position.coords);
                showPosition(position);
                
                // Start watching position after getting initial location
                navigator.geolocation.watchPosition(
                    showPosition,
                    showError,
                    options
                );
            },
            // Error callback
            (error) => {
                console.error("Error getting initial position:", error);
                showDetailedError(error);
            },
            options
        );
    } catch (e) {
        console.error("Exception in getLocation:", e);
        alert("Error initializing location services. Please ensure location access is enabled.");
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
var activeWarning = false;

// Update showPosition with validation
function showPosition(position) {
    if (!position || !position.coords) {
        console.error("Invalid position data received:", position);
        return;
    }

    userLat = position.coords.latitude;
    userLon = position.coords.longitude;

    if (!userLat || !userLon) {
        console.error("Invalid coordinates:", {lat: userLat, lon: userLon});
        return;
    }

    console.log("Position update:", {lat: userLat, lon: userLon});
    
    var userHeading = position.coords.heading;
    var userSpeed = position.coords.speed;

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

// Add new function for detailed error handling
function showDetailedError(error) {
    let message = "Location Error: ";
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message += "Please enable location access in your browser settings.";
            break;
        case error.POSITION_UNAVAILABLE:
            message += "Location information is unavailable. Please check your device's location settings.";
            break;
        case error.TIMEOUT:
            message += "Location request timed out. Please check your internet connection.";
            break;
        case error.UNKNOWN_ERROR:
            message += "An unknown error occurred. Please try refreshing the page.";
            break;
    }
    console.error(message, error);
    alert(message);
}

// Add this helper function to calculate distance between coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * 
              Math.cos(lat1Rad) * Math.cos(lat2Rad);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Convert to meters
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

// Replace normalizeStreetName function with improved version
function normalizeStreetName(streetName) {
    if (!streetName) return '';
    
    // Convert to lowercase and remove periods
    let normalized = streetName.toLowerCase().replace(/\./g, '');
    
    // Special handling for Lake Shore Boulevard
    if (normalized.includes('lake shore') || normalized.includes('lakeshore')) {
        normalized = normalized
            .replace('lakeshore', 'lake shore')
            .replace('blvd', 'boulevard')
            .replace(/ e\.?(\s|$)/, ' east$1')
            .replace(/ w\.?(\s|$)/, ' west$1');
            
        // Remove everything after cardinal directions
        normalized = normalized.replace(/(east|west).*$/, '$1');
    }
    
    // Handle special cases with common abbreviations
    const replacements = {
        'rd': 'road',
        'st': 'street',
        'ave': 'avenue',
        'dr': 'drive',
        'cres': 'crescent',
        'blvd': 'boulevard',
        'ct': 'court',
        'ln': 'lane',
        'pl': 'place'
    };

    // Replace abbreviations with full words
    for (const [abbr, full] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${abbr}\\b`, 'g');
        normalized = normalized.replace(regex, full);
    }

    // Clean up the street name - stop at first "near", "east of", etc.
    normalized = normalized
        .replace(/\s*\([^)]*\)/g, '') // Remove parentheses content
        .replace(/\s*(near|between|at|beside|behind|across from|in front of|east of|west of|north of|south of).*$/i, '') // Remove descriptive text
        .replace(/\s+/g, ' ') // Clean up spaces
        .trim();

    console.log(`Street name normalization: "${streetName}" -> "${normalized}"`);
    return normalized;
}

// Add street name validation function
function isValidStreetName(streetName) {
    if (!streetName) return false;
    
    // Must be at least 3 characters
    if (streetName.length < 3) return false;
    
    // Common business/place names to reject
    const invalidNames = /^(bmo|rbc|td|cibc|scotiabank|tim hortons|mcdonalds|walmart|costco|canadian tire|home depot|lowes|ikea|no name|no nearby|unknown|undefined)$/i;
    if (invalidNames.test(streetName)) {
        console.log(`Rejected business name: ${streetName}`);
        return false;
    }
    
    // Must contain at least one word that's typically in street names
    const streetIndicators = /(road|rd|street|st|avenue|ave|drive|dr|crescent|cres|boulevard|blvd|court|ct|circle|cir|lane|ln|way|trail|path|park|gardens|gate|heights|hills|place|plaza|square|terrace|valley|view|wood)/i;
    if (!streetIndicators.test(streetName)) {
        console.log(`Missing street indicator in: ${streetName}`);
        return false;
    }
    
    return true;
}

// Add this function to handle street consistency
function processStreetName(newStreet) {
    // Add to history
    streetHistory.push(newStreet);
    if (streetHistory.length > 10) {
        streetHistory.shift(); // Keep last 10 readings
    }

    // If we have a confirmed street, require multiple different readings to change it
    if (currentConfirmedStreet) {
        if (newStreet === currentConfirmedStreet) {
            temporaryStreetCount = 0;
            sameStreetCount++;
            return currentConfirmedStreet;
        } else {
            temporaryStreetCount++;
            // Only change street if we see the new street multiple times
            if (temporaryStreetCount > streetConfidenceThreshold) {
                const recentStreets = streetHistory.slice(-streetConfidenceThreshold);
                const allSame = recentStreets.every(s => s === newStreet);
                if (allSame) {
                    console.log(`Street changed from ${currentConfirmedStreet} to ${newStreet} after ${streetConfidenceThreshold} confirmations`);
                    currentConfirmedStreet = newStreet;
                    sameStreetCount = 1;
                    temporaryStreetCount = 0;
                    return newStreet;
                }
            }
            return currentConfirmedStreet;
        }
    } else {
        // No confirmed street yet, establish one
        const mostCommon = getMostCommonStreet(streetHistory);
        if (mostCommon && streetHistory.length >= 3) {
            currentConfirmedStreet = mostCommon;
            sameStreetCount = 1;
            return mostCommon;
        }
        return newStreet;
    }
}

// Add helper function to get most common street
function getMostCommonStreet(streets) {
    const counts = {};
    let maxCount = 0;
    let mostCommon = null;

    streets.forEach(street => {
        counts[street] = (counts[street] || 0) + 1;
        if (counts[street] > maxCount) {
            maxCount = counts[street];
            mostCommon = street;
        }
    });

    return maxCount >= 2 ? mostCommon : null;
}

// Update the compareStreetNames function
function compareStreetNames(locationA, locationB) {
    const normalizedA = normalizeStreetName(locationA);
    const normalizedB = normalizeStreetName(locationB);
    
    console.log(`Comparing normalized streets: "${normalizedA}" with "${normalizedB}"`);
    
    // Exact match
    if (normalizedA === normalizedB) {
        return true;
    }
    
    // Handle Lake Shore Boulevard special case
    if (normalizedA.includes('lake shore') || normalizedB.includes('lake shore')) {
        const baseA = normalizedA.replace(/(east|west)$/, '').trim();
        const baseB = normalizedB.replace(/(east|west)$/, '').trim();
        
        if (baseA === baseB) {
            const dirA = normalizedA.match(/(east|west)$/)?.[1] || '';
            const dirB = normalizedB.match(/(east|west)$/)?.[1] || '';
            return !dirA || !dirB || dirA === dirB;
        }
    }
    
    return false;
}

// Update checkProximity function
async function checkProximity() {
    if (!userLat || !userLon) {
        console.log("No location data available");
        return;
    }

    console.log("\n--- Checking proximity ---");
    let nearbyCameras = [];

    try {
        const userResponse = await fetch(`/get_street_name?lat=${userLat}&lng=${userLon}`);
        const userData = await userResponse.json();
        const originalStreet = userData.street;
        let userStreet = normalizeStreetName(originalStreet);
        
        if (!isValidStreetName(originalStreet)) {
            console.log(`Invalid street name detected: ${originalStreet}, using confirmed street`);
            if (currentConfirmedStreet) {
                userStreet = currentConfirmedStreet;
            } else {
                console.log('No confirmed street available');
                return;
            }
        }

        userStreet = processStreetName(userStreet);
        console.log(`Current location (normalized): ${userStreet} (original: ${originalStreet}) [Confidence: ${sameStreetCount}] [Confirmed: ${currentConfirmedStreet}]`);

        // Find active cameras within range
        for (const camera of aseLocations) {
            if (camera.status === "Active") {
                const distance = calculateDistance(userLat, userLon, camera.latitude, camera.longitude);
                if (distance <= 200) {
                    // Extract street name from camera location
                    const cameraLocation = camera.location;
                    const cameraStreetMatch = cameraLocation.match(/^([^(]+?)(?:\s+(?:Near|Between|At|North of|South of|East of|West of))?(?:\s+(?:and|&))?\s*(?:\(.*\))?$/i);
                    const cameraStreet = cameraStreetMatch ? cameraStreetMatch[1].trim() : cameraLocation;

                    nearbyCameras.push({ 
                        camera, 
                        distance,
                        originalStreet: cameraStreet
                    });
                    console.log(`Camera in range: ${camera.location} (${Math.round(distance)}m)`);
                }
            }
        }

        // Check if any nearby cameras are on the same street
        if (nearbyCameras.length > 0) {
            let closestMatch = null;
            let closestDistance = Infinity;

            // Check all nearby cameras and find the closest match
            for (const { camera, distance, originalStreet } of nearbyCameras) {
                console.log(`Checking camera: "${originalStreet}" at ${Math.round(distance)}m`);
                
                if (compareStreetNames(originalStreet, userData.street)) {
                    if (distance < closestDistance) {
                        closestMatch = { camera, distance, originalStreet };
                        closestDistance = distance;
                    }
                }
            }

            // Show warning for closest matching camera
            if (closestMatch) {
                console.log(`MATCH! On same street as camera: ${closestMatch.originalStreet}, distance: ${Math.round(closestMatch.distance)}m`);
                showWarning({
                    distance: Math.round(closestMatch.distance),
                    street: userData.street,
                    location: closestMatch.camera.location
                });
                return;
            }
        }

        if (activeWarning) {
            hideWarning();
        }

    } catch (error) {
        console.error("Error in proximity check:", error);
    }
}

// Update showWarning to include confidence info
function showWarning(warningInfo) {
    const warningBanner = document.getElementById('warning-banner');
    warningBanner.innerHTML = `
        ⚠️ WARNING: Active Speed Camera Ahead! ⚠️
        <div class="distance-text">${warningInfo.distance}m ahead</div>
        <div class="location-text">
            On ${warningInfo.street}<br>
        </div>
    `;
    warningBanner.style.display = 'block';
    
    if (!activeWarning) {
        activeWarning = true;
        document.body.classList.add('warning-active');
        
        if (soundEnabled) {
            playWarningSound();
        }
        
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    }
    console.log(`Warning activated - Street confidence: ${sameStreetCount}`);
}

// Add new function to handle sound
function playWarningSound() {
    const warningSound = document.getElementById('warningSound');
    if (warningSound) {
        warningSound.currentTime = 0; // Reset to start
        warningSound.loop = true;
        
        const playPromise = warningSound.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Error playing sound:", error);
            });
        }
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
            var circle = L.circle([location.latitude, location.longitude], {
                color: color,
                fillColor: color === 'red' ? '#f03' : '#ff0',
                fillOpacity: 0.2,
                radius: 200,
                interactive: !testMode  // Disable interaction in test mode
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
                icon: cameraIcon,
                interactive: !testMode  // Disable interaction in test mode
            }).addTo(map);

            // Only add popups if not in test mode
            if (!testMode) {
                var message = `
                    <b>ID:</b> ${location.id}<br>
                    <b>Location Code:</b> ${location.location_code}<br>
                    <b>Ward:</b> ${location.ward}<br>
                    <b>Location:</b> ${location.location}<br>
                    <b>FID:</b> ${location.fid}<br>
                    <b>Status:</b> ${location.status}
                `;
                circle.bindPopup(message);
                marker.bindPopup(message);
            }
            
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
}, 1000); // Check every second

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
    
    // Remove existing markers and re-add them
    aseMarkers.forEach(marker => marker.remove());
    aseMarkers = [];
    addAseMarkers();
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

// Update showTestModeButton function
function showTestModeButton() {
    const testModeBtn = document.getElementById('testModeBtn');
    if (testModeBtn) {
        testModeBtn.style.display = 'block';
        testModeBtn.addEventListener('click', toggleTestMode);
    }
}

// Update window.onload function
window.onload = function() {
    console.log("Page loaded, initializing...");
    
    // Always show test mode button in development
    showTestModeButton();
    
    // Initialize sound button
    const enableSoundBtn = document.getElementById('enableSound');
    const warningSound = document.getElementById('warningSound');
    
    if (enableSoundBtn && warningSound) {
        enableSoundBtn.addEventListener('click', function() {
            soundEnabled = true;
            // Test sound setup
            warningSound.loop = false;
            warningSound.currentTime = 0;
            warningSound.play()
                .then(() => {
                    setTimeout(() => {
                        warningSound.pause();
                        warningSound.currentTime = 0;
                    }, 500);
                })
                .catch(error => {
                    console.log("Error playing test sound:", error);
                });
            enableSoundBtn.style.display = 'none';
        });
    }
    
    // Start location tracking with a slight delay to ensure page is ready
    setTimeout(() => {
        console.log("Starting location tracking...");
        getLocation();
    }, 1000);
    
    map.on('click', simulatePosition);
};
