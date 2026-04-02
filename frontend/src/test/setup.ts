import { vi } from 'vitest';

// Mock valid JWT token for testing
export const mockValidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.test-signature';

// Mock invalid token
export const mockInvalidToken = 'invalid-token';

// Mock Ant Design message
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...(actual as object),
    message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  };
});

// Mock log utility
vi.mock('../../utils/log', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    getLevel: vi.fn(),
  },
}));

// Helper to create mock fetch response
export const createMockFetchResponse = (data: any, options?: { ok?: boolean; status?: number }) => ({
  ok: options?.ok ?? true,
  status: options?.status ?? 200,
  json: async () => data,
  text: async () => JSON.stringify(data),
  headers: new Headers(),
});

// Helper to setup authenticated fetch
export const setupAuthenticatedFetch = (responses: any[]) => {
  const fetchMock = vi.fn();
  responses.forEach((response) => {
    fetchMock.mockResolvedValueOnce(response);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

// Helper to setup localStorage with token
export const setupAuthStorage = (token: string = mockValidToken) => {
  localStorage.setItem('prism_token', token);
};

// Helper to clear all mocks
export const clearAllMocks = () => {
  vi.clearAllMocks();
  localStorage.clear();
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});
