import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/candidate/', '/employer/', '/dashboard/', '/login', '/onboarding', '/settings', '/messages/'],
    },
    sitemap: 'https://veiled-ventures.web.app/sitemap.xml',
  };
}
