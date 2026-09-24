export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getPasswordStrengthError(password) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}