import { initializeOptimizationLayer } from './api/optimization.js?v=1.0.1';
import { initializeGlobals } from './utils/globals.js?v=1.0.1';
import { connect_modal } from './components/connect-modal.js?v=1.0.1';
import * as core from './core/index.js?v=1.0.1';

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
