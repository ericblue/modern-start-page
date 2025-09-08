import { useState, useEffect } from 'react';

export default function DateGreeting() {
  const [date, setDate] = useState(new Date());
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => {
      setDate(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const hour = date.getHours();
    let newGreeting = '';

    if (hour >= 5 && hour < 12) {
      newGreeting = 'Guten Morgen';
    } else if (hour >= 12 && hour < 17) {
      newGreeting = 'Guten Tag';
    } else if (hour >= 17 && hour < 22) {
      newGreeting = 'Guten Abend';
    } else {
      newGreeting = 'Gute Nacht';
    }

    setGreeting(newGreeting);
  }, [date]);

  const formattedDate = date.toLocaleDateString('de-DE', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="text-center space-y-1 sm:space-y-2">
      <p className="text-lg sm:text-xl lg:text-2xl text-secondary-400">{formattedDate}</p>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-secondary-200">{greeting}</h2>
    </div>
  );
} 