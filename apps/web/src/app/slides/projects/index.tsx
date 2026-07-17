import { motion } from 'framer-motion';
import { Tag } from './components/tag';
import { ArtImage } from '../../components/artImage';
import { ArtPlaceholder } from '../../components/artPlaceholder';
import { SectionGap } from '../../components/sectionGap';
import { fadeIn, fadeUp, viewportOnce } from '../../lib/motion';
import { IProject, IProjectSlide, projects } from '../../../content/projects';

import './index.scss';

function ProjectImageSlide({
  slide,
  variant,
  title
}: {
  slide: Extract<IProjectSlide, { kind: 'image' }>;
  variant: IProject['variant'];
  title: string;
}) {
  const aspectRatio = variant === 'tall' ? undefined : slide.aspectRatio;

  return (
    <motion.div
      className={`project-image-slide project-image-slide--${variant}`}
      variants={fadeIn}
      initial='hidden'
      whileInView='visible'
      viewport={viewportOnce}
    >
      {slide.src ? (
        <ArtImage src={slide.src} alt={slide.alt} aspectRatio={aspectRatio} />
      ) : (
        <ArtPlaceholder
          label={`${title} — ${slide.alt}`}
          aspectRatio={aspectRatio}
        />
      )}
    </motion.div>
  );
}

function ProjectBlock({
  project,
  className
}: {
  project: IProject;
  className?: string;
}) {
  return (
    <div className={'project-block' + (className ? ` ${className}` : '')}>
      <motion.div
        className='project-header'
        variants={fadeUp}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <h3>{project.title}</h3>
        <div className='tags'>
          {project.tags.map((tag) => (
            <Tag icon={tag.icon} title={tag.title} key={tag.title} />
          ))}
        </div>
      </motion.div>

      {project.slides.map((slide, index) =>
        slide.kind === 'image' ? (
          <ProjectImageSlide
            slide={slide}
            variant={project.variant}
            title={project.title}
            key={index}
          />
        ) : (
          <motion.div
            className='project-text-slide'
            variants={fadeUp}
            initial='hidden'
            whileInView='visible'
            viewport={viewportOnce}
            key={index}
          >
            {slide.heading && <h4>{slide.heading}</h4>}
            <p>{slide.body}</p>
          </motion.div>
        )
      )}
    </div>
  );
}

export function ProjectSlides() {
  return (
    <section className='projects-section'>
      <ProjectBlock project={projects[0]} className='first-project-slide' />
      <SectionGap />
      <ProjectBlock project={projects[1]} />
      <SectionGap />
      <ProjectBlock project={projects[2]} />
    </section>
  );
}
