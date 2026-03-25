'use client';

import { getDisplayRows, type WeeklyHours } from '@/lib/opening-hours';

export default function WeeklyHoursChart({
  title,
  hours,
  emptyLabel = 'Closed',
}: {
  title: string;
  hours: WeeklyHours | null | undefined;
  emptyLabel?: string;
}) {
  const rows = getDisplayRows(hours, { emptyLabel });

  const hasAnyHours = rows.some((row) => row.periods.length > 0);
  if (!hasAnyHours) return null;

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="text-sm font-semibold text-white/80">{title}</div>

      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div
            key={row.day}
            className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3"
          >
            <div className="text-xs font-medium text-white/50">{row.label}</div>

            <div className="min-h-[32px] rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white/75">
              {row.periods.length > 0 ? row.text : emptyLabel === '' ? <span>&nbsp;</span> : row.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}