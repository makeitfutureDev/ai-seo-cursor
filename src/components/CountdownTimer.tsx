import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  language: 'en' | 'ro';
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ language }) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('00:00:00');

  const translations = {
    en: {
      label: 'Next Analysis In:'
    },
    ro: {
      label: 'Următoarea Analiză În:'
    }
  };

  const t = translations[language];

  const calculateTimeRemaining = (): string => {
    const now = new Date();
    
    // Bucharest is UTC+3 in summer (EEST) and UTC+2 in winter (EET)
    // For simplicity, we'll use UTC+2 as the standard offset
    // Midnight in Bucharest (UTC+2) = 22:00 UTC (10 PM UTC)
    const BUCHAREST_UTC_OFFSET_HOURS = 2;
    const BUCHAREST_MIDNIGHT_UTC_HOUR = 24 - BUCHAREST_UTC_OFFSET_HOURS; // 22:00 UTC
    
    // Create next midnight Bucharest time (which is 22:00 UTC)
    let nextReset = new Date();
    nextReset.setUTCHours(BUCHAREST_MIDNIGHT_UTC_HOUR, 0, 0, 0); // Set to 22:00 UTC (midnight Bucharest)
    
    // If current time is past midnight Bucharest today, set to tomorrow's midnight Bucharest
    if (now.getTime() >= nextReset.getTime()) {
      nextReset.setUTCDate(nextReset.getUTCDate() + 1);
    }
    
    const timeDiff = nextReset.getTime() - now.getTime();
    
    // If time difference is negative or very small, set to next day (should be handled by above logic, but as a safeguard)
    if (timeDiff <= 0) {
      nextReset.setUTCDate(nextReset.getUTCDate() + 1);
      const newTimeDiff = nextReset.getTime() - now.getTime();
      return formatTimeDifference(newTimeDiff);
    }
    
    return formatTimeDifference(timeDiff);
  };

  const formatTimeDifference = (timeDiff: number): string => {
    
    // Calculate hours, minutes, and seconds
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    // Format with leading zeros
    const formatTime = (num: number): string => num.toString().padStart(2, '0');
    
    return `${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`;
  };

  useEffect(() => {
    // Update immediately
    setTimeRemaining(calculateTimeRemaining());
    
    // Set up interval to update every second
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);
    
    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center space-x-2 bg-white/20 rounded-full px-4 py-2">
      <Clock className="h-4 w-4 text-white" />
      <div className="text-white">
        <div className="text-xs font-medium opacity-90">
          {t.label}
        </div>
        <div className="text-sm font-mono font-bold">
          {timeRemaining}
        </div>
      </div>
    </div>
  );
};

export default CountdownTimer;