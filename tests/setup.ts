import '@testing-library/jest-dom';
import { server } from './mocks/server';

// Setup MSW for tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
