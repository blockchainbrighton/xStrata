
/**
 * XStrata V7 Optimization Engine
 * Implements IndexedDB for high-capacity storage and immediate metadata loading.
 */

const InscriptionDB = (() => {
    const DB_NAME = 'XStrataCache';
    const DB_VERSION = 1;
    const STORE_NAME = 'inscriptions';

    let dbPromise = null;

    const getDB = () => {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
        return dbPromise;
    };

    return {
        get: async (key) => {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },
        set: async (key, value) => {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(value, key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    };
})();

// Bridge for the main application
window.EnhancedCache = {
    saveInscription: async (id, data, mimeType, meta) => {
        // Save large data to IndexedDB
        await InscriptionDB.set(`data:${id}`, { data, mimeType });
        // Save small metadata to LocalStorage for instant access
        localStorage.setItem(`meta:${id}`, JSON.stringify(meta));
    },
    loadInscription: async (id) => {
        return await InscriptionDB.get(`data:${id}`);
    },
    loadMeta: (id) => {
        const meta = localStorage.getItem(`meta:${id}`);
        return meta ? JSON.parse(meta) : null;
    }
};

// Silence noisy focus/blur logs if verbose is off
const originalAddEventListener = window.addEventListener;
window.addEventListener = function(type, listener, options) {
    if ((type === 'focus' || type === 'blur') && String(listener).includes('dumpAuthDebug')) {
        const wrapped = (...args) => {
            const debugEnabled = document.getElementById('toggle-auth-debug')?.checked;
            if (debugEnabled) listener.apply(this, args);
        };
        return originalAddEventListener.call(this, type, wrapped, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
};

console.log("XStrata V7 Optimization Engine Loaded: IndexedDB Active.");
