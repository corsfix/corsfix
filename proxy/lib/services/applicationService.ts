import { ApplicationEntity } from "../../models/ApplicationEntity";
import { Application } from "../../types/api";
import { CacheableMemory } from "cacheable";
import { getRedisClient } from "./cacheService";

const applicationCache = new CacheableMemory({
  ttl: "1m",
  lruSize: 1000,
});

export const getApplication = async (
  domain: string
): Promise<Application | null> => {
  let application = applicationCache.get<Application>(domain);
  if (application) {
    return application;
  }

  const applicationEntity = await ApplicationEntity.findOne({
    origin_domains: { $in: [domain] },
  }).lean();

  if (!applicationEntity) {
    return null;
  }

  application = {
    id: applicationEntity._id.toString(),
    user_id: applicationEntity.user_id,
    origin_domains: applicationEntity.origin_domains,
    target_domains: applicationEntity.target_domains,
  };

  applicationCache.set(domain, application);

  return application;
};

export const registerAppInvalidateCacheHandlers = () => {
  const redis = getRedisClient();

  redis.subscribe("app-invalidate", (err, count) => {
    if (err) console.error(err);
    console.log(`Subscribed to ${count} channels.`);
  });

  redis.on("message", (channel, message) => {
    switch (channel) {
      case "app-invalidate":
        try {
          const origins: string[] = JSON.parse(message);
          for (let origin of origins) {
            applicationCache.delete(origin);
          }
        } catch (error) {
          console.error(
            "Failed to parse message in app-invalidate channel:",
            error
          );
        }
        break;
      default:
        break;
    }
  });
};
