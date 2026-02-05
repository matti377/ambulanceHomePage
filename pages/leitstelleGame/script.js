const STORAGE_KEY = 'leitstelle-dispatch-game-v3';
const DATA_PATH = './data';

const fallbackData = {
    incidents: [
        { title: 'Wohnungsbrand', priority: 'high', needs: ['LF', 'DLK', 'HLF'] },
        { title: 'Verkehrsunfall mit Verletzten', priority: 'high', needs: ['Ambulance', 'SAMU'] },
        { title: 'Bewusstlose Person', priority: 'medium', needs: ['Ambulance', 'SAMU'] },
        { title: 'Brandmeldealarm', priority: 'medium', needs: ['HLF', 'LF'] },
        { title: 'Keller unter Wasser', priority: 'low', needs: ['LF'] },
        { title: 'Ölunfall auf Straße', priority: 'low', needs: ['LF'] },
    ],
    aao: [
        { code: 'F1', name: 'Brand klein', units: ['LF'] },
        { code: 'F2', name: 'Brand Wohnung', units: ['LF', 'DLK', 'HLF'] },
        { code: 'VU1', name: 'Verkehrsunfall', units: ['Ambulance', 'SAMU'] },
        { code: 'VU2', name: 'VU eingeklemmt', units: ['Ambulance', 'SAMU', 'HLF'] },
        { code: 'RD1', name: 'Rettungsdienst', units: ['Ambulance'] },
        { code: 'RD2', name: 'RD + Notarzt', units: ['Ambulance', 'SAMU'] },
    ],
    vehicles: [
        {
            id: 'ambu-1',
            name: 'Ambulance Alpha',
            type: 'Ambulance',
            station: 'CSP Luxembourg',
            status: 'ready',
            statusLevel: 0,
            position: { lat: 49.6116, lng: 6.1319 },
        },
        {
            id: 'ambu-2',
            name: 'Ambulance Bravo',
            type: 'Ambulance',
            station: 'CIS Esch',
            status: 'ready',
            statusLevel: 1,
            position: { lat: 49.495, lng: 5.9806 },
        },
        {
            id: 'hlf-1',
            name: 'SAMU HLF 1',
            type: 'HLF',
            station: 'CSP Luxembourg',
            status: 'ready',
            statusLevel: 0,
            position: { lat: 49.6129, lng: 6.1296 },
        },
        {
            id: 'lf-1',
            name: 'LF 2/1',
            type: 'LF',
            station: 'CIS Diekirch',
            status: 'ready',
            statusLevel: 2,
            position: { lat: 49.8566, lng: 6.0983 },
        },
        {
            id: 'dlk-1',
            name: 'DLK 1/1',
            type: 'DLK',
            station: 'CSP Luxembourg',
            status: 'ready',
            statusLevel: 0,
            position: { lat: 49.6102, lng: 6.1333 },
        },
        {
            id: 'samu-1',
            name: 'SAMU Médecin',
            type: 'SAMU',
            station: 'CHL',
            status: 'ready',
            statusLevel: 1,
            position: { lat: 49.6108, lng: 6.1232 },
        },
        {
            id: 'vsav-1',
            name: 'VIA 3',
            type: 'VIA',
            station: 'CIS Grevenmacher',
            status: 'ready',
            statusLevel: 2,
            position: { lat: 49.6779, lng: 6.4416 },
        },
    ],
};

let incidentTemplates = [];
let aaoCatalog = [];
let defaultVehicles = [];
let state = null;

const locations = [
    'Luxembourg Ville',
    'Esch-sur-Alzette',
    'Differdange',
    'Ettelbruck',
    'Diekirch',
    'Grevenmacher',
    'Wiltz',
    'Remich',
];

const defaultState = () => ({
    score: 0,
    resolved: 0,
    vehicles: defaultVehicles.map((vehicle) => ({ ...vehicle })),
    incidents: [],
    dispatches: [],
    calls: [],
    log: ['Schicht gestartet. Leitstelle bereit für neue Meldungen.'],
});

const incidentList = document.getElementById('incidentList');
const fleetList = document.getElementById('fleetList');
const mapCanvas = document.getElementById('map_canvas');
const callList = document.getElementById('callList');
const logList = document.getElementById('logList');
const clock = document.getElementById('clock');

const activeIncidents = document.getElementById('activeIncidents');
const availableVehicles = document.getElementById('availableVehicles');
const resolvedIncidents = document.getElementById('resolvedIncidents');
const dispatchScore = document.getElementById('dispatchScore');

const newIncidentBtn = document.getElementById('newIncident');
const resetGameBtn = document.getElementById('resetGame');

const vehicleSort = document.getElementById('vehicleSort');
const incidentModal = document.getElementById('incidentModal');
const incidentForm = document.getElementById('incidentForm');
const incidentAAO = document.getElementById('incidentAAO');
const incidentLocation = document.getElementById('incidentLocation');
const incidentCaller = document.getElementById('incidentCaller');
const incidentNotes = document.getElementById('incidentNotes');
const incidentSignal = document.getElementById('incidentSignal');
const closeModal = document.getElementById('closeModal');
const cancelModal = document.getElementById('cancelModal');

const tabs = document.querySelectorAll('.tab');

let map = null;
let vehicleMarkers = {};

function updateClock() {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return defaultState();
    }
    try {
        const parsed = JSON.parse(raw);
        const defaults = defaultState();
        const vehicles = defaults.vehicles.map((vehicle) => {
            const stored = parsed.vehicles?.find((item) => item.id === vehicle.id);
            return stored ? { ...vehicle, ...stored } : vehicle;
        });
        return { ...defaults, ...parsed, vehicles };
    } catch (error) {
        return defaultState();
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function fetchData() {
    try {
        const [incidentResponse, vehiclesResponse, aaoResponse] = await Promise.all([
            fetch(`${DATA_PATH}/incidents.json`),
            fetch(`${DATA_PATH}/vehicles.json`),
            fetch(`${DATA_PATH}/aao.json`),
        ]);

        if (!incidentResponse.ok || !vehiclesResponse.ok || !aaoResponse.ok) {
            throw new Error('Data fetch failed');
        }

        const [incidentData, vehicleData, aaoData] = await Promise.all([
            incidentResponse.json(),
            vehiclesResponse.json(),
            aaoResponse.json(),
        ]);

        incidentTemplates = incidentData;
        defaultVehicles = vehicleData;
        aaoCatalog = aaoData;
    } catch (error) {
        incidentTemplates = fallbackData.incidents;
        defaultVehicles = fallbackData.vehicles;
        aaoCatalog = fallbackData.aao;
    }
}

function addIncident(overrides = {}) {
    const template = incidentTemplates[Math.floor(Math.random() * incidentTemplates.length)];
    const location = overrides.location || locations[Math.floor(Math.random() * locations.length)];
    const chosenAAO = overrides.aao || aaoCatalog[Math.floor(Math.random() * aaoCatalog.length)];
    const id = `incident-${Date.now()}`;

    const incident = {
        id,
        title: overrides.title || template.title,
        location,
        priority: overrides.priority || template.priority,
        needs: chosenAAO.units,
        aao: chosenAAO.code,
        status: 'open',
        reportedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        caller: overrides.caller || 'Erw. Fremdanrufer',
        notes: overrides.notes || '',
        signal: overrides.signal || false,
    };

    state.incidents.unshift(incident);
    state.log.unshift(`Neue Meldung: ${incident.title} in ${incident.location}.`);
    saveState();
}

function addCallFromIncident(incident) {
    state.calls.unshift({
        id: `call-${Date.now()}`,
        summary: incident.title,
        location: incident.location,
        time: incident.reportedAt,
        caller: incident.caller,
        notes: incident.notes,
    });
}

function dispatchVehicle(incidentId, vehicleId) {
    const vehicle = state.vehicles.find((item) => item.id === vehicleId);
    const incident = state.incidents.find((item) => item.id === incidentId);

    if (!vehicle || !incident || vehicle.status !== 'ready') {
        return;
    }

    vehicle.status = 'alarm';
    vehicle.statusLevel = 8;
    incident.status = 'assigned';

    state.dispatches.push({
        id: `dispatch-${Date.now()}`,
        vehicleId,
        incidentId,
    });

    state.score += incident.priority === 'high' ? 15 : incident.priority === 'medium' ? 10 : 6;
    state.log.unshift(`${vehicle.name} wurde zu ${incident.title} (${incident.location}) disponiert.`);

    saveState();
}

function resolveIncident(incidentId) {
    const incident = state.incidents.find((item) => item.id === incidentId);
    if (!incident) {
        return;
    }
    const dispatches = state.dispatches.filter((item) => item.incidentId === incidentId);
    dispatches.forEach((dispatch) => {
        const vehicle = state.vehicles.find((item) => item.id === dispatch.vehicleId);
        if (vehicle) {
            vehicle.status = 'ready';
            vehicle.statusLevel = Math.floor(Math.random() * 3);
        }
    });
    state.dispatches = state.dispatches.filter((item) => item.incidentId !== incidentId);
    incident.status = 'resolved';
    state.resolved += 1;
    state.log.unshift(`${incident.title} abgeschlossen.`);
    saveState();
}

function renderIncidents() {
    incidentList.innerHTML = '';

    if (state.incidents.length === 0) {
        incidentList.innerHTML = '<div class="card">Keine Einsätze aktiv.</div>';
        return;
    }

    state.incidents.forEach((incident) => {
        const card = document.createElement('div');
        card.className = 'card';
        const badgeLabel = incident.priority === 'high' ? 'Hoch' : incident.priority === 'medium' ? 'Mittel' : 'Niedrig';

        card.innerHTML = `
            <div class="card-title">
                <span>${incident.title}</span>
                <span class="badge ${incident.priority}">${badgeLabel}</span>
            </div>
            <div class="card-meta">
                Ort: ${incident.location}<br>
                Stichwort: ${incident.aao}<br>
                Bedarf: ${incident.needs.join(', ')}
            </div>
        `;

        const actions = document.createElement('div');
        actions.className = 'card-meta';

        const select = document.createElement('select');
        select.className = 'select';
        select.innerHTML = '<option value="">Fahrzeug wählen</option>';
        state.vehicles
            .filter((vehicle) => vehicle.status === 'ready')
            .forEach((vehicle) => {
                const option = document.createElement('option');
                option.value = vehicle.id;
                option.textContent = `${vehicle.name} (${vehicle.type})`;
                select.appendChild(option);
            });

        const dispatchBtn = document.createElement('button');
        dispatchBtn.className = 'btn ghost';
        dispatchBtn.textContent = 'Alarmieren';
        dispatchBtn.addEventListener('click', () => {
            if (!select.value) {
                return;
            }
            dispatchVehicle(incident.id, select.value);
            render();
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn ghost';
        closeBtn.textContent = 'Abschließen';
        closeBtn.addEventListener('click', () => {
            resolveIncident(incident.id);
            render();
        });

        actions.appendChild(select);
        actions.appendChild(dispatchBtn);
        actions.appendChild(closeBtn);

        card.appendChild(actions);
        incidentList.appendChild(card);
    });
}

function renderFleet() {
    const sorted = [...state.vehicles];
    if (vehicleSort.value === 'status') {
        sorted.sort((a, b) => a.statusLevel - b.statusLevel);
    }
    if (vehicleSort.value === 'station') {
        sorted.sort((a, b) => a.station.localeCompare(b.station));
    }
    if (vehicleSort.value === 'name') {
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    fleetList.innerHTML = '';
    sorted.forEach((vehicle) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-title">
                <span>${vehicle.name}</span>
                <span class="badge ${vehicle.status}">${vehicle.status}</span>
            </div>
            <div class="card-meta">
                Typ: ${vehicle.type}<br>
                Standort: ${vehicle.station}<br>
                Status: ${vehicle.statusLevel}/8
            </div>
        `;
        fleetList.appendChild(card);
    });
}

function renderMap() {
    if (!map) {
        return;
    }
    state.vehicles.forEach((vehicle) => {
        const markerContent = `<div class="vehicle-marker ${vehicle.status}">${vehicle.type}<br><strong>${vehicle.statusLevel}/8</strong></div>`;
        if (vehicleMarkers[vehicle.id]) {
            vehicleMarkers[vehicle.id]
                .setLatLng([vehicle.position.lat, vehicle.position.lng])
                .setIcon(L.divIcon({ className: '', html: markerContent }));
            return;
        }

        const marker = L.marker([vehicle.position.lat, vehicle.position.lng], {
            icon: L.divIcon({ className: '', html: markerContent }),
        }).addTo(map);
        vehicleMarkers[vehicle.id] = marker;
    });
}

function renderCalls() {
    callList.innerHTML = '';
    if (state.calls.length === 0) {
        callList.innerHTML = '<div class="card">Keine Anrufe in der Warteschlange.</div>';
        return;
    }
    state.calls.forEach((call) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-title">
                <span>${call.summary}</span>
                <span class="badge low">${call.time}</span>
            </div>
            <div class="card-meta">
                Ort: ${call.location}<br>
                Anrufer: ${call.caller}<br>
                ${call.notes ? `Info: ${call.notes}` : ''}
            </div>
        `;
        callList.appendChild(card);
    });
}

function renderLog() {
    logList.innerHTML = '';
    state.log.slice(0, 20).forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'card';
        item.textContent = entry;
        logList.appendChild(item);
    });
}

function renderStats() {
    const open = state.incidents.filter((incident) => incident.status !== 'resolved');
    activeIncidents.textContent = open.length;
    availableVehicles.textContent = state.vehicles.filter((v) => v.status === 'ready').length;
    resolvedIncidents.textContent = state.resolved;
    dispatchScore.textContent = state.score;
}

function render() {
    renderStats();
    renderIncidents();
    renderFleet();
    renderMap();
    renderCalls();
    renderLog();
    saveState();
}

function showModal() {
    incidentModal.classList.add('show');
    incidentModal.setAttribute('aria-hidden', 'false');
}

function hideModal() {
    incidentModal.classList.remove('show');
    incidentModal.setAttribute('aria-hidden', 'true');
}

function fillAAOSelect() {
    incidentAAO.innerHTML = '';
    aaoCatalog.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.code;
        option.textContent = `${entry.code} – ${entry.name}`;
        incidentAAO.appendChild(option);
    });
}

function setupTabs() {
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach((btn) => btn.classList.remove('active'));
            tab.classList.add('active');
            if (tab.dataset.tab === 'calls') {
                callList.classList.remove('hidden');
                logList.classList.add('hidden');
            } else {
                callList.classList.add('hidden');
                logList.classList.remove('hidden');
            }
        });
    });
}

function initMap() {
    if (!mapCanvas || map) {
        return;
    }
    map = L.map(mapCanvas, { zoomControl: false }).setView([49.6116, 6.1319], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
}

async function init() {
    await fetchData();
    state = loadState();
    fillAAOSelect();
    initMap();
    render();
    updateClock();
    setInterval(updateClock, 1000 * 30);
    setupTabs();
}

newIncidentBtn.addEventListener('click', () => {
    showModal();
});

resetGameBtn.addEventListener('click', () => {
    if (window.confirm('Schicht zurücksetzen?')) {
        state = defaultState();
        render();
    }
});

closeModal.addEventListener('click', hideModal);
cancelModal.addEventListener('click', hideModal);

incidentForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const selectedAAO = aaoCatalog.find((entry) => entry.code === incidentAAO.value);
    const incident = {
        location: incidentLocation.value.trim() || 'Unbekannt',
        aao: selectedAAO,
        caller: incidentCaller.value,
        notes: incidentNotes.value.trim(),
        signal: incidentSignal.checked,
    };
    addIncident(incident);
    addCallFromIncident(state.incidents[0]);
    incidentForm.reset();
    hideModal();
    render();
});

vehicleSort.addEventListener('change', render);

init();
