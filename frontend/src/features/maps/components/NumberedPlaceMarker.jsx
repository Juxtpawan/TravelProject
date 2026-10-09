import { AdvancedMarker } from '@vis.gl/react-google-maps';
import NumberedPin from './NumberedPin';

/** Shared Advanced Marker wrapper; callers provide normalized coordinates and category styling. */
export default function NumberedPlaceMarker({ position, title, number, category, selected = false, onClick }) {
  return (
    <AdvancedMarker
      position={position}
      title={title}
      zIndex={selected ? 1000 : undefined}
      onClick={onClick}
    >
      <NumberedPin number={number} category={category} selected={selected} />
    </AdvancedMarker>
  );
}
