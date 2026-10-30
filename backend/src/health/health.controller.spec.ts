import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('responde ok', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok' });
  });
});
