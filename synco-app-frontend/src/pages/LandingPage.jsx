import { ArrowRight, Trophy, BarChart2, User, Award, ArrowDownCircle, CheckCircle} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import characterImage from '../assets/Hero.png';
import '../styles/pages/LandingPage.css';
import bgmiImage from '../assets/bgmi.jpg';
import valorantImage from '../assets/valorant.jpg';
import gameVideo from '../assets/video.mp4';


const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page-wrapper">
      {/* Hero Section */}
      <section className="hero-section">
        
        <div className="hero-content">
          <div className="hero-text-col">
            <div className="hero-online-badge">
              <div className="hero-online-dot"></div>
              <span className="hero-online-text">24,000 Players Online</span>
            </div>
            <h1 className="hero-title">
              COMPETE.<br/>
              <span className="hero-title-highlight">IMPROVE.</span><br/>
              ACHIEVE.
            </h1>
            <p className="hero-description">
              Synco is the competitive gaming platform for players who want better matches, real competition and a legacy that lasts.
            </p>
            <button onClick={() => navigate('/login')} className="hero-cta-btn" >
              Play <ArrowRight size={18} />
            </button>
          </div>
          
          <div className="hero-image-container">
            <img 
              src={characterImage} 
              alt="Hero Character" 
              className="hero-image" 
            />
          </div>
        </div>

        <div className="scroll-indicator">
          <span className="scroll-text">Scroll to explore</span>
          <ArrowDownCircle size={20} strokeWidth={1} />
        </div>
      </section>

      {/* Featured Games */}
      <section id="games" className="featured-section">
        <div className="featured-container">
          <div className="featured-header">
            <div className="featured-title-wrapper">
              <span className="featured-label">Top Arenas</span>
              <h2 className="featured-title">Featured Games</h2>
            </div>
            <button className="featured-link group" onClick={() => navigate('/play')}>
              Explore Games <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          <div className="featured-grid">
            <div className="featured-card-bgmi group">
              <img 
                src={bgmiImage} 
                alt="BGMI" 
                className="bgmi-image" 
              />
              <h3 className="featured-card-title">BGMI</h3>
            </div>
            
            <div className="featured-card-val group">
              <img 
                src={valorantImage} 
                alt="Valorant" 
                className="valorant-image" 
              />
              <h3 className="featured-card-title">VALORANT</h3>
            </div>
            
            <div className="featured-card-video group">
              <video
                className="featured-video"
                src={gameVideo}
                poster={valorantImage}
                autoPlay
                muted
                loop
                playsInline
              />
              {/* Optional: You can overlay a title or play button here if desired */}
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="features-section">
        <div className="features-container">
          <span className="features-label">Our Core Features</span>
          <h2 className="features-title">COMPETE. CLIMB. <span className="features-title-highlight">EARN.</span></h2>
          
          <div className="features-grid">
            {[
              { icon: Trophy, title: 'Tournaments', desc: 'Compete in daily, weekly and special tournaments. Challenge the best and win exclusive rewards.' },
              { icon: BarChart2, title: 'Rankings & Leaderboards', desc: 'Climb the ranks and prove you are the best. Track your progress on global leaderboards.' },
              { icon: User, title: 'Player Stats', desc: 'Detailed insights into your performance. Analyze stats, improve your gameplay.' },
              { icon: Award, title: 'Rewards & XP', desc: 'Earn XP, unlock achievements and claim exclusive rewards as you level up.' }
            ].map((feature, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon-box">
                  <feature.icon size={20} />
                </div>
                <h3 className="feature-card-title">0{i+1} <span className="feature-card-title-text">{feature.title}</span></h3>
                <p className="feature-card-desc">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Organizer & Recruiter Section */}
      <section className="organizer-section">
        <div className="organizer-container">
          
          <div className="organizer-text-col">
            <span className="organizer-label">For Organizations & Scouts</span>
            <h2 className="organizer-title">
              HOST TOURNAMENTS. <br />
              <span className="organizer-title-highlight">RECRUIT TALENT.</span>
            </h2>
            <p className="organizer-desc">
              Take control of the competitive scene. Launch custom bracket tournaments with automated matchmaking, and scout verified players using in-depth performance analytics.
            </p>
            
            <div className="organizer-list">
              {[
                'Automated Bracket Management',
                'Advanced Player Analytics & Stats',
                'Secure Prize Pool Distribution'
              ].map((item, i) => (
                <div key={i} className="organizer-list-item">
                  <CheckCircle size={20} className="organizer-list-icon" />
                  {item}
                </div>
              ))}
            </div>

            <button className="organizer-btn" onClick={() => navigate('/login')}>
              Register At SYNCO <ArrowRight size={16} />
            </button>
          </div>

          {/* Abstract UI Mockup */}
          <div className="organizer-visual-col">
            {/* Background glow effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-[#C1A87D]/20 blur-[100px] rounded-full"></div>
            
            <div className="organizer-glass-card">
              <div className="organizer-mockup-header">
                <span className="organizer-mockup-title">Pro League Qualifiers</span>
                <span className="bg-[#C1A87D] text-black text-[10px] font-bold px-2 py-1 rounded uppercase">Live</span>
              </div>
              
              {/* Abstract Bracket Visual */}
              <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-4">
                  <div className="bg-white/10 h-10 rounded-lg border border-white/5"></div>
                  <div className="bg-white/10 h-10 rounded-lg border border-white/5"></div>
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="organizer-bracket-line"></div>
                  <div className="bg-[#C1A87D] h-10 rounded-lg shadow-[0_0_15px_rgba(193,168,125,0.3)]"></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-page"> 
        <div className="cta-container"> 
          <span className="cta-section-label"> 
            The next level starts here 
          </span> 
          
          <h2 className="cta-title"> 
            BUILD YOUR <br /> 
            <span className="cta-title-highlight">LEGACY.</span> 
          </h2> 
          
          <p className="cta-description"> 
            Compete with the best. <br /> 
            Track your journey. <br /> 
            Make your mark. 
          </p> 
          
          <button className="cta-button group" onClick={() => navigate('/login')}> 
            Join Synco 
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /> 
          </button> 
        </div> 
        
        <div className="cta-bottom-text"> 
          SYNCO // COMPETE. IMPROVE. ACHIEVE. 
        </div> 
      </section>
    </div>
  );
};

export default LandingPage;