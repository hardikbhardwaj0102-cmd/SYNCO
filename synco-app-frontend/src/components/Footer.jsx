import { ArrowUpRight } from 'lucide-react';
import '../styles/components/Footer.css';

const Footer = () => {
  return (
    <footer className="footer-wrapper">
      
      {/* Top Section: CTA and Navigation */}
      <div className="footer-top-grid">
        <div className="footer-cta">
          <h2 className="footer-cta-text">Play hard. We handle the rest.</h2>
        </div>

        <div className="footer-links-group">
          <div className="footer-link-col">
            <a className="footer-link">Home</a>
            <a className="footer-link">Games</a>
            <a className="footer-link">Tournaments</a>
            <a className="footer-link">Rankings</a>
            <a className="footer-link">Profile</a>
          </div>
          
          <div className="footer-link-col">
            <a className="footer-link">
              X <ArrowUpRight size={14} />
            </a>
            <a className="footer-link">
              Instagram <ArrowUpRight size={14} />
            </a>
            <a className="footer-link">
              Discord <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </div>

      {/* Middle Section: Location and Legal */}
      <div className="footer-middle-row">
        <div className="flex flex-col gap-1">
          <span>Global HQ—Remote</span>
          <span>India—IN</span>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-end gap-1 md:gap-16 text-left md:text-right">
          <span>contact@synco.gg</span>
          <span>©2026 SYNCO LEGAL</span>
        </div>
      </div>

      {/* Bottom Section: Massive Typography */}
      <div className="footer-brand-container">
        <h1 className="footer-brand-text">SYNCO</h1>
      </div>
      
    </footer>
  );
};

export default Footer;