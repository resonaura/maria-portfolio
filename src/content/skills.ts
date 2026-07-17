import { FileText, Frame, Image, LucideIcon, PenTool } from 'lucide-react';

export interface ISkill {
  icon: LucideIcon;
  name: string;
  level: number;
}

export const skills: ISkill[] = [
  { icon: PenTool, name: 'Adobe Illustrator', level: 100 },
  { icon: Image, name: 'Adobe Photoshop', level: 80 },
  { icon: FileText, name: 'Word Processing Software', level: 70 },
  { icon: Frame, name: 'Figma', level: 70 }
];
