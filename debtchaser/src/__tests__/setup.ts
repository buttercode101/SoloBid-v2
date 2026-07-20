import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Notification API
Object.defineProperty(window, 'Notification', {
  writable: true,
  value: class MockNotification {
    static permission = 'default';
    static requestPermission = vi.fn().mockResolvedValue('granted');
    constructor() {}
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});

// Mock share API
Object.defineProperty(navigator, 'share', {
  writable: true,
  value: vi.fn().mockResolvedValue(undefined),
});
