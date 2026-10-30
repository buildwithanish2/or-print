export interface PublicPlan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number | string;
  priceYearly: number | string;
  features?: string[];
  isPopular?: boolean;
  ctaText?: string;
}
export interface AgentRelease {
  latestVersion: string;
  sha256: string;
  fileSize: number;
  downloadUrl?: string;
}
export function resolvePublicPlans(apiPlans: unknown): PublicPlan[];
export function resolveAgentRelease(response: unknown): AgentRelease;
export function resolvePublicNavigation<T>(apiItems: unknown, fallbackItems: T[]): T[];
export function hasPublicNavigationTopic(items: unknown, topic: 'contact' | 'partner'): boolean;
