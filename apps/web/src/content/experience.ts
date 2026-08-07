export interface IExperienceItem {
  column: 'left' | 'right';
  role: string;
  company: string;
  period: string;
  location: string;
  bullets: string[];
}

export const experience: IExperienceItem[] = [
  {
    column: 'left',
    role: 'Graphic Designer',
    company: 'Instant Imprints',
    period: '2025–2026',
    location: 'Burnaby, BC',
    bullets: [
      'Created custom visual solutions including brochures, posters, signage, promotional materials, and social media graphics for a wide range of clients and industries.',
      'Developed original graphic concepts and illustrations to communicate key messages while maintaining strong visual impact and brand consistency.',
      'Collaborated directly with clients and production teams to transform creative ideas into production-ready artwork.',
      'Refined and rebuilt low-quality client assets, improving overall visual quality and print readiness.',
      'Designed marketing materials that contributed to increased customer engagement, repeat business, and improved production efficiency.'
    ]
  },
  {
    column: 'right',
    role: 'Graphic Designer (Contract/Freelance)',
    company: 'Smart Receipts',
    period: '2024–2025',
    location: 'Vancouver, BC',
    bullets: [
      "Developed app icon concepts and interface graphics aligned with the brand's visual language.",
      'Managed projects independently while maintaining quality standards and meeting deadlines.',
      'Iterated designs quickly based on feedback, improving visual consistency across digital touchpoints.',
      'Produced clean, scalable assets optimized for digital platforms and user experience.'
    ]
  },
  {
    column: 'left',
    role: 'Administrator & Graphic Designer',
    company: 'Construction company «SMD Construction»',
    period: '2024',
    location: 'Vancouver, Canada',
    bullets: [
      'Developed business cards, work forms, social media content, employee search, etc.'
    ]
  },
  {
    column: 'right',
    role: 'Graphic Designer & Illustrator',
    company: 'Marketing company "KulibinPRO"',
    period: '2022',
    location: 'Moscow Region, Russia',
    bullets: [
      'Created a corporate identity for the "Fathers and Children" literature contest'
    ]
  },
  {
    column: 'left',
    role: 'Graphic Designer',
    company: 'Recovery Café',
    period: '2023–2024',
    location: 'Vancouver, Canada',
    bullets: [
      'Participated in the creation of a mural',
      'Collaborated with team members by brainstorming and implementing creative ideas, improving the cafe'
    ]
  },
  {
    column: 'right',
    role: 'Graphic Designer',
    company: 'The Central City Library',
    period: '2021',
    location: 'Moscow Region, Russia',
    bullets: [
      'Designed diplomas and certificates, booklets, banners and information sheets'
    ]
  },
  {
    column: 'left',
    role: 'Graphic Designer',
    company: 'Freelance',
    period: '2023',
    location: 'Vancouver, Canada',
    bullets: [
      'Created illustrations for commercial and non-commercial projects'
    ]
  },
  {
    column: 'right',
    role: 'Graphic Designer',
    company: 'Print shop «Angel»',
    period: '2019–2020',
    location: 'Moscow Region, Russia',
    bullets: [
      'Designed booklets, banners, presentations, final documents, restaurant menus for printing'
    ]
  }
];
