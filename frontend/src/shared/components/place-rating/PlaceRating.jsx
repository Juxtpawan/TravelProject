/** Five-star visual rating used consistently in place cards and details. */
export default function PlaceRating({ rating, size = 'sm', className = '' }) {
  const value = Math.min(5, Math.max(0, Number(rating) || 0));
  const starsClass = size === 'lg' ? 'text-xl' : 'text-sm';

  return (
    <span className={`inline-flex shrink-0 items-center gap-px leading-none ${starsClass} ${className}`} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, value - index)) * 100;
        return <span key={index} className="relative inline-block text-[#d9dfda]" aria-hidden="true">
          ★
          <span className="absolute inset-y-0 left-0 overflow-hidden text-[#f5a623]" style={{ width: `${fill}%` }}>★</span>
        </span>;
      })}
    </span>
  );
}
