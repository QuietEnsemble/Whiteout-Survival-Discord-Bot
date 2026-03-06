const fs = require('fs');
const path = require('path');

// Load all language files from i18n directory
const languages = {};

function flattenKeys(obj, prefix = '') {
    const keys = [];
    if (!obj || typeof obj !== 'object') return keys;
    for (const k of Object.keys(obj)) {
        const val = obj[k];
        const pathKey = prefix ? `${prefix}.${k}` : k;
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            keys.push(...flattenKeys(val, pathKey));
        } else {
            keys.push(pathKey);
        }
    }
    return keys;
}

function loadLanguages() {
    const languageFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.json'));

    for (const file of languageFiles) {
        const languageCode = path.parse(file).name;
        const filePath = path.join(__dirname, file);
        
        try {
            const languageData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            languages[languageCode] = languageData;
        } catch (error) {
            console.error(`Failed to load language file ${file}: ${error.message}`);
        }
    }
}

function compareAllLanguages(mainLang = 'en') {
    if (!languages[mainLang]) {
        console.warn(`[i18n] Main language '${mainLang}' not found; skipping comparison.`);
        return;
    }

    const mainKeys = new Set(flattenKeys(languages[mainLang]));

    for (const [code, data] of Object.entries(languages)) {
        if (code === mainLang) continue;

        const langKeys = new Set(flattenKeys(data));

        const missing = [...mainKeys].filter(k => !langKeys.has(k));
        const extra = [...langKeys].filter(k => !mainKeys.has(k));

        if (missing.length === 0 && extra.length === 0) {
            continue;
        }

        console.groupCollapsed(`[i18n] ${code}: differences compared to ${mainLang} — missing: ${missing.length}, extra: ${extra.length}`);
        if (missing.length) {
            console.log(`Missing keys (${missing.length}) in ${code} compared to ${mainLang}:`);
            console.log(missing);
        }
        if (extra.length) {
            console.log(`Extra keys (${extra.length}) in ${code} not present in ${mainLang}:`);
            console.log(extra);
        }
        console.groupEnd();
    }
}

// Load languages on module initialization
loadLanguages();

// Run a comparison against the main language file to report missing/extra keys
try {
    compareAllLanguages('en');
} catch (err) {
    console.error('[i18n] Error while comparing languages:', err);
}

// Export the languages object that can be imported directly
module.exports = languages;

// Add reload function for hot reloading
module.exports.reload = function() {
    // Clear existing languages
    Object.keys(languages).forEach(key => delete languages[key]);
    // Reload from files
    loadLanguages();
    // Re-run comparison after reload
    try {
        compareAllLanguages('en');
    } catch (err) {
        console.error('[i18n] Error while comparing languages after reload:', err);
    }
    console.log('i18n files reloaded');
};

// Expose comparison helper
module.exports.compareAllLanguages = compareAllLanguages;