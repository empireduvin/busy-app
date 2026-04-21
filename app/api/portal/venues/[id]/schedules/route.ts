import { NextResponse } from 'next/server';
import { requirePortalVenueRequest } from '@/lib/portal-server';
import { getErrorStatus } from '@/lib/authz';
import {
  DAY_OPTIONS,
  isValidDayOfWeek,
  isValidScheduleType,
  type DayOfWeek,
  type ScheduleType,
} from '@/lib/schedule-rules';

type OpeningHours = Partial<Record<DayOfWeek, Array<{ open: string; close: string }>>>;

type IncomingScheduleRow = {
  venue_id?: string;
  schedule_type?: string;
  day_of_week?: string;
  start_time?: string;
  end_time?: string;
  sort_order?: number | null;
  title?: string | null;
  description?: string | null;
  deal_text?: string | null;
  notes?: string | null;
  detail_json?: unknown;
  is_active?: boolean | null;
  status?: string | null;
};

function isValidTimeValue(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value.trim());
}

function normalizeSelectedDays(value: unknown) {
  const selectedDays = Array.isArray(value) ? value : [];
  return selectedDays
    .map((day) => String(day ?? '').trim().toLowerCase())
    .filter(isValidDayOfWeek);
}

function sanitizeScheduleRows(
  rows: unknown,
  venueId: string,
  scheduleType: ScheduleType
) {
  const rawRows = Array.isArray(rows) ? rows : [];
  const sanitized = rawRows.map((row) => {
    const candidate = (row ?? {}) as IncomingScheduleRow;
    const dayOfWeek = String(candidate.day_of_week ?? '').trim().toLowerCase();
    const startTime = String(candidate.start_time ?? '').trim();
    const endTime = String(candidate.end_time ?? '').trim();

    if (!isValidDayOfWeek(dayOfWeek)) {
      throw new Error('Each schedule row must include a valid day.');
    }

    if (!isValidTimeValue(startTime) || !isValidTimeValue(endTime)) {
      throw new Error('Each schedule row must include valid start and end times.');
    }

    if (startTime === endTime) {
      throw new Error('Start and end time cannot be the same.');
    }

    return {
      venue_id: venueId,
      schedule_type: scheduleType,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      sort_order:
        typeof candidate.sort_order === 'number' && Number.isFinite(candidate.sort_order)
          ? candidate.sort_order
          : null,
      title: String(candidate.title ?? '').trim() || null,
      description: String(candidate.description ?? '').trim() || null,
      deal_text: String(candidate.deal_text ?? '').trim() || null,
      notes: String(candidate.notes ?? '').trim() || null,
      detail_json: candidate.detail_json ?? null,
      is_active: candidate.is_active !== false,
      status: String(candidate.status ?? 'published').trim() || 'published',
    };
  });

  if (!sanitized.length) {
    throw new Error('Missing schedule payload.');
  }

  return sanitized;
}

function buildHoursJsonFromRows(
  scheduleRows: Array<{
    day_of_week: DayOfWeek;
    start_time: string;
    end_time: string;
    sort_order?: number | null;
  }>
): OpeningHours | null {
  const orderedDays: DayOfWeek[] = DAY_OPTIONS.map((option) => option.value);

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
      const rawScheduleType = String(body?.scheduleType ?? '').trim();
      const scheduleType = rawScheduleType as ScheduleType;
      const saveMode = body?.saveMode === 'replace' ? 'replace' : 'append';
      const selectedDays = normalizeSelectedDays(body?.selectedDays);

      if (!isValidScheduleType(rawScheduleType)) {
        return NextResponse.json(
          { ok: false, error: 'Choose a valid schedule type.' },
          { status: 400 }
        );
      }

      const rows = sanitizeScheduleRows(body?.rows, id, scheduleType);

      if (saveMode === 'replace' && !selectedDays.length) {
        return NextResponse.json(
          { ok: false, error: 'Choose at least one day to overwrite.' },
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
      const rawScheduleType = String(body?.scheduleType ?? '').trim();
      const scheduleType = rawScheduleType as ScheduleType;
      const selectedDays = normalizeSelectedDays(body?.selectedDays);

      if (!isValidScheduleType(rawScheduleType)) {
        return NextResponse.json(
          { ok: false, error: 'Choose a valid schedule type.' },
          { status: 400 }
        );
      }

      if (!selectedDays.length) {
        return NextResponse.json(
          { ok: false, error: 'Choose at least one day to delete.' },
          { status: 400 }
        );
      }

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
      const rawScheduleType = String(body?.scheduleType ?? '').trim();
      const scheduleType = rawScheduleType as ScheduleType;

      if (!isValidScheduleType(rawScheduleType)) {
        return NextResponse.json(
          { ok: false, error: 'Choose a valid schedule type.' },
          { status: 400 }
        );
      }

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
      { status: getErrorStatus(error) }
    );
  }
}
