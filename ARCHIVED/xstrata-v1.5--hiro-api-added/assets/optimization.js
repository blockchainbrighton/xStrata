
/**
 * Optimization Layer for API Usage & Performance
 * Injected to handle Caching, Rate-Limiting, and Request Deduplication.
 */

(function() {
    console.log("🚀 [Optimization Layer] Initializing...");

    const CACHE_PREFIX = "api_cache_v1_";
    const MEMORY_CACHE = new Map();
    const IN_FLIGHT_REQUESTS = new Map();
    const MAX_CONCURRENT_REQUESTS = 5;
    let ACTIVE_REQUESTS = 0;
    const REQUEST_QUEUE = [];

    // --- Configuration ---
    const CACHE_TTL = 1000 * 60 * 60; // 1 hour default
    const ENABLE_LOGGING = true;

    function log(...args) {
        if (ENABLE_LOGGING) console.log("[OptLayer]", ...args);
    }

    // --- Cache Management ---

    function getCacheKey(url, options) {
        // Simple key generation based on URL and method.
        // Body is not hashed for simplicity, assuming GET mainly for caching.
        const method = options?.method || 'GET';
        if (method !== 'GET') return null; // Don't cache non-GET
        return `${CACHE_PREFIX}${url}`;
    }

    function getFromCache(key) {
        if (!key) return null;

        // 1. Memory Cache
        if (MEMORY_CACHE.has(key)) {
            log("Memory Cache Hit:", key);
            return MEMORY_CACHE.get(key).clone(); // Clone response to be safe
        }

        // 2. Persistent Storage (localStorage)
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                const entry = JSON.parse(stored);
                if (Date.now() - entry.timestamp < CACHE_TTL) {
                    log("Storage Cache Hit:", key);
                    // Reconstruct Response object
                    const response = new Response(entry.body, entry.init);
                    // Update memory cache
                    MEMORY_CACHE.set(key, response.clone());
                    return response;
                } else {
                    localStorage.removeItem(key); // Expired
                }
            }
        } catch (e) {
            console.warn("Cache read error", e);
        }
        return null;
    }

    async function saveToCache(key, response) {
        if (!key || !response || !response.ok) return;

        try {
            const cloned = response.clone();
            const bodyText = await cloned.text();
            
            // Store in Memory
            MEMORY_CACHE.set(key, new Response(bodyText, response));

            // Store in LocalStorage (if size permits)
            // Limit text size to avoid quota exceeded errors (~500KB limit for safety)
            if (bodyText.length < 500000) {
                const entry = {
                    timestamp: Date.now(),
                    body: bodyText,
                    init: {
                        status: response.status,
                        statusText: response.statusText,
                        headers: [...response.headers.entries()]
                    }
                };
                localStorage.setItem(key, JSON.stringify(entry));
            }
        } catch (e) {
            console.warn("Cache save error", e);
        }
    }

    // --- Rate Limiting & Queue ---

    async function processQueue() {
        if (ACTIVE_REQUESTS >= MAX_CONCURRENT_REQUESTS || REQUEST_QUEUE.length === 0) return;

        const { url, options, resolve, reject } = REQUEST_QUEUE.shift();
        ACTIVE_REQUESTS++;

        try {
            const response = await originalFetch(url, options);
            resolve(response);
        } catch (error) {
            reject(error);
        } finally {
            ACTIVE_REQUESTS--;
            processQueue();
        }
    }

    function queuedFetch(url, options) {
        return new Promise((resolve, reject) => {
            REQUEST_QUEUE.push({ url, options, resolve, reject });
            processQueue();
        });
    }

    // --- Interceptor ---

    const originalFetch = window.fetch;

    window.fetch = async function(url, options = {}) {
        let urlStr = url.toString();

        // --- Proxy Rewrite for Hiro API ---
        if (urlStr.includes('api.mainnet.hiro.so') || urlStr.includes('api.testnet.hiro.so')) {
            const originalUrl = urlStr;
            urlStr = urlStr
                .replace('https://api.mainnet.hiro.so', '/hiro-proxy/mainnet')
                .replace('https://api.testnet.hiro.so', '/hiro-proxy/testnet');
            
            url = urlStr; // Update the URL argument for the actual fetch
            log(`Proxy Rewriting: ${originalUrl} -> ${urlStr}`);
        }

        const cacheKey = getCacheKey(urlStr, options);

        // 1. Check Cache
        const cachedResponse = getFromCache(cacheKey);
        if (cachedResponse) return cachedResponse;

        // 2. Dedup: Check In-Flight
        if (IN_FLIGHT_REQUESTS.has(cacheKey)) {
            log("Deduplication Hit:", urlStr);
            const response = await IN_FLIGHT_REQUESTS.get(cacheKey);
            return response.clone();
        }

        // 3. Network Request (Queue-managed)
        log("Fetching:", urlStr);
        const requestPromise = queuedFetch(url, options)
            .then(async (response) => {
                if (response.ok) {
                    await saveToCache(cacheKey, response.clone());
                }
                IN_FLIGHT_REQUESTS.delete(cacheKey);
                return response;
            })
            .catch((err) => {
                IN_FLIGHT_REQUESTS.delete(cacheKey);
                console.warn("[OptLayer] Network/CORS Error encountered:", urlStr);
                // Return a safe error response to handle CORS/Network errors gracefully
                return new Response(JSON.stringify({ 
                    error: true, 
                    message: "Network request failed. Possible CORS issue or offline.",
                    details: err.message 
                }), {
                    status: 503,
                    statusText: "Service Unavailable",
                    headers: { "Content-Type": "application/json" }
                });
            });

        if (cacheKey) {
            IN_FLIGHT_REQUESTS.set(cacheKey, requestPromise);
        }

        return requestPromise;
    };

    // --- Public API for Manual Control ---
    window.OptLayer = {
        clearCache: () => {
            MEMORY_CACHE.clear();
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
            });
            log("Cache cleared.");
        },
        getStatus: () => ({
            activeRequests: ACTIVE_REQUESTS,
            queueLength: REQUEST_QUEUE.length,
            memoryCacheSize: MEMORY_CACHE.size
        })
    };

    console.log("🚀 [Optimization Layer] Active.");
})();
