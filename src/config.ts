export const site = {
  name: 'Hassan Abid',
  role: 'Senior Software Engineer · Google Developers Expert for Android',
  subtitle:
    'Senior Software Engineer. Google Developers Expert for Android',
  url: 'https://hassanabid.netlify.app',
  copyright: '© All rights reserved.',
  // GA4 measurement id (G-XXXXXXX). Empty disables analytics.
  // Legacy Universal id UA-73379983-2 is dead and intentionally not shipped.
  analyticsId: '',
  socials: {
    twitter: 'https://twitter.com/hassanabidpk',
    github: 'https://github.com/hassanabidpk',
    instagram: 'https://www.instagram.com/hassanabidpk/',
    linkedin: 'https://www.linkedin.com/in/hassanabid89/',
  },
  menu: [
    { label: 'Home', path: '/' },
    { label: 'Talks', path: '/talks' },
    { label: 'Workshops', path: '/workshops' },
    { label: 'Mentoring', path: '/mentoring' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ],
} as const;
