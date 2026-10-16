import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerHandlers } from './src/app.js';

const gladys = new GladysIntegration();
registerHandlers(gladys);
gladys.handleShutdown();

logger.warn(
  'FF-Agent reply actions send REAL requests. Incoming alarm reception is not implemented yet.',
);
gladys.connect().catch((error) => {
  logger.error(
    'Cannot connect to Gladys. Run npm run dev:connect after installing the dev manifest.',
    error,
  );
  process.exit(1);
});
