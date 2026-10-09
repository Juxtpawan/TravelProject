/** Shared numbered map pin used by itinerary and destination POIs. */
export default function NumberedPin({ number, category, selected = false, small = false }) {
  const pinPath = 'M24 2C11.85 2 2 11.85 2 24c0 14.3 20.3 32.9 21.17 33.68a1.25 1.25 0 0 0 1.66 0C25.7 56.9 46 38.3 46 24 46 11.85 36.15 2 24 2Z';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 60"
      className={`${small ? 'h-9 w-7' : 'h-14 w-11'} overflow-visible drop-shadow-md transition-transform ${selected ? 'scale-110' : 'hover:scale-105'}`}
    >
      <path d={pinPath} fill="white" />
      <path d={pinPath} fill={category.border} transform="translate(2 2) scale(.917)" />
      <path d={pinPath} fill={category.color} transform="translate(4 4) scale(.833)" />
      <text x="24" y={small ? '26' : '29'} textAnchor="middle" dominantBaseline="central" fill="#000000" fontSize={small ? '19' : '24'} fontWeight="900" fontFamily="inherit">
        {number}
      </text>
    </svg>
  );
}
