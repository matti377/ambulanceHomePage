const STORAGE_KEY = 'leitstelle-dispatch-game-v1';

const defaultState = () => ({
    score: 0,
    resolved: 0,
    vehicles: [
        {
            id: 'ambu-1',
            name: 'Ambulance Alpha',
            type: 'Ambulance',
            station: 'CSP Luxembourg',
            status: 'ready',
            statusLevel: 0,
            position: { x: 62, y: 52 },
        },
        {
            id: 'ambu-2',
            name: 'Ambulance Bravo',
            type: 'Ambulance',
            station: 'CIS Esch',
            status: 'ready',
            statusLevel: 1,
            position: { x: 46, y: 70 },
        },
        {
            id: 'hlf-1',
            name: 'SAMU HLF 1',
            type: 'HLF',
            station: 'CSP Luxembourg',
            status: 'ready',
            statusLevel: 0,
            position: { x: 60, y: 50 },
        },
        {
            id: 'lf-1',
            name: 'LF 2/1',
            type: 'LF',
            station: 'CIS Diekirch',
            status: 'ready',
            statusLevel: 2,
            position: { x: 70, y: 30 },
        },
        {
            id: 'dlk-1',
            name: 'DLK 1/1',
            type: 'DLK',
            station: 'CSP Luxembourg',
            status: 'ready',
            statusLevel: 0,
            position: { x: 63, y: 49 },
        },
        {
            id: 'samu-1',
            name: 'SAMU Médecin',
            type: 'SAMU',
            station: 'CHL',
            status: 'ready',
            statusLevel: 1,
            position: { x: 61, y: 53 },
        },
        {
            id: 'vsav-1',
            name: 'VIA 3',
            type: 'VIA',
            station: 'CIS Grevenmacher',
            status: 'ready',
            statusLevel: 2,
            position: { x: 82, y: 52 },
        },
    ],
    incidents: [],
    dispatches: [],
    log: [
        'Schicht gestartet. Leitstelle bereit für neue Meldungen.',
    ],
});

const incidentTemplates = [
    {
        title: 'Wohnungsbrand',
        priority: 'high',
        needs: ['LF', 'DLK', 'HLF'],
    },
    {
        title: 'Verkehrsunfall mit Verletzten',
        priority: 'high',
        needs: ['Ambulance', 'SAMU'],
    },
    {
        title: 'Bewusstlose Person',
        priority: 'medium',
        needs: ['Ambulance', 'SAMU'],
    },
    {
        title: 'Brandmeldealarm',
        priority: 'medium',
        needs: ['HLF', 'LF'],
    },
    {
        title: 'Keller unter Wasser',
        priority: 'low',
        needs: ['LF'],
    },
    {
        title: 'Ölunfall auf Straße',
        priority: 'low',
        needs: ['LF'],
    },
];

const aaoCatalog = [
    {
        code: 'F1',
        name: 'Brand klein',
        units: ['LF'],
    },
    {
        code: 'F2',
        name: 'Brand Wohnung',
        units: ['LF', 'DLK', 'HLF'],
    },
    {
        code: 'VU1',
        name: 'Verkehrsunfall',
        units: ['Ambulance', 'SAMU'],
    },
    {
        code: 'VU2',
        name: 'VU eingeklemmt',
        units: ['Ambulance', 'SAMU', 'HLF'],
    },
    {
        code: 'RD1',
        name: 'Rettungsdienst',
        units: ['Ambulance'],
    },
    {
        code: 'RD2',
        name: 'RD + Notarzt',
        units: ['Ambulance', 'SAMU'],
    },
];

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

const state = loadState();

const incidentList = document.getElementById('incidentList');
const fleetList = document.getElementById('fleetList');
const dispatchList = document.getElementById('dispatchList');
const logList = document.getElementById('logList');
const mapList = document.getElementById('mapList');

const activeIncidents = document.getElementById('activeIncidents');
const availableVehicles = document.getElementById('availableVehicles');
const resolvedIncidents = document.getElementById('resolvedIncidents');
const dispatchScore = document.getElementById('dispatchScore');

const newIncidentBtn = document.getElementById('newIncident');
const resetGameBtn = document.getElementById('resetGame');

newIncidentBtn.addEventListener('click', () => {
    addIncident();
    render();
});

resetGameBtn.addEventListener('click', () => {
    if (window.confirm('Möchtest du die Schicht wirklich zurücksetzen?')) {
        const freshState = defaultState();
        Object.keys(state).forEach((key) => {
            state[key] = freshState[key];
        });
        saveState();
        render();
    }
});

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
        return {
            ...defaults,
            ...parsed,
            vehicles,
        };
    } catch (error) {
        return defaultState();
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function addIncident() {
    const template = incidentTemplates[Math.floor(Math.random() * incidentTemplates.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    const defaultAAO = aaoCatalog[Math.floor(Math.random() * aaoCatalog.length)];
    const id = `incident-${Date.now()}`;
    state.incidents.push({
        id,
        title: template.title,
        location,
        priority: template.priority,
        needs: defaultAAO.units,
        aao: defaultAAO.code,
        status: 'open',
        reportedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    });
    state.log.unshift(`Neue Meldung: ${template.title} in ${location}.`);
    saveState();
}

function dispatchVehicle(incidentId, vehicleId) {
    const vehicle = state.vehicles.find((item) => item.id === vehicleId);
    const incident = state.incidents.find((item) => item.id === incidentId);

    if (!vehicle || !incident || vehicle.status !== 'ready') {
        return;
    }

    vehicle.status = 'busy';
    vehicle.statusLevel = 8;
    incident.status = 'assigned';

    state.dispatches.push({
        id: `dispatch-${Date.now()}`,
        vehicleId,
        incidentId,
        eta: `${Math.floor(Math.random() * 8) + 6} Min`,
        startedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    });

    state.score += incident.priority === 'high' ? 15 : incident.priority === 'medium' ? 10 : 6;
    state.log.unshift(`${vehicle.name} wurde zu ${incident.title} (${incident.location}) disponiert.`);

    saveState();
}

function resolveDispatch(dispatchId) {
    const dispatch = state.dispatches.find((item) => item.id === dispatchId);
    if (!dispatch) {
        return;
    }

    const vehicle = state.vehicles.find((item) => item.id === dispatch.vehicleId);
    const incident = state.incidents.find((item) => item.id === dispatch.incidentId);

    if (vehicle) {
        vehicle.status = 'ready';
        vehicle.statusLevel = Math.floor(Math.random() * 3);
    }
    if (incident) {
        incident.status = 'resolved';
    }

    state.dispatches = state.dispatches.filter((item) => item.id !== dispatchId);
    state.resolved += 1;

    state.log.unshift(`${incident?.title ?? 'Einsatz'} abgeschlossen. ${vehicle?.name ?? 'Fahrzeug'} ist zurück.`);

    saveState();
}

function renderIncidents() {
    incidentList.innerHTML = '';
    const openIncidents = state.incidents.filter((incident) => incident.status !== 'resolved');

    if (openIncidents.length === 0) {
        incidentList.innerHTML = '<div class="empty-state">Keine offenen Meldungen. Erzeuge eine neue Meldung.</div>';
        return;
    }

    openIncidents.forEach((incident) => {
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
                Gemeldet: ${incident.reportedAt}<br>
                Stichwort: ${incident.aao ?? 'Auswählen'}<br>
                Bedarf: ${incident.needs.join(', ')}
            </div>
        `;

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const vehicleSelect = document.createElement('select');
        vehicleSelect.className = 'select';
        vehicleSelect.innerHTML = '<option value="">Fahrzeug wählen</option>';

        const available = state.vehicles.filter((vehicle) => vehicle.status === 'ready');
        available.forEach((vehicle) => {
            const option = document.createElement('option');
            option.value = vehicle.id;
            option.textContent = `${vehicle.name} (${vehicle.type})`;
            vehicleSelect.appendChild(option);
        });
        vehicleSelect.disabled = incident.status === 'assigned';

        const aaoSelect = document.createElement('select');
        aaoSelect.className = 'select';
        aaoSelect.innerHTML = '<option value="">AAO-Stichwort wählen</option>';
        aaoCatalog.forEach((entry) => {
            const option = document.createElement('option');
            option.value = entry.code;
            option.textContent = `${entry.code} · ${entry.name}`;
            if (incident.aao === entry.code) {
                option.selected = true;
            }
            aaoSelect.appendChild(option);
        });
        aaoSelect.disabled = incident.status === 'assigned';

        aaoSelect.addEventListener('change', () => {
            const selected = aaoCatalog.find((entry) => entry.code === aaoSelect.value);
            if (!selected) {
                return;
            }
            incident.aao = selected.code;
            incident.needs = selected.units;
            state.log.unshift(`AAO ${selected.code} (${selected.name}) für ${incident.title} gesetzt.`);
            saveState();
            render();
        });

        const button = document.createElement('button');
        button.className = 'small-btn';
        button.textContent = 'Disponieren';
        button.disabled = available.length === 0 || incident.status === 'assigned';

        button.addEventListener('click', () => {
            if (!vehicleSelect.value) {
                return;
            }
            dispatchVehicle(incident.id, vehicleSelect.value);
            render();
        });

        actions.appendChild(aaoSelect);
        actions.appendChild(vehicleSelect);
        actions.appendChild(button);

        card.appendChild(actions);

        incidentList.appendChild(card);
    });
}

function renderFleet() {
    fleetList.innerHTML = '';

    state.vehicles.forEach((vehicle) => {
        const card = document.createElement('div');
        card.className = 'card';

        card.innerHTML = `
            <div class="card-title">
                <span>${vehicle.name}</span>
                <span class="badge ${vehicle.status}">${vehicle.status === 'ready' ? 'Bereit' : 'Unterwegs'}</span>
            </div>
            <div class="card-meta">
                Typ: ${vehicle.type}<br>
                Station: ${vehicle.station}<br>
                Status: ${vehicle.statusLevel}/8
            </div>
        `;

        fleetList.appendChild(card);
    });
}

function renderMap() {
    mapList.innerHTML = '';

    state.vehicles.forEach((vehicle) => {
        const marker = document.createElement('div');
        marker.className = `map-marker ${vehicle.status}`;
        marker.style.left = `${vehicle.position.x}%`;
        marker.style.top = `${vehicle.position.y}%`;
        marker.innerHTML = `
            <span>${vehicle.type}</span>
            <strong>${vehicle.statusLevel}/8</strong>
        `;
        mapList.appendChild(marker);
    });
}

function renderDispatches() {
    dispatchList.innerHTML = '';

    if (state.dispatches.length === 0) {
        dispatchList.innerHTML = '<div class="empty-state">Keine aktiven Dispositionen.</div>';
        return;
    }

    state.dispatches.forEach((dispatch) => {
        const vehicle = state.vehicles.find((item) => item.id === dispatch.vehicleId);
        const incident = state.incidents.find((item) => item.id === dispatch.incidentId);

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-title">
                <span>${vehicle?.name ?? 'Fahrzeug'}</span>
                <span class="badge station">ETA ${dispatch.eta}</span>
            </div>
            <div class="card-meta">
                Einsatz: ${incident?.title ?? 'Unbekannt'}<br>
                Ort: ${incident?.location ?? 'Unbekannt'}<br>
                Start: ${dispatch.startedAt}
            </div>
        `;

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const button = document.createElement('button');
        button.className = 'small-btn secondary';
        button.textContent = 'Einsatz abschließen';
        button.addEventListener('click', () => {
            resolveDispatch(dispatch.id);
            render();
        });

        actions.appendChild(button);
        card.appendChild(actions);
        dispatchList.appendChild(card);
    });
}

function renderLog() {
    logList.innerHTML = '';

    state.log.slice(0, 10).forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'log-entry';
        item.innerHTML = `<strong>${entry}</strong>`;
        logList.appendChild(item);
    });
}

function renderStats() {
    const openIncidents = state.incidents.filter((incident) => incident.status !== 'resolved');
    const available = state.vehicles.filter((vehicle) => vehicle.status === 'ready');

    activeIncidents.textContent = openIncidents.length;
    availableVehicles.textContent = available.length;
    resolvedIncidents.textContent = state.resolved;
    dispatchScore.textContent = state.score;
}

function render() {
    renderStats();
    renderIncidents();
    renderFleet();
    renderDispatches();
    renderLog();
    renderMap();
    saveState();
}

render();
