import { useEffect, useState } from 'react';

export const HERO_IMAGES = [
  {
    src: '/images/home-hero-eiffel-1600.jpg',
    srcSet: '/images/home-hero-eiffel-640.jpg 640w, /images/home-hero-eiffel-1024.jpg 1024w, /images/home-hero-eiffel-1600.jpg 1600w',
  },
  {
    src: '/images/home-hero-taj-mahal-1600.jpg',
    srcSet: '/images/home-hero-taj-mahal-640.jpg 640w, /images/home-hero-taj-mahal-1024.jpg 1024w, /images/home-hero-taj-mahal-1600.jpg 1600w',
  },
  {
    src: '/images/home-hero-santorini-1600.jpg',
    srcSet: '/images/home-hero-santorini-640.jpg 640w, /images/home-hero-santorini-1024.jpg 1024w, /images/home-hero-santorini-1600.jpg 1600w',
  },
  {
    src: '/images/home-hero-mountain.jpg',
    srcSet: '/images/home-hero-mountain-640.jpg 640w, /images/home-hero-mountain-1024.jpg 1024w, /images/home-hero-mountain.jpg 1280w',
  },
];

const ROTATION_INTERVAL_MS = 9000;

function getCurrentHeroImageIndex() {
  return Math.floor(Date.now() / ROTATION_INTERVAL_MS) % HERO_IMAGES.length;
}

export function useHeroImageIndex() {
  const [index, setIndex] = useState(getCurrentHeroImageIndex);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIndex(0);
      return undefined;
    }

    const updateIndex = () => setIndex(getCurrentHeroImageIndex());
    const firstTickDelay = ROTATION_INTERVAL_MS - (Date.now() % ROTATION_INTERVAL_MS);
    let intervalId;
    const firstTimeoutId = window.setTimeout(() => {
      updateIndex();
      intervalId = window.setInterval(updateIndex, ROTATION_INTERVAL_MS);
    }, firstTickDelay);

    return () => {
      window.clearTimeout(firstTimeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  return index;
}
