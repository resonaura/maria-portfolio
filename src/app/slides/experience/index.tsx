import { motion } from 'framer-motion';
import { Slide } from '../../components/slide';
import { experience, IExperienceItem } from '../../../content/experience';
import { fadeUp, staggerContainer, viewportOnce } from '../../lib/motion';
import './index.scss';

function ExperienceCard({ item }: { item: IExperienceItem }) {
  return (
    <motion.div className='experience-card' variants={fadeUp}>
      <span className='dot' aria-hidden='true' />
      <p className='role'>{item.role}</p>
      <p className='company'>{item.company}</p>
      <p className='meta'>
        {item.period} · {item.location}
      </p>
      <ul>
        {item.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </motion.div>
  );
}

export function ExperienceSlide() {
  const left = experience.filter((item) => item.column === 'left');
  const right = experience.filter((item) => item.column === 'right');

  return (
    <Slide className='experience-slide'>
      <div className='slide-content'>
        <h2>Experience</h2>
        <motion.div
          className='timeline'
          variants={staggerContainer}
          initial='hidden'
          whileInView='visible'
          viewport={viewportOnce}
        >
          <div className='timeline-column'>
            {left.map((item) => (
              <ExperienceCard item={item} key={item.company} />
            ))}
          </div>
          <div className='timeline-column'>
            {right.map((item) => (
              <ExperienceCard item={item} key={item.company} />
            ))}
          </div>
        </motion.div>
      </div>
    </Slide>
  );
}
