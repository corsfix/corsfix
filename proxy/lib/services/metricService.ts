import { UserOriginDailyEntity } from "../../models/UserOriginDailyEntity";
import { Subject } from "rxjs";
import { bufferTime } from "rxjs/operators";

interface MetricEvent {
  userId: string;
  origin: string;
  date: Date;
  count: number;
  bytes: number;
}

const BUFFER_TIME_MS = 30_000; // 30 seconds
const MAX_BATCH_SIZE = 300; // Maximum number of events to process in a single batch

const metricEvents$ = new Subject<MetricEvent>();

export const countMetrics = async (
  userId: string,
  origin: string,
  bytes: number
): Promise<void> => {
  const date = new Date();
  const dateKey = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

  await UserOriginDailyEntity.updateOne(
    { user_id: userId, origin, date: dateKey },
    { $inc: { req_count: 1, bytes } },
    { upsert: true }
  );
};

export const batchCountMetrics = (
  userId: string,
  origin: string,
  bytes: number
): void => {
  const date = new Date();
  const dateKey = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  metricEvents$.next({ userId, origin, date: dateKey, count: 1, bytes });
};

metricEvents$
  .pipe(bufferTime(BUFFER_TIME_MS, undefined, MAX_BATCH_SIZE))
  .subscribe(async (batch) => {
    if (!batch.length) return;

    try {
      await processBatchMetrics(batch);
    } catch (error) {
      console.error("Error processing batch metrics.", error);
    }
  });

const processBatchMetrics = async (events: MetricEvent[]): Promise<void> => {
  const aggregatedMetrics = events.reduce(
    (map, { userId, origin, date, count, bytes }) => {
      const key = `${userId}|${origin}|${date.getTime()}`;
      const entry = map.get(key) ?? {
        userId,
        origin,
        date,
        count: 0,
        bytes: 0,
      };
      entry.count += count;
      entry.bytes += bytes;
      map.set(key, entry);
      return map;
    },
    new Map<string, MetricEvent>()
  );

  const aggregatedEntries = Array.from(aggregatedMetrics.values());

  if (aggregatedEntries.length > 0) {
    const bulkOps = aggregatedEntries.map(
      ({ userId, origin, date, count, bytes }) => ({
        updateOne: {
          filter: { user_id: userId, origin, date },
          update: { $inc: { req_count: count, bytes } },
          upsert: true,
        },
      })
    );

    await UserOriginDailyEntity.bulkWrite(bulkOps);
    console.log(
      `Processed ${aggregatedEntries.length} aggregated metrics from ${events.length} events in a single bulk operation`
    );
  }
};

export const registerMetricShutdownHandlers = () => {
  process.on("SIGINT", async () => {
    console.log("Received SIGINT, shutting down gracefully...");
    await flushPendingMetrics();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Received SIGTERM, shutting down gracefully...");
    await flushPendingMetrics();
    process.exit(0);
  });
};

export const flushPendingMetrics = async (): Promise<void> => {
  return new Promise((resolve) => {
    if (metricEvents$.closed) {
      resolve();
      return;
    }

    const subscription = metricEvents$.subscribe({
      complete: () => {
        subscription.unsubscribe();
        resolve();
      },
      error: () => {
        subscription.unsubscribe();
        resolve();
      },
    });

    metricEvents$.complete();
  });
};
