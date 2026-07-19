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
