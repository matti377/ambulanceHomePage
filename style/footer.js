(function () {
    const SUPPORTED_LANGUAGES = ['de', 'en', 'fr', 'lb'];
    const FALLBACK_LANGUAGE = 'de';
    let footerConfigPromise = null;

    function getLanguage() {
        const toolkitLanguage = window.ToolkitI18n && typeof window.ToolkitI18n.getStoredLanguage === 'function'
            ? window.ToolkitI18n.getStoredLanguage()
            : localStorage.getItem('language');
        return SUPPORTED_LANGUAGES.includes(toolkitLanguage) ? toolkitLanguage : FALLBACK_LANGUAGE;
    }

    function loadFooterConfig() {
        if (!footerConfigPromise) {
            footerConfigPromise = fetch('/data/footer.json').then((response) => {
                if (!response.ok) {
                    throw new Error('Footer config could not be loaded.');
                }
                return response.json();
            });
        }
        return footerConfigPromise;
    }

    function applyFooterToElement(footer, config) {
        if (!footer.dataset.footerProfile) {
            return;
        }

        const profiles = config.profiles || {};
        const profile = profiles.default;
        if (!profile) {
            return;
        }

        const language = getLanguage();
        const content = profile[language] || profile[FALLBACK_LANGUAGE];
        if (!content) {
            return;
        }

        const firstSelector = footer.dataset.footerFirst;
        const lastSelector = footer.dataset.footerLast;

        if (firstSelector && content.firstHtml) {
            const firstElement = document.querySelector(firstSelector);
            if (firstElement) {
                firstElement.innerHTML = content.firstHtml;
            }
        }

        if (lastSelector && content.lastText) {
            const lastElement = document.querySelector(lastSelector);
            if (lastElement) {
                lastElement.textContent = content.lastText;
            }
        }
    }

    function applyFooters() {
        loadFooterConfig()
            .then((config) => {
                document.querySelectorAll('footer[data-footer-profile]').forEach((footer) => {
                    applyFooterToElement(footer, config);
                });
            })
            .catch((error) => {
                console.error(error);
            });
    }

    if (window.ToolkitI18n && typeof window.ToolkitI18n.applyTranslations === 'function' && !window.ToolkitI18n._footerWrapped) {
        const originalApplyTranslations = window.ToolkitI18n.applyTranslations.bind(window.ToolkitI18n);
        window.ToolkitI18n.applyTranslations = function (config) {
            originalApplyTranslations(config);
            applyFooters();
        };
        window.ToolkitI18n._footerWrapped = true;
    }

    window.addEventListener('load', applyFooters);
})();
