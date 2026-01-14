import { viewLatestInscription } from '../core/index.js';

/**
 * This file restores essential global functions that are called from inline HTML event handlers.
 * By explicitly attaching them to the `window` object, we make them accessible from the global scope.
 */

export const initializeGlobals = () => {
    // showPage and debugTokenUri are already attached to window by core/index.js
    // window.showPage = showPage;
    // window.debugTokenUri = debugTokenUri;
    
    // viewLatestInscription is also attached by core/index.js, but we can keep it here if needed for clarity
    // or just rely on the side-effect.
    // window.viewLatestInscription = viewLatestInscription;

    console.log('🌍 [Globals] Essential functions have been attached to the window object.');
};
