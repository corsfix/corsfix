import fs from "fs";
import path from "path";

export interface Product {
  id: string;
  name: string;
  rpm: number;
}

interface Config {
  products: Product[];
}

let cachedConfig: Config | null = null;

/**
 * Initialize configuration by reading from config.json
 * @param configPath Path to config.json file (defaults to ./config.json in project root)
 */
export function initConfig(configPath?: string): Config {
  const filePath = configPath || path.join(process.cwd(), "config.json");

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    cachedConfig = JSON.parse(fileContent) as Config;
    return cachedConfig;
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        `Failed to read config from ${filePath}: ${error.message}. Fallback to empty products.`
      );
    }
    // fallback to empty products
    cachedConfig = {
      products: [],
    };
    return cachedConfig;
  }
}

/**
 * Get the cached configuration
 * @throws Error if init() hasn't been called yet
 */
export function getConfig(): Config {
  if (!cachedConfig) {
    throw new Error("Config not initialized. Call initConfig() first.");
  }
  return cachedConfig;
}
