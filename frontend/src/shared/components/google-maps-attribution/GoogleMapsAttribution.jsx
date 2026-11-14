/** Official Google Maps attribution mark for Google Maps sourced content. */
export default function GoogleMapsAttribution({ className = '', alt = 'Google Maps' }) {
  return <img
    src="/google-maps-logo-dark.svg"
    alt={alt}
    className={`inline-block h-4 w-auto max-w-full align-middle ${className}`}
  />;
}
