// Map instance
let map;
let alertMarkers = [];
let nearbyUserMarkers = [];

// Initialize map
function initMap() {
    if (map) return;
    
    map = L.map('map', {
        center: [20.5937, 78.9629],
        zoom: 5,
        zoomControl: false,
        attributionControl: false,
        maxZoom: 22 // Allow ultra zoom
    });

    // Google Satellite (Ultra High Res) - Only layer, no API needed
    const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22, // Allow zooming in very deep
        maxNativeZoom: 20, // Tiles exist up to 20, zoom 21-22 will stretch
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Google'
    });

    // Add Google Satellite as default and only layer
    googleSat.addTo(map);

    // Controls
    L.control.zoom({ position: 'topright' }).addTo(map);

    console.log('Map initialized');
}

// Create custom marker icon for alerts
function createAlertIcon() {
    return L.divIcon({
        className: 'custom-alert-marker',
        html: `
            <div style="
                width: 40px;
                height: 40px;
                background: #ef4444;
                border: 3px solid #fff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
                font-size: 20px;
                font-weight: bold;
                color: #fff;
            ">!</div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
}

// Create custom marker icon for nearby users
function createUserIcon() {
    return L.divIcon({
        className: 'custom-user-marker',
        html: `
            <div style="
                width: 32px;
                height: 32px;
                background: #3b82f6;
                border: 2px solid #fff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
                font-size: 16px;
                font-weight: bold;
                color: #fff;
            ">U</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
}

// Add alert markers to map
function addAlertMarkers(alerts) {
    // Clear existing alert markers
    alertMarkers.forEach(marker => map.removeLayer(marker));
    alertMarkers = [];

    alerts.forEach(alert => {
        if (alert.latitude && alert.longitude) {
            const marker = L.marker([alert.latitude, alert.longitude], {
                icon: createAlertIcon()
            }).addTo(map);

            // Create popup content
            const popupContent = `
                <div style="min-width: 220px; padding: 8px;">
                    <div style="background: #1a1a1a; padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; margin-bottom: 6px;">
                            <span style="color: #888; font-size: 11px; width: 50px;">NAME:</span>
                            <span style="color: #fff; font-size: 12px; font-weight: 500;">${alert.user_name || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; align-items: center; margin-bottom: 6px;">
                            <span style="color: #888; font-size: 11px; width: 50px;">PHONE:</span>
                            <span style="color: #fff; font-size: 12px;">${alert.user_phone || 'N/A'}</span>
                        </div>
                        <div style="display: flex; align-items: center; margin-bottom: 6px;">
                            <span style="color: #888; font-size: 11px; width: 50px;">TYPE:</span>
                            <span style="color: #fbbf24; font-size: 12px; font-weight: 500;">${alert.alert_type || 'Voice Help'}</span>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <span style="color: #888; font-size: 11px; width: 50px;">TIME:</span>
                            <span style="color: #aaa; font-size: 11px;">${formatTimeAgo(alert.created_at)}</span>
                        </div>
                    </div>
                    
                    <button onclick="showAlertDetails('${alert.id}')" style="
                        width: 100%;
                        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                        color: #000;
                        border: none;
                        padding: 10px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        transition: all 0.2s;
                        box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
                    " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(251, 191, 36, 0.4)'" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(251, 191, 36, 0.3)'">
                        View Details
                    </button>
                </div>
            `;

            marker.bindPopup(popupContent);

            // Show popup on hover
            marker.on('mouseover', function (e) {
                this.openPopup();
            });

            // Store alert data with marker
            marker.alertData = alert;

            alertMarkers.push(marker);
        }
    });

    // Fit map to show all markers if any exist
    if (alertMarkers.length > 0) {
        const group = L.featureGroup(alertMarkers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Add nearby user markers to map
function addNearbyUserMarkers(users, alertLat, alertLon) {
    // Clear existing nearby user markers
    nearbyUserMarkers.forEach(marker => map.removeLayer(marker));
    nearbyUserMarkers = [];

    users.forEach(user => {
        if (user.last_latitude && user.last_longitude) {
            const marker = L.marker([user.last_latitude, user.last_longitude], {
                icon: createUserIcon()
            }).addTo(map);

            // Create popup content
            const popupContent = `
                <div style="min-width: 200px; padding: 8px;">
                    <div style="
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: #fff;
                        padding: 6px 12px;
                        border-radius: 6px;
                        font-weight: 600;
                        font-size: 12px;
                        margin-bottom: 8px;
                        text-align: center;
                    ">[USER] NEARBY HELPER</div>
                    
                    <div style="background: #1a1a1a; padding: 10px; border-radius: 6px;">
                        <div style="display: flex; align-items: center; margin-bottom: 6px;">
                            <span style="color: #888; font-size: 11px; width: 60px;">NAME:</span>
                            <span style="color: #fff; font-size: 12px; font-weight: 500;">${user.name || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; align-items: center; margin-bottom: 6px;">
                            <span style="color: #888; font-size: 11px; width: 60px;">PHONE:</span>
                            <span style="color: #fff; font-size: 12px;">${user.phone || 'N/A'}</span>
                        </div>
                        <div style="display: flex; align-items: center; margin-bottom: 6px;">
                            <span style="color: #888; font-size: 11px; width: 60px;">DISTANCE:</span>
                            <span style="color: #3b82f6; font-size: 12px; font-weight: 500;">${user.distance.toFixed(2)} km</span>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <span style="color: #888; font-size: 11px; width: 60px;">LAST:</span>
                            <span style="color: #aaa; font-size: 11px;">${formatTimeAgo(user.last_location_updated_at)}</span>
                        </div>
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent);

            // Show popup on hover
            marker.on('mouseover', function (e) {
                this.openPopup();
            });

            nearbyUserMarkers.push(marker);
        }
    });

    // Draw circle showing 5km radius
    if (alertLat && alertLon) {
        const circle = L.circle([alertLat, alertLon], {
            color: '#fbbf24',
            fillColor: '#fbbf24',
            fillOpacity: 0.1,
            radius: 5000 // 5km in meters
        }).addTo(map);

        nearbyUserMarkers.push(circle);

        // Fit map to show alert and radius
        map.fitBounds(circle.getBounds());
    }

    console.log(`Added ${users.length} nearby user markers`);
}

// Clear nearby user markers
function clearNearbyUserMarkers() {
    nearbyUserMarkers.forEach(marker => map.removeLayer(marker));
    nearbyUserMarkers = [];
}
