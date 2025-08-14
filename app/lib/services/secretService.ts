import { Application, SecretItem, UpsertSecret } from "@/types/api";
import dbConnect from "../dbConnect";
import { SecretEntity } from "@/models/SecretEntity";
import { encrypt, getKekVersion, maskSecret } from "../utils";
import crypto from "crypto";
import { ApplicationEntity } from "@/models/ApplicationEntity";

export async function getApplicationSecrets(
  user_id: string
): Promise<Application[]> {
  await dbConnect();

  const applications = await ApplicationEntity.find({
    user_id: user_id,
  }).lean();

  const secrets = await SecretEntity.find({ user_id: user_id }).lean();

  return applications.map((application) => ({
    id: application._id.toString(),
    name: application.name,
    originDomains: application.origin_domains,
    targetDomains: application.target_domains,
    secrets: secrets
      .filter(
        (secret) =>
          secret.application_id.toString() === application._id.toString()
      )
      .map((secret) => ({
        id: secret._id.toString(),
        application_id: application._id.toString(),
        name: secret.name,
        note: secret.note,
        masked_value: secret.masked_value,
      })),
  }));
}

export async function createSecret(
  user_id: string,
  kek: string,
  { application_id, name, note, value }: UpsertSecret
): Promise<SecretItem> {
  await dbConnect();

  const dek = crypto.randomBytes(32).toString("base64");

  const encryptedData = await encrypt(value, dek);
  const encryptedDek = await encrypt(dek, kek);

  const secret = new SecretEntity({
    application_id: application_id,
    user_id: user_id,
    name: name,
    note: note || "",
    masked_value: maskSecret(value),
    data: encryptedData,
    dek: encryptedDek,
    kek_version: getKekVersion(),
  });

  await secret.save();

  return {
    application_id: application_id,
    id: secret.id,
    name: name,
    note: note,
    masked_value: secret.masked_value,
  };
}

export async function updateSecret(
  user_id: string,
  id: string,
  kek: string,
  { name, note, value }: UpsertSecret
): Promise<SecretItem> {
  await dbConnect();

  const existingSecret = await SecretEntity.findOne({
    _id: id,
    user_id: user_id,
  });

  if (!existingSecret) {
    throw new Error("Secret not found");
  }

  existingSecret.name = name;
  existingSecret.note = note;

  // Encrypt the new value if provided
  if (value) {
    const dek = crypto.randomBytes(32).toString("base64");

    const encryptedData = await encrypt(value, dek);
    const encryptedDek = await encrypt(dek, kek);

    existingSecret.data = encryptedData;
    existingSecret.dek = encryptedDek;
    existingSecret.masked_value = maskSecret(value);
    existingSecret.kek_version = getKekVersion();
  }

  await existingSecret.save();

  return {
    application_id: existingSecret.application_id.toString(),
    id: existingSecret.id,
    name: existingSecret.name,
    note: existingSecret.note,
    masked_value: existingSecret.masked_value,
  };
}

export async function deleteSecret(user_id: string, id: string): Promise<void> {
  await dbConnect();

  const secret = await SecretEntity.findOne({
    _id: id,
    user_id: user_id,
  });

  if (!secret) {
    throw new Error("Secret not found");
  }

  await secret.deleteOne();
}

export async function deleteSecretsForApplication(
  user_id: string,
  application_id: string
): Promise<void> {
  await dbConnect();

  await SecretEntity.deleteMany({
    user_id: user_id,
    application_id: application_id,
  });
}

export async function secretExistsForApplication(
  user_id: string,
  application_id: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  await dbConnect();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {
    user_id: user_id,
    application_id: application_id,
    name: name,
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingSecret = await SecretEntity.findOne(query);

  return !!existingSecret;
}

export async function getSecretsForApplication(
  user_id: string,
  application_id: string
): Promise<SecretItem[]> {
  await dbConnect();

  const secrets = await SecretEntity.find({
    user_id: user_id,
    application_id: application_id,
  }).lean();

  return secrets.map((secret) => ({
    id: secret._id.toString(),
    application_id: secret.application_id.toString(),
    name: secret.name,
    note: secret.note,
    masked_value: secret.masked_value,
  }));
}

export async function manageApplicationSecrets(
  user_id: string,
  kek: string,
  application_id: string,
  secrets: Array<{
    id?: string;
    name: string;
    value: string | null;
    delete?: boolean;
  }>
): Promise<void> {
  await dbConnect();

  for (const secretData of secrets) {
    if (secretData.delete) {
      // Delete the secret by ID (should always have ID for deletes)
      await SecretEntity.deleteOne({
        _id: secretData.id,
        user_id: user_id,
        application_id: application_id,
      });
    } else if (secretData.id) {
      // Update existing secret (has ID)
      const existingSecret = await SecretEntity.findOne({
        _id: secretData.id,
        user_id: user_id,
        application_id: application_id,
      });

      if (existingSecret) {
        // Update name (always allow name changes)
        existingSecret.name = secretData.name;

        // Update value if provided
        if (secretData.value?.trim()) {
          const dek = crypto.randomBytes(32).toString("base64");
          const encryptedData = await encrypt(secretData.value, dek);
          const encryptedDek = await encrypt(dek, kek);

          existingSecret.data = encryptedData;
          existingSecret.dek = encryptedDek;
          existingSecret.masked_value = maskSecret(secretData.value);
          existingSecret.kek_version = getKekVersion();
        }

        await existingSecret.save();
      }
    } else if (secretData.value?.trim()) {
      // Create new secret (no ID, has value)
      const dek = crypto.randomBytes(32).toString("base64");
      const encryptedData = await encrypt(secretData.value, dek);
      const encryptedDek = await encrypt(dek, kek);

      const secret = new SecretEntity({
        application_id: application_id,
        user_id: user_id,
        name: secretData.name,
        note: "",
        masked_value: maskSecret(secretData.value),
        data: encryptedData,
        dek: encryptedDek,
        kek_version: getKekVersion(),
      });

      await secret.save();
    }
  }
}
