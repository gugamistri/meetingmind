import '@testing-library/jest-dom';

// Global test setup for Vitest and React Testing Library

// Mock Tauri API for testing
(globalThis as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
  metadata: {
    windows: [],
    webviews: [],
    currentWindow: {
      label: 'main',
    },
    currentWebview: {
      label: 'main',
    },
  },
  plugins: {},
  listeners: new Map(),
  invoke: async () => Promise.resolve(),
  channel: {
    transformCallback: () => {},
    transformStream: () => {},
  },
  convertFileSrc: (filePath: string) => filePath,
};
