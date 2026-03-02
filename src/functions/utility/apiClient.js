/**
 * Shared API client for Whiteout Survival game API
 * Centralizes sign building, HTTP requests, and player data fetching
 * Used by: fetchPlayerData.js, refreshAlliance.js, redeemFunction.js
 */

const crypto = require('crypto');
const fetch = require('node-fetch');
const http = require('http');
const https = require('https');
const { API_CONFIG } = require('./apiConfig');
const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });

// Browser profiles for header randomization
const BROWSER_PROFILES = [
    {
        browser: 'Chrome',
        versions: [124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135],
        platforms: [
            { os: 'Windows NT 10.0; Win64; x64', secPlatform: '"Windows"' },
            { os: 'Windows NT 11.0; Win64; x64', secPlatform: '"Windows"' },
            { os: 'Macintosh; Intel Mac OS X 10_15_7', secPlatform: '"macOS"' },
            { os: 'X11; Linux x86_64', secPlatform: '"Linux"' }
        ],
        buildSecUa: (ver) => `"Not:A-Brand";v="99", "Google Chrome";v="${ver}", "Chromium";v="${ver}"`
    },
    {
        browser: 'Brave',
        versions: [132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145],
        platforms: [
            { os: 'Windows NT 10.0; Win64; x64', secPlatform: '"Windows"' },
            { os: 'Windows NT 11.0; Win64; x64', secPlatform: '"Windows"' },
            { os: 'Macintosh; Intel Mac OS X 10_15_7', secPlatform: '"macOS"' }
        ],
        buildSecUa: (ver) => `"Not:A-Brand";v="99", "Brave";v="${ver}", "Chromium";v="${ver}"`
    },
    {
        browser: 'Edge',
        versions: [124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135],
        platforms: [
            { os: 'Windows NT 10.0; Win64; x64', secPlatform: '"Windows"' },
            { os: 'Windows NT 11.0; Win64; x64', secPlatform: '"Windows"' },
            { os: 'Macintosh; Intel Mac OS X 10_15_7', secPlatform: '"macOS"' }
        ],
        buildSecUa: (ver) => `"Not A(B)rand";v="8", "Chromium";v="${ver}", "Microsoft Edge";v="${ver}"`
    }
];

/**
 * Generates randomized browser-like headers to avoid server-side bot detection.
 * Rotates browser type, version, OS, and related sec-* headers on every call.
 * @returns {Object} Headers object
 */
function generateBrowserHeaders() {
    const profile = BROWSER_PROFILES[Math.floor(Math.random() * BROWSER_PROFILES.length)];
    const version = profile.versions[Math.floor(Math.random() * profile.versions.length)];
    const platform = profile.platforms[Math.floor(Math.random() * profile.platforms.length)];

    return {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.7',
        'Origin': API_CONFIG.ORIGIN,
        'Referer': `${API_CONFIG.ORIGIN}/`,
        'User-Agent': `Mozilla/5.0 (${platform.os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`,
        'sec-ch-ua': profile.buildSecUa(version),
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': platform.secPlatform,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'sec-gpc': '1',
    };
}

/**
 * Builds MD5 signed form data for simple player API calls
 * Uses fixed key order: fid, time (milliseconds)
 * @param {string} playerId - Player FID
 * @returns {string} Signed form data string
 */
function buildPlayerPayload(playerId) {
    const currentTime = Date.now();
    const form = `fid=${playerId}&time=${currentTime}`;
    const sign = crypto.createHash('md5').update(form + API_CONFIG.SECRET).digest('hex');
    return `sign=${sign}&${form}`;
}

/**
 * Builds MD5 signed form data with alphabetically sorted keys
 * Used for gift code API calls (captcha, redeem, auth)
 * @param {Object} data - Key-value pairs to encode
 * @returns {string} Signed form data string
 */
function encodeData(data) {
    const sortedKeys = Object.keys(data).sort();
    const encodedData = sortedKeys
        .map(key => `${key}=${typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]}`)
        .join('&');

    const sign = crypto.createHash('md5')
        .update(encodedData + API_CONFIG.SECRET)
        .digest('hex');

    return `sign=${sign}&${encodedData}`;
}

/**
 * Makes a POST request using node-fetch (for player API)
 * @param {string} url - API endpoint URL
 * @param {string} body - Signed form data string
 * @returns {Promise<{status: number, data: Object}>} Response
 */
async function fetchPost(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...generateBrowserHeaders()
        },
        body,
        // disable keep-alive and add a timeout so we don't hang on stale sockets
        agent: url.startsWith('https') ? httpsAgent : httpAgent,
        timeout: 15000
    });

    if (response.status === 429) {
        throw new Error('RATE_LIMIT');
    }

    if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    return { status: response.status, data };
}

/**
 * Makes a POST request using native http/https (for gift code API)
 * Includes Origin header required by the gift code endpoint
 * @param {string} url - API endpoint URL
 * @param {Object} payload - Data to encode and send
 * @param {string} label - Label for error logging
 * @returns {Promise<{ok: boolean, status: number, data: Object, raw: string}>} Response
 */
async function nativePost(url, payload, label) {
    return new Promise((resolve, reject) => {
        const postData = encodeData(payload);

        const urlObject = new URL(url);
        const browserHeaders = generateBrowserHeaders();
        const options = {
            hostname: urlObject.hostname,
            port: urlObject.port || (urlObject.protocol === 'https:' ? 443 : 80),
            path: urlObject.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                ...browserHeaders
            }
        };

        const client = urlObject.protocol === 'https:' ? https : http;
        const req = client.request(options, (res) => {
            let raw = '';

            res.on('data', (chunk) => {
                raw += chunk;
            });

            res.on('end', () => {
                let data;
                try {
                    data = JSON.parse(raw);
                } catch (error) {
                    data = raw;
                }

                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    data,
                    raw
                });
            });
        });

        req.on('error', (error) => {
            console.error(`${label} request failed:`, error.message);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Fetches player data from the game API with retry logic
 * @param {string} playerId - Player FID
 * @param {Object} [options] - Options
 * @param {Function} [options.onError] - Error callback: (error, context) => void
 * @param {Function} [options.delay] - Delay function: (ms) => Promise<void>
 * @param {boolean} [options.returnErrorObject] - If true, returns { error, playerNotExist } instead of null on failure
 * @returns {Promise<Object|null>} Player data, error object, or null
 */
async function fetchPlayerData(playerId, options = {}) {
    const { onError, delay, returnErrorObject = false } = options;
    const delayFn = delay || ((ms) => new Promise(resolve => setTimeout(resolve, ms)));
    let retries = 0;

    while (retries < API_CONFIG.MAX_RETRIES) {
        try {
            const body = buildPlayerPayload(playerId);
            const { data } = await fetchPost(API_CONFIG.API_URL, body);

            // Check for player not exist
            if (data.err_code === 40001 || data.msg === 'ROLE NOT EXIST' || data.msg === 'ROLE NOT EXIST.') {
                if (returnErrorObject) {
                    return { error: 'ROLE NOT EXIST', playerNotExist: true };
                }
                // For fetchPlayerData.js style: report and return null
                const errorMsg = data.msg || 'ROLE NOT EXIST';
                if (onError) {
                    await onError(new Error(`Invalid player ID ${playerId}: ${errorMsg}`), 'fetchPlayerFromAPI');
                }
                return null;
            }

            // Check for non-retryable errors
            const errorMsg = (data.msg || '').toLowerCase();
            if (errorMsg.includes('not exist') || errorMsg.includes('invalid')) {
                if (returnErrorObject) {
                    return { error: data.msg || 'Unknown error', playerNotExist: true };
                }
                if (onError) {
                    await onError(new Error(`Invalid player ID ${playerId}: ${data.msg}`), 'fetchPlayerFromAPI');
                }
                return null;
            }

            // Success
            if (data.code === 0 && data.data) {
                return data.data;
            }

            throw new Error(`API returned error: ${data.msg || 'Unknown error'}`);

        } catch (error) {
            if (error.message === 'RATE_LIMIT') {
                throw error; // Caller handles rate limits
            }

            retries++;

            if (onError) {
                await onError(error, 'fetchPlayerFromAPI');
            }

            if (retries < API_CONFIG.MAX_RETRIES) {
                await delayFn(API_CONFIG.RETRY_DELAY);
            }
        }
    }

    // All retries exhausted
    if (returnErrorObject) {
        return { error: 'MAX_RETRIES_EXCEEDED', playerNotExist: false };
    }
    return null;
}

module.exports = {
    buildPlayerPayload,
    encodeData,
    fetchPost,
    nativePost,
    fetchPlayerData
};
