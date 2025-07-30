import crypto from "crypto";
import { CacheableMemory } from "cacheable";
import { EncryptedObject, SecretEntity } from "../../models/SecretEntity";

const dekCache = new CacheableMemory({
  ttl: "1m",
  lruSize: 1000,
});

const secretCache = new CacheableMemory({
  ttl: "1m",
  lruSize: 1000,
});

const getKek = async (kek_version: string): Promise<string | null> => {
  const kek = process.env[kek_version];
  if (!kek) {
    throw new Error(`Failed to retrieve KEK for version: ${kek_version}`);
  }
  return kek;
};

const decrypt = async (
  encryptedObject: EncryptedObject,
  key: string
): Promise<string> => {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "base64"),
    Buffer.from(encryptedObject.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encryptedObject.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedObject.encrypted, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
};

const getDecryptedDek = async (
  dek: EncryptedObject,
  kek_version: string
): Promise<string> => {
  const dekCacheKey = dek.encrypted;
  const cachedDek = dekCache.get<string>(dekCacheKey);
  if (cachedDek) {
    return cachedDek;
  }
  const kek = await getKek(kek_version);
  if (!kek) {
    throw new Error("kek not found");
  }
  const decryptedDek = await decrypt(dek, kek);
  dekCache.set(dekCacheKey, decryptedDek);
  return decryptedDek;
};

const getSecrets = async (application_id: string) => {
  const cachedSecrets = secretCache.get<any[]>(application_id);
  if (cachedSecrets) {
    return cachedSecrets;
  }

  const secrets = await SecretEntity.find({ application_id }).lean();
  secretCache.set(application_id, secrets);
  return secrets;
};

export const getSecretsMap = async (
  secret_names: Set<string>,
  application_id: string
) => {
  const allSecrets = await getSecrets(application_id);
  const secretVariables = allSecrets.filter((secret) =>
    secret_names.has(secret.name)
  );

  const decryptedSecrets = await Promise.all(
    secretVariables.map(async (secret) => {
      const decryptedDek = await getDecryptedDek(
        secret.dek,
        secret.kek_version
      );
      const decrypted = await decrypt(secret.data, decryptedDek);
      return { name: secret.name, value: decrypted };
    })
  );

  const secretsMap: Record<string, string> = {};
  decryptedSecrets.forEach((secret) => {
    secretsMap[secret.name] = secret.value;
  });

  return secretsMap;
};
