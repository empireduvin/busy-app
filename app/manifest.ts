import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'First Round',
    short_name: 'First Round',
    description: "Find what's live now at pubs, bars, specials and events near you",
    start_url: '/livenow',
    scope: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#ff6f24',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/maskable-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
