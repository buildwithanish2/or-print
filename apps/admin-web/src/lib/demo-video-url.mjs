export const getDemoVideoEmbedUrl = (value) => {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;

    if (['youtu.be', 'www.youtu.be', 'youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      const id = url.hostname.includes('youtu.be')
        ? url.pathname.split('/').filter(Boolean)[0]
        : url.pathname === '/watch'
          ? url.searchParams.get('v')
          : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
      return id && /^[A-Za-z0-9_-]{6,20}$/.test(id)
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : null;
    }

    if (url.hostname === 'player.vimeo.com' && /^\/video\/\d+$/.test(url.pathname)) return url.toString();
    return null;
  } catch {
    return null;
  }
};
