// DOM Elements
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const clearApiKeyBtn = document.getElementById('clearApiKeyBtn');
const uploadArea = document.getElementById('uploadArea');
const ecgImageInput = document.getElementById('ecgImageInput');
const ecgImagePreview = document.getElementById('ecgImagePreview');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultsSection = document.getElementById('resultsSection');
const analysisResult = document.getElementById('analysisResult');
const t = (key) => (window.ecgI18n && typeof window.ecgI18n.t === 'function' ? window.ecgI18n.t(key) : key);

// Load saved API key
function loadApiKey() {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        analyzeBtn.disabled = false;
    }
}
loadApiKey();

// Simple Markdown-to-HTML converter (supports basic formatting)
function markdownToHtml(text) {
    if (!text) return '';

    return text
        // Escape HTML tags first for safety
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

        // Convert Markdown
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')      // **bold**
        .replace(/\*(.*?)\*/g, '<em>$1</em>')                 // *italic*
        .replace(/__(.*?)__/g, '<strong>$1</strong>')         // __bold__
        .replace(/_(.*?)_/g, '<em>$1</em>')                   // _italic_

        // Headings (optional, but useful)
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')

        // Lists
        .replace(/^\s*[\d]+\.\s+(.*$)/gm, '<li>$1</li>')
        .replace(/^\s*-\s+(.*$)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>')           // Wrap loose <li> in <ul>
        .replace(/(<ul>\s*<li>.*<\/li>\s*<\/ul>)/g, '<ul>$1</ul>') // Fix nesting

        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

// Save API key to localStorage
saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key && key.startsWith('sk-')) {
        localStorage.setItem('openai_api_key', key);
        alert(t('alerts.apiSaved'));
        analyzeBtn.disabled = false;
    } else {
        alert(t('alerts.apiInvalid'));
    }
});

// Clear API key
clearApiKeyBtn.addEventListener('click', () => {
    localStorage.removeItem('openai_api_key');
    apiKeyInput.value = '';
    analyzeBtn.disabled = true;
    alert(t('alerts.apiCleared'));
});

// Handle image upload
uploadArea.addEventListener('click', () => {
    ecgImageInput.click();
});

ecgImageInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (!file.type.match('image.*')) {
            alert(t('alerts.imageOnly'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            ecgImagePreview.src = event.target.result;
            ecgImagePreview.style.display = 'block';
            analyzeBtn.disabled = !localStorage.getItem('openai_api_key');
        };
        reader.readAsDataURL(file);
    }
});

// Drag and drop support
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#e63946';
    uploadArea.style.backgroundColor = 'rgba(230, 57, 70, 0.1)';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '';
    uploadArea.style.backgroundColor = '';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    uploadArea.style.backgroundColor = '';

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        ecgImageInput.files = e.dataTransfer.files;
        const event = new Event('change', { bubbles: true });
        ecgImageInput.dispatchEvent(event);
    }
});

// Analyze ECG with OpenAI
analyzeBtn.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) {
        alert(t('alerts.saveKeyFirst'));
        return;
    }

    if (!ecgImagePreview.src) {
        alert(t('alerts.uploadFirst'));
        return;
    }

    // Show loading
    loadingIndicator.style.display = 'block';
    resultsSection.classList.add('hidden');

    try {
        // Convert image to base64
        const imageUrl = ecgImagePreview.src;
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        // Load prompt text from local propmt.txt (same folder)
        let promptText = '';
        try {
            const promptResp = await fetch('propmt.txt');
            if (promptResp.ok) {
                promptText = await promptResp.text();
            }
        } catch (e) {
            console.warn('Could not load propmt.txt:', e);
            promptText = '';
        }
        // Call OpenAI Vision API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-5.2",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: promptText,
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64}`
                                }
                            }
                        ]
                    }
                ],
                max_completion_tokens: 1000
            })
        });

        if (!openaiResponse.ok) {
            const error = await openaiResponse.json();
            throw new Error(error.error?.message || t('errors.apiRequestFailed'));
        }

        const data = await openaiResponse.json();
        const analysis = data.choices[0].message.content;

        // Display result
        const htmlResult = markdownToHtml(analysis);
        analysisResult.innerHTML = `<p>${htmlResult}</p>`;
        resultsSection.classList.remove('hidden');

    } catch (error) {
        console.error('Analysis error:', error);
        analysisResult.innerHTML = `<strong>${t('errors.label')}:</strong> ${error.message || t('errors.unknown')}`;
        resultsSection.classList.remove('hidden');
    } finally {
        loadingIndicator.style.display = 'none';
    }
});
