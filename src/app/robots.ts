import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://github.com/tikidragonslayer/TalentOS';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/candidate/', '/employer/', '/dashboard/', '/login', '/onboarding', '/settings', '/messages/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
