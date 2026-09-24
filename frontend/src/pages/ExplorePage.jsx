export default function ExplorePage() {
  return (
    <div className="space-y-6">
      <div className="bg-pine text-white p-8 rounded-2xl">
        <h1 className="text-3xl font-bold">Explore Destinations</h1>
        <p className="opacity-90">Notice how this banner stops expanding on huge screens!</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-xs border border-gray-200">
            <h3 className="font-bold text-lg">Top Place {i}</h3>
            <p className="text-gray-500 text-sm mt-1">Responsive card content.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
