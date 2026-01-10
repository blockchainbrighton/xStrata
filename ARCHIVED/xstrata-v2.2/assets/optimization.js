/**
 * Optimization Layer for API Usage & Performance
 * - Secure Proxy Routing
 * - Graceful Error Handling
 * - Request Object Support
 */

(function() {
    console.log("🚀 [Optimization Layer] Initializing with Secure Proxy...");

    const PROXY_BASE = "/hiro-proxy";
    
    // Helper: Delay function for retry logic
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const originalFetch = window.fetch;

    window.fetch = async function(input, init = {}) {
        let url = input;
        let options = init;

        // 1. Handle Request Objects (Fix for Stacks.js)
        if (input instanceof Request) {
            url = input.url;
            // Merge options if needed, but Request object usually contains everything
            // We might need to clone it to modify headers/url, but for proxying,
            // treating it as a string URL + options is often safer if we want to rewrite URL.
            // However, Request objects are immutable.
            // Best approach: create a new Request or call fetch with string + init.
            
            // To be safe, we'll convert Request to string + init for our proxy logic
            // unless it's a non-proxy URL.
             try {
                // If body is used, we need to be careful.
                // For read-only proxying, this is usually fine.
                // For posts, we might need to extract body.
                 options = {
                    method: input.method,
                    headers: input.headers,
                    body: input.body, // This might be a stream
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
        // Matches mainnet or testnet calls typically made by Stacks.js
        let targetUrl = urlStr;
        const hiroMatch = urlStr.match(/^https?:\/\/api\.(mainnet|testnet)\.hiro\.so(.*)/);
        if (hiroMatch) {
            const network = hiroMatch[1]; // 'mainnet' or 'testnet'
            let path = hiroMatch[2];
            
            // CACHE BUSTING for Transaction Status
            // Append timestamp to /tx/ endpoints to prevent browser/proxy caching
            if (path.includes('/tx/') || path.includes('/v1/tx/') || path.includes('/extended/v1/tx/')) {
                const separator = path.includes('?') ? '&' : '?';
                path += `${separator}_t=${Date.now()}`;
            }

            targetUrl = `${PROXY_BASE}/${network}${path}`;
            // console.log(`[OptLayer] Rewriting ${urlStr} -> ${targetUrl}`);
        }

        try {
            const response = await originalFetch(targetUrl, options);
            
            // 3. Graceful Error Handling (503 Service Unavailable)
            // If the proxy returns 503 or network fails
            if (response.status === 503) {
                console.warn(`[OptLayer] 503 received for ${targetUrl}`);
                // Optional: Retry logic could go here, but for now we just return it
                // so the app handles it (or doesn't crash).
                // The notes say: "return a standardized 503 Service Unavailable response"
                // which the proxy already does.
            }
            
            return response;

        } catch (err) {
            console.error(`[OptLayer] Network Failure for ${targetUrl}:`, err);
            // Return a synthetic 503 response instead of throwing, to prevent app crash
            return new Response(JSON.stringify({ error: "Network Error", details: err.message }), {
                status: 503,
                statusText: "Service Unavailable",
                headers: { "Content-Type": "application/json" }
            });
        }
    };

    console.log("🚀 [Optimization Layer] Active. Proxying Hiro API calls.");
})();