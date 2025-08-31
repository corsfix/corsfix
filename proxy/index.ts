import { app } from "./app";
import dbConnect from "./lib/dbConnect";
import { registerAppInvalidateCacheHandlers } from "./lib/services/applicationService";
import { initRedis } from "./lib/services/cacheService";
import { registerMetricShutdownHandlers } from "./lib/services/metricService";
import { initPubSub } from "./lib/services/pubSubService";
import { registerGlobalRateLimiter } from "./lib/services/ratelimitService";

import "dotenv/config";

const PORT = 80;

(async () => {
  await dbConnect();

  await initRedis();
  registerGlobalRateLimiter();

  await initPubSub();
  registerAppInvalidateCacheHandlers();

  registerMetricShutdownHandlers();

  app
    .listen(PORT)
    .then(() => console.log(`Webserver started on port ${PORT}`))
    .catch((error) => console.error("Failed to start application.", error));
})();
