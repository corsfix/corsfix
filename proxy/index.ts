import { app } from "./app";
import { initConfig } from "./lib/config";
import dbConnect from "./lib/dbConnect";
import { registerApiKeyInvalidateCacheHandlers } from "./lib/services/apiKeyService";
import { registerAppInvalidateCacheHandlers } from "./lib/services/applicationService";
import { initRedis } from "./lib/services/cacheService";
import { registerMetricShutdownHandlers } from "./lib/services/metricService";
import { initPubSub } from "./lib/services/pubSubService";
import { registerGlobalRateLimiter } from "./lib/services/ratelimitService";
import { registerSecretInvalidateCacheHandlers } from "./lib/services/secretService";

import "dotenv/config";

const PORT = 80;

(async () => {
  await dbConnect();

  await initRedis();
  registerGlobalRateLimiter();

  await initPubSub();
  registerAppInvalidateCacheHandlers();
  registerApiKeyInvalidateCacheHandlers();
  registerSecretInvalidateCacheHandlers();

  registerMetricShutdownHandlers();

  initConfig(process.env.CONFIG_PATH);

  app
    .listen(PORT)
    .then(() => console.log(`Webserver started on port ${PORT}`))
    .catch((error) => console.error("Failed to start application.", error));
})();
