const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function validateEmail(email: unknown): ValidationResult<string> {
  if (typeof email !== "string") {
    return { success: false, error: "Invalid email or password" };
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return { success: false, error: "Invalid email or password" };
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { success: false, error: "Invalid email or password" };
  }

  return { success: true, data: trimmedEmail };
}

export function validatePassword(
  password: unknown,
  isSignup: boolean
): ValidationResult<string> {
  if (typeof password !== "string") {
    return { success: false, error: "Invalid email or password" };
  }

  if (password.length === 0) {
    return { success: false, error: "Invalid email or password" };
  }

  if (isSignup && password.length < MIN_PASSWORD_LENGTH) {
    return {
      success: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    };
  }

  return { success: true, data: password };
}

export function validateCredentials(
  email: unknown,
  password: unknown,
  isSignup: boolean
): ValidationResult<{ email: string; password: string }> {
  const emailResult = validateEmail(email);
  if (!emailResult.success) {
    return emailResult;
  }

  const passwordResult = validatePassword(password, isSignup);
  if (!passwordResult.success) {
    return passwordResult;
  }

  return {
    success: true,
    data: { email: emailResult.data, password: passwordResult.data },
  };
}
