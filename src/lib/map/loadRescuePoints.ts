import { getField, parseCoordinate, parseCSV } from "./parseCSV";
import type { LayerLoadResult } from "./loadCIS";

const RESCUE_POINT_PATHS = [
  "/pages/map/rettungspunkte.csv",
  "/pages/map/data/rettungspunkte.csv",
];

async function fetchFirstAvailable(paths: string[]): Promise<string> {
  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        return response.text();
      }
      console.warn(`Unable to load ${path}: ${response.status}`);
    } catch (error) {
      console.warn(`Unable to load ${path}`, error);
    }
  }

  throw new Error("No rescue point CSV source could be loaded.");
}

export async function loadRescuePoints(markerIcon: L.DivIcon): Promise<LayerLoadResult> {
  const content = await fetchFirstAvailable(RESCUE_POINT_PATHS);
  const rows = parseCSV(content, ";");
  const layer = L.layerGroup();
  const points: L.LatLngExpression[] = [];
  const markersById = new Map<string, L.Marker>();

  rows.forEach((row, index) => {
    const latitude = parseCoordinate(getField(row, ["GEOGRAPHISCHE BREITE", "Latitude"]));
    const longitude = parseCoordinate(getField(row, ["GEOGRAPHISCHE LAENGE", "GEOGRAPHISCHE LÄNGE", "Longitude"]));

    if (latitude === null || longitude === null) {
      console.warn(`Skipping rescue point row ${index + 2}: invalid coordinates`, row);
      return;
    }

    const name = getField(row, ["NAME", "Nom"]) || "Unnamed rescue point";
    const city = getField(row, ["ORT", "Ville", "City"]) || "Unknown city";

    points.push([latitude, longitude]);
    const marker = L.marker([latitude, longitude], { icon: markerIcon })
      .bindPopup(`<strong>${name}</strong><br>${city}`)
      .addTo(layer);

    markersById.set(name.toUpperCase(), marker);
  });

  return { layer, points, markersById };
}
