/**
 * Optimization Layer for API Usage & Performance
 * - Secure Proxy Routing
 * - Graceful Error Handling
 * - Request Object Support
 */

const PROXY_BASE = "/hiro-proxy";

/**
 * Helper: Delay function for retry logic
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise}
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Intercepts and rewrites Hiro API calls to use a secure proxy.
 * Handles Request objects and adds cache-busting for transaction status.
 */
export const initializeOptimizationLayer = () => {
    console.log("🚀 [Optimization Layer] Initializing with Secure Proxy...");

    const originalFetch = window.fetch;

    window.fetch = async function(input, init = {}) {
        let url = input;
        let options = init;

        // 1. Handle Request Objects (Fix for Stacks.js)
        if (input instanceof Request) {
            url = input.url;
            try {
                options = {
                    method: input.method,
                    headers: input.headers,
                    body: input.body,
                    mode: input.mode,
                    credentials: input.credentials,
                    cache: input.cache,
                    redirect: input.redirect,
                    referrer: input.referrer,
                    integrity: input.integrity,
                    ...init
                };
            } catch (e) {
                console.warn("Error cloning Request object properties", e);
            }
        }

        const urlStr = url.toString();

        // 2. URL Rewriting (Intercept Hiro API calls)
        let targetUrl = urlStr;
        const hiroMatch = urlStr.match(/^https?:\/\/api\.(mainnet|testnet)\.hiro\.so(.*)/);
        if (hiroMatch) {
            const network = hiroMatch[1]; // 'mainnet' or 'testnet'
            let path = hiroMatch[2];
            
            // CACHE BUSTING for Transaction Status
            if (path.includes('/tx/') || path.includes('/v1/tx/')) {
                const separator = path.includes('?') ? '&' : '?';
                path += `${separator}_t=${Date.now()}`;
            }

            targetUrl = `${PROXY_BASE}/${network}${path}`;
        }

        try {
            const response = await originalFetch(targetUrl, options);
            
            // 3. Graceful Error Handling (503 Service Unavailable)
            if (response.status === 503) {
                console.warn(`[OptLayer] 503 received for ${targetUrl}`);
            }
            
            return response;

        } catch (err) {
            console.error(`[OptLayer] Network Failure for ${targetUrl}:`, err);
            // Return a synthetic 503 response instead of throwing
            return new Response(JSON.stringify({ error: "Network Error", details: err.message }), {
                status: 503,
                statusText: "Service Unavailable",
                headers: { "Content-Type": "application/json" }
            });
        }
    };

    console.log("🚀 [Optimization Layer] Active. Proxying Hiro API calls.");
};
