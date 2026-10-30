export function validateShopProvisioningCredentials(shopName: unknown, password: unknown): string | null {
  if (typeof shopName !== 'string' || shopName.trim().length < 2 || shopName.trim().length > 100) {
    return 'Shop name must contain 2 to 100 characters';
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return 'Shop owner password must contain 12 to 128 characters';
  }
  return null;
}
