/**
 * Global test setup for Mind tests
 */

import { beforeAll } from 'vitest';
import { taskState } from '../src/state/state.js';

// Setup global mocks before all tests
beforeAll(() => {
    // Clear disabled models
    taskState.disabledModels.clear();
    // Let ensemble handle model selection
});

// Export common mocks - let ensemble handle model classes
export const mockEnsemble = {
    // Tests should use modelClass, not specific models
};