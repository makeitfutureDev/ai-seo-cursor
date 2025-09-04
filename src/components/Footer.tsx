import React from 'react';

interface FooterProps {
  onShowTerms?: () => void;
}

const Footer: React.FC<FooterProps> = ({ onShowTerms }) => {
  return (
    <footer className="bg-white/10 backdrop-blur-lg border-t border-white/20">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-white/80 text-sm">
            © 2025 AI Optimizer. All rights reserved.
          </p>
          {onShowTerms && (
            <div className="mt-2 md:mt-0">
              <button
                onClick={onShowTerms}
                className="text-white/80 hover:text-white text-sm underline transition-colors"
              >
                Termeni și Condiții
              </button>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;