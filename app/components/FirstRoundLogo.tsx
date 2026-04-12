'use client';

export default function FirstRoundLogo({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={[
          'relative shrink-0 overflow-hidden rounded-[22px] bg-gradient-to-br from-orange-400 via-orange-500 to-[#ff5a1f] shadow-[0_10px_30px_rgba(255,111,36,0.35)]',
          compact ? 'h-11 w-11' : 'h-12 w-12',
        ].join(' ')}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_48%)]" />
        <div
          className={[
            'absolute inset-0 flex items-center justify-center font-black italic text-white',
            compact ? 'text-2xl' : 'text-[28px]',
          ].join(' ')}
          style={{ textShadow: '4px 4px 0 rgba(158,46,0,0.22)' }}
        >
          FR
        </div>
      </div>

      <div className="leading-none text-white">
        <div
          className={[
            'font-black uppercase italic tracking-tight',
            compact ? 'text-xl' : 'text-2xl',
          ].join(' ')}
          style={{ textShadow: '3px 3px 0 rgba(0,0,0,0.18)' }}
        >
          First
        </div>
        <div
          className={[
            '-mt-1 font-black uppercase italic tracking-tight',
            compact ? 'text-xl' : 'text-2xl',
          ].join(' ')}
          style={{ textShadow: '3px 3px 0 rgba(0,0,0,0.18)' }}
        >
          Round
        </div>
        <div className="mt-1 h-1.5 w-20 skew-x-[-24deg] rounded-full bg-gradient-to-r from-[#ff5a1f] to-orange-300" />
      </div>
    </div>
  );
}
