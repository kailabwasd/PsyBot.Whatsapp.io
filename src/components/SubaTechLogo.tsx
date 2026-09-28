import React, { useState, useEffect } from 'react';

interface SubaTechLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  theme?: 'dark' | 'light' | 'auto';
}

export const SubaTechLogo: React.FC<SubaTechLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = true,
  theme = 'auto',
}) => {
  const [resolvedIsLight, setResolvedIsLight] = useState<boolean>(() => {
    if (theme === 'light') return true;
    if (theme === 'dark') return false;
    if (typeof document !== 'undefined') {
      return !document.documentElement.classList.contains('access-dark-mode');
    }
    return true;
  });

  useEffect(() => {
    if (theme === 'light') {
      setResolvedIsLight(true);
      return;
    }
    if (theme === 'dark') {
      setResolvedIsLight(false);
      return;
    }

    // Auto check from DOM / localStorage
    const updateThemeCheck = () => {
      const isDarkModeActive = document.documentElement.classList.contains('access-dark-mode');
      const savedSettings = localStorage.getItem('psybot_accessibility_settings');
      let isDarkSetting = false;
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          if (parsed.darkMode) isDarkSetting = true;
        } catch (e) {}
      }
      setResolvedIsLight(!isDarkModeActive && !isDarkSetting);
    };

    updateThemeCheck();

    const handleStorageChange = () => updateThemeCheck();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('applet:accessibilitychange', handleStorageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('applet:accessibilitychange', handleStorageChange as EventListener);
    };
  }, [theme]);

  // Dimension scales
  const scale = {
    sm: { height: 28, textMain: 'text-lg', psybot: 'text-lg', tagline: 'text-[9px]' },
    md: { height: 38, textMain: 'text-2xl sm:text-3xl', psybot: 'text-2xl sm:text-3xl', tagline: 'text-[10px] sm:text-xs' },
    lg: { height: 52, textMain: 'text-3xl sm:text-4xl', psybot: 'text-3xl sm:text-4xl', tagline: 'text-xs sm:text-sm' },
    xl: { height: 68, textMain: 'text-4xl sm:text-5xl', psybot: 'text-4xl sm:text-5xl', tagline: 'text-sm sm:text-base' },
  }[size];

  return (
    <div className={`inline-flex flex-col select-none ${className}`}>
      <div className="flex items-center gap-2 font-black tracking-tight leading-none">
        
        {/* "Psybot" Brand */}
        <div className="flex items-center">
          <span className={`${scale.psybot} font-black ${resolvedIsLight ? 'text-[#0B2545]' : 'text-white'}`}>Psy</span>
          <span className={`${scale.psybot} font-black text-[#00E5FF] drop-shadow-[0_0_12px_rgba(0,229,255,0.4)]`}>bot</span>
        </div>

        {/* Separator */}
        <span className={`${resolvedIsLight ? 'text-slate-500' : 'text-slate-400'} text-sm font-bold`}>/</span>

        {/* SubaTECH Logo */}
        <div className="flex items-center font-black tracking-tight leading-none">
          {/* "Suba" */}
          <span
            className={`${scale.textMain} font-extrabold transition-colors ${
              resolvedIsLight ? 'text-[#0B2545]' : 'text-slate-100'
            }`}
            style={{ letterSpacing: '-0.03em' }}
          >
            Suba
          </span>

          {/* "T" in Cyan / Clear */}
          <span
            className={`${scale.textMain} font-black text-[#00E5FF]`}
            style={{ textShadow: '0 0 20px rgba(0,229,255,0.3)' }}
          >
            T
          </span>

          {/* "E" in Cyan with Play-Triangle */}
          <span className={`relative inline-flex items-center ${scale.textMain} font-black text-[#00E5FF]`}>
            <span>E</span>
            {/* Cyan play triangle accent */}
            <span 
              className="absolute left-[38%] top-[42%] -translate-y-1/2 w-0 h-0 border-y-[3.5px] border-y-transparent border-l-[6px] border-l-[#00E5FF] pointer-events-none drop-shadow-[0_0_4px_#00E5FF]"
              style={{
                filter: 'drop-shadow(0 0 3px rgba(0,229,255,0.8))'
              }}
            />
          </span>

          {/* "C" in Lime Green with central Yellow dot */}
          <span className={`relative inline-flex items-center justify-center ${scale.textMain} font-black text-[#2BF267]`}>
            <span>C</span>
            {/* Yellow core circle inside C */}
            <span
              className="absolute left-[34%] top-[50%] -translate-y-1/2 w-[28%] h-[28%] rounded-full bg-[#FAFF00] shadow-[0_0_8px_#FAFF00] pointer-events-none"
            />
          </span>

          {/* "H" in Vivid Coral/Red */}
          <span
            className={`${scale.textMain} font-black text-[#FF3646]`}
            style={{ textShadow: '0 0 20px rgba(255,54,70,0.3)' }}
          >
            H
          </span>
        </div>
      </div>

      {/* Tagline: "Cocreando la Suba del futuro" */}
      {showTagline && (
        <span
          className={`${scale.tagline} font-bold tracking-[0.22em] mt-1 ${
            resolvedIsLight ? 'text-slate-700' : 'text-slate-300'
          }`}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          Cocreando la Suba del futuro
        </span>
      )}
    </div>
  );
};
