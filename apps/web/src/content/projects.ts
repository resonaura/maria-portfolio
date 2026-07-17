import {
  Brush,
  Layers,
  LucideIcon,
  Palette,
  PenTool,
  Sparkles,
  SwatchBook,
  Type
} from 'lucide-react';

export interface IProjectTag {
  icon: LucideIcon;
  title: string;
}

export interface IProjectImageSlide {
  kind: 'image';
  alt: string;
  aspectRatio: string;
  /** Left undefined until the real artwork is dropped in — renders as a placeholder. */
  src?: string;
}

export interface IProjectTextSlide {
  kind: 'text';
  heading?: string;
  body: string;
}

export type IProjectSlide = IProjectImageSlide | IProjectTextSlide;

export interface IProject {
  slug: string;
  title: string;
  /** wide = full-bleed landscape slides, tall = full-height vertical slides */
  variant: 'wide' | 'tall';
  tags: IProjectTag[];
  slides: IProjectSlide[];
}

const placeholderCaseStudy =
  'Case study copy goes here — once the final artwork is ready, drop image files into public/projects/<slug>/ and fill this text in.';

export const projects: IProject[] = [
  {
    slug: 'editorial-illustration',
    title: 'Editorial Illustration',
    variant: 'wide',
    tags: [
      { icon: PenTool, title: 'Illustration' },
      { icon: Palette, title: 'Color' },
      { icon: Layers, title: 'Composition' }
    ],
    slides: [
      {
        kind: 'image',
        alt: 'Editorial illustration cover artwork',
        aspectRatio: '16 / 9'
      },
      {
        kind: 'text',
        heading: 'About the project',
        body: placeholderCaseStudy
      },
      {
        kind: 'image',
        alt: 'Editorial illustration detail',
        aspectRatio: '16 / 9'
      }
    ]
  },
  {
    slug: 'brand-identity',
    title: 'Brand Identity',
    variant: 'wide',
    tags: [
      { icon: SwatchBook, title: 'Branding' },
      { icon: Type, title: 'Typography' }
    ],
    slides: [
      {
        kind: 'image',
        alt: 'Brand identity showcase',
        aspectRatio: '16 / 9'
      },
      {
        kind: 'text',
        heading: 'About the project',
        body: placeholderCaseStudy
      }
    ]
  },
  {
    slug: 'poster-series',
    title: 'Poster Series',
    variant: 'tall',
    tags: [
      { icon: Brush, title: 'Poster Design' },
      { icon: Sparkles, title: 'Concept Art' }
    ],
    slides: [
      {
        kind: 'image',
        alt: 'Poster series, tall format',
        aspectRatio: '3 / 4'
      },
      {
        kind: 'image',
        alt: 'Poster series, tall format detail',
        aspectRatio: '3 / 4'
      }
    ]
  }
];

export interface IWebProject {
  slug: string;
  title: string;
  description: string;
}

export const webProjects: IWebProject[] = [
  {
    slug: 'would-you-love',
    title: 'Would You Love',
    description:
      'Identity and prototype for an AI-driven business-consulting startup.'
  },
  {
    slug: 'web-project-2',
    title: 'Web Project',
    description: 'Details coming soon.'
  },
  {
    slug: 'web-project-3',
    title: 'Web Project',
    description: 'Details coming soon.'
  }
];
