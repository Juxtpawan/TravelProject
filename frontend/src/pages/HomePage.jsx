// src/pages/HomePage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    // Redirects user to the explore page with their search term
    navigate(`/explore?search=${encodeURIComponent(searchQuery)}`);
  };

  // Quick mock data for popular destinations
  const popularPlaces = [
    { name: 'Paris', image: 'https://unsplash.com/paris', trips: '3.2k planned' },
    { name: 'Tokyo', image: 'https://unsplash.com', trips: '2.8k planned' },
    { name: 'New York', image: 'https://unsplash.com', trips: '4.1k planned' },
  ];

  return (
    <div className="w-full bg-off-white">
      {/* 1. Hero Section with Search Input */}
      <section className="relative h-[200px] flex items-center justify-center bg-off-white overflow-hidden">
        {/* Background Image Overlay */}
        <div className="absolute inset-0 opacity-40 bg-[url('https://unsplash.com')] bg-cover bg-center" />
        
        <div className="relative z-10 max-w-2xl text-center px-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-pine mb-4 tracking-tight">
            Where to go?
          </h1>

          {/* Search Form Wrapper */}
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2 bg-white border-2 border-border-default p-2 rounded-xl shadow-xl">
            <input
              type="text"
              placeholder="Place to go, things to do, hotel"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="grow px-4 py-3 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none text-base"
            />
            <button
              type="submit"
              className="bg-green border-border-default hover:bg-moss text-pine font-semibold px-6 py-3 rounded-lg transition-colors shadow-md"
            >
              Start Planning
            </button>
          </form>
        </div>
      </section>

      {/* 2. Popular Destinations Grid Section */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-pine">Popular destinations</h2>
          <p className="text-slate-500 mt-1">Inspiring places to build your next itinerary</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {popularPlaces.map((place) => (
            <div 
              key={place.name} 
              className="group cursor-pointer rounded-xl overflow-hidden shadow-sm hover:shadow-md border border-slate-100 transition-all bg-white"
              onClick={() => navigate(`/explore?search=${place.name}`)}
            >
              <div className="h-48 w-full overflow-hidden relative">
                <img 
                  src={place.image} 
                  alt={place.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-bold text-lg text-pine">{place.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{place.trips}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
