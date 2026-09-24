
export default function TripDetailsPage() {
  return (
    <div className="flex w-full h-full">
      {/* Left Panel: Itinerary List */}
      <div className="w-full md:w-[450px] h-full bg-white border-r border-gray-200 overflow-y-auto p-6 flex-shrink-0">
        <h1 className="text-2xl font-black">My Paris Trip</h1>
        <p className="text-gray-500 text-sm">Day 1 to Day 5 Itinerary timeline</p>
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl border">Morning: Louvre Museum</div>
          <div className="p-4 bg-gray-50 rounded-xl border">Afternoon: Eiffel Tower</div>
        </div>
      </div>

      {/* Right Panel: The Map Window (Fills all remaining space) */}
      <div className="hidden md:flex flex-grow h-full bg-slate-100 items-center justify-center relative">
        <span className="text-gray-400 font-medium">[ Google Maps Component Canvas ]</span>
        
        {/* Floating Mobile/UI Control example inside full layout */}
        <div className="absolute bottom-6 right-6 bg-white shadow-lg p-3 rounded-lg text-xs font-semibold">
          Map Controls
        </div>
      </div>
    </div>
  );
}
