export declare const PRODUCTION_API_BASE_URL: string;
export declare const PRODUCTION_CUSTOMER_WEB_URL: string;
export declare const PRODUCTION_SHOP_WEB_URL: string;
export declare const PRODUCTION_ADMIN_WEB_URL: string;
export declare function resolvePublicApiBaseUrl(configuredUrl: string | undefined, isProduction: boolean): string;
export declare function resolvePublicSocketUrl(configuredSocketUrl: string | undefined, configuredApiUrl: string | undefined, isProduction: boolean): string;
export declare function resolvePublicPortalUrl(configuredUrl: string | undefined, isProduction: boolean, productionFallback: string, developmentFallback: string): string;
