import { FcGoogle } from 'react-icons/fc';

/** Current full-color Google G mark, used as a compact source indicator. */
export default function GoogleGMark({ className = '', title = 'Google Maps rating' }) {
  return <FcGoogle role="img" aria-label={title} title={title} className={`inline-block h-5 w-5 shrink-0 ${className}`} />;
}
