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
