'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type Venue = {
  id: string;
  name: string | null;
  suburb: string | null;
  venue_type_id: string | null;
};

type ScheduleType =
  | 'opening'
  | 'kitchen'
  | 'happy_hour'
  | 'trivia'
  | 'live_music'
  | 'sport'
  | 'comedy'
  | 'karaoke'
  | 'dj'
  | 'special_event';

type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

type SaveMode = 'append' | 'replace';

type TimeBlock = {
  start_time: string;
  end_time: string;
};

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const SCHEDULE_TYPE_OPTIONS: { value: ScheduleType; label: string }[] = [
  { value: 'opening', label: 'Opening Hours' },
  { value: 'kitchen', label: 'Kitchen Hours' },
  { value: 'happy_hour', label: 'Happy Hour' },
  { value: 'trivia', label: 'Trivia' },
  { value: 'live_music', label: 'Live Music' },
  { value: 'sport', label: 'Sport' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'dj', label: 'DJ' },
  { value: 'special_event', label: 'Special Event' },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function formatVenueTypeId(value: string | null) {
  if (!value) return '—';

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function requiresTitle(type: ScheduleType) {
  return [
    'trivia',
    'live_music',
    'sport',
    'comedy',
    'karaoke',
    'dj',
    'special_event',
  ].includes(type);
}

export default function AdminSchedulesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);

  const [scheduleType, setScheduleType] = useState<ScheduleType>('opening');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [saveMode, setSaveMode] = useState<SaveMode>('replace');

  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([
    { start_time: '', end_time: '' },
  ]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dealText, setDealText] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadVenues() {
      setLoadingVenues(true);
      setErrorMessage(null);
      setMessage(null);

      const { data, error } = await supabase
        .from('venues')
        .select('id, name, suburb, venue_type_id')
        .order('name', { ascending: true });

      console.log('VENUES QUERY RESULT:', { data, error });

      if (error) {
        setErrorMessage(`Failed to load venues: ${error.message}`);
        setVenues([]);
      } else if (!data || data.length === 0) {
        setVenues([]);
        setErrorMessage(
          'No venues returned from Supabase. Check table name, RLS policies, and whether this project has venue data.'
        );
      } else {
        setVenues((data ?? []) as Venue[]);
      }

      setLoadingVenues(false);
    }

    loadVenues();
  }, []);

  const filteredVenues = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return venues;

    return venues.filter((venue) => {
      const haystack = [
        venue.name ?? '',
        venue.suburb ?? '',
        venue.venue_type_id ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [venues, search]);

  function toggleVenue(id: string) {
    setSelectedVenueIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function selectAllFiltered() {
    const filteredIds = filteredVenues.map((venue) => venue.id);
    setSelectedVenueIds((current) => {
      const set = new Set([...current, ...filteredIds]);
      return Array.from(set);
    });
  }

  function clearFiltered() {
    const filteredIds = new Set(filteredVenues.map((venue) => venue.id));
    setSelectedVenueIds((current) =>
      current.filter((id) => !filteredIds.has(id))
    );
  }

  function toggleDay(day: DayOfWeek) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    );
  }

  function updateTimeBlock(
    index: number,
    field: keyof TimeBlock,
    value: string
  ) {
    setTimeBlocks((current) =>
      current.map((block, i) =>
        i === index ? { ...block, [field]: value } : block
      )
    );
  }

  function addTimeBlock() {
    setTimeBlocks((current) => [...current, { start_time: '', end_time: '' }]);
  }

  function removeTimeBlock(index: number) {
    setTimeBlocks((current) => {
      if (current.length === 1) return current;
      return current.filter((_, i) => i !== index);
    });
  }

  function resetFormAfterSave() {
    setSelectedDays([]);
    setTimeBlocks([{ start_time: '', end_time: '' }]);
    setTitle('');
    setDescription('');
    setDealText('');
    setNotes('');
  }

  async function handleSave() {
    setMessage(null);
    setErrorMessage(null);

    if (!selectedVenueIds.length) {
      setErrorMessage('Please select at least one venue.');
      return;
    }

    if (!selectedDays.length) {
      setErrorMessage('Please select at least one day.');
      return;
    }

    const cleanedTimeBlocks = timeBlocks
      .map((block) => ({
        start_time: block.start_time.trim(),
        end_time: block.end_time.trim(),
      }))
      .filter((block) => block.start_time && block.end_time);

    if (!cleanedTimeBlocks.length) {
      setErrorMessage('Please add at least one valid time block.');
      return;
    }

    for (const block of cleanedTimeBlocks) {
      if (block.start_time === block.end_time) {
        setErrorMessage('Start and end time cannot be the same.');
        return;
      }
    }

    if (requiresTitle(scheduleType) && !title.trim()) {
      setErrorMessage(
        `Please enter a title for ${scheduleType.replace(/_/g, ' ')}.`
      );
      return;
    }

    setSaving(true);

    try {
      if (saveMode === 'replace') {
        const { error: deleteError } = await supabase
          .from('venue_schedule_rules')
          .delete()
          .in('venue_id', selectedVenueIds)
          .eq('schedule_type', scheduleType)
          .in('day_of_week', selectedDays);

        if (deleteError) {
          throw deleteError;
        }
      }

      const rows = selectedVenueIds.flatMap((venueId) =>
        selectedDays.flatMap((day) =>
          cleanedTimeBlocks.map((block, index) => ({
            venue_id: venueId,
            schedule_type: scheduleType,
            day_of_week: day,
            start_time: block.start_time,
            end_time: block.end_time,
            sort_order: index + 1,
            title: title.trim() || null,
            description: description.trim() || null,
            deal_text: dealText.trim() || null,
            notes: notes.trim() || null,
            is_active: true,
            status: 'published',
          }))
        )
      );

      const { error: insertError } = await supabase
        .from('venue_schedule_rules')
        .insert(rows);

      if (insertError) {
        throw insertError;
      }

      setMessage(
        `Saved ${rows.length} schedule row${rows.length === 1 ? '' : 's'} successfully.`
      );
      resetFormAfterSave();
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = selectedVenueIds.length;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Admin Schedules
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Bulk-manage opening hours, kitchen hours, happy hours, and recurring
            events.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">
                1. Select Venues
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                Search and select one or many venues.
              </p>
            </div>

            <div className="mb-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by venue, suburb, or type"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
              >
                Select all filtered
              </button>
              <button
                type="button"
                onClick={clearFiltered}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
              >
                Clear filtered
              </button>
              <div className="ml-auto rounded-xl bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700">
                Selected: {selectedCount}
              </div>
            </div>

            {errorMessage && !venues.length ? (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {errorMessage}
              </div>
            ) : null}

            <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-neutral-200">
              {loadingVenues ? (
                <div className="p-4 text-sm text-neutral-600">Loading venues…</div>
              ) : filteredVenues.length === 0 ? (
                <div className="p-4 text-sm text-neutral-600">No venues found.</div>
              ) : (
                <div className="divide-y divide-neutral-200">
                  {filteredVenues.map((venue) => {
                    const checked = selectedVenueIds.includes(venue.id);

                    return (
                      <label
                        key={venue.id}
                        className="flex cursor-pointer items-start gap-3 p-3 hover:bg-neutral-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleVenue(venue.id)}
                          className="mt-1 h-4 w-4"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-neutral-900">
                            {venue.name ?? 'Unnamed venue'}
                          </div>
                          <div className="mt-1 text-sm text-neutral-600">
                            {venue.suburb ?? '—'} •{' '}
                            {formatVenueTypeId(venue.venue_type_id)}
                          </div>
                          <div className="mt-1 break-all text-xs text-neutral-400">
                            {venue.id}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">
                2. Create Schedule Rules
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                Apply the same schedule to multiple venues and days in one save.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Schedule Type
                </label>
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                >
                  {SCHEDULE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Save Mode
                </label>
                <select
                  value={saveMode}
                  onChange={(e) => setSaveMode(e.target.value as SaveMode)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                >
                  <option value="replace">Replace existing selected days</option>
                  <option value="append">Append to existing</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                Days
              </label>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((day) => {
                  const active = selectedDays.includes(day.value);

                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                        active
                          ? 'bg-neutral-900 text-white'
                          : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-neutral-700">
                  Time Blocks
                </label>
                <button
                  type="button"
                  onClick={addTimeBlock}
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                >
                  Add time block
                </button>
              </div>

              <div className="space-y-3">
                {timeBlocks.map((block, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-2xl border border-neutral-200 p-3 md:grid-cols-[1fr_1fr_auto]"
                  >
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Start
                      </label>
                      <input
                        type="time"
                        value={block.start_time}
                        onChange={(e) =>
                          updateTimeBlock(index, 'start_time', e.target.value)
                        }
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                        End
                      </label>
                      <input
                        type="time"
                        value={block.end_time}
                        onChange={(e) =>
                          updateTimeBlock(index, 'end_time', e.target.value)
                        }
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeTimeBlock(index)}
                        disabled={timeBlocks.length === 1}
                        className="rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    requiresTitle(scheduleType)
                      ? 'Required for event-style schedule types'
                      : 'Optional'
                  }
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Deal Text
                </label>
                <input
                  type="text"
                  value={dealText}
                  onChange={(e) => setDealText(e.target.value)}
                  placeholder="e.g. $7 schooners / $12 cocktails"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional description"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Internal notes or extra context"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </div>

            {message ? (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                {message}
              </div>
            ) : null}

            {errorMessage && venues.length > 0 ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save schedule rules'}
              </button>

              <button
                type="button"
                onClick={resetFormAfterSave}
                disabled={saving}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear form
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}