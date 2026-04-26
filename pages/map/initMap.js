import { loadCIS } from "./loadCIS.js";
import { loadRescuePoints } from "./loadRescuePoints.js";

const LUXEMBOURG_CENTER = [49.8153, 6.1296];
const DEFAULT_ZOOM = 9;
const RESCUE_POINT_PATTERN = /^[A-Z]{2}-\d{3}$/;

function createMarkerIcon(color) {
  return L.divIcon({
    className: "custom-map-marker",
    html: `<span class="marker-pin" style="--marker-color: ${color};"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
}

function createUserLocationIcon() {
  return L.divIcon({
    className: "user-location-marker",
    html: '<span class="user-location-dot"></span><span class="user-location-pulse"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function formatRescuePointId(value) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const letters = normalized.slice(0, 2).replace(/[^A-Z]/g, "");
  const digits = normalized.slice(2).replace(/\D/g, "").slice(0, 3);

  if (!letters) {
    return "";
  }

  if (letters.length < 2) {
    return letters;
  }

  return `${letters}-${digits}`;
}

function setupRescuePointSearch(map, rescueMarkers) {
  const input = document.getElementById("rescue-point-id");
  const button = document.getElementById("rescue-point-button");
  const feedback = document.getElementById("rescue-point-feedback");

  if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement) || !(feedback instanceof HTMLElement)) {
    return;
  }

  const runSearch = () => {
    const value = formatRescuePointId(input.value);
    input.value = value;

    if (!RESCUE_POINT_PATTERN.test(value)) {
      feedback.textContent = "Use the format AA-000.";
      return;
    }

    const marker = rescueMarkers.get(value);
    if (!marker) {
      feedback.textContent = `No rescue point found for ${value}.`;
      return;
    }

    feedback.textContent = "";
    map.setView(marker.getLatLng(), 16, { animate: true });
    marker.openPopup();
  };

  input.addEventListener("input", () => {
    input.value = formatRescuePointId(input.value);
    feedback.textContent = "";
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    runSearch();
  });

  button.addEventListener("click", runSearch);
}

function setupUserLocation(map, userLayer) {
  const button = document.getElementById("user-location-button");
  const feedback = document.getElementById("map-status");

  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const userIcon = createUserLocationIcon();

  const updateStatus = (message) => {
    if (feedback instanceof HTMLElement) {
      feedback.textContent = message;
    }
  };

  button.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      updateStatus("Geolocation is not supported on this device.");
      return;
    }

    updateStatus("Locating...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latLng = [position.coords.latitude, position.coords.longitude];

        userLayer.clearLayers();
        L.circle(latLng, {
          radius: position.coords.accuracy,
          color: "#2f80ed",
          weight: 1,
          fillColor: "#2f80ed",
          fillOpacity: 0.12,
        }).addTo(userLayer);

        L.marker(latLng, { icon: userIcon })
          .bindPopup("Your current position")
          .addTo(userLayer)
          .openPopup();

        if (!map.hasLayer(userLayer)) {
          userLayer.addTo(map);
        }

        map.setView(latLng, 15, { animate: true });
        updateStatus("Location found");
        window.setTimeout(() => updateStatus("Map ready"), 1600);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Location access was denied."
          : "Unable to get your position.";
        updateStatus(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  });
}

export async function initMap(elementId = "luxembourg-map") {
  const map = L.map(elementId).setView(LUXEMBOURG_CENTER, DEFAULT_ZOOM);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const cisIcon = createMarkerIcon("#d32f2f");
  const rescueIcon = createMarkerIcon("#1976d2");
  const userLayer = L.layerGroup();

  const [cisResult, rescueResult] = await Promise.all([
    loadCIS(cisIcon),
    loadRescuePoints(rescueIcon),
  ]);

  cisResult.layer.addTo(map);
  rescueResult.layer.addTo(map);

  L.control.layers(undefined, {
    "CIS Stations": cisResult.layer,
    "Rescue Points": rescueResult.layer,
    "My Position": userLayer,
  }).addTo(map);

  const allPoints = [...cisResult.points, ...rescueResult.points];
  if (allPoints.length > 0) {
    map.fitBounds(allPoints, { padding: [24, 24] });
  }

  setupRescuePointSearch(map, rescueResult.markersById ?? new Map());
  setupUserLocation(map, userLayer);

  return map;
}
