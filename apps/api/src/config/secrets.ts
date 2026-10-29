const readSecret = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured before the API starts`);
  if (process.env.NODE_ENV === 'production'
    && (value.length < 32 || /example|replace|change.?me|printqr_super_secret/i.test(value))) {
    throw new Error(`${name} must be a unique random secret of at least 32 characters in production`);
  }
  return value;
};

export const JWT_SECRET = readSecret('JWT_SECRET');
export const JWT_REFRESH_SECRET = readSecret('JWT_REFRESH_SECRET');

if (JWT_SECRET === JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
}

const paymentEncryptionKey = process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
if (paymentEncryptionKey && !/^[a-f\d]{64}$/i.test(paymentEncryptionKey)) {
  throw new Error('PAYMENT_CREDENTIALS_ENCRYPTION_KEY must be a 64-character hex-encoded 32-byte key');
}
if (process.env.NODE_ENV === 'production' && !paymentEncryptionKey) {
  throw new Error('PAYMENT_CREDENTIALS_ENCRYPTION_KEY must be configured before the API starts in production');
}

const collegeIdHashSecret = process.env.COLLEGE_ID_HASH_SECRET;
if (process.env.NODE_ENV === 'production' && (!collegeIdHashSecret || collegeIdHashSecret.length < 32 || collegeIdHashSecret === JWT_SECRET || /example|replace|change.?me/i.test(collegeIdHashSecret))) {
  throw new Error('COLLEGE_ID_HASH_SECRET must be a unique random secret of at least 32 characters in production');
}
export const COLLEGE_ID_HASH_SECRET = collegeIdHashSecret || JWT_SECRET;
