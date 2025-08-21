/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';

// Custom render function for testing React components
const customRender = (ui: React.ReactElement, options?: RenderOptions) => {
  // Add any providers here (theme, store, etc.)
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <>{children}</>;
  };

  return render(ui, { wrapper: Wrapper, ...options });
};

// Mock data generators
export const createMockAppInfo = (overrides = {}) => ({
  name: 'MeetingMind',
  version: '0.1.0',
  description: 'Privacy-first AI Meeting Assistant',
  ...overrides,
});

export const createMockHealthStatus = (overrides = {}) => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  components: {
    database: 'not_initialized',
    audio: 'not_initialized',
    ai: 'not_initialized',
  },
  ...overrides,
});

// Re-export everything from React Testing Library
export * from '@testing-library/react';

// Override the render method
export { customRender as render };
