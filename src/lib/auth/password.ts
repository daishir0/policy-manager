import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// パスワード強度チェック
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("パスワードは8文字以上必要です");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("大文字を1文字以上含めてください");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("小文字を1文字以上含めてください");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("数字を1文字以上含めてください");
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("記号を1文字以上含めてください");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
