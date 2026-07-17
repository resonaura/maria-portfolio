import { motion } from 'framer-motion';
import { Slide } from '../../components/slide';
import { ArtPlaceholder } from '../../components/artPlaceholder';
import { webProjects } from '../../../content/projects';
import { fadeUp, staggerContainer, viewportOnce } from '../../lib/motion';
import './index.scss';

export function WebDesignSlide() {
  return (
    <Slide className='web-design-slide'>
      <div className='slide-content'>
        <h2>Web Design</h2>
        <p>
          Recently, I embarked on my web design journey. My first project was
          creating a website for a startup that uses AI for business consulting.
          Since it was a young startup, they hadn't had an idea of what they
          want from this project. Therefore, I had to develop their identity
          from scratch. The customer was left satisfied and the following
          prototype is my solution to the ambiguous tasks and goals I was faced
          with.
        </p>

        <motion.div
          className='web-projects'
          variants={staggerContainer}
          initial='hidden'
          whileInView='visible'
          viewport={viewportOnce}
        >
          {webProjects.map((project) => (
            <motion.div
              className='web-project-card'
              variants={fadeUp}
              key={project.slug}
            >
              <ArtPlaceholder label={project.title} aspectRatio='16 / 10' />
              <h3>{project.title}</h3>
              <p>{project.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </Slide>
  );
}
