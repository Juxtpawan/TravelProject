import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function WorkspaceRailControls({ backTo, backLabel, expandLabel, onExpand, className = '' }) {
  return (
    <div className={`flex h-full w-full flex-col items-center gap-3 py-3 ${className}`}>
      <Link to={backTo} aria-label={backLabel} title={backLabel} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-pine transition hover:bg-slate-100">
        <ArrowLeft size={17} />
      </Link>
      <span className="h-px w-8 bg-slate-200" />
      <button type="button" onClick={onExpand} aria-label={expandLabel} title={expandLabel} className="flex w-full min-h-0 flex-1 items-center justify-center rounded-lg px-2 text-pine text-center transition hover:bg-slate-50">
        <span className="flex -rotate-180 flex-col items-center gap-2 text-xs font-bold tracking-wide [writing-mode:vertical-rl]">{expandLabel}</span>
      </button>
    </div>
  );
}
