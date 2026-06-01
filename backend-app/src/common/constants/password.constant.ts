export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@$%*?&.#_-])[A-Za-z\d!@$%*?&.#_-]{8,}$/;

export const PASSWORD_MESSAGE =
  'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character';