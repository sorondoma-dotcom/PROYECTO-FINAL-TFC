export interface ApiConfig {
  nodeApiBase: string;
  phpApiBase: string;
  phpPublicBase: string;
}

const DEFAULT_ORIGIN =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost:4200';

const runtimeEnv =
  typeof window !== 'undefined' && (window as any).__swimLiveEnv
    ? (window as any).__swimLiveEnv
    : undefined;

function withTrailingSlashGuard(base: string): string {
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

const origin = withTrailingSlashGuard(DEFAULT_ORIGIN);

export const API_CONFIG: ApiConfig = {
  nodeApiBase:
    runtimeEnv?.nodeApiBase ?? `${origin}/api`,
  phpApiBase:
    runtimeEnv?.phpApiBase ?? `${origin}/auth-api/api`,
  phpPublicBase:
    runtimeEnv?.phpPublicBase ?? `${origin}/auth-api`,
};

export function resolvePhpAssetUrl(path: string): string {
  if (!path) {
    return '';
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.phpPublicBase}${normalizedPath}`;
}
