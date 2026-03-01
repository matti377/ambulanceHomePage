(function () {
    const SUPPORTED_LANGUAGES = ['de', 'en', 'fr', 'lb'];
    const FALLBACK_LANGUAGE = 'de';

    function sanitizeLanguage(language) {
        return SUPPORTED_LANGUAGES.includes(language) ? language : FALLBACK_LANGUAGE;
    }

    function getStoredLanguage() {
        return sanitizeLanguage(localStorage.getItem('language'));
    }

    function getStoredTheme() {
        return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    }

    function getStoredBetaFeatures() {
        return localStorage.getItem('betaFeatures') === 'true';
    }

    function applySavedVisualSettings() {
        const theme = getStoredTheme();
        const betaEnabled = getStoredBetaFeatures();

        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }

        document.body.classList.toggle('beta-features-enabled', betaEnabled);
    }

    function applyTranslations(config) {
        const language = getStoredLanguage();
        const translations = config.translations || {};
        const active = translations[language] || translations[FALLBACK_LANGUAGE] || {};
        const fallback = translations[FALLBACK_LANGUAGE] || {};

        function t(key) {
            return active[key] || fallback[key] || key;
        }

        document.documentElement.lang = language;
        applySavedVisualSettings();

        if (config.titleKey) {
            document.title = t(config.titleKey);
        }

        if (config.text) {
            Object.entries(config.text).forEach(([selector, key]) => {
                const element = document.querySelector(selector);
                if (element) {
                    element.textContent = t(key);
                }
            });
        }

        if (Array.isArray(config.textAll)) {
            config.textAll.forEach((item) => {
                document.querySelectorAll(item.selector).forEach((element) => {
                    element.textContent = t(item.key);
                });
            });
        }

        if (Array.isArray(config.attrs)) {
            config.attrs.forEach((item) => {
                document.querySelectorAll(item.selector).forEach((element) => {
                    element.setAttribute(item.attr, t(item.key));
                });
            });
        }

        if (typeof config.onApplied === 'function') {
            config.onApplied({
                language,
                t
            });
        }
    }

    window.ToolkitI18n = {
        applyTranslations,
        getStoredLanguage
    };
})();
