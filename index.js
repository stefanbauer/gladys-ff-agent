import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerHandlers } from './src/app.js';

const gladys = new GladysIntegration();
registerHandlers(gladys);
gladys.handleShutdown();

logger.warn('FF-Agent reply actions send REAL requests, including for test alarms.');
gladys.connect().catch((error) => {
  logger.error(
    'Cannot connect to Gladys. Run npm run dev:connect after installing the dev manifest.',
    error,
  );
  process.exit(1);
});
