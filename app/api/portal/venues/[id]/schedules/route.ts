import { NextResponse } from 'next/server';
import { requirePortalVenueRequest } from '@/lib/portal-server';

type ScheduleType =
  | 'opening'
  | 'kitchen'
  | 'happy_hour'
  | 'bottle_shop'
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

type OpeningHours = Partial<Record<DayOfWeek, Array<{ open: string; close: string }>>>;

function buildHoursJsonFromRows(
  scheduleRows: Array<{
    day_of_week: DayOfWeek;
    start_time: string;
    end_time: string;
    sort_order?: number | null;
  }>
): OpeningHours | null {
  const orderedDays: DayOfWeek[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  const output: OpeningHours = {};

  for (const day of orderedDays) {
    const matching = scheduleRows
      .filter((row) => row.day_of_week === day)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((row) => ({
        open: row.start_time.slice(0, 5),
        close: row.end_time.slice(0, 5),
      }));

    if (matching.length > 0) {
      output[day] = matching;
    }
  }

  return Object.keys(output).length > 0 ? output : null;
}

async function syncVenueHoursColumn(
  supabase: ReturnType<typeof import('@/lib/supabaseServer').supabaseServer>,
  venueId: string,
  scheduleType: ScheduleType
) {
  const columnMap: Partial<
    Record<
      ScheduleType,
      'opening_hours' | 'kitchen_hours' | 'happy_hour_hours'
    >
  > = {
    opening: 'opening_hours',
    kitchen: 'kitchen_hours',
    happy_hour: 'happy_hour_hours',
  };

  const targetColumn = columnMap[scheduleType];
  if (!targetColumn) return;

  const { data, error } = await supabase
    .from('venue_schedule_rules')
    .select('day_of_week, start_time, end_time, sort_order, is_active, status')
    .eq('venue_id', venueId)
    .eq('schedule_type', scheduleType)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);

  const liveRows = ((data ?? []) as Array<{
    day_of_week: DayOfWeek;
    start_time: string;
    end_time: string;
    sort_order?: number | null;
    is_active?: boolean | null;
    status?: string | null;
  }>).filter((row) => {
    if (row.is_active === false) return false;

    const status = row.status?.trim().toLowerCase();
    if (!status) return true;

    return !['draft', 'archived', 'deleted'].includes(status);
  });

  const hoursJson = buildHoursJsonFromRows(liveRows);
  const { error: updateError } = await supabase
    .from('venues')
    .update({ [targetColumn]: hoursJson })
    .eq('id', venueId);

  if (updateError) throw new Error(updateError.message);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { supabase } = await requirePortalVenueRequest(request, id);
    const body = await request.json();
    const action = String(body?.action ?? '');

    if (action === 'save') {
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      const scheduleType = body?.scheduleType as ScheduleType;
      const saveMode = body?.saveMode === 'replace' ? 'replace' : 'append';
      const selectedDays = Array.isArray(body?.selectedDays) ? body.selectedDays : [];

      if (!rows.length || !scheduleType) {
        return NextResponse.json(
          { ok: false, error: 'Missing schedule payload.' },
          { status: 400 }
        );
      }

      if (saveMode === 'replace') {
        const { error: deleteError } = await supabase
          .from('venue_schedule_rules')
          .delete()
          .eq('venue_id', id)
          .eq('schedule_type', scheduleType)
          .in('day_of_week', selectedDays);

        if (deleteError) throw new Error(deleteError.message);
      }

      const { error: insertError } = await supabase.from('venue_schedule_rules').insert(rows);
      if (insertError) throw new Error(insertError.message);

      await syncVenueHoursColumn(supabase, id, scheduleType);
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete-selected-days') {
      const scheduleType = body?.scheduleType as ScheduleType;
      const selectedDays = Array.isArray(body?.selectedDays) ? body.selectedDays : [];

      const { error } = await supabase
        .from('venue_schedule_rules')
        .delete()
        .eq('venue_id', id)
        .eq('schedule_type', scheduleType)
        .in('day_of_week', selectedDays);

      if (error) throw new Error(error.message);

      await syncVenueHoursColumn(supabase, id, scheduleType);
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete-all') {
      const scheduleType = body?.scheduleType as ScheduleType;

      const { error } = await supabase
        .from('venue_schedule_rules')
        .delete()
        .eq('venue_id', id)
        .eq('schedule_type', scheduleType);

      if (error) throw new Error(error.message);

      await syncVenueHoursColumn(supabase, id, scheduleType);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: 'Unsupported portal schedule action.' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
