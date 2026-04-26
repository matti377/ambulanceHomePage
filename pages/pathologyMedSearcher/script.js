(function () {
    const MAX_RESULTS = 50;
    const INPUT_DEBOUNCE_MS = 300;
    const FILES = {
        medications: './CIS_bdpm.csv',
        substances: './CIS_COMPO_bdpm.csv',
        pathologies: './cis-pathologie.csv'
    };
    const DOSAGE_PATTERN = /\b\d[\d\s]*(?:[.,]\d+)?\s*(?:mg|g|kg|microgrammes?|µg|mcg|ui|u\.i\.|ml|cl|l|%)(?:\s*\/\s*\d[\d\s]*(?:[.,]\d+)?\s*(?:mg|g|kg|microgrammes?|µg|mcg|ui|u\.i\.|ml|cl|l|%))*(?:\s*(?:par|pour)\s*(?:cent|ml|mL|dose|pulverisation|g|kg|comprime|gelule|ampoule|flacon))?/gi;

    const searchInput = document.getElementById('searchInput');
    const pathologySelect = document.getElementById('pathologySelect');
    const searchNote = document.getElementById('searchNote');
    const entryCount = document.getElementById('entryCount');
    const resultCount = document.getElementById('resultCount');
    const resultsSubtitle = document.getElementById('resultsSubtitle');
    const resultsContainer = document.getElementById('resultsContainer');

    const state = {
        ready: false,
        entries: [],
        query: '',
        pathologyOptions: []
    };

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function decodeText(arrayBuffer) {
        const utf8 = new TextDecoder('utf-8').decode(arrayBuffer);
        if (utf8.indexOf('\uFFFD') === -1) {
            return utf8;
        }
        return new TextDecoder('iso-8859-1').decode(arrayBuffer);
    }

    async function fetchText(path) {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error('Datei konnte nicht geladen werden: ' + path);
        }
        return decodeText(await response.arrayBuffer());
    }

    function getOrCreateEntry(entryMap, code) {
        if (!entryMap.has(code)) {
            entryMap.set(code, {
                code,
                medicationName: '',
                form: '',
                substances: new Set(),
                pathologies: new Set()
            });
        }
        return entryMap.get(code);
    }

    function splitLines(text) {
        return text.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean);
    }

    function sortTextList(values) {
        return Array.from(values).sort((a, b) => a.localeCompare(b, 'fr'));
    }

    function extractMedicationDetails(medicationName) {
        const heading = String(medicationName || '').split(',')[0].trim();
        const dosageMatches = heading.match(DOSAGE_PATTERN) || [];
        const baseName = heading
            .replace(DOSAGE_PATTERN, ' ')
            .replace(/\s{2,}/g, ' ')
            .replace(/\s+([/()-])/g, '$1')
            .replace(/([/()-])\s+/g, '$1 ')
            .trim()
            .replace(/[,-]+$/, '')
            .trim();

        return {
            baseName: baseName || heading || String(medicationName || '').trim(),
            dosages: dosageMatches.map((value) => value.replace(/\s{2,}/g, ' ').trim()).filter(Boolean)
        };
    }

    function buildDataset(rawFiles) {
        const entryMap = new Map();

        splitLines(rawFiles.medications).forEach((line) => {
            const columns = line.split('\t');
            if (columns.length < 3) {
                return;
            }

            const code = columns[0].trim();
            const medicationName = columns[1].trim();
            const form = columns[2].trim();
            if (!code || !medicationName) {
                return;
            }

            const entry = getOrCreateEntry(entryMap, code);
            entry.medicationName = medicationName;
            entry.form = form || entry.form;
        });

        splitLines(rawFiles.substances).forEach((line) => {
            const columns = line.split('\t');
            if (columns.length < 4) {
                return;
            }

            const code = columns[0].trim();
            const substance = columns[3].trim();
            if (!code || !substance) {
                return;
            }

            getOrCreateEntry(entryMap, code).substances.add(substance);
        });

        splitLines(rawFiles.pathologies).forEach((line, index) => {
            const columns = line.split('\t');
            if (columns.length < 2) {
                return;
            }

            const code = columns[0].trim();
            const pathology = columns[1].trim();
            const isHeaderRow = index === 0 && normalizeText(code) === 'code_cis';
            if (isHeaderRow || !code || !pathology) {
                return;
            }

            getOrCreateEntry(entryMap, code).pathologies.add(pathology);
        });

        const groupedEntries = new Map();

        Array.from(entryMap.values())
            .filter((entry) => entry.medicationName)
            .forEach((entry) => {
                const details = extractMedicationDetails(entry.medicationName);
                const groupKey = normalizeText(details.baseName || entry.medicationName);

                if (!groupedEntries.has(groupKey)) {
                    groupedEntries.set(groupKey, {
                        medicationName: details.baseName || entry.medicationName,
                        forms: new Set(),
                        dosages: new Set(),
                        substances: new Set(),
                        pathologies: new Set(),
                        codes: new Set(),
                        variantNames: new Set()
                    });
                }

                const groupedEntry = groupedEntries.get(groupKey);
                groupedEntry.codes.add(entry.code);
                groupedEntry.variantNames.add(entry.medicationName);

                if (entry.form) {
                    groupedEntry.forms.add(entry.form);
                }

                details.dosages.forEach((dosage) => groupedEntry.dosages.add(dosage));
                entry.substances.forEach((substance) => groupedEntry.substances.add(substance));
                entry.pathologies.forEach((pathology) => groupedEntry.pathologies.add(pathology));
            });

        return Array.from(groupedEntries.values())
            .map((entry) => {
                const forms = sortTextList(entry.forms);
                const dosages = sortTextList(entry.dosages);
                const substances = sortTextList(entry.substances);
                const pathologies = sortTextList(entry.pathologies);
                const variantNames = sortTextList(entry.variantNames);
                const fields = [
                    normalizeText(entry.medicationName),
                    ...forms.map(normalizeText),
                    ...dosages.map(normalizeText),
                    ...substances.map(normalizeText),
                    ...pathologies.map(normalizeText),
                    ...variantNames.map(normalizeText)
                ];

                return {
                    medicationName: entry.medicationName,
                    forms,
                    formText: forms.length ? forms.join(', ') : 'Aucune information',
                    dosages,
                    substances,
                    pathologies,
                    codes: Array.from(entry.codes),
                    variantNames,
                    normalizedName: normalizeText(entry.medicationName),
                    normalizedForms: forms.map(normalizeText),
                    normalizedDosages: dosages.map(normalizeText),
                    normalizedSubstances: substances.map(normalizeText),
                    normalizedPathologies: pathologies.map(normalizeText),
                    normalizedVariantNames: variantNames.map(normalizeText),
                    normalizedFields: fields
                };
            })
            .sort((a, b) => a.medicationName.localeCompare(b.medicationName, 'fr'));
    }

    function buildPathologyOptions(entries) {
        const options = new Set();
        entries.forEach((entry) => {
            entry.pathologies.forEach((pathology) => options.add(pathology));
        });
        return sortTextList(options);
    }

    function formatCount(count, singular, plural) {
        return count + ' ' + (count === 1 ? singular : plural);
    }

    function populatePathologySelect(options) {
        const optionMarkup = [
            '<option value="">Selectionner une pathologie...</option>',
            ...options.map((option) => '<option value="' + escapeHtml(option) + '">' + escapeHtml(option) + '</option>')
        ].join('');

        pathologySelect.innerHTML = optionMarkup;
    }

    function syncPathologySelectWithInput(query) {
        const normalizedQuery = normalizeText(query);
        if (!normalizedQuery) {
            pathologySelect.value = '';
            return;
        }

        const matchingOption = state.pathologyOptions.find((option) => normalizeText(option) === normalizedQuery);
        pathologySelect.value = matchingOption || '';
    }

    function getQueryTokens(query) {
        return Array.from(new Set(normalizeText(query).split(/\s+/).filter(Boolean)));
    }

    function getMatchScore(entry, normalizedQuery, tokens) {
        let score = 0;

        if (normalizedQuery && entry.normalizedName.includes(normalizedQuery)) {
            score += 140;
            if (entry.normalizedName.startsWith(normalizedQuery)) {
                score += 35;
            }
        }

        if (normalizedQuery && entry.normalizedVariantNames.some((value) => value.includes(normalizedQuery))) {
            score += 50;
        }

        if (normalizedQuery && entry.normalizedDosages.some((value) => value.includes(normalizedQuery))) {
            score += 40;
        }

        if (normalizedQuery && entry.normalizedSubstances.some((value) => value.includes(normalizedQuery))) {
            score += 95;
        }

        if (normalizedQuery && entry.normalizedPathologies.some((value) => value.includes(normalizedQuery))) {
            score += 75;
        }

        tokens.forEach((token) => {
            if (entry.normalizedName.includes(token)) {
                score += 16;
            }
            if (entry.normalizedVariantNames.some((value) => value.includes(token))) {
                score += 8;
            }
            if (entry.normalizedDosages.some((value) => value.includes(token))) {
                score += 7;
            }
            if (entry.normalizedSubstances.some((value) => value.includes(token))) {
                score += 10;
            }
            if (entry.normalizedPathologies.some((value) => value.includes(token))) {
                score += 8;
            }
        });

        return score;
    }

    function searchEntries(query) {
        const normalizedQuery = normalizeText(query);
        const tokens = getQueryTokens(query);

        if (!normalizedQuery) {
            return [];
        }

        return state.entries
            .map((entry) => ({
                entry,
                score: getMatchScore(entry, normalizedQuery, tokens)
            }))
            .filter(({ entry, score }) => {
                if (score === 0) {
                    return false;
                }

                return tokens.every((token) => entry.normalizedFields.some((field) => field.includes(token)));
            })
            .sort((left, right) => {
                if (right.score !== left.score) {
                    return right.score - left.score;
                }
                return left.entry.medicationName.localeCompare(right.entry.medicationName, 'fr');
            })
            .map(({ entry }) => entry);
    }

    function findHighlightRanges(text, tokens) {
        if (!tokens.length || !text) {
            return [];
        }

        let normalized = '';
        const indexMap = [];

        for (let originalIndex = 0; originalIndex < text.length; originalIndex += 1) {
            const normalizedChars = text[originalIndex]
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();

            for (const normalizedChar of normalizedChars) {
                normalized += normalizedChar;
                indexMap.push(originalIndex);
            }
        }

        const ranges = [];
        tokens.forEach((token) => {
            if (!token) {
                return;
            }

            let cursor = 0;
            while (cursor <= normalized.length) {
                const matchIndex = normalized.indexOf(token, cursor);
                if (matchIndex === -1) {
                    break;
                }

                const start = indexMap[matchIndex];
                const end = indexMap[matchIndex + token.length - 1] + 1;
                ranges.push([start, end]);
                cursor = matchIndex + token.length;
            }
        });

        ranges.sort((a, b) => a[0] - b[0]);

        return ranges.reduce((merged, current) => {
            const previous = merged[merged.length - 1];
            if (!previous || current[0] > previous[1]) {
                merged.push(current);
                return merged;
            }

            previous[1] = Math.max(previous[1], current[1]);
            return merged;
        }, []);
    }

    function highlightText(text, tokens) {
        const ranges = findHighlightRanges(text, tokens);
        if (!ranges.length) {
            return escapeHtml(text);
        }

        let cursor = 0;
        let html = '';

        ranges.forEach(([start, end]) => {
            html += escapeHtml(text.slice(cursor, start));
            html += '<mark class="highlight">' + escapeHtml(text.slice(start, end)) + '</mark>';
            cursor = end;
        });

        html += escapeHtml(text.slice(cursor));
        return html;
    }

    function renderStateMessage(type, title, description) {
        resultsContainer.innerHTML = [
            '<div class="' + type + '">',
            title ? '<p><strong>' + escapeHtml(title) + '</strong></p>' : '',
            description ? '<p>' + escapeHtml(description) + '</p>' : '',
            '</div>'
        ].join('');
    }

    function renderResults(entries, totalCount, query) {
        const tokens = getQueryTokens(query);
        const limitedResults = entries.slice(0, MAX_RESULTS);

        if (!query.trim()) {
            resultCount.textContent = formatCount(0, 'resultat', 'resultats');
            resultsSubtitle.textContent = 'Aucune recherche lancee.';
            renderStateMessage('empty-state', 'Commencer une recherche', 'Saisissez un medicament, une substance active ou choisissez une pathologie.');
            return;
        }

        resultCount.textContent = formatCount(totalCount, 'resultat', 'resultats');

        if (!limitedResults.length) {
            resultsSubtitle.textContent = 'Aucun resultat pour "' + query + '".';
            renderStateMessage('empty-state', 'Aucun resultat', 'Essayez un autre terme ou utilisez la liste des pathologies.');
            return;
        }

        resultsSubtitle.textContent = totalCount > MAX_RESULTS
            ? formatCount(totalCount, 'resultat', 'resultats') + ' pour "' + query + '". Les ' + MAX_RESULTS + ' premiers sont affiches.'
            : formatCount(totalCount, 'resultat', 'resultats') + ' pour "' + query + '".';

        const cards = limitedResults.map((entry) => {
            const dosageText = entry.dosages.length ? entry.dosages : ['Aucune information'];
            const substancesText = entry.substances.length ? entry.substances : ['Aucune information'];
            const pathologiesText = entry.pathologies.length ? entry.pathologies : ['Aucune information'];
            const codeLabel = entry.codes.length === 1
                ? 'Code CIS ' + escapeHtml(entry.codes[0])
                : escapeHtml(String(entry.codes.length)) + ' codes CIS';

            return [
                '<article class="result-card">',
                '<div class="result-head">',
                '<div>',
                '<div class="result-title">' + highlightText(entry.medicationName, tokens) + '</div>',
                '<div class="result-form">' + highlightText(entry.formText, tokens) + '</div>',
                '</div>',
                '<div class="result-code">' + codeLabel + '</div>',
                '</div>',
                '<div class="detail-list">',
                '<div class="detail-row">',
                '<div class="detail-label">Dosages possibles</div>',
                '<div class="detail-value">' + dosageText.map((value) => highlightText(value, tokens)).join(', ') + '</div>',
                '</div>',
                '<div class="detail-row">',
                '<div class="detail-label">Substances actives</div>',
                '<div class="detail-value">' + substancesText.map((value) => highlightText(value, tokens)).join(', ') + '</div>',
                '</div>',
                '<div class="detail-row">',
                '<div class="detail-label">Pathologies</div>',
                '<div class="detail-value">' + pathologiesText.map((value) => highlightText(value, tokens)).join(', ') + '</div>',
                '</div>',
                '</div>',
                '</article>'
            ].join('');
        }).join('');

        resultsContainer.innerHTML = '<div class="results-list">' + cards + '</div>';
    }

    function performSearch() {
        const query = searchInput.value;
        state.query = query;

        if (!state.ready) {
            return;
        }

        const matches = searchEntries(query);
        renderResults(matches, matches.length, query);
    }

    function debounce(callback, wait) {
        let timeoutId;
        return function debounced() {
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(callback, wait);
        };
    }

    async function initialize() {
        try {
            const [medications, substances, pathologies] = await Promise.all([
                fetchText(FILES.medications),
                fetchText(FILES.substances),
                fetchText(FILES.pathologies)
            ]);

            state.entries = buildDataset({ medications, substances, pathologies });
            state.pathologyOptions = buildPathologyOptions(state.entries);
            state.ready = true;
            populatePathologySelect(state.pathologyOptions);

            entryCount.textContent = formatCount(state.entries.length, 'medicament', 'medicaments');
            resultCount.textContent = formatCount(0, 'resultat', 'resultats');
            searchNote.textContent = 'Recherche active. Vous pouvez taper un terme ou choisir une pathologie dans la liste.';

            renderResults([], 0, '');
            if (searchInput.value.trim()) {
                performSearch();
            }
        } catch (error) {
            console.error(error);
            pathologySelect.innerHTML = '<option value="">Impossible de charger les pathologies</option>';
            searchNote.textContent = 'Impossible de charger les donnees.';
            resultsSubtitle.textContent = 'Erreur de chargement.';
            renderStateMessage('error-state', 'Impossible de charger les donnees', error.message);
        }
    }

    searchInput.addEventListener('input', debounce(function () {
        syncPathologySelectWithInput(searchInput.value);
        performSearch();
    }, INPUT_DEBOUNCE_MS));

    pathologySelect.addEventListener('change', function () {
        searchInput.value = pathologySelect.value;
        performSearch();
    });

    initialize();
})();
