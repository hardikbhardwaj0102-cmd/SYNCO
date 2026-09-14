import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import '../styles/pages/RegistrationGateway.css';

const RegistrationGateway = () => {
  const [profileType, setProfileType] = useState('organization');

  // Future Cloudflare D1 Form Submit
  // const handleRegistration = async (e) => {
  //   e.preventDefault();
  //   await fetch('/api/register', { method: 'POST', body: formData });
  // };

  return (
    <div className="register-wrapper">
      <div className="register-card">
        
        <div className="register-header-box">
          <h1 className="register-title">Register Yourself:</h1>
          <p className="register-subtitle">Please select your profile type to proceed.</p>
        </div>

        {/* Custom Toggle Switch matching "image_04cc45.png" */}
        <div className="register-toggle-group">
          <button
            onClick={() => setProfileType('organization')}
            className={`register-toggle-btn ${
              profileType === 'organization' 
                ? 'register-toggle-active' 
                : 'register-toggle-inactive'
            }`}
          >
            Organization
            {profileType === 'organization' && <CheckCircle2 size={16} className="text-white" fill="black" />}
          </button>
          
          <button
            onClick={() => setProfileType('recruiter')}
            className={`register-toggle-btn ${
              profileType === 'recruiter' 
                ? 'register-toggle-active' 
                : 'register-toggle-inactive'
            }`}
          >
            Recruiter
            {profileType === 'recruiter' && <CheckCircle2 size={16} className="text-white" fill="black" />}
          </button>
        </div>

        {/* Dynamic Form Area */}
        <div className="register-form-box">
          <h2 className="register-form-title">
            {profileType === 'organization' ? 'Organization Registration Form' : 'Recruiter Registration Form'}
          </h2>
          <p className="register-form-subtitle">
            {profileType === 'organization' ? 'Organization Basic Information' : 'Recruiter & Agency Details'}
          </p>

          <form className="register-form">
            <div className="register-form-group">
              <label className="register-label">
                {profileType === 'organization' ? 'Organization Name' : 'Recruiter Full Name'}
              </label>
              <input 
                type="text" 
                className="register-input" 
                placeholder="Type here..."
              />
            </div>
            
            {/* Add more form fields as needed for the backend integration */}
            
            <button type="button" className="register-submit-btn">
              Submit Application
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default RegistrationGateway;