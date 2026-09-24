// src/pages/TripsPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function TripsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black text-gray-900">My Trips</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-xs">
          + Create a Trip
        </button>
      </div>

      {/* Grid of trips matching your Tripadvisor style bounds */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between h-48">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Upcoming</span>
            <h3 className="font-bold text-xl mt-1 text-gray-900">Summer in Paris</h3>
            <p className="text-gray-500 text-sm mt-1">July 12 - July 18, 2026</p>
          </div>
          
          {/* Link jumps directly into the immersive edge-to-edge split layout */}
          <Link 
            to="/trips/paris-123" 
            className="text-sm font-semibold text-blue-600 hover:underline mt-4 block"
          >
            Open Planning Workspace →
          </Link>
        </div>
      </div>
    </div>
  );
}
