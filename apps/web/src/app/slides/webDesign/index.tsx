import { motion } from 'framer-motion';
import { Slide } from '../../components/slide';
import { fadeIn, fadeUp, staggerContainer, viewportOnce } from '../../lib/motion';
import './index.scss';

export function WebDesignSlide() {
  return (
    <Slide className='web-design-slide'>
      {/* Section heading */}
      <motion.div
        className='web-design-section-header'
        variants={fadeUp}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
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
      </motion.div>

      {/* Figma embeds — each full-width, stacked vertically */}
      <motion.div
        className='web-embeds'
        variants={staggerContainer}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <motion.div className='web-embed' variants={fadeIn}>
          <iframe
            src='https://www.figma.com/embed?embed_host=share&url=https%3A%2F%2Fwww.figma.com%2Fproto%2FR1qTHmJWG2i09W5aSBu6TH%2FUntitled%3Fnode-id%3D1-2%26t%3D3K6Z1ZfUhVozbkDt-1%26scaling%3Dscale-down%26content-scaling%3Dfixed%26page-id%3D0%253A1'
            title='AI Consulting Website Prototype'
            frameBorder={0}
            style={{ height: '100%', left: 0, position: 'absolute', top: 0, width: '100%' }}
            allowFullScreen
            sandbox='allow-same-origin allow-scripts allow-pointer-lock allow-forms'
            loading='lazy'
          />
        </motion.div>

        <motion.div className='web-embed' variants={fadeIn}>
          <iframe
            src='https://www.figma.com/embed?embed_host=share&url=https%3A%2F%2Fwww.figma.com%2Fproto%2FhzxsTPU6qbzets9dZrsu4d%2FWouldYouLove%3Fnode-id%3D348-12309%26t%3DROjtVRcaSEMYzZeI-1%26scaling%3Dscale-down%26content-scaling%3Dfixed%26page-id%3D241%253A969'
            title='WouldYouLove Prototype'
            frameBorder={0}
            style={{ height: '100%', left: 0, position: 'absolute', top: 0, width: '100%' }}
            allowFullScreen
            sandbox='allow-same-origin allow-scripts allow-pointer-lock allow-forms'
            loading='lazy'
          />
        </motion.div>
      </motion.div>
    </Slide>
  );
}
