export function getUsageIdentity(usage: {
  user?: { name?: string | null; role?: string | null } | null;
} | null | undefined): { name: string; role: string };
