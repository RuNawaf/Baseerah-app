import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
  vi.restoreAllMocks();
});

window.scrollTo = () => {};