import { getField, parseCoordinate, parseCSV } from "./parseCSV.js";

function createPopupContent(name, address, city) {
  return `
    <strong>${name}</strong><br>
    ${address}<br>
    ${city}
  `;
}

async function fetchCSV(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }

  return response.text();
}

function buildAddress(row) {
  const street = getField(row, ["Strasse", "Straße", "Rue"]);
  const houseNumber = getField(row, ["Hausnummer", "Numero", "Numéro"]);
  return [street, houseNumber].filter(Boolean).join(" ").trim();
}

export async function loadCIS(markerIcon) {
  const content = await fetchCSV("/pages/map/data/cis.csv");
  const rows = parseCSV(content, ";");
  const layer = L.layerGroup();
  const points = [];

  rows.forEach((row, index) => {
    const latitude = parseCoordinate(getField(row, ["WGS84_Lat", "Latitude"]));
    const longitude = parseCoordinate(getField(row, ["WGS84_Lon", "Longitude"]));

    if (latitude === null || longitude === null) {
      console.warn(`Skipping CIS row ${index + 2}: invalid coordinates`, row);
      return;
    }

    const name = getField(row, ["Wache", "Name"]) || "Unnamed CIS Station";
    const city = getField(row, ["Ort", "Ville", "City"]) || "Unknown city";
    const address = buildAddress(row) || "Address unavailable";

    points.push([latitude, longitude]);
    L.marker([latitude, longitude], { icon: markerIcon })
      .bindPopup(createPopupContent(name, address, city))
      .addTo(layer);
  });

  return { layer, points };
}
