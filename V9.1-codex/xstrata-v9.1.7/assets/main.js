import { initializeOptimizationLayer } from './api/optimization.js';
import { initializeGlobals } from './utils/globals.js';
import { connect_modal } from './components/connect-modal.js';
import * as core from './core/index.js';

/**
 * Main Entry Point
 * Initializes the optimization layer, globals, and exports core functionality.
 */

try {
    // Initialize the API optimization layer immediately
    initializeOptimizationLayer();

    // Restore global functions for HTML event handlers
    initializeGlobals();

    console.log("📦 [App] Modules initialized and ready.");
} catch (error) {
    console.error("❌ [App] Initialization failed:", error);
}

// Export components and core logic for use in the application
export {
    connect_modal,
    core
};
