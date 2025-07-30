import { ApplicationEntity } from "../../models/ApplicationEntity";
import { Application } from "../../types/api";
import { CacheableMemory } from "cacheable";

const applicationCache = new CacheableMemory({
  ttl: "1m",
  lruSize: 1000,
});

export const getApplication = async (
  origin: string
): Promise<Application | null> => {
  let application = applicationCache.get<Application>(origin);
  if (application) {
    return application;
  }

  const hasPort = origin.includes(":443");
  const alternateOrigin = hasPort
    ? origin.replace(":443", "")
    : `${origin}:443`;

  const applicationEntity = await ApplicationEntity.findOne({
    allowed_origins: { $in: [origin, alternateOrigin] },
  }).lean();

  if (!applicationEntity) {
    return null;
  }

  application = {
    id: applicationEntity._id.toString(),
    user_id: applicationEntity.user_id,
    allowed_origins: applicationEntity.allowed_origins,
    target_domains: applicationEntity.target_domains,
  };

  applicationCache.set(origin, application);
  applicationCache.set(alternateOrigin, application);

  return application;
};
