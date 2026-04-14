import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL?.trim() || 'admin.firstround@gmail.com';
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL?.trim() || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() || '';

const TOPIC_LABELS: Record<string, string> = {
  correction: 'Fix a venue listing',
  partner: 'Feature my venue',
  access: 'Get venue access',
  general: 'General enquiry',
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function trimInput(value: unknown, maxLength: number) {
  return String(value ?? '')
    .trim()
    .slice(0, maxLength);
}

function topicToSubject(topic: string) {
  if (topic === 'correction') return 'First Round listing correction';
  if (topic === 'partner') return 'First Round feature request';
  if (topic === 'access') return 'First Round venue access request';
  return 'First Round enquiry';
}

function buildTextBody({
  topic,
  name,
  venueName,
  email,
  message,
}: {
  topic: string;
  name: string;
  venueName: string;
  email: string;
  message: string;
}) {
  return [
    `Topic: ${TOPIC_LABELS[topic] ?? TOPIC_LABELS.general}`,
    name ? `Name: ${name}` : 'Name: Not provided',
    venueName ? `Venue: ${venueName}` : 'Venue: Not provided',
    email ? `Reply email: ${email}` : 'Reply email: Not provided',
    '',
    'Message:',
    message,
  ].join('\n');
}

export async function POST(request: Request) {
  try {
    if (!RESEND_API_KEY || !CONTACT_FROM_EMAIL) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Contact sending is not configured yet. Please use the direct email option for now.',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const topic = trimInput(body?.topic, 40) || 'general';
    const name = trimInput(body?.name, 100);
    const venueName = trimInput(body?.venueName, 120);
    const email = trimInput(body?.email, 160).toLowerCase();
    const message = trimInput(body?.message, 3000);
    const website = trimInput(body?.website, 200);

    if (website) {
      return NextResponse.json({ ok: true, message: 'Your message has been sent.' });
    }

    if (!TOPIC_LABELS[topic]) {
      return NextResponse.json({ ok: false, error: 'Choose a valid contact reason.' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json(
        { ok: false, error: 'Add a message so we know what you need help with.' },
        { status: 400 }
      );
    }

    if (message.length < 10) {
      return NextResponse.json(
        { ok: false, error: 'Add a little more detail so we can help properly.' },
        { status: 400 }
      );
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: 'Enter a valid reply email or leave it blank.' },
        { status: 400 }
      );
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'first-round-contact/1.0',
      },
      body: JSON.stringify({
        from: CONTACT_FROM_EMAIL,
        to: [CONTACT_TO_EMAIL],
        reply_to: email || undefined,
        subject: topicToSubject(topic),
        text: buildTextBody({ topic, name, venueName, email, message }),
      }),
    });

    if (!resendResponse.ok) {
      const resendPayload = (await resendResponse.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      return NextResponse.json(
        {
          ok: false,
          error:
            resendPayload?.message ||
            resendPayload?.error ||
            'We could not send your message right now. Please try again shortly.',
        },
        { status: 502 }
      );
    }

    const resendPayload = (await resendResponse.json().catch(() => null)) as
      | { id?: string }
      | null;

    return NextResponse.json({
      ok: true,
      message: 'Your message was accepted for delivery. We will get back to you soon.',
      deliveryId: resendPayload?.id ?? null,
      sentTo: CONTACT_TO_EMAIL,
      replyTo: email || null,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'We could not send your message right now. Please try again shortly.',
      },
      { status: 500 }
    );
  }
}
