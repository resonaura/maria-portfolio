import { Header } from './components/header';
import { IpadProvider } from './components/ipadProvider';
import './index.scss';
import { ThemeProvider } from './providers/theme';
import { AboutSlide } from './slides/about';
import { ArtworkSlide } from './slides/artwork';
import { FathersSonsSlide } from './slides/fathersSons';
import { ExperienceSlide } from './slides/experience';
import { IntroSlide } from './slides/intro';
import { KhinkaliSlide } from './slides/khinkali';
import { MafiaSlide } from './slides/mafia';
import { OtherArtsSlide } from './slides/otherArts';

import { WebDesignSlide } from './slides/webDesign';
import { ContactsSlide } from './slides/contacts';

function App() {
  return (
    <ThemeProvider>
      <IpadProvider>
        <Header />
        <div className='slides'>
          <IntroSlide />
          <AboutSlide />
          <ExperienceSlide />
          <ArtworkSlide label='Artwork' />
          <FathersSonsSlide />
          <MafiaSlide />
          <OtherArtsSlide />
          <KhinkaliSlide />

          <WebDesignSlide />
          <ContactsSlide />
        </div>
      </IpadProvider>
    </ThemeProvider>
  );
}

export default App;
