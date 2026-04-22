'use client';

import {
  DAY_OPTIONS,
  type DayOfWeek,
} from '@/lib/schedule-rules';

export type DealScheduleItemDraft = {
  id: string;
  selectedDays: DayOfWeek[];
  timeBlocks: Array<{ start_time: string; end_time: string }>;
  title: string;
  dealText: string;
  specialPrice: string;
  description: string;
  notes: string;
};

type Props = {
  items: DealScheduleItemDraft[];
  scheduleType: 'daily_special' | 'lunch_special';
  variant: 'admin' | 'portal';
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onToggleDay: (itemId: string, day: DayOfWeek) => void;
  onSetDaysPreset: (
    itemId: string,
    preset: 'weekdays' | 'weekend' | 'all' | 'clear'
  ) => void;
  onAddTimeBlock: (itemId: string) => void;
  onRemoveTimeBlock: (itemId: string, index: number) => void;
  onUpdateTimeBlock: (
    itemId: string,
    index: number,
    field: 'start_time' | 'end_time',
    value: string
  ) => void;
  onUpdateField: (
    itemId: string,
    field: 'title' | 'dealText' | 'specialPrice' | 'description' | 'notes',
    value: string
  ) => void;
};

export default function DealScheduleItemsEditor({
  items,
  scheduleType,
  variant,
  onAddItem,
  onRemoveItem,
  onToggleDay,
  onSetDaysPreset,
  onAddTimeBlock,
  onRemoveTimeBlock,
  onUpdateTimeBlock,
  onUpdateField,
}: Props) {
  const isPortal = variant === 'portal';

  const surfaceClassName = isPortal
    ? 'portal-surface-subtle rounded-2xl border p-4'
    : 'rounded-2xl border border-orange-200 bg-orange-50 p-4';
  const itemClassName = isPortal
    ? 'portal-surface rounded-2xl border p-4'
    : 'rounded-2xl border border-black/10 bg-white p-4';
  const ghostButtonClassName = isPortal
    ? 'portal-ghost-button rounded-xl border px-3 py-2 text-sm'
    : 'admin-ghost-button rounded-xl border px-3 py-2 text-sm font-medium';
  const inputClassName = isPortal
    ? 'w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/40'
    : 'w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm';
  const textareaClassName = inputClassName;
  const itemLabelClassName = isPortal
    ? 'text-sm font-semibold text-white'
    : 'text-sm font-semibold text-neutral-900';
  const helperTextClassName = isPortal ? 'text-white/62' : 'text-neutral-600';
  const dayButtonBase = 'min-h-[40px] rounded-xl border px-3 py-2 text-sm font-semibold';
  const selectedDayClassName = isPortal
    ? 'border-orange-400 bg-orange-500 text-black shadow-[0_0_0_2px_rgba(251,146,60,0.22)]'
    : 'border-orange-400 bg-orange-500 text-black shadow-[0_0_0_2px_rgba(251,146,60,0.22)]';
  const unselectedDayClassName = isPortal
    ? 'portal-ghost-button'
    : 'admin-ghost-button border';

  return (
    <div className={`mt-4 ${surfaceClassName}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={itemLabelClassName}>
            {scheduleType === 'daily_special' ? 'Daily special items' : 'Lunch special items'}
          </div>
          <div className={`mt-1 text-xs ${helperTextClassName}`}>
            One item block equals one special. Add a fresh block for each separate offer.
          </div>
        </div>
        <button type="button" onClick={onAddItem} className={ghostButtonClassName}>
          Add special item
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {items.map((item, itemIndex) => (
          <div key={item.id} className={itemClassName}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className={itemLabelClassName}>Item {itemIndex + 1}</div>
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className={isPortal
                    ? 'portal-danger-button rounded-xl border px-3 py-2 text-sm'
                    : 'rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50'}
                >
                  Remove item
                </button>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => onSetDaysPreset(item.id, 'weekdays')} className={ghostButtonClassName}>
                Mon-Fri
              </button>
              <button type="button" onClick={() => onSetDaysPreset(item.id, 'weekend')} className={ghostButtonClassName}>
                Weekend
              </button>
              <button type="button" onClick={() => onSetDaysPreset(item.id, 'all')} className={ghostButtonClassName}>
                All days
              </button>
              <button type="button" onClick={() => onSetDaysPreset(item.id, 'clear')} className={ghostButtonClassName}>
                Clear days
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {DAY_OPTIONS.map((day) => {
                const active = item.selectedDays.includes(day.value);
                return (
                  <button
                    key={`${item.id}-${day.value}`}
                    type="button"
                    onClick={() => onToggleDay(item.id, day.value)}
                    className={`${dayButtonBase} ${active ? selectedDayClassName : unselectedDayClassName}`}
                    aria-pressed={active}
                  >
                    {active ? `Selected ${day.label}` : day.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className={itemLabelClassName}>Time blocks</div>
                <button
                  type="button"
                  onClick={() => onAddTimeBlock(item.id)}
                  className={ghostButtonClassName}
                >
                  Add block
                </button>
              </div>
              <div className="space-y-3">
                {item.timeBlocks.map((block, blockIndex) => (
                  <div
                    key={`${item.id}-${blockIndex}-${block.start_time}-${block.end_time}`}
                    className={isPortal
                      ? 'portal-surface-subtle grid gap-2.5 rounded-2xl border p-3 md:grid-cols-[1fr_1fr_auto]'
                      : 'grid gap-2.5 rounded-2xl border border-black/10 bg-white/70 p-3 md:grid-cols-[1fr_1fr_auto]'}
                  >
                    <input
                      type="time"
                      value={block.start_time}
                      onChange={(event) =>
                        onUpdateTimeBlock(item.id, blockIndex, 'start_time', event.target.value)
                      }
                      className={inputClassName}
                    />
                    <input
                      type="time"
                      value={block.end_time}
                      onChange={(event) =>
                        onUpdateTimeBlock(item.id, blockIndex, 'end_time', event.target.value)
                      }
                      className={inputClassName}
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveTimeBlock(item.id, blockIndex)}
                      className={isPortal
                        ? 'portal-danger-button rounded-xl border px-3 py-2 text-sm'
                        : 'rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50'}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className={`mb-1 block text-sm font-medium ${isPortal ? 'text-white/82' : ''}`}>Title</label>
                <input
                  type="text"
                  value={item.title}
                  onChange={(event) => onUpdateField(item.id, 'title', event.target.value)}
                  placeholder={scheduleType === 'daily_special' ? 'e.g. Steak Night' : 'e.g. Lunch Special'}
                  className={inputClassName}
                />
              </div>
              <div>
                <label className={`mb-1 block text-sm font-medium ${isPortal ? 'text-white/82' : ''}`}>Deal text / summary</label>
                <input
                  type="text"
                  value={item.dealText}
                  onChange={(event) => onUpdateField(item.id, 'dealText', event.target.value)}
                  placeholder={scheduleType === 'daily_special' ? 'e.g. Parmi + chips $20' : 'e.g. Lunch special $15'}
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className={`mb-1 block text-sm font-medium ${isPortal ? 'text-white/82' : ''}`}>Structured price</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={item.specialPrice}
                  onChange={(event) => onUpdateField(item.id, 'specialPrice', event.target.value)}
                  placeholder={scheduleType === 'lunch_special' ? 'e.g. 15' : 'e.g. 20'}
                  className={inputClassName}
                />
                <div className={`mt-1 text-xs ${helperTextClassName}`}>
                  Used for filterable special pricing without changing your public copy.
                </div>
              </div>
            </div>

            <div className="mt-3.5">
              <label className={`mb-1 block text-sm font-medium ${isPortal ? 'text-white/82' : ''}`}>Description</label>
              <textarea
                value={item.description}
                onChange={(event) => onUpdateField(item.id, 'description', event.target.value)}
                rows={3}
                placeholder="Optional detail for this special or offer"
                className={textareaClassName}
              />
            </div>

            <div className="mt-3.5">
              <label className={`mb-1 block text-sm font-medium ${isPortal ? 'text-white/82' : ''}`}>Notes</label>
              <textarea
                value={item.notes}
                onChange={(event) => onUpdateField(item.id, 'notes', event.target.value)}
                rows={3}
                placeholder="Optional notes"
                className={textareaClassName}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
