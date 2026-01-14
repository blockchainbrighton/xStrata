import * as Connect from '@stacks/connect';
import { StacksTestnet } from '@stacks/network';
import { Buffer } from 'buffer';

// LAZY LOAD HELPERS
let _stacksTx, _merkle, _audio;
const getStacksTx = async () => {
    if (!_stacksTx) {
        const mod = await import('@stacks/transactions');
        console.log('DEBUG: @stacks/transactions module:', mod);
        // Robust fallback for CJS/ESM interop
        if (mod.callReadOnlyFunction) _stacksTx = mod;
        else if (mod.default && mod.default.callReadOnlyFunction) _stacksTx = mod.default;
        else _stacksTx = { ...mod, ...mod.default }; // Flatten attempt
        console.log('DEBUG: Resolved _stacksTx:', _stacksTx);
    }
    return _stacksTx;
};
const getMerkle = async () => {
    if (!_merkle) _merkle = await import('./lib/merkle.js');
    return _merkle;
};
const getAudio = async () => {
    if (!_audio) _audio = await import('./lib/audio-engine.js');
    return _audio;
};

window.Buffer = Buffer;

// JOURNEY LOGGER
const journeyLog = (msg, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMsg = `[${timestamp}] ${msg}`;
    console.log(logMsg, data || '');
    const el = document.getElementById('journey-log');
    if (el) {
        const div = document.createElement('div');
        // Custom replacer for BigInt
        const isSensitiveKey = (key) =>
            /(appPrivateKey|privateKey|transitKey|secret|mnemonic|seed|authResponseToken|coreSessionToken)/i.test(String(key));

        const redactString = (str) => {
            if (typeof str !== 'string') return str;
            // JWT-like (auth response / requests)
            if (str.startsWith('eyJ') && str.includes('.') && str.length > 60) return '[JWT redacted]';
            // Long hex blobs
            if (/^[0-9a-f]+$/i.test(str) && str.length > 120) return str.slice(0, 32) + '…(hex truncated)';
            // Very long strings
            if (str.length > 400) return str.slice(0, 200) + '…(truncated)';
            return str;
        };

        const safeStringify = (obj) =>
            JSON.stringify(obj, (key, value) => {
                if (typeof value === 'bigint') return value.toString() + 'n';
                if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
                if (isSensitiveKey(key)) return '[REDACTED]';
                if (typeof value === 'string') return redactString(value);
                return value;
            });
        
        const maxLen = (msg.startsWith('AUTH DEBUG DUMP') || msg.startsWith('[console.error]') || msg.startsWith('[window.error]') || msg.startsWith('[unhandledrejection]')) ? 2200 : 250;
        if (data) {
            const serialized = safeStringify(data);
            const truncated = serialized.length > maxLen ? serialized.substring(0, maxLen) + '…' : serialized;
            div.innerText = logMsg + ' ' + truncated;
        } else {
            div.innerText = logMsg;
        }
        el.prepend(div);
    }
};

// DEBUG HELPERS
const isAuthDebugEnabled = () => {
    const el = document.getElementById('toggle-auth-debug');
    return el ? Boolean(el.checked) : true;
};

const safeSerialize = (value, maxLen = 1200) => {
    try {
        const json = JSON.stringify(
            value,
            (key, val) => {
                if (typeof val === 'bigint') return `${val.toString()}n`;
                if (val instanceof Error) return { name: val.name, message: val.message, stack: val.stack };
                if (val instanceof Uint8Array) return { type: 'Uint8Array', length: val.length };
                if (typeof val === 'function') return `[Function ${val.name || 'anonymous'}]`;
                if (/(appPrivateKey|privateKey|transitKey|secret|mnemonic|seed|authResponseToken|coreSessionToken)/i.test(String(key)))
                    return '[REDACTED]';
                if (typeof val === 'string') {
                    if (val.startsWith('eyJ') && val.includes('.') && val.length > 60) return '[JWT redacted]';
                    if (/^[0-9a-f]+$/i.test(val) && val.length > 120) return val.slice(0, 32) + '…(hex truncated)';
                    if (val.length > 1200) return val.slice(0, 200) + '…(truncated)';
                }
                return val;
            },
            2
        );
        if (!json) return String(value);
        return json.length > maxLen ? json.slice(0, maxLen) + '…' : json;
    } catch {
        try {
            return String(value);
        } catch {
            return '[unserializable]';
        }
    }
};

const listInterestingStorageKeys = () => {
    const keys = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            if (/(connect|blockstack|stacks|auth|xverse|hiro|leather)/i.test(k)) keys.push(k);
        }
    } catch {
        // ignore
    }
    return keys.sort();
};

const getLocalStorageJsonSummary = (key, maxLen = 500) => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        let decoded = raw;
        // Some values may be stored as hex-encoded JSON (starting with 7b = "{")
        if (/^[0-9a-f]+$/i.test(raw) && raw.startsWith('7b') && raw.length % 2 === 0) {
            try {
                const bytes = new Uint8Array(raw.length / 2);
                for (let i = 0; i < raw.length; i += 2) bytes[i / 2] = parseInt(raw.slice(i, i + 2), 16);
                decoded = new TextDecoder().decode(bytes);
            } catch {
                decoded = raw;
            }
        }

        let parsed = null;
        try {
            parsed = JSON.parse(decoded);
        } catch {
            parsed = null;
        }

        const redact = (obj) => {
            if (!obj || typeof obj !== 'object') return obj;
            if (Array.isArray(obj)) return obj.map(redact);
            const out = {};
            for (const [k, v] of Object.entries(obj)) {
                if (/(appPrivateKey|privateKey|transitKey|secret|mnemonic|seed|authResponseToken|coreSessionToken)/i.test(k)) {
                    out[k] = '[REDACTED]';
                } else if (typeof v === 'string' && v.startsWith('eyJ') && v.includes('.') && v.length > 60) {
                    out[k] = '[JWT redacted]';
                } else {
                    out[k] = redact(v);
                }
            }
            return out;
        };

        const previewString = parsed ? JSON.stringify(redact(parsed)) : decoded;

        return {
            key,
            length: decoded.length,
            parsedType: parsed ? typeof parsed : null,
            preview: previewString.length > maxLen ? previewString.slice(0, maxLen) + '…' : previewString,
        };
    } catch {
        return null;
    }
};

const getSelectedProviderId = () => {
    try {
        return localStorage.getItem('STX_PROVIDER');
    } catch {
        return null;
    }
};

const clearSelectedProviderId = () => {
    try {
        localStorage.removeItem('STX_PROVIDER');
    } catch {
        // ignore
    }
    try {
        Connect.disconnect?.();
    } catch {
        // ignore
    }
};

const wrapProviderForDebug = (provider, label = 'provider') => {
    if (!provider || typeof provider !== 'object') return provider;
    if (provider.__wrappedForAuthDebug) return provider;

    const handler = {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            const intercept = ['authenticationRequest', 'transactionRequest', 'signatureRequest', 'structuredDataSignatureRequest', 'request'];
            if (!intercept.includes(String(prop))) return value;
            if (typeof value !== 'function') return value;

            return async (...args) => {
                if (isAuthDebugEnabled()) {
                    journeyLog(`[${label}.${String(prop)}] called`, { args: safeSerialize(args, 800) });
                }
                try {
                    const result = await value.apply(target, args);
                    if (isAuthDebugEnabled()) {
                        journeyLog(`[${label}.${String(prop)}] resolved`, { result: safeSerialize(result, 1200) });
                    }
                    return result;
                } catch (e) {
                    if (isAuthDebugEnabled()) {
                        journeyLog(`[${label}.${String(prop)}] threw`, { error: e?.message || String(e), stack: e?.stack || null });
                    }
                    throw e;
                }
            };
        },
    };

    const proxied = new Proxy(provider, handler);
    try {
        proxied.__wrappedForAuthDebug = true;
    } catch {
        // ignore
    }
    return proxied;
};

const getProviderSummary = () => {
    const candidates = {
        Connect_getStacksProvider: null,
        window_StacksProvider: null,
        window_BlockstackProvider: null,
        window_XverseProviders: null,
    };

    try {
        candidates.Connect_getStacksProvider = Connect.getStacksProvider?.() || null;
    } catch (e) {
        candidates.Connect_getStacksProvider = { error: e?.message || String(e) };
    }

    candidates.window_StacksProvider = window.StacksProvider || null;
    candidates.window_BlockstackProvider = window.BlockstackProvider || null;
    candidates.window_XverseProviders = window.XverseProviders || null;

    const summarize = (p) => {
        if (!p) return null;
        const summary = { type: typeof p };
        try {
            summary.constructorName = p?.constructor?.name || null;
        } catch {
            summary.constructorName = null;
        }
        try {
            summary.keys = Object.keys(p).slice(0, 40);
        } catch {
            summary.keys = ['[unavailable]'];
        }
        try {
            summary.id = p.id || p.providerId || p.name || null;
        } catch {
            summary.id = null;
        }
        try {
            summary.hasAuthenticationRequest = typeof p.authenticationRequest === 'function';
            summary.hasTransactionRequest = typeof p.transactionRequest === 'function';
            summary.hasSignatureRequest = typeof p.signatureRequest === 'function';
        } catch {
            summary.hasAuthenticationRequest = false;
            summary.hasTransactionRequest = false;
            summary.hasSignatureRequest = false;
        }
        return summary;
    };

    return {
        isStacksWalletInstalled: (() => {
            try {
                return Connect.isStacksWalletInstalled();
            } catch {
                return false;
            }
        })(),
        selectedProviderId: getSelectedProviderId(),
        connectLocalStorage: getLocalStorageJsonSummary('@stacks/connect'),
        blockstackSessionLocalStorage: getLocalStorageJsonSummary('blockstack-session'),
        registeredProviders: (() => {
            try {
                const arr = window.webbtc_stx_providers;
                if (!Array.isArray(arr)) return null;
                return arr.map(p => ({ id: p?.id || null, name: p?.name || null, webUrl: p?.webUrl || null })).slice(0, 20);
            } catch {
                return null;
            }
        })(),
        candidates: {
            Connect_getStacksProvider: summarize(candidates.Connect_getStacksProvider),
            window_StacksProvider: summarize(candidates.window_StacksProvider),
            window_BlockstackProvider: summarize(candidates.window_BlockstackProvider),
            window_XverseProviders: summarize(candidates.window_XverseProviders),
        },
    };
};

const dumpAuthDebug = async (reason) => {
    if (!isAuthDebugEnabled()) return;
    let manifestCheck = null;
    try {
        const res = await fetch(CONNECT_AUTH_DEFAULTS.manifestPath, { cache: 'no-store' });
        manifestCheck = { ok: res.ok, status: res.status, contentType: res.headers.get('content-type') };
    } catch (e) {
        manifestCheck = { ok: false, error: e?.message || String(e) };
    }

    const signedIn = userSession.isUserSignedIn();
    const pending = userSession.isSignInPending();

    const debug = {
        reason,
        origin: window.location.origin,
        href: window.location.href,
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus?.() ?? null,
        userAgent: navigator.userAgent,
        connectDefaults: CONNECT_AUTH_DEFAULTS,
        manifestCheck,
        provider: getProviderSummary(),
        session: {
            isUserSignedIn: signedIn,
            isSignInPending: pending,
            hasUserData: (() => {
                try {
                    return Boolean(userSession.loadUserData());
                } catch {
                    return false;
                }
            })(),
            stxAddress: (() => {
                try {
                    const ud = userSession.loadUserData();
                    return ud?.profile?.stxAddress || null;
                } catch {
                    return null;
                }
            })(),
        },
        localStorageKeys: listInterestingStorageKeys(),
    };

    journeyLog('AUTH DEBUG DUMP', debug);
};

const installGlobalErrorLogging = () => {
    if (window.__authDebugInstalled) return;
    window.__authDebugInstalled = true;

    window.__lastConnectAuthError = null;

    const originalError = console.error.bind(console);
    console.error = (...args) => {
        originalError(...args);
        try {
            if (typeof args?.[0] === 'string' && args[0].includes('[Connect] Error during auth request')) {
                const errObj = args[1];
                window.__lastConnectAuthError = {
                    message: errObj?.message || String(errObj),
                    name: errObj?.name || null,
                };
            }
        } catch {
            // ignore
        }
        if (isAuthDebugEnabled()) journeyLog('[console.error]', { args: safeSerialize(args) });
    };

    const originalWarn = console.warn.bind(console);
    console.warn = (...args) => {
        originalWarn(...args);
        if (isAuthDebugEnabled()) journeyLog('[console.warn]', { args: safeSerialize(args) });
    };

    window.addEventListener('error', (ev) => {
        if (!isAuthDebugEnabled()) return;
        journeyLog('[window.error]', {
            message: ev.message,
            filename: ev.filename,
            lineno: ev.lineno,
            colno: ev.colno,
            error: ev.error ? safeSerialize(ev.error) : null,
        });
    });

    window.addEventListener('unhandledrejection', (ev) => {
        if (!isAuthDebugEnabled()) return;
        journeyLog('[unhandledrejection]', { reason: safeSerialize(ev.reason) });
    });

    window.addEventListener('message', (ev) => {
        if (!isAuthDebugEnabled()) return;
        // Avoid dumping giant payloads; just show origin and a short summary.
        const dataSummary =
            typeof ev.data === 'string'
                ? ev.data.slice(0, 300)
                : safeSerialize(ev.data, 600);
        journeyLog('[window.message]', { origin: ev.origin, data: dataSummary });
    });

    window.addEventListener('focus', () => void dumpAuthDebug('window.focus'));
    window.addEventListener('blur', () => void dumpAuthDebug('window.blur'));
    document.addEventListener('visibilitychange', () => void dumpAuthDebug('visibilitychange'));
    window.addEventListener('storage', (e) => {
        if (!isAuthDebugEnabled()) return;
        if (!e.key) return;
        if (!/(connect|blockstack|stacks|auth|xverse|hiro|leather)/i.test(e.key)) return;
        journeyLog('[storage]', { key: e.key, newValue: (e.newValue || '').slice(0, 200) });
    });
};

journeyLog("App loading...");

const appConfig = new Connect.AppConfig(['store_write', 'publish_data']);
const userSession = new Connect.UserSession({ appConfig });
const network = new StacksTestnet({ url: 'https://api.testnet.hiro.so' });

journeyLog("Network configured", { url: network.coreApiUrl });

// AUTH STATUS UI
const setAuthStatus = (message, tone = 'info') => {
    const el = document.getElementById('auth-status');
    if (!el) return;
    el.className = `status ${tone}`;
    el.innerText = message || '';
};

// MINT UI HELPERS
const MICROSTX_PER_STX = 1_000_000;
const getFeePerTxMicroStx = () => {
    const el = document.getElementById('fee-per-tx');
    const raw = el ? Number(el.value) : NaN;
    // Default to 100,000 microSTX (0.1 STX) to ensure reliability on testnet/mainnet
    const fee = Number.isFinite(raw) && raw >= 1000 ? Math.floor(raw) : 100_000;
    return fee;
};
const isSafeModeEnabled = () => Boolean(document.getElementById('toggle-safe-mode')?.checked);
const formatMicroStx = (micro) => `${(micro / MICROSTX_PER_STX).toFixed(6)} STX`;
const formatInt = (n) => new Intl.NumberFormat().format(n);

// MINT PREVIEW SETTINGS
// NOTE: HTML preview can execute scripts; keep this enabled for local/dev only.
// Before public launch, set `enabled` to false (or tighten `sandbox`).
const MINT_HTML_PREVIEW = {
    enabled: true,
    sandbox: 'allow-scripts allow-same-origin',
};

let currentFileMeta = { name: null, size: 0 };
let lastInscriptionId = null;
let networkFeeRateMicroPerByte = null;
let mainnetFeeRateMicroPerByte = null;
let lastFeeRateFetch = { current: null, mainnet: null };

const MAINNET_CORE_API_CANDIDATES = [
    'https://api.hiro.so',
    'https://api.mainnet.hiro.so',
];

const renderMintGuidance = () => {
    const el = document.getElementById('mint-guidance');
    if (!el) return;
    el.innerText =
        'Large inscriptions require many sequential wallet signatures. Keep the wallet open, avoid refreshing, and consider smaller files if you see wallet “internal error” or repeated cancels. If interrupted, use Resume with the Inscription ID.';
};

const estimateTxCounts = (chunkCount, missingCount = null) => {
    const begin = missingCount === null ? 1 : 0; // resume assumes begin already happened
    const uploads = missingCount === null ? chunkCount : missingCount;
    const seal = 1;
    const total = begin + uploads + seal;
    return { begin, uploads, seal, total };
};

const estimateTxBytes = {
    begin: 380,
    seal: 420,
    addChunk: (chunkLen) => 520 + chunkLen, // overhead + raw bytes (rough)
};

const extractFeeRate = (data) => {
    if (data === null || data === undefined) return null;
    if (typeof data === 'number') return Number.isFinite(data) ? data : null;
    if (typeof data === 'string') {
        const n = Number(data);
        return Number.isFinite(n) ? n : null;
    }
    if (Array.isArray(data)) {
        // Some APIs may return an array of estimations.
        const rates = data
            .map(extractFeeRate)
            .filter((n) => Number.isFinite(n) && n > 0);
        return rates.length ? Math.max(...rates) : null;
    }
    if (typeof data === 'object') {
        const direct =
            data.fee_rate ??
            data.feeRate ??
            data.fee_rate_per_byte ??
            data.feeRatePerByte ??
            null;
        const directParsed = extractFeeRate(direct);
        if (directParsed) return directParsed;

        // Some fee endpoints return an `estimations` array.
        if (Array.isArray(data.estimations)) {
            const rates = data.estimations
                .map((e) => extractFeeRate(e?.fee_rate ?? e?.feeRate ?? e))
                .filter((n) => Number.isFinite(n) && n > 0);
            return rates.length ? Math.max(...rates) : null;
        }
    }
    return null;
};

const fetchFeeRateFromBaseUrl = async (baseUrl) => {
    const url = `${baseUrl}/v2/fees/transfer`;
    const res = await fetch(url, { cache: 'no-store', redirect: 'follow' });
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch {
        parsed = null;
    }
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${url} (${contentType || 'unknown content-type'})`);
    }
    const rate = extractFeeRate(parsed);
    if (!Number.isFinite(rate) || rate <= 0) {
        const preview = text ? text.slice(0, 200) : '';
        throw new Error(`Unrecognized fee response from ${url}: ${preview}`);
    }
    return rate;
};

const fetchFeeRateWithFallback = async (label, baseUrls) => {
    let lastErr = null;
    for (const baseUrl of baseUrls) {
        try {
            const rate = await fetchFeeRateFromBaseUrl(baseUrl);
            return { baseUrl, rate };
        } catch (e) {
            lastErr = e;
            journeyLog('Fee rate source failed', { label, baseUrl, error: e?.message || String(e) });
        }
    }
    throw lastErr || new Error(`Fee rate unavailable (${label})`);
};

const renderFeeEstimates = (context = { mode: 'mint', missingCount: null }) => {
    const el = document.getElementById('fee-estimates');
    if (!el) return;

    const feePerTx = getFeePerTxMicroStx();
    const { total } = estimateTxCounts(currentChunks.length, context.missingCount);
    const fixedTotal = feePerTx * total;
    const hasFile = currentChunks.length > 0;

    const updatedAgo = (t) => {
        if (!t) return null;
        const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
        return sec < 60 ? `${sec}s` : `${Math.round(sec / 60)}m`;
    };

    let feeRateLine = hasFile
        ? 'Current network fee-rate estimate: not loaded (click “Fetch Fee Rates”)'
        : 'Select a file to see per-file fee estimates.';
    if (Number.isFinite(networkFeeRateMicroPerByte) && networkFeeRateMicroPerByte > 0) {
        const bytesUploads = (context.missingCount === null)
            ? currentChunks.reduce((sum, c) => sum + estimateTxBytes.addChunk(c.length), 0)
            : null; // computed in resume UI where we know missing indices
        const bytesBegin = context.missingCount === null ? estimateTxBytes.begin : 0;
        const bytesSeal = estimateTxBytes.seal;
        const bytesTotal = bytesUploads !== null ? (bytesBegin + bytesUploads + bytesSeal) : null;
        if (bytesTotal !== null) {
            const micro = Math.ceil(bytesTotal * networkFeeRateMicroPerByte);
            feeRateLine = `Current network fee-rate estimate: ${formatMicroStx(micro)} (rate ${networkFeeRateMicroPerByte} microSTX/byte${lastFeeRateFetch.current ? `, updated ${updatedAgo(lastFeeRateFetch.current)} ago` : ''})`;
        } else {
            feeRateLine = `Current network fee-rate loaded: ${networkFeeRateMicroPerByte} microSTX/byte${lastFeeRateFetch.current ? ` (updated ${updatedAgo(lastFeeRateFetch.current)} ago)` : ''}`;
        }
    }

    let mainnetFeeLine = hasFile ? 'Mainnet fee-rate estimate: not loaded' : '';
    if (Number.isFinite(mainnetFeeRateMicroPerByte) && mainnetFeeRateMicroPerByte > 0) {
        let src = null;
        try {
            src = localStorage.getItem('fee-rate:mainnetSource');
        } catch {
            src = null;
        }
        const bytesUploads = (context.missingCount === null)
            ? currentChunks.reduce((sum, c) => sum + estimateTxBytes.addChunk(c.length), 0)
            : null;
        const bytesBegin = context.missingCount === null ? estimateTxBytes.begin : 0;
        const bytesSeal = estimateTxBytes.seal;
        const bytesTotal = bytesUploads !== null ? (bytesBegin + bytesUploads + bytesSeal) : null;
        if (bytesTotal !== null) {
            const micro = Math.ceil(bytesTotal * mainnetFeeRateMicroPerByte);
            mainnetFeeLine = `Mainnet fee-rate estimate: ${formatMicroStx(micro)} (rate ${mainnetFeeRateMicroPerByte} microSTX/byte${src ? `, source ${src}` : ''}${lastFeeRateFetch.mainnet ? `, updated ${updatedAgo(lastFeeRateFetch.mainnet)} ago` : ''})`;
        } else {
            mainnetFeeLine = `Mainnet fee-rate loaded: ${mainnetFeeRateMicroPerByte} microSTX/byte${src ? ` (source ${src})` : ''}${lastFeeRateFetch.mainnet ? ` (updated ${updatedAgo(lastFeeRateFetch.mainnet)} ago)` : ''}`;
        }
    }

    el.innerHTML = `
        <div><strong>Transactions required:</strong> ~${formatInt(total)} (${context.missingCount === null ? 'begin + chunks + seal' : 'missing chunks + seal'})</div>
        <div><strong>Configured fee/tx:</strong> ${formatMicroStx(feePerTx)} (${formatInt(feePerTx)} microSTX)</div>
        <div><strong>Configured total:</strong> ${formatMicroStx(fixedTotal)} for ~${formatInt(total)} tx</div>
        <div>${feeRateLine}</div>
        ${mainnetFeeLine ? `<div>${mainnetFeeLine}</div>` : ''}
    `;
};

const maybeFetchFeeRates = async ({ maxAgeMs = 60_000 } = {}) => {
    const now = Date.now();
    const currentAge = lastFeeRateFetch.current ? now - lastFeeRateFetch.current : Infinity;
    const mainnetAge = lastFeeRateFetch.mainnet ? now - lastFeeRateFetch.mainnet : Infinity;
    const shouldFetch =
        currentAge > maxAgeMs ||
        mainnetAge > maxAgeMs ||
        !Number.isFinite(networkFeeRateMicroPerByte) ||
        !Number.isFinite(mainnetFeeRateMicroPerByte);
    if (!shouldFetch) return false;

    try {
        const current = await fetchFeeRateWithFallback('current', [network.coreApiUrl]);
        const mainnet = await fetchFeeRateWithFallback('mainnet', MAINNET_CORE_API_CANDIDATES);

        networkFeeRateMicroPerByte = current.rate;
        mainnetFeeRateMicroPerByte = mainnet.rate;
        lastFeeRateFetch = { current: now, mainnet: now };
        try {
            localStorage.setItem('fee-rate:lastFetch', JSON.stringify(lastFeeRateFetch));
            localStorage.setItem('fee-rate:current', String(current.rate));
            localStorage.setItem('fee-rate:mainnet', String(mainnet.rate));
            localStorage.setItem('fee-rate:mainnetSource', mainnet.baseUrl);
        } catch {
            // ignore
        }
        journeyLog('Fee rates auto-updated', {
            currentNetwork: { baseUrl: current.baseUrl, microSTXPerByte: current.rate },
            mainnet: { baseUrl: mainnet.baseUrl, microSTXPerByte: mainnet.rate },
        });
        return true;
    } catch (e) {
        journeyLog('Fee rates auto-update failed', { error: e?.message || String(e) });
        return false;
    }
};

const renderMintProgress = (msg) => {
    const el = document.getElementById('mint-progress');
    if (!el) return;
    el.innerHTML = msg || '';
};

const getErrorMessage = (e) => {
    if (!e) return 'Unknown error';
    if (typeof e === 'string') return e;
    if (e instanceof Error) return e.message || e.name || 'Error';
    try {
        return JSON.stringify(e);
    } catch {
        return String(e);
    }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callReadOnlyFunctionWithRetry(opts, { retries = 3, baseDelayMs = 400 } = {}) {
    const { callReadOnlyFunction } = await getStacksTx();
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await callReadOnlyFunction(opts);
        } catch (e) {
            lastErr = e;
            const msg = getErrorMessage(e);
            journeyLog('Read-only call failed', { attempt, error: msg, functionName: opts.functionName });
            if (attempt >= retries) break;
            const delay = baseDelayMs * Math.pow(2, attempt);
            await sleep(delay);
        }
    }
    throw lastErr || new Error('Read-only call failed');
}

const persistLastInscription = (id) => {
    lastInscriptionId = id;
    try {
        localStorage.setItem('last-inscription-id', String(id));
    } catch {
        // ignore
    }
};

const restoreLastInscription = () => {
    try {
        const raw = localStorage.getItem('last-inscription-id');
        if (!raw) return null;
        const id = Number(raw);
        return Number.isFinite(id) ? id : null;
    } catch {
        return null;
    }
};

const CONNECT_AUTH_DEFAULTS = {
    redirectTo: '/',
    manifestPath: '/manifest.json',
};

async function checkManifestAvailable() {
    try {
        const res = await fetch(CONNECT_AUTH_DEFAULTS.manifestPath, { cache: 'no-store' });
        if (!res.ok) return false;
        const json = await res.json();
        return Boolean(json && typeof json === 'object');
    } catch {
        return false;
    }
}

// CONTRACT CONFIG
const getContractDetails = () => {
    const input = document.getElementById('contract-address-input').value.replace(/\s/g, ''); 
    const parts = input.split('.');
    if (parts.length !== 2) {
        journeyLog("ERROR: Invalid contract address format", { input });
        throw new Error("Invalid Address Format. Expected: ADDRESS.CONTRACT_NAME");
    }
    const details = { address: parts[0], name: parts[1] };
    journeyLog("Contract details parsed", details);
    return details;
};

const CONTRACT_SOURCE = `
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-SEALED (err u101))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-INVALID-CHUNK (err u103))
(define-constant MAX-CHUNK-SIZE u8192)

(define-data-var next-id uint u0)

(define-map Inscriptions
    uint 
    {
        owner: principal,
        mime-type: (string-ascii 64),
        total-size: uint,
        chunk-count: uint,
        sealed: bool,
        merkle-root: (buff 32),
        data-hash: (buff 32)
    }
)

(define-map PendingInscriptions
    { hash: (buff 32), owner: principal }
    {
        mime-type: (string-ascii 64),
        total-size: uint,
        chunk-count: uint
    }
)

(define-map Chunks { context: (buff 32), index: uint } (buff 8192))

(define-public (begin-inscription (hash (buff 32)) (mime (string-ascii 64)) (total-size uint) (chunk-count uint))
    (begin
        (map-set PendingInscriptions { hash: hash, owner: tx-sender } {
            mime-type: mime,
            total-size: total-size,
            chunk-count: chunk-count
        })
        (ok true)
    ))

(define-public (add-chunk (hash (buff 32)) (index uint) (data (buff 8192)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND)))
        (asserts! (< index (get chunk-count meta)) ERR-INVALID-CHUNK)
        (map-set Chunks { context: hash, index: index } data)
        (ok true)))

(define-public (seal-inscription (hash (buff 32)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND))
          (id (var-get next-id)))
        (map-insert Inscriptions id {
            owner: tx-sender,
            mime-type: (get mime-type meta),
            total-size: (get total-size meta),
            chunk-count: (get chunk-count meta),
            sealed: true,
            merkle-root: hash,
            data-hash: hash
        })
        (map-delete PendingInscriptions { hash: hash, owner: tx-sender })
        (var-set next-id (+ id u1))
        (ok id)))

(define-read-only (get-inscription (id uint)) (map-get? Inscriptions id))

(define-read-only (get-chunk (id uint) (index uint)) 
    (let ((meta (map-get? Inscriptions id)))
        (match meta
            m (map-get? Chunks { context: (get data-hash m), index: index })
            none)))

(define-read-only (get-pending-inscription (hash (buff 32)) (owner principal))
    (map-get? PendingInscriptions { hash: hash, owner: owner }))

(define-read-only (get-pending-chunk (hash (buff 32)) (index uint))
    (map-get? Chunks { context: hash, index: index }))
`;

let currentChunks = [];
let currentRoot = null;
let currentMimeType = "application/octet-stream";
let currentFileObjectUrl = null;

renderMintGuidance();
renderFeeEstimates();

function setMintFilePanelVisible(visible) {
    const panel = document.getElementById('mint-file-panel');
    if (!panel) return;
    panel.classList.toggle('hidden', !visible);
}

function clearMintFilePreview() {
    const el = document.getElementById('mint-file-preview');
    if (el) el.innerHTML = '';
    const stats = document.getElementById('mint-file-stats');
    if (stats) stats.innerHTML = '';
    setMintFilePanelVisible(false);
    if (currentFileObjectUrl) {
        try {
            URL.revokeObjectURL(currentFileObjectUrl);
        } catch {
            // ignore
        }
        currentFileObjectUrl = null;
    }
}

function computeMintByteEstimate({ missingIndices = null, includeBegin = true } = {}) {
    const bytesBegin = includeBegin ? estimateTxBytes.begin : 0;
    const bytesSeal = estimateTxBytes.seal;
    const chunks = missingIndices ? missingIndices.map((i) => currentChunks[i]).filter(Boolean) : currentChunks;
    const bytesUploads = chunks.reduce((sum, c) => sum + estimateTxBytes.addChunk(c.length), 0);
    return { bytesBegin, bytesUploads, bytesSeal, bytesTotal: bytesBegin + bytesUploads + bytesSeal };
}

async function checkPendingStatus(root) {
    if (!userSession.isUserSignedIn()) return null;
    const stacksTx = await getStacksTx();
    console.log("DEBUG checkPendingStatus stacksTx:", Object.keys(stacksTx));
    const { bufferCV, standardPrincipalCV, cvToValue } = stacksTx;
    const { address, name } = getContractDetails();
    const stxAddress = userSession.loadUserData().profile.stxAddress.testnet || userSession.loadUserData().profile.stxAddress.mainnet;
    
    try {
        const res = await callReadOnlyFunctionWithRetry({
            contractAddress: address,
            contractName: name,
            functionName: 'get-pending-inscription',
            functionArgs: [ bufferCV(root), standardPrincipalCV(stxAddress) ],
            senderAddress: stxAddress,
            network
        });
        const meta = cvToValue(res);
        // cvToValue returns the JS object (or null for none).
        return meta; 
    } catch (e) {
        console.error("Error checking pending status:", e);
        return null;
    }
}

async function renderMintFileStats(pendingMeta = null) {
    const statsEl = document.getElementById('mint-file-stats');
    if (!statsEl) return;
    if (!currentFileMeta?.name || !currentChunks.length || !currentRoot) {
        statsEl.innerHTML = '';
        return;
    }
    const { bufToHex } = await getMerkle();

    const chunkCount = currentChunks.length;
    const lastChunkSize = currentChunks[currentChunks.length - 1]?.length ?? 0;
    // If pending, 'begin' tx is already done (or we assume it is if checking pending)
    // But wait, if pendingMeta exists, the 'begin' is done.
    const missingCount = pendingMeta ? null : chunkCount; // For estimation display, we simplify
    // We should probably check ACTUAL missing chunks if pendingMeta is true.
    // But for now, let's just show standard estimate or modified one.
    
    const { total } = estimateTxCounts(chunkCount, pendingMeta ? 0 : null); 
    // If pending, assume all chunks uploaded? No, we don't know yet without scanning.
    // So let's show "Scanning..." or just standard total.
    
    const configuredFeePerTx = getFeePerTxMicroStx();
    const configuredTotal = configuredFeePerTx * total;
    const rootHex = `0x${bufToHex(currentRoot)}`;
    const bytesEstimate = computeMintByteEstimate({ includeBegin: !pendingMeta }).bytesTotal;

    const costAtRate = (rate) => {
        if (!Number.isFinite(rate) || rate <= 0) return null;
        return Math.ceil(bytesEstimate * rate);
    };

    const currentRateCost = costAtRate(networkFeeRateMicroPerByte);
    const mainnetRateCost = costAtRate(mainnetFeeRateMicroPerByte);

    const stxAddress = (() => {
        try {
            const ud = userSession.loadUserData();
            return ud?.profile?.stxAddress?.testnet || ud?.profile?.stxAddress?.mainnet || null;
        } catch {
            return null;
        }
    })();
    
    let statusHtml = '';
    if (pendingMeta) {
        statusHtml = `<div class="k" style="color:blue">Status</div><div class="v" style="color:blue; font-weight:bold;">Pending Inscription Found</div>`;
    }

    statsEl.innerHTML = `
        <div class="k">File</div><div class="v">${currentFileMeta.name}</div>
        <div class="k">MIME</div><div class="v">${currentMimeType || 'unknown'}</div>
        <div class="k">Size</div><div class="v">${formatInt(currentFileMeta.size)} bytes</div>
        <div class="k">Chunks</div><div class="v">${formatInt(chunkCount)} (8192 bytes max, last ${formatInt(lastChunkSize)} bytes)</div>
        <div class="k">Merkle root</div><div class="v">${rootHex}</div>
        ${statusHtml}
        <div class="k">Tx required</div><div class="v">~${formatInt(total)} (rough estimate)</div>
        <div class="k">Safe mode</div><div class="v">${isSafeModeEnabled() ? 'ON (waits for confirmation)' : 'OFF (faster, more resume risk)'}</div>
        <div class="k">Configured fee/tx</div><div class="v">${formatMicroStx(configuredFeePerTx)} (${formatInt(configuredFeePerTx)} microSTX)</div>
        <div class="k">Configured total</div><div class="v">${formatMicroStx(configuredTotal)} for ~${formatInt(total)} tx</div>
        <div class="k">Est. tx bytes</div><div class="v">~${formatInt(bytesEstimate)} bytes (rough)</div>
        <div class="k">Current fee-rate total</div><div class="v">${currentRateCost !== null ? `${formatMicroStx(currentRateCost)} (rate ${networkFeeRateMicroPerByte} microSTX/byte)` : 'not loaded (Fetch Fee Rates)'}</div>
        <div class="k">Mainnet fee-rate total</div><div class="v">${mainnetRateCost !== null ? `${formatMicroStx(mainnetRateCost)} (rate ${mainnetFeeRateMicroPerByte} microSTX/byte)` : 'not loaded (Fetch Fee Rates)'}</div>
        <div class="k">Signer</div><div class="v">${stxAddress ? stxAddress : 'Not connected'}</div>
    `;
}

function renderMintFilePreview(file) {
    const previewEl = document.getElementById('mint-file-preview');
    if (!previewEl) return;
    previewEl.innerHTML = '';

    if (currentFileObjectUrl) {
        try {
            URL.revokeObjectURL(currentFileObjectUrl);
        } catch {
            // ignore
        }
        currentFileObjectUrl = null;
    }
    try {
        currentFileObjectUrl = URL.createObjectURL(file);
    } catch {
        currentFileObjectUrl = null;
    }

    const mime = file.type || currentMimeType || '';
    const lowerName = (file.name || '').toLowerCase();
    const isHtml = mime === 'text/html' || lowerName.endsWith('.html') || lowerName.endsWith('.htm');
    const safeLink = currentFileObjectUrl
        ? `<div style="margin-top:8px; font-size:12px;"><a href="${currentFileObjectUrl}" download="${file.name}">Download / open</a></div>`
        : '';

    if (mime.startsWith('image/') && currentFileObjectUrl) {
        previewEl.innerHTML = `<img src="${currentFileObjectUrl}" alt="preview" style="max-width:100%; height:auto; border-radius:6px;">${safeLink}`;
        return;
    }
    if (mime.startsWith('audio/') && currentFileObjectUrl) {
        previewEl.innerHTML = `<audio controls style="width:100%;" src="${currentFileObjectUrl}"></audio>${safeLink}`;
        return;
    }
    if (mime.startsWith('video/') && currentFileObjectUrl) {
        previewEl.innerHTML = `<video controls style="width:100%; max-height:260px;" src="${currentFileObjectUrl}"></video>${safeLink}`;
        return;
    }

    if (isHtml && currentFileObjectUrl) {
        if (!MINT_HTML_PREVIEW.enabled) {
            previewEl.innerHTML = `
                <div style="font-size:12px; color:#856404;">
                    HTML preview is disabled. Download/open the file instead.
                </div>
                ${safeLink}
            `;
            return;
        }

        const iframe = document.createElement('iframe');
        iframe.src = currentFileObjectUrl;
        iframe.style.width = '100%';
        iframe.style.height = '320px';
        iframe.style.border = '1px solid #eee';
        iframe.style.borderRadius = '6px';
        iframe.setAttribute('sandbox', MINT_HTML_PREVIEW.sandbox);

        const note = document.createElement('div');
        note.style.marginTop = '8px';
        note.style.fontSize = '12px';
        note.style.color = '#555';
        note.innerText = 'HTML preview is rendered in an iframe. Relative assets may not load unless they are bundled inline.';

        previewEl.appendChild(iframe);
        previewEl.appendChild(note);
        if (safeLink) {
            const linkWrap = document.createElement('div');
            linkWrap.innerHTML = safeLink;
            previewEl.appendChild(linkWrap);
        }
        return;
    }

    // Fallback: show basic info + link
    previewEl.innerHTML = `
        <div style="font-size:12px; color:#555;">
            No inline preview for <strong>${mime || 'unknown type'}</strong>.
        </div>
        ${safeLink}
    `;
}

function guessMimeTypeFromName(name) {
    const n = (name || '').toLowerCase();
    if (n.endsWith('.html') || n.endsWith('.htm')) return 'text/html';
    if (n.endsWith('.json')) return 'application/json';
    if (n.endsWith('.txt')) return 'text/plain';
    if (n.endsWith('.svg')) return 'image/svg+xml';
    return null;
}

async function handleSelectedFile(file) {
    if (!file) return;
    const { chunkFile, computeMerkleRoot, bufToHex, getProof } = await getMerkle();
    clearMintFilePreview();
    journeyLog(`File selected: ${file.name} (${file.size} bytes)`);
    currentFileMeta = { name: file.name, size: file.size };
    currentMimeType = file.type || guessMimeTypeFromName(file.name) || "application/octet-stream";
    journeyLog(`Detected MIME: ${currentMimeType}`);
    
    const buf = await file.arrayBuffer();
    journeyLog("File read into ArrayBuffer. Starting chunking...");
    
    currentChunks = chunkFile(buf);
    journeyLog(`File chunked into ${currentChunks.length} pieces.`);
    
    // Fix: Ensure root is a Buffer/Uint8Array for Stacks.js compatibility
    currentRoot = Buffer.from(computeMerkleRoot(currentChunks));
    journeyLog("Merkle Root calculated", { root: bufToHex(currentRoot) });
    
    let pendingMeta = await checkPendingStatus(currentRoot);
    if (pendingMeta) {
        journeyLog("Pending inscription found!", pendingMeta);
    }
    
    const rootHex = `0x${bufToHex(currentRoot)}`;
    document.getElementById('mint-steps').innerHTML = `File: ${file.name} (${formatInt(file.size)} bytes) | Chunks: ${currentChunks.length} | Root: ${rootHex}`;
    
    const btn = document.getElementById('btn-start-mint');
    if (pendingMeta) {
        btn.innerText = "Resume Inscription";
        btn.classList.add('btn-resume-style'); // Optional styling
    } else {
        btn.innerText = "Begin Inscription";
        btn.classList.remove('btn-resume-style');
    }
    btn.classList.remove('hidden');

    setMintFilePanelVisible(true);
    renderMintFilePreview(file);
    renderMintFileStats(pendingMeta);
    void maybeFetchFeeRates({ maxAgeMs: 60_000 }).then((updated) => {
        if (updated) {
            renderFeeEstimates({ mode: 'mint', missingCount: null });
            renderMintFileStats(pendingMeta);
        }
    });
    renderFeeEstimates({ mode: 'mint', missingCount: null });
}

// UI Logic
window.showPage = (page) => {
    journeyLog(`Switching to page: ${page}`);
    document.querySelectorAll('[id^="page-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`page-${page}`).classList.remove('hidden');

    if (page === 'mint') {
        void maybeFetchFeeRates({ maxAgeMs: 60_000 }).then((updated) => {
            if (updated) renderFeeEstimates({ mode: 'mint', missingCount: null });
        });
    }

    if (page === 'play') {
        // Default to showing the first page of inscriptions.
        void renderGalleryPage(viewerGalleryPage || 0);
    }

    if (page === 'mint' && !userSession.isUserSignedIn()) {
        const mintEl = document.getElementById('mint-steps');
        if (mintEl && !mintEl.innerText.trim()) {
            mintEl.innerHTML = `
                <div style="background:#fff3cd; padding:10px; border-radius:5px; color:#856404;">
                    Connect your wallet to inscribe. Viewing inscriptions works without a wallet.
                </div>
            `;
        }
    }
};

const updateUI = () => {
    const signedIn = userSession.isUserSignedIn();
    journeyLog(`Updating UI. User signed in: ${signedIn}`);
    if (signedIn) {
        const userData = userSession.loadUserData();
        const addr = userData?.profile?.stxAddress?.testnet || userData?.profile?.stxAddress?.mainnet || 'Unknown address';
        journeyLog(`User address: ${addr}`);
        document.getElementById('address-display').innerText = `Connected: ${addr}`;
        document.getElementById('connect-wallet').classList.add('hidden');
        document.getElementById('disconnect-wallet').classList.remove('hidden');
        setAuthStatus('Wallet connected. You can deploy and inscribe.', 'ok');
    } else {
        document.getElementById('address-display').innerText = '';
        document.getElementById('connect-wallet').classList.remove('hidden');
        document.getElementById('disconnect-wallet').classList.add('hidden');
        setAuthStatus('Not connected. Viewing works without a wallet, but deploying and inscribing require connecting.', 'info');
    }
};

// INITIALIZE AUTH + UI
async function initAuthAndUI() {
    installGlobalErrorLogging();

    // Restore persisted fee setting (if any)
    try {
        const storedFee = localStorage.getItem('fee-per-tx');
        const el = document.getElementById('fee-per-tx');
        if (el) {
            let n = storedFee ? Number(storedFee) : 100000;
            if (!Number.isFinite(n) || n < 1000) n = 100000; // Enforce safe minimum
            el.value = String(Math.floor(n));
        }
    } catch {
        // ignore
    }

    // Restore cached fee rates (if any) so Mint estimates show something immediately.
    try {
        const currentRate = Number(localStorage.getItem('fee-rate:current'));
        const mainnetRate = Number(localStorage.getItem('fee-rate:mainnet'));
        const lastFetchRaw = localStorage.getItem('fee-rate:lastFetch');
        const lastFetch = lastFetchRaw ? JSON.parse(lastFetchRaw) : null;
        if (Number.isFinite(currentRate) && currentRate > 0) networkFeeRateMicroPerByte = currentRate;
        if (Number.isFinite(mainnetRate) && mainnetRate > 0) mainnetFeeRateMicroPerByte = mainnetRate;
        if (lastFetch && typeof lastFetch === 'object') lastFeeRateFetch = lastFetch;
    } catch {
        // ignore
    }

    const stacksWalletInstalled = Connect.isStacksWalletInstalled();
    if (!stacksWalletInstalled) {
        setAuthStatus(
            'No Stacks wallet provider detected in this browser. Install Xverse (extension) or Leather, then refresh. Logging into a web wallet alone does not connect to this app.',
            'warn'
        );
    }

    const manifestOk = await checkManifestAvailable();
    if (!manifestOk) {
        setAuthStatus(
            'Missing `/manifest.json`. Wallet authentication will fail until it is available at the site root.',
            'error'
        );
    }

    await dumpAuthDebug('init');

    if (userSession.isSignInPending()) {
        journeyLog("Auth sign-in pending. Completing...");
        setAuthStatus('Completing wallet sign-in...', 'info');
        try {
            await userSession.handlePendingSignIn();
            journeyLog("Auth pending sign-in completed.");
        } catch (e) {
            journeyLog("Auth pending sign-in failed", { error: e?.message || String(e) });
            setAuthStatus('Sign-in failed. Please try connecting your wallet again.', 'error');
        }
    }
    updateUI();
}
void initAuthAndUI();

// AUTH HANDLERS
document.getElementById('connect-wallet').addEventListener('click', () => {
    journeyLog("User clicked 'Connect Wallet'");
    setAuthStatus('Opening wallet connect...', 'info');
    void dumpAuthDebug('connect click (before showConnect)');

    // If a stale/invalid selected provider is stored, force the modal to re-select.
    try {
        const provider = Connect.getStacksProvider?.();
        const hasAuth = provider && typeof provider.authenticationRequest === 'function';
        const selectedId = getSelectedProviderId();
        if (selectedId && !hasAuth) {
            journeyLog('Auth debug: selected provider is missing authenticationRequest; clearing STX_PROVIDER to force reselection.', {
                selectedProviderId: selectedId,
                providerKeys: provider ? Object.keys(provider).slice(0, 20) : null,
            });
            clearSelectedProviderId();
        }
    } catch (e) {
        journeyLog('Auth debug: provider inspection failed', { error: e?.message || String(e) });
    }

    // Prefer using the detected provider directly; if missing, let Connect UI pick.
    let provider = null;
    try {
        provider = Connect.getStacksProvider?.() || null;
        if (provider && isAuthDebugEnabled()) {
            provider = wrapProviderForDebug(provider, 'StacksProvider');
        }
    } catch (e) {
        journeyLog('Auth debug: failed to acquire provider for showConnect', { error: e?.message || String(e) });
        provider = null;
    }

    const connectOptions = {
        ...CONNECT_AUTH_DEFAULTS,
        appDetails: { name: 'Stacks Inscription Proto', icon: window.location.origin + '/vite.svg' },
        userSession,
        onFinish: () => {
            journeyLog("Auth onFinish triggered");
            updateUI();
            void dumpAuthDebug('connect onFinish');
        },
        onCancel: () => {
            journeyLog("Auth onCancel triggered");
            const lastErr = window.__lastConnectAuthError;
            if (lastErr?.message) {
                setAuthStatus(`Wallet connect failed: ${lastErr.message}`, 'error');
            } else {
                setAuthStatus('Wallet connection canceled. Connect to deploy or inscribe.', 'warn');
            }
            void dumpAuthDebug('connect onCancel');
        }
    };

    if (provider) Connect.showConnect(connectOptions, provider);
    else Connect.showConnect(connectOptions);
});

document.getElementById('disconnect-wallet').addEventListener('click', () => {
    journeyLog("User clicked 'Disconnect Wallet'");
    userSession.signUserOut();
    updateUI();
    setAuthStatus('Disconnected.', 'info');
});

const ensureAuth = async ({ action } = {}) => {
    journeyLog("Ensuring auth before action...", { action: action || 'unknown' });
    if (userSession.isUserSignedIn()) {
        journeyLog("Auth verified.");
        return;
    }

    void dumpAuthDebug(`ensureAuth start (${action || 'unknown'})`);

    if (!Connect.isStacksWalletInstalled()) {
        setAuthStatus(
            action
                ? `Wallet provider not detected. Install Xverse (extension) or Leather to ${action}, then refresh.`
                : 'Wallet provider not detected. Install Xverse (extension) or Leather, then refresh.',
            'warn'
        );
    }

    setAuthStatus(action ? `Connect your wallet to ${action}.` : 'Connect your wallet to continue.', 'warn');
    journeyLog("Auth missing. Redirecting to connect...");

    return new Promise((resolve, reject) => {
        Connect.showConnect({
            ...CONNECT_AUTH_DEFAULTS,
            appDetails: { name: 'Stacks Inscription Proto', icon: window.location.origin + '/vite.svg' },
            userSession,
            onFinish: () => {
                journeyLog("Auth onFinish (ensureAuth) triggered");
                updateUI();
                void dumpAuthDebug(`ensureAuth onFinish (${action || 'unknown'})`);
                resolve();
            },
            onCancel: () => {
                journeyLog("Auth onCancel (ensureAuth) triggered");
                const lastErr = window.__lastConnectAuthError;
                if (lastErr?.message) {
                    setAuthStatus(`Wallet connect failed: ${lastErr.message}`, 'error');
                } else {
                    setAuthStatus('Wallet connection canceled. Connect to deploy or inscribe.', 'warn');
                }
                void dumpAuthDebug(`ensureAuth onCancel (${action || 'unknown'})`);
                reject(new Error('Wallet connection canceled'));
            }
        });
    });
};

// OPTIONAL: auth monitor (polls for state transitions)
let authMonitorInterval = null;
let authMonitorLastSnapshot = null;

function getAuthMonitorSnapshot() {
    return {
        isStacksWalletInstalled: (() => {
            try {
                return Connect.isStacksWalletInstalled();
            } catch {
                return false;
            }
        })(),
        hasWindowStacksProvider: Boolean(window.StacksProvider),
        hasWindowBlockstackProvider: Boolean(window.BlockstackProvider),
        isUserSignedIn: userSession.isUserSignedIn(),
        isSignInPending: userSession.isSignInPending(),
        storageKeys: listInterestingStorageKeys(),
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus?.() ?? null,
    };
}

function startAuthMonitor() {
    if (authMonitorInterval) return;
    authMonitorLastSnapshot = null;
    journeyLog('Auth monitor started (polling every 1s).');
    authMonitorInterval = setInterval(() => {
        if (!isAuthDebugEnabled()) return;
        const snap = getAuthMonitorSnapshot();
        const changed = safeSerialize(snap) !== safeSerialize(authMonitorLastSnapshot);
        if (changed) {
            journeyLog('Auth monitor change', snap);
            authMonitorLastSnapshot = snap;
        }
    }, 1000);
}

function stopAuthMonitor() {
    if (!authMonitorInterval) return;
    clearInterval(authMonitorInterval);
    authMonitorInterval = null;
    journeyLog('Auth monitor stopped.');
}

document.getElementById('btn-dump-auth')?.addEventListener('click', () => void dumpAuthDebug('manual dump button'));
document.getElementById('btn-reset-wallet')?.addEventListener('click', () => {
    clearSelectedProviderId();
    journeyLog('Cleared selected wallet provider (STX_PROVIDER).');
    setAuthStatus('Wallet selection reset. Click “Connect Wallet” to choose again.', 'info');
    void dumpAuthDebug('manual reset wallet selection');
});
document.getElementById('btn-toggle-monitor')?.addEventListener('click', (e) => {
    if (!authMonitorInterval) {
        startAuthMonitor();
        e.target.innerText = 'Stop Auth Monitor';
    } else {
        stopAuthMonitor();
        e.target.innerText = 'Start Auth Monitor';
    }
});

// FILE HANDLING
document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await handleSelectedFile(file);
    // Allow re-selecting the same file to trigger change again
    e.target.value = '';
});

// DRAG & DROP
(() => {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;

    const prevent = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
    };

    const setActive = (active) => {
        dropZone.classList.toggle('active', active);
    };

    // Prevent the browser from opening the file if dropped outside the zone
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((name) => {
        window.addEventListener(name, prevent);
        document.addEventListener(name, prevent);
    });

    dropZone.addEventListener('dragenter', () => setActive(true));
    dropZone.addEventListener('dragover', () => setActive(true));
    dropZone.addEventListener('dragleave', () => setActive(false));
    dropZone.addEventListener('drop', async (ev) => {
        setActive(false);
        const file = ev.dataTransfer?.files?.[0];
        if (!file) return;
        journeyLog('File dropped into drop zone.', { name: file.name, size: file.size, type: file.type });
        await handleSelectedFile(file);
    });
})();

document.getElementById('fee-per-tx')?.addEventListener('change', () => {
    try {
        localStorage.setItem('fee-per-tx', String(getFeePerTxMicroStx()));
    } catch {
        // ignore
    }
    renderFeeEstimates({ mode: 'mint', missingCount: null });
    renderMintFileStats();
});

document.getElementById('toggle-safe-mode')?.addEventListener('change', () => {
    renderMintProgress(isSafeModeEnabled()
        ? '<div>Safe mode enabled: waits for each transaction to confirm before continuing.</div>'
        : '<div>Safe mode disabled: proceeds after signing; use Resume if chunks are missing.</div>');
    renderMintFileStats();
});

document.getElementById('btn-fetch-fee-rate')?.addEventListener('click', async () => {
    const now = Date.now();
    try {
        const results = await Promise.allSettled([
            fetchFeeRateWithFallback('current', [network.coreApiUrl]),
            fetchFeeRateWithFallback('mainnet', MAINNET_CORE_API_CANDIDATES),
        ]);

        const [currentRes, mainnetRes] = results;
        let hadAny = false;

        if (currentRes.status === 'fulfilled') {
            networkFeeRateMicroPerByte = currentRes.value.rate;
            hadAny = true;
        } else {
            journeyLog('Fee rate fetch failed (current)', { error: currentRes.reason?.message || String(currentRes.reason) });
        }

        if (mainnetRes.status === 'fulfilled') {
            mainnetFeeRateMicroPerByte = mainnetRes.value.rate;
            hadAny = true;
            try {
                localStorage.setItem('fee-rate:mainnetSource', mainnetRes.value.baseUrl);
            } catch {
                // ignore
            }
        } else {
            journeyLog('Fee rate fetch failed (mainnet)', { error: mainnetRes.reason?.message || String(mainnetRes.reason) });
        }

        lastFeeRateFetch = { current: now, mainnet: now };
        try {
            localStorage.setItem('fee-rate:lastFetch', JSON.stringify(lastFeeRateFetch));
            if (Number.isFinite(networkFeeRateMicroPerByte) && networkFeeRateMicroPerByte > 0) {
                localStorage.setItem('fee-rate:current', String(networkFeeRateMicroPerByte));
            }
            if (Number.isFinite(mainnetFeeRateMicroPerByte) && mainnetFeeRateMicroPerByte > 0) {
                localStorage.setItem('fee-rate:mainnet', String(mainnetFeeRateMicroPerByte));
            }
        } catch {
            // ignore
        }

        if (hadAny) {
            journeyLog('Fee rates loaded', { currentNetwork: networkFeeRateMicroPerByte, mainnet: mainnetFeeRateMicroPerByte });
            renderMintProgress('<div>Fee rates updated (current network and/or mainnet).</div>');
        } else {
            renderMintProgress('<div style="color:#856404">Could not fetch fee rates (current or mainnet). Using configured fee/tx.</div>');
        }

        renderFeeEstimates({ mode: 'mint', missingCount: null });
        renderMintFileStats();
    } catch (e) {
        journeyLog('Fee rate fetch failed', { error: e?.message || String(e) });
        renderMintProgress('<div style="color:#856404">Could not fetch fee rates; using configured fee/tx.</div>');
        renderFeeEstimates({ mode: 'mint', missingCount: null });
        renderMintFileStats();
    }
});

// DEPLOY ACTION
document.getElementById('btn-deploy-contract').addEventListener('click', async () => {
    journeyLog("User clicked 'Deploy Contract'");
    try {
        await ensureAuth({ action: 'deploy the contract' });
    } catch (e) {
        journeyLog("Deploy blocked (auth not completed)", { error: e?.message || String(e) });
        return;
    }

    const { name } = getContractDetails();
    const deployParams = {
        contractName: name,
        codeBody: CONTRACT_SOURCE,
        network,
        userSession,
    };
    journeyLog("Requesting Contract Deploy...", { contractName: name });
    Connect.openContractDeploy({
        ...deployParams,
        onFinish: (data) => {
            journeyLog("Deploy onFinish", data);
            alert(`Contract Deployed! TX: ${data.txId}`);
        },
        onCancel: () => journeyLog("Deploy onCancel")
    });
});

// HELPER: Promisified Contract Call
function openContractCallWrapper(options) {
    return new Promise((resolve, reject) => {
        const fee = options.fee ?? getFeePerTxMicroStx();
        Connect.openContractCall({
            ...options,
            fee, // microSTX
            onFinish: (data) => resolve(data),
            onCancel: () => reject(new Error("User cancelled transaction")),
        });
    });
}

// HELPER: Poll for Transaction Confirmation
async function waitForTransactionSuccess(txId, { timeoutMs = 10 * 60 * 1000, pollMs = 5000 } = {}) {
    journeyLog(`Polling for TX: ${txId}`);
    const apiUrl = network.coreApiUrl; // e.g. https://api.testnet.hiro.so
    
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const interval = setInterval(async () => {
            if (Date.now() - started > timeoutMs) {
                clearInterval(interval);
                reject(new Error(`Timed out waiting for TX confirmation: ${txId}`));
                return;
            }
            try {
                const res = await fetch(`${apiUrl}/extended/v1/tx/${txId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.tx_status === 'success') {
                        clearInterval(interval);
                        resolve(data);
                    } else if (data.tx_status === 'abort_by_response' || data.tx_status === 'abort_by_post_condition') {
                        clearInterval(interval);
                        reject(new Error(`Transaction failed: ${data.tx_status}`));
                    }
                    // If 'pending', continue polling
                }
            } catch (e) {
                console.error("Polling error:", e);
            }
        }, pollMs); // Poll interval
    });
}

// SCAN HELPER
async function scanMissingChunks(hash, expectedCount) {
    const { address, name } = getContractDetails();
    const { bufferCV, uintCV, cvToValue } = await getStacksTx();
    const { bufToHex } = await getMerkle();
    journeyLog("Scanning chunks...", { hash: bufToHex(hash), expectedCount });
    const missing = [];
    // Optimization: Parallelize calls in batches? 
    // For now, sequential to avoid rate limits, but with little delay.
    for (let i = 0; i < expectedCount; i++) {
        if (i > 0 && i % 20 === 0) await sleep(50);
        try {
            const res = await callReadOnlyFunctionWithRetry({
                contractAddress: address,
                contractName: name,
                functionName: 'get-pending-chunk',
                functionArgs: [ bufferCV(hash), uintCV(i) ],
                senderAddress: address,
                network
            });
            const val = cvToValue(res);
            if (!val) missing.push(i);
        } catch (e) {
            console.error(`Error scanning chunk ${i}`, e);
            missing.push(i); // Assume missing if error
        }
    }
    journeyLog(`Scan complete. Missing ${missing.length}/${expectedCount} chunks.`);
    return missing;
}

// THE MINT ACTION
document.getElementById('btn-start-mint').addEventListener('click', async () => {
    journeyLog("User clicked 'Begin / Resume Inscription'");
    if (!currentChunks.length) {
        journeyLog("ABORT: No file chunks available.");
        return alert("Please select a file first.");
    }

    // Load dependencies
    const { bufferCV, stringAsciiCV, uintCV, PostConditionMode, AnchorMode } = await getStacksTx();
    const { bufToHex } = await getMerkle();
    
    const statusEl = document.getElementById('mint-steps');
    try {
        await ensureAuth({ action: 'inscribe a file' });
    } catch (e) {
        journeyLog("Mint blocked (auth not completed)", { error: e?.message || String(e) });
        statusEl.innerHTML += `
            <div style="background:#fff3cd; padding:15px; border-radius:5px; color:#856404; margin-top:10px;">
                <h3 style="margin-top:0">Wallet Required</h3>
                <p>Connect your wallet to start an inscription. You can still view existing inscriptions without connecting.</p>
            </div>
        `;
        return;
    }

    try {
        const { address, name } = getContractDetails();
        const pendingMeta = await checkPendingStatus(currentRoot);
        
        let txCounts;
        let missingIndices = [];
        
        if (pendingMeta) {
             statusEl.innerHTML = `<div style="color:blue">Scanning pending inscription...</div>`;
             missingIndices = await scanMissingChunks(currentRoot, currentChunks.length);
             txCounts = estimateTxCounts(currentChunks.length, missingIndices.length);
        } else {
             txCounts = estimateTxCounts(currentChunks.length);
             missingIndices = Array.from({length: currentChunks.length}, (_, i) => i);
        }

        const feePerTx = getFeePerTxMicroStx();
        renderMintProgress(`
            <div><strong>Mode:</strong> ${pendingMeta ? 'Resuming' : 'Starting Fresh'}</div>
            <div><strong>Expected signatures:</strong> ~${formatInt(txCounts.total)} transactions</div>
            <div><strong>Configured fee:</strong> ${formatMicroStx(feePerTx)} per tx (estimated total ${formatMicroStx(feePerTx * txCounts.total)})</div>
        `);
        
        // Step 1: Reserve Inscription Slot (Only if not pending)
        if (!pendingMeta) {
            statusEl.innerHTML = `
                <div style="background:#eef; padding:15px; border-radius:5px;">
                    <h3 style="margin-top:0">Step 1: Reserve Inscription Slot</h3>
                    <p>Creating "Pending" Inscription on-chain...</p>
                </div>
            `;
            
            const context = currentRoot; // Use root as context for now
            const args = [ 
                bufferCV(currentRoot),
                stringAsciiCV(currentMimeType), 
                uintCV(currentFileMeta?.size || (currentChunks.reduce((sum, c) => sum + c.length, 0))), 
                uintCV(currentChunks.length),
                bufferCV(context)
            ];
            
            const txParams = {
                contractAddress: address,
                contractName: name,
                functionName: 'begin-inscription',
                functionArgs: args,
                network,
                userSession,
                postConditionMode: PostConditionMode.Allow,
                anchorMode: AnchorMode.Any,
            };

            const txData = await openContractCallWrapper(txParams);
            journeyLog(`Initialization TX sent: ${txData.txId}`);

            statusEl.innerHTML = `
                <div style="background:#fff3cd; padding:15px; border-radius:5px; color:#856404;">
                    <h3 style="margin-top:0">Step 1: Confirming...</h3>
                    <p><strong>TX:</strong> ${txData.txId}</p>
                    <p>Waiting for confirmation...</p>
                    <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 20px; height: 20px; animation: spin 2s linear infinite; margin: 0 auto;"></div>
                </div>
            `;

            await waitForTransactionSuccess(txData.txId);
            journeyLog("Initialization Confirmed!");
        }

        statusEl.innerHTML = `
            <div style="background:#d4edda; padding:15px; border-radius:5px; color:#155724;">
                <h3 style="margin-top:0">Step 2: Upload Data</h3>
                <p>Uploading ${missingIndices.length} chunks...</p>
            </div>
        `;

        // 3. Start Chunk Uploads (pass hash)
        if (missingIndices.length > 0) {
            await startChunkUploads(currentRoot, statusEl, missingIndices);
        } else {
            journeyLog("No chunks to upload.");
        }

        // 4. Seal Inscription
        await sealInscriptionTransaction(currentRoot, statusEl);

    } catch (e) {
        journeyLog("Minting Process Error", { error: e.message });
        document.getElementById('mint-steps').innerHTML += `
            <div style="background:#f8d7da; padding:15px; border-radius:5px; color:#721c24; margin-top:10px;">
                <h3>Process Paused / Failed</h3>
                <p>${e.message}</p>
                <p>You can Resume by selecting the file again.</p>
            </div>
        `;
    }
});

// RESUME ACTION - Deprecated/Redirect logic
document.getElementById('btn-resume-mint').addEventListener('click', async () => {
    alert("To resume, simply select your file in the 'Mint / Inscribe' tab. The system will automatically detect the pending inscription.");
    window.showPage('mint');
});

async function sealInscriptionTransaction(hash, statusEl) {
    const { bufferCV, PostConditionMode, AnchorMode } = await getStacksTx();
    const { bufToHex } = await getMerkle();
    const { address, name } = getContractDetails();
    statusEl.innerHTML += `
        <div style="background:#eef; padding:10px; border-radius:5px; margin-top:10px;">
            <h3 style="margin-top:0">Step: Seal & Finalize</h3>
            <p>Signing Seal Transaction...</p>
        </div>
    `;
    
    journeyLog("Sealing inscription...", { hash: bufToHex(hash) });
    const sealTx = await openContractCallWrapper({
        contractAddress: address,
        contractName: name,
        functionName: 'seal-inscription',
        functionArgs: [ bufferCV(hash) ],
        network,
        userSession,
        postConditionMode: PostConditionMode.Allow,
        anchorMode: AnchorMode.Any,
    });
    
    let inscriptionId = null;
    if (sealTx?.txId) {
        statusEl.innerHTML += `<p>Seal TX Sent: ${sealTx.txId}. Waiting for ID...</p>`;
        const txDetails = await waitForTransactionSuccess(sealTx.txId);
        
        if (txDetails.tx_result.repr.includes('(ok u')) {
             const match = txDetails.tx_result.repr.match(/\(ok u(\d+)\)/);
             if (match && match[1]) inscriptionId = parseInt(match[1]);
        }
    }

    if (inscriptionId !== null) {
        persistLastInscription(inscriptionId);
        statusEl.innerHTML += `
            <div style="background:#d4edda; padding:10px; border-radius:5px; color:#155724; margin-top: 10px;">
                <h3 style="margin-top:0">🎉 Inscription #${inscriptionId} Complete!</h3>
                <button onclick="document.getElementById('manifest-id-input').value = ${inscriptionId}; showPage('play');" style="background:#28a745; color:white; border:none; padding:10px; cursor:pointer;">View Inscription</button>
            </div>
        `;
    } else {
        statusEl.innerHTML += `<div style="color:red">Sealed, but could not parse ID. Check explorer.</div>`;
    }
}

async function startChunkUploads(hash, statusEl, specificIndices = null) {
    const { bufToHex, getProof } = await getMerkle();
    journeyLog(`Starting sequential chunk uploads for Hash: ${bufToHex(hash)}`);
    const { address, name } = getContractDetails();
    const { bufferCV, uintCV, PostConditionMode, AnchorMode, listCV, tupleCV, boolCV } = await getStacksTx();
    
    const indicesToUpload = specificIndices || Array.from({length: currentChunks.length}, (_, i) => i);
    const totalToUpload = indicesToUpload.length;

    for (let n = 0; n < indicesToUpload.length; n++) {
        const i = indicesToUpload[n];
        const chunkData = currentChunks[i];
        
        journeyLog(`Preparing Chunk ${i}: size=${chunkData.length}, hash=${bufToHex(hash)}`);
        
        const p = document.createElement('p');
        p.innerText = `Uploading Part ${i} (${n + 1}/${totalToUpload})...`;
        p.style.margin = "5px 0";
        p.style.paddingLeft = "20px";
        statusEl.appendChild(p);

        try {
            // Increase pacing to 1 second to give wallet state time to propagate
            await new Promise(r => setTimeout(r, 1000));
            
            const proof = getProof(currentChunks, i);
            const proofCV = listCV(proof.map(p => tupleCV({
                hash: bufferCV(p.hash),
                "is-left": boolCV(p.isLeft)
            })));

            const tx = await openContractCallWrapper({
                contractAddress: address,
                contractName: name,
                functionName: 'add-chunk',
                functionArgs: [ 
                    bufferCV(new Uint8Array(hash)), 
                    uintCV(i), 
                    bufferCV(new Uint8Array(chunkData)),
                    proofCV
                ],
                network,
                userSession,
                postConditionMode: PostConditionMode.Allow,
                anchorMode: AnchorMode.Any,
            });

            const txId = tx?.txId || null;
            if (txId) {
                journeyLog(`Chunk ${i} TX Sent: ${txId}`);
                p.innerText = `Part ${i} - Sent (${txId.slice(0, 10)}…)`;
            }

            if (txId && isSafeModeEnabled()) {
                await waitForTransactionSuccess(txId);
            }

            p.innerText = `Part ${i} - Confirmed ✓`;
            p.style.color = '#28a745';

        } catch (err) {
            p.innerText = `Part ${i} - Failed ✕`;
            p.style.color = '#dc3545';
            journeyLog(`Chunk ${i} Error`, { error: err.message });
            throw err; 
        }
    }
}
// [END OF FILE ADDITIONS - Now verify integration with existing code]


// PLAYER LOGIC
function playerLog(msg) {
    journeyLog(`Player: ${msg}`);
    const div = document.createElement('div');
    div.innerText = `> ${msg}`;
    document.getElementById('player-log').appendChild(div);
}

async function fetchInscriptionData(id) {
    const { address, name } = getContractDetails();
    journeyLog(`Fetching inscription data for ID: ${id} from ${address}.${name}`);
    const { callReadOnlyFunction, uintCV, cvToValue } = await getStacksTx();
    
    try {
        const metaRes = await callReadOnlyFunction({
            contractAddress: address, contractHash: '', 
            contractName: name, functionName: 'get-inscription',
            functionArgs: [uintCV(id)], senderAddress: address, network
        });
        const meta = cvToValue(metaRes);
        if (!meta) {
            journeyLog(`ERROR: Inscription ${id} not found on-chain.`);
            throw new Error("Not found");
        }

        // DEBUG: Inspect meta structure to fix MIME extraction
        journeyLog("Meta Object:", meta);
        if (meta.value) journeyLog("Meta.value:", meta.value);

        const count = Number(meta.value['chunk-count'].value);
        const totalSize = Number(meta.value['total-size'].value);
        journeyLog(`Inscription found. ID: ${id}, Chunks: ${count}, Size: ${totalSize} bytes`);
        
        const buffers = [];
        for (let i = 0; i < count; i++) {
            journeyLog(`Fetching Chunk ${i}...`);
            const res = await callReadOnlyFunction({
                contractAddress: address, contractName: name,
                functionName: 'get-chunk', functionArgs: [uintCV(id), uintCV(i)],
                senderAddress: address, network
            });
            const val = cvToValue(res);
            
            if (!val) {
                journeyLog(`CRITICAL: Chunk ${i} is missing on-chain.`);
                throw new Error(`Chunk ${i} missing. Inscription incomplete.`);
            }
            
            // Heuristic fix: check where the bytes are
            let bytes;
            if (val instanceof Uint8Array) bytes = val;
            else if (val && val.value) bytes = val.value; // Maybe it didn't unwrap?
            else if (val && val.buffer) bytes = val.buffer; // Maybe it's a Buffer object?
            else bytes = val; // Fallback

            // If it's a hex string (older stacks.js behavior?)
            if (typeof bytes === 'string') {
                if (bytes.startsWith('0x')) bytes = bytes.slice(2);
                const byteArray = new Uint8Array(bytes.length / 2);
                for (let j = 0; j < bytes.length; j += 2) {
                    byteArray[j / 2] = parseInt(bytes.substring(j, j + 2), 16);
                }
                bytes = byteArray;
            }
            
            if (!bytes || !bytes.length) {
                 journeyLog(`CRITICAL: Chunk ${i} data is empty.`);
                 throw new Error(`Chunk ${i} is empty.`);
            }

            buffers.push(bytes);
        }
        journeyLog("All chunks fetched. Reconstructing...");
        const full = new Uint8Array(buffers.reduce((a, b) => a + b.length, 0));
        let offset = 0;
        buffers.forEach(b => { full.set(b, offset); offset += b.length; });
        
        // DEBUG: Log Header
        const header = Array.from(full.slice(0, 16)).map(b => b.toString(16).padStart(2,'0')).join(' ');
        journeyLog(`Downloaded ${full.length} bytes. Header: ${header}`);
        
        // Robust MIME Extraction
        let mimeType = "application/octet-stream";
        try {
            const rawMime = meta.value['mime-type'];
            journeyLog("Raw MIME object:", rawMime);
            if (rawMime) {
                if (typeof rawMime === 'string') mimeType = rawMime;
                else if (rawMime.data) mimeType = rawMime.data;
                else if (rawMime.value) mimeType = rawMime.value;
            }
        } catch (err) {
            journeyLog("Error extracting MIME", err);
        }

        // MIME Sniffing / Correction for legacy/incorrect types
        if (mimeType === 'application/json' || mimeType === 'application/octet-stream') {
             const snifferMime = sniffMimeType(full);
             if (snifferMime) {
                 journeyLog(`MIME Sniffer: Corrected ${mimeType} to ${snifferMime}`);
                 mimeType = snifferMime;
             }
        }
        
        return { data: full, mimeType };
    } catch (e) {
        journeyLog("Fetch Error", { error: e.message });
        throw e;
    }
}

function sniffMimeType(buffer) {
    if (buffer.length < 4) return null;
    const hex = Array.from(buffer.slice(0, 4)).map(b => b.toString(16).padStart(2,'0')).join('').toLowerCase();
    
    // WebM / EBML: 1a 45 df a3
    if (hex === '1a45dfa3') return 'audio/webm';
    
    // WAV: 52 49 46 46 (RIFF)
    if (hex === '52494646') return 'audio/wav';
    
    // PNG: 89 50 4e 47
    if (hex === '89504e47') return 'image/png';
    
    // JPG: ff d8 ff
    if (hex.startsWith('ffd8ff')) return 'image/jpeg';
    
    // GIF: 47 49 46 38
    if (hex === '47494638') return 'image/gif';
    
    // PDF: 25 50 44 46
    if (hex === '25504446') return 'application/pdf';

    return null;
}


// VIEWER CONTROLS
document.getElementById('btn-clear-viewer').addEventListener('click', () => {
    document.getElementById('media-container').innerHTML = '<span style="color: #ccc;">No content loaded</span>';
    document.getElementById('player-log').innerHTML = '';
    journeyLog("Viewer cleared.");
});

// VIEWER GALLERY (16-per-page)
const VIEWER_PAGE_SIZE = 16;
let viewerGalleryPage = 0;
let viewerSelectedId = null;
const inscriptionMetaCache = new Map();

function tryParseMeta(meta) {
    if (!meta) return null;
    const v = meta.value || meta;
    try {
        const sealed = Boolean(v.sealed?.value ?? v.sealed);
        const totalSize = Number(v['total-size']?.value ?? v['total-size'] ?? 0);
        const chunkCount = Number(v['chunk-count']?.value ?? v['chunk-count'] ?? 0);
        const owner = v.owner?.value ?? v.owner ?? null;
        const rawMime = v['mime-type'] ?? null;
        const mime =
            typeof rawMime === 'string'
                ? rawMime
                : rawMime?.value ?? rawMime?.data ?? (rawMime?.type ? String(rawMime.type) : null);
        return { sealed, totalSize, chunkCount, owner, mimeType: mime || 'unknown' };
    } catch {
        return { sealed: false, totalSize: 0, chunkCount: 0, owner: null, mimeType: 'unknown' };
    }
}

async function fetchInscriptionMeta(id) {
    if (inscriptionMetaCache.has(id)) return inscriptionMetaCache.get(id);
    const { address, name } = getContractDetails();
    const { uintCV, cvToValue } = await getStacksTx();
    const res = await callReadOnlyFunctionWithRetry({
        contractAddress: address,
        contractName: name,
        functionName: 'get-inscription',
        functionArgs: [uintCV(id)],
        senderAddress: address,
        network,
    });
    const meta = cvToValue(res);
    const parsed = meta ? tryParseMeta(meta) : null;
    inscriptionMetaCache.set(id, parsed);
    return parsed;
}

function setGalleryStatus(text) {
    const el = document.getElementById('gallery-status');
    if (el) el.innerText = text;
}

function setGallerySelected(id) {
    viewerSelectedId = id;
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;
    grid.querySelectorAll('.gallery-card').forEach((card) => {
        const cid = Number(card.getAttribute('data-id'));
        card.classList.toggle('selected', Number.isFinite(cid) && cid === id);
    });
}

async function renderGalleryPage(page) {
    const grid = document.getElementById('gallery-grid');
    const pageInput = document.getElementById('gallery-page-input');
    if (!grid) return;
    viewerGalleryPage = Math.max(0, Number(page) || 0);
    if (pageInput) pageInput.value = String(viewerGalleryPage);

    const start = viewerGalleryPage * VIEWER_PAGE_SIZE;
    const end = start + VIEWER_PAGE_SIZE - 1;
    setGalleryStatus(`Showing IDs ${start}–${end}`);

    grid.innerHTML = '';
    for (let i = start; i <= end; i++) {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        card.setAttribute('data-id', String(i));
        card.innerHTML = `
            <div class="id">#${i}</div>
            <div class="muted">Loading…</div>
        `;
        card.addEventListener('click', async () => {
            document.getElementById('manifest-id-input').value = i;
            setGallerySelected(i);
            document.getElementById('btn-play-single').click();
        });
        grid.appendChild(card);
    }

    // Fetch metadata in parallel and fill cards
    await Promise.all(
        Array.from({ length: VIEWER_PAGE_SIZE }, (_, idx) => start + idx).map(async (id) => {
            const meta = await fetchInscriptionMeta(id);
            const card = grid.querySelector(`.gallery-card[data-id="${id}"]`);
            if (!card) return;
            if (!meta) {
                card.innerHTML = `
                    <div class="id">#${id}</div>
                    <div class="missing">Not found</div>
                    <div class="muted">Click to try anyway</div>
                `;
                return;
            }
            const sealed = meta.sealed ? 'sealed' : 'draft';
            const size = meta.totalSize ? `${formatInt(meta.totalSize)} bytes` : 'unknown size';
            card.innerHTML = `
                <div class="id">#${id}</div>
                <div class="muted">${meta.mimeType}</div>
                <div class="muted">${size} • ${formatInt(meta.chunkCount)} chunks • ${sealed}</div>
            `;
        })
    );

    if (Number.isFinite(viewerSelectedId)) setGallerySelected(viewerSelectedId);
}

document.getElementById('gallery-prev')?.addEventListener('click', () => renderGalleryPage(Math.max(0, viewerGalleryPage - 1)));
document.getElementById('gallery-next')?.addEventListener('click', () => renderGalleryPage(viewerGalleryPage + 1));
document.getElementById('gallery-go')?.addEventListener('click', () => {
    const val = Number(document.getElementById('gallery-page-input')?.value);
    renderGalleryPage(Number.isFinite(val) ? val : 0);
});
document.getElementById('gallery-jump')?.addEventListener('click', () => {
    const id = Number(document.getElementById('gallery-jump-id')?.value);
    if (!Number.isFinite(id) || id < 0) return;
    const page = Math.floor(id / VIEWER_PAGE_SIZE);
    renderGalleryPage(page).then(() => {
        document.getElementById('manifest-id-input').value = id;
        setGallerySelected(id);
        document.getElementById('btn-play-single').click();
    });
});
document.getElementById('gallery-refresh')?.addEventListener('click', () => {
    inscriptionMetaCache.clear();
    renderGalleryPage(viewerGalleryPage);
});

document.getElementById('btn-play-single').addEventListener('click', async () => {
    const idInput = document.getElementById('manifest-id-input');
    if (!idInput.value) {
        return alert("Please enter an Inscription ID.");
    }
    const id = parseInt(idInput.value);
    journeyLog(`User clicked 'Load & View' for ID: ${id}`);
    viewerSelectedId = id;
    setGallerySelected(id);
    
    const container = document.getElementById('media-container');
    container.innerHTML = '<span style="color: #666;">Loading content from Stacks chain...</span>';
    
    try {
        playerLog("Fetching metadata and chunks...");
        const { data, mimeType } = await fetchInscriptionData(id);
        
        journeyLog(`Data fetched successfully. Size: ${data.length} bytes. MIME: ${mimeType}`);
        container.innerHTML = ''; // Clear loading text

        if (mimeType.startsWith('audio/')) {
            playerLog("Detected Audio. Decoding...");
            const { processRecursiveAudio } = await getAudio();
            const { audioCtx, outputBuffer } = await processRecursiveAudio([data.buffer]);
            
            // Create audio controls
            const audioWrapper = document.createElement('div');
            audioWrapper.style.width = '100%';
            audioWrapper.style.textAlign = 'center';

            const info = document.createElement('p');
            info.innerText = `Audio: ${(outputBuffer.duration).toFixed(2)}s | ${outputBuffer.sampleRate}Hz | ${outputBuffer.numberOfChannels}ch`;
            audioWrapper.appendChild(info);

            // Simple Play Button for decoded buffer
            const playBtn = document.createElement('button');
            playBtn.innerText = "▶ Play Audio";
            playBtn.style.background = "#28a745";
            playBtn.onclick = () => {
                const source = audioCtx.createBufferSource();
                source.buffer = outputBuffer;
                source.connect(audioCtx.destination);
                source.start();
            };
            audioWrapper.appendChild(playBtn);
            container.appendChild(audioWrapper);
            
            playerLog("Audio ready to play.");

        } else if (mimeType.startsWith('image/')) {
            playerLog("Detected Image. Rendering...");
            const blob = new Blob([data], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const img = document.createElement('img');
            img.src = url;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '600px';
            img.style.border = '1px solid #ddd';
            container.appendChild(img);

        } else if (mimeType.startsWith('video/')) {
            playerLog("Detected Video. Rendering...");
            const blob = new Blob([data], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const vid = document.createElement('video');
            vid.src = url;
            vid.controls = true;
            vid.style.maxWidth = '100%';
            vid.style.maxHeight = '600px';
            container.appendChild(vid);

        } else if (mimeType === 'text/html' || mimeType === 'application/pdf') {
             playerLog(`Detected ${mimeType}. Rendering in sandboxed iframe...`);
             const blob = new Blob([data], { type: mimeType });
             const url = URL.createObjectURL(blob);
             const iframe = document.createElement('iframe');
             iframe.src = url;
             iframe.style.width = '100%';
             iframe.style.height = '600px';
             iframe.style.border = '1px solid #ccc';
             // Sandbox for security: allow scripts but restrict other actions if needed
             iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin'); 
             container.appendChild(iframe);

        } else if (mimeType.includes('json') || mimeType.startsWith('text/')) {
            playerLog(`Detected Text/JSON. Rendering...`);
            const text = new TextDecoder().decode(data);
            const pre = document.createElement('pre');
            
            // Try pretty printing if JSON
            try {
                const obj = JSON.parse(text);
                pre.innerText = JSON.stringify(obj, null, 2);
            } catch (e) {
                pre.innerText = text.substring(0, 5000) + (text.length > 5000 ? '\n...[truncated]' : '');
            }
            
            pre.style.background = '#eee';
            pre.style.padding = '10px';
            pre.style.width = '100%';
            pre.style.overflow = 'auto';
            pre.style.whiteSpace = 'pre-wrap';
            container.appendChild(pre);
        } else {
            playerLog(`Unknown MIME: ${mimeType}. Displaying as Hex/Text...`);
            const text = new TextDecoder().decode(data);
            const pre = document.createElement('pre');
            pre.innerText = `[Raw Data - First 500 bytes]\n` + text.substring(0, 500);
            pre.style.background = '#f8d7da';
            pre.style.padding = '10px';
            container.appendChild(pre);
        }
    } catch (e) { 
        journeyLog("Player Error", { error: e.message });
        playerLog(`Error: ${e.message}`); 
        container.innerHTML = `<div style="color:red; text-align:center;">Error: ${e.message}</div>`;
    }
});

document.getElementById('btn-load-manifest').addEventListener('click', async () => {
    const manifestId = parseInt(document.getElementById('manifest-id-input').value);
    journeyLog(`User clicked 'Load Manifest' for ID: ${manifestId}`);
    try {
        playerLog("Fetching...");
        const { data: bytes } = await fetchInscriptionData(manifestId);
        const manifest = JSON.parse(new TextDecoder().decode(bytes));
        journeyLog("Manifest parsed", manifest);
        
        const clips = [];
        for (const clipId of manifest) {
            playerLog(`Clip ${clipId}...`);
            const { data } = await fetchInscriptionData(parseInt(clipId));
            clips.push(data.buffer);
        }
        
        journeyLog("All manifest clips fetched. Processing audio...");
        const { processRecursiveAudio } = await getAudio();
        const { audioCtx, outputBuffer } = await processRecursiveAudio(clips);
        const source = audioCtx.createBufferSource();
        source.buffer = outputBuffer;
        source.connect(audioCtx.destination);
        source.start();
        playerLog("Playing!");
    } catch (e) { 
        journeyLog("Player Error", { error: e.message });
        playerLog(`Error: ${e.message}`); 
    }
});
