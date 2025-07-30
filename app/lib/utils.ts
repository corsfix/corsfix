import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import tinycolor from "tinycolor2";
import crypto from "crypto";
import { EncryptedObject } from "@/models/SecretEntity";
import { Session } from "next-auth";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const computeComplementaryColor = (color: string) => {
  const accent = tinycolor(color);

  return [
    accent,
    accent.clone().lighten(8),
    accent.clone().lighten(16),
    accent.clone().lighten(24),
  ];
};

export function getPreviousMidnightEpoch(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(0, 0, 0, 0);
  return midnight.getTime();
}

export function getLastNDaysMidnightEpochs(n: number): number[] {
  const epochs: number[] = [];
  const now = new Date();

  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setUTCHours(0, 0, 0, 0);
    epochs.push(date.getTime());
  }

  return epochs;
}

export const getKekVersion = (): string => {
  const kekVersion = process.env.KEK_VERSION;
  if (!kekVersion) {
    throw new Error("KEK_VERSION is not set");
  }
  return kekVersion;
};

export const getKek = async (): Promise<string | null> => {
  const kek_version = getKekVersion();
  const kek = process.env[kek_version];
  if (!kek) {
    throw new Error(`Failed to retrieve KEK for version: ${kek_version}`);
  }
  return kek;
};

export const encrypt = async (
  data: string,
  key: string
): Promise<EncryptedObject> => {
  const keyBuffer = Buffer.from(key, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);
  const encrypted = Buffer.concat([
    cipher.update(data, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    encrypted: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };
};

export function maskSecret(secret: string): string {
  if (!secret) {
    return secret;
  }

  if (secret.length < 3) {
    return "***";
  }

  if (secret.length <= 6) {
    const first = secret.charAt(0);
    const last = secret.charAt(secret.length - 1);
    return `${first}***${last}`;
  }

  const first = secret.substring(0, 2);
  const last = secret.substring(secret.length - 2);
  return `${first}***${last}`;
}

export const getUserId = (session: Session | null): string => {
  if (!session || !session.user) {
    return "";
  }

  return session.user.legacy_id || session.user.id || "";
};
