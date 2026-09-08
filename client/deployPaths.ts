export function normalizeAssetBasePath(value?: string): string {
  const raw = value?.trim() || '/';
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  if (withLeadingSlash === '/') return '/';
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function normalizeRouterBasename(value?: string): string {
  const assetBase = normalizeAssetBasePath(value);
  if (assetBase === '/') return '/';
  return assetBase.replace(/\/+$/, '');
}
