export type CSVRow = Record<string, string>;

const HEADER_ALIASES: Record<string, string> = {
  strasse: "street",
  straße: "street",
  rue: "street",
  hausnummer: "houseNumber",
  numero: "houseNumber",
  numeroadresse: "houseNumber",
  ort: "city",
  localite: "city",
  localité: "city",
  wache: "name",
  nom: "name",
  name: "name",
  wgs84lat: "latitude",
  breitengrad: "latitude",
  geographischebreite: "latitude",
  latitude: "latitude",
  wgs84lon: "longitude",
  laengengrad: "longitude",
  längengrad: "longitude",
  geographischelaenge: "longitude",
  geographischelänge: "longitude",
  longitude: "longitude",
};

function normalizeHeader(value: string): string {
  const trimmed = value.trim().replace(/^\uFEFF/, "");
  const collapsed = trimmed.replace(/\s+/g, "");
  const normalized = collapsed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/[_-]+/g, "").toLowerCase();
}

function splitCSVLine(line: string, separator: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === separator && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCSV(content: string, separator = ";"): CSVRow[] {
  const normalizedContent = content.replace(/^\uFEFF/, "");
  const lines = normalizedContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const rawHeaders = splitCSVLine(lines[0], separator);
  const headers = rawHeaders.map((header) => {
    const normalized = normalizeHeader(header);
    return HEADER_ALIASES[normalized] ?? normalized;
  });

  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line, separator);
    return headers.reduce<CSVRow>((row, header, index) => {
      row[header] = (values[index] ?? "").trim();
      return row;
    }, {});
  });
}

export function getField(row: CSVRow, candidates: string[]): string {
  for (const candidate of candidates) {
    const key = HEADER_ALIASES[normalizeHeader(candidate)] ?? normalizeHeader(candidate);
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export function parseCoordinate(value: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
