/**
 * Reusable password validation utility enforcing:
 * - At least 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 * - At least one special symbol
 * - No spaces
 */

export interface PasswordRequirement {
  id: "length" | "lowercase" | "uppercase" | "number" | "symbol" | "noSpaces";
  label: string;
  met: boolean;
}

export interface PasswordValidation {
  isValid: boolean;
  hasMinLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  hasNoSpaces: boolean;
  requirements: PasswordRequirement[];
  errorMessage?: string;
}

export function validatePasswordStrength(password: string): PasswordValidation {
  const hasMinLength = password.length >= 8;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  // Any non-alphanumeric and non-space character is considered a symbol
  const hasSymbol = /[^A-Za-z0-9\s]/.test(password);
  const hasNoSpaces = password.length > 0 && !/\s/.test(password);

  const requirements: PasswordRequirement[] = [
    { id: "length", label: "At least 8 characters", met: hasMinLength },
    { id: "lowercase", label: "One lowercase letter (a-z)", met: hasLowercase },
    { id: "uppercase", label: "One uppercase letter (A-Z)", met: hasUppercase },
    { id: "number", label: "One number (0-9)", met: hasNumber },
    { id: "symbol", label: "One special symbol (!@#$%...)", met: hasSymbol },
    { id: "noSpaces", label: "No spaces", met: hasNoSpaces },
  ];

  const unmet = requirements.filter((r) => !r.met);
  const isValid = unmet.length === 0;

  let errorMessage: string | undefined;
  if (!hasNoSpaces && /\s/.test(password)) {
    errorMessage = "Password cannot contain spaces";
  } else if (!hasMinLength) {
    errorMessage = "Password must be at least 8 characters long";
  } else if (!hasLowercase) {
    errorMessage = "Password must contain at least one lowercase letter (a-z)";
  } else if (!hasUppercase) {
    errorMessage = "Password must contain at least one uppercase letter (A-Z)";
  } else if (!hasNumber) {
    errorMessage = "Password must contain at least one number (0-9)";
  } else if (!hasSymbol) {
    errorMessage = "Password must contain at least one special symbol (!@#$%...)";
  }

  return {
    isValid,
    hasMinLength,
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSymbol,
    hasNoSpaces,
    requirements,
    errorMessage,
  };
}
