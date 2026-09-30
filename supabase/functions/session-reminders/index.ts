// session-reminders/index.ts
// Supabase Edge Function — triggered every 30 min via pg_cron.
// Sends 1-hour and 24-hour email reminders for all TLR sessions.
// All secrets (Resend key, Zoom links) live in Supabase secrets — never in this file.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY           = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ZOOM_MONDAY              = Deno.env.get('ZOOM_MONDAY')!
const ZOOM_WEDNESDAY           = Deno.env.get('ZOOM_WEDNESDAY')!
const ZOOM_THURSDAY            = Deno.env.get('ZOOM_THURSDAY')!
const ZOOM_MASTERCLASS         = Deno.env.get('ZOOM_MASTERCLASS')!

const FROM = 'The Living Room <stuart@motivate-coaching.com>'
const HUB_URL = 'https://motivate-coaching.github.io/tlr-hub/dashboard.html'

// ── Timezone helpers ──────────────────────────────────────────────────────────

/** Last Sunday of a given month (UTC midnight) */
function lastSundayOf(year: number, month: number): Date {
  // month is 0-indexed: 2 = March, 9 = October
  const last = new Date(Date.UTC(year, month + 1, 0))
  last.setUTCDate(last.getUTCDate() - last.getUTCDay())
  return last
}

/** Is this UTC moment during UK British Summer Time? (last Sun Mar 01:00 UTC → last Sun Oct 01:00 UTC) */
function isUkBst(utc: Date): boolean {
  const y = utc.getUTCFullYear()
  const start = lastSundayOf(y, 2); start.setUTCHours(1, 0, 0, 0)
  const end   = lastSundayOf(y, 9); end.setUTCHours(1, 0, 0, 0)
  return utc >= start && utc < end
}

/** Is this UTC moment during EU Central European Summer Time? (same dates as UK BST) */
function isEuSummer(utc: Date): boolean {
  return isUkBst(utc)
}

/** Is this UTC moment during US Eastern Daylight Time? (2nd Sun Mar 07:00 UTC → 1st Sun Nov 06:00 UTC) */
function isUsEdt(utc: Date): boolean {
  const y = utc.getUTCFullYear()
  // Second Sunday of March (clocks spring forward at 2am EST = 7am UTC)
  const mar1  = new Date(Date.UTC(y, 2, 1))
  const sun1  = new Date(Date.UTC(y, 2, 1 + ((7 - mar1.getUTCDay()) % 7)))
  const sun2  = new Date(sun1); sun2.setUTCDate(sun1.getUTCDate() + 7); sun2.setUTCHours(7, 0, 0, 0)
  // First Sunday of November (clocks fall back at 2am EDT = 6am UTC)
  const nov1  = new Date(Date.UTC(y, 10, 1))
  const sun1n = new Date(Date.UTC(y, 10, 1 + ((7 - nov1.getUTCDay()) % 7))); sun1n.setUTCHours(6, 0, 0, 0)
  return utc >= sun2 && utc < sun1n
}

/** UK offset from UTC in hours (+1 BST, 0 GMT) */
function ukOff(utc: Date): number { return isUkBst(utc) ? 1 : 0 }

/** Format a UTC time as local time string with timezone label */
function fmt(utc: Date, offsetHours: number, label: string): string {
  const local = new Date(utc.getTime() + offsetHours * 3_600_000)
  const h = local.getUTCHours(), m = local.getUTCMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  const mm = m ? `:${String(m).padStart(2, '0')}` : ''
  return `${h12}${mm}${h < 12 ? 'am' : 'pm'} ${label}`
}

/** Format session time in all three zones */
function allZones(sessionUtc: Date): string {
  const ukLabel  = isUkBst(sessionUtc)    ? 'BST' : 'GMT'
  const cetLabel = isEuSummer(sessionUtc) ? 'CEST' : 'CET'
  const etLabel  = isUsEdt(sessionUtc)    ? 'EDT' : 'EST'
  return [
    fmt(sessionUtc, isUkBst(sessionUtc) ? 1 : 0,   ukLabel),
    fmt(sessionUtc, isEuSummer(sessionUtc) ? 2 : 1, cetLabel),
    fmt(sessionUtc, isUsEdt(sessionUtc) ? -4 : -5,  etLabel),
  ].join(' · ')
}

/** Friendly date string in UK time: "Monday, 6 October" */
function sessionDateStr(sessionUtc: Date): string {
  const off = ukOff(sessionUtc)
  const local = new Date(sessionUtc.getTime() + off * 3_600_000)
  return local.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
  })
}

// ── Session schedule ──────────────────────────────────────────────────────────

interface Session {
  name: string
  zoom: string
  /** Returns the next UTC start time of this session strictly after `now` */
  nextAfter(now: Date): Date
}

/** A session that recurs on the same weekday and UK-local time every week.
 *  dayOfWeek: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat */
function weekly(name: string, zoom: string, dayOfWeek: number, ukHour: number, ukMin: number): Session {
  return {
    name,
    zoom,
    nextAfter(now: Date): Date {
      // Work in UK local time to find the next matching day
      const off = ukOff(now)
      const ukNow = new Date(now.getTime() + off * 3_600_000)
      const curDow  = ukNow.getUTCDay()
      const curMins = ukNow.getUTCHours() * 60 + ukNow.getUTCMinutes()
      const sesMins = ukHour * 60 + ukMin

      let daysAhead = (dayOfWeek - curDow + 7) % 7
      if (daysAhead === 0 && curMins >= sesMins) daysAhead = 7

      // Build the session date in UK local
      const sessUk = new Date(Date.UTC(
        ukNow.getUTCFullYear(), ukNow.getUTCMonth(), ukNow.getUTCDate() + daysAhead,
        ukHour, ukMin, 0, 0
      ))
      // Convert UK local → UTC (re-check DST at the session date)
      return new Date(sessUk.getTime() - ukOff(sessUk) * 3_600_000)
    }
  }
}

/** The last Wednesday of each month at a given UK-local time */
function lastWednesday(name: string, zoom: string, ukHour: number, ukMin: number): Session {
  return {
    name,
    zoom,
    nextAfter(now: Date): Date {
      for (let mOff = 0; mOff <= 3; mOff++) {
        const base  = new Date(now)
        base.setUTCMonth(base.getUTCMonth() + mOff)
        const year  = base.getUTCFullYear()
        const month = base.getUTCMonth()

        // Last day of month
        const last  = new Date(Date.UTC(year, month + 1, 0))
        // Back up to last Wednesday (day 3)
        const daysBack = (last.getUTCDay() - 3 + 7) % 7
        const lwUk  = new Date(Date.UTC(year, month, last.getUTCDate() - daysBack, ukHour, ukMin, 0, 0))
        const lwUtc = new Date(lwUk.getTime() - ukOff(lwUk) * 3_600_000)

        if (lwUtc > now) return lwUtc
      }
      throw new Error('lastWednesday: no occurrence found')
    }
  }
}

// All TLR sessions
const SESSIONS: Session[] = [
  weekly      ('TLR Monday Session',   ZOOM_MONDAY,      1, 12,  0),
  weekly      ('Dedicated Time',        ZOOM_WEDNESDAY,   3, 12,  0),
  weekly      ('TLR Thursday Session', ZOOM_THURSDAY,    4,  7, 30),
  lastWednesday('TLR Masterclass',     ZOOM_MASTERCLASS, 14,  0),
]

// ── Email HTML ────────────────────────────────────────────────────────────────

function emailHtml(opts: {
  sessionName: string
  dateStr: string
  times: string
  zoom: string
  type: '1h' | '24h'
}): string {
  const { sessionName, dateStr, times, zoom, type } = opts
  const headline  = type === '1h' ? 'Starting in one hour' : 'See you tomorrow'
  const intro     = type === '1h'
    ? 'Your session is about to begin. Here\'s everything you need to join.'
    : 'A reminder that you have a session coming up tomorrow.'
  const preheader = type === '1h'
    ? `Your session starts in one hour — ${times.split(' · ')[0]}.`
    : `${sessionName} is tomorrow — ${times.split(' · ')[0]}.`
  const year = new Date().getUTCFullYear()

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${sessionName}</title>
</head>
<body style="margin:0;padding:0;background:#F9F7F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F7F2;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <!-- Header bar -->
  <tr><td style="background:#0F1215;border-radius:12px 12px 0 0;padding:24px 36px;text-align:center;">
    <p style="margin:0 0 3px;color:#E8A800;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">The Living Room</p>
    <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;">Motivate Coaching</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:40px 36px 36px;">
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#111820;line-height:1.2;">${headline}</h1>
    <p style="margin:0 0 32px;font-size:15px;color:#445566;line-height:1.65;">${intro}</p>

    <!-- Session card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F7F2;border-radius:10px;margin-bottom:28px;">
    <tr><td style="padding:24px;">
      <p style="margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8899AA;">Session</p>
      <p style="margin:0 0 18px;font-size:20px;font-weight:700;color:#111820;">${sessionName}</p>
      <p style="margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8899AA;">When</p>
      <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#111820;">${dateStr}</p>
      <p style="margin:0;font-size:14px;color:#445566;line-height:1.6;">${times}</p>
    </td></tr>
    </table>

    <!-- Join button -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
    <tr><td align="center">
      <a href="${zoom}" style="display:inline-block;background:#0F1215;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:15px 40px;border-radius:8px;">Join on Zoom →</a>
    </td></tr>
    </table>

    <p style="margin:0;font-size:14px;color:#8899AA;line-height:1.65;">The link is also in your calendar invite and on your <a href="${HUB_URL}" style="color:#1A6B72;text-decoration:none;">TLR Hub dashboard</a>.</p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#F5F1EB;border-radius:0 0 12px 12px;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#8899AA;line-height:1.7;">
      You're receiving this because you're an active member of The Living Room.<br>
      © ${year} Motivate Coaching
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  const now = new Date()
  console.log(`[session-reminders] Running at ${now.toISOString()}`)

  // Find sessions due for a reminder right now
  type Due = { session: Session; type: '1h' | '24h'; sessionUtc: Date }
  const due: Due[] = []

  for (const session of SESSIONS) {
    const sessionUtc = session.nextAfter(now)
    const minsAway   = (sessionUtc.getTime() - now.getTime()) / 60_000

    if (minsAway >= 45 && minsAway <= 75) {
      // ~1 hour away
      due.push({ session, type: '1h', sessionUtc })
      console.log(`[session-reminders] 1h reminder due: "${session.name}" at ${sessionUtc.toISOString()} (${minsAway.toFixed(1)} min away)`)
    } else if (minsAway >= 1425 && minsAway <= 1455) {
      // ~24 hours away
      due.push({ session, type: '24h', sessionUtc })
      console.log(`[session-reminders] 24h reminder due: "${session.name}" at ${sessionUtc.toISOString()} (${(minsAway / 60).toFixed(1)} hrs away)`)
    }
  }

  if (due.length === 0) {
    console.log('[session-reminders] No reminders due — exiting.')
    return new Response(JSON.stringify({ sent: 0, message: 'No reminders due' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Fetch all member emails via Supabase admin client
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data: { users }, error: usersErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (usersErr) {
    console.error('[session-reminders] Failed to list users:', usersErr.message)
    return new Response(JSON.stringify({ error: usersErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const emails = users.map(u => u.email).filter(Boolean) as string[]
  console.log(`[session-reminders] ${emails.length} member(s) to notify`)

  if (emails.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No members found' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  let totalSent = 0

  for (const { session, type, sessionUtc } of due) {
    const subject = type === '1h'
      ? `Starting in 1 hour — ${session.name}`
      : `See you tomorrow — ${session.name}`

    const html = emailHtml({
      sessionName: session.name,
      dateStr:     sessionDateStr(sessionUtc),
      times:       allZones(sessionUtc),
      zoom:        session.zoom,
      type,
    })

    // Send individually via Resend batch API (so recipients can't see each other)
    // Resend batch limit is 100 per call — chunk to be safe
    const CHUNK = 50
    for (let i = 0; i < emails.length; i += CHUNK) {
      const chunk   = emails.slice(i, i + CHUNK)
      const payload = chunk.map(to => ({ from: FROM, to: [to], subject, html }))

      const res = await fetch('https://api.resend.com/emails/batch', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (res.ok) {
        totalSent += chunk.length
        console.log(`[session-reminders] Sent ${type} reminder for "${session.name}" to ${chunk.length} member(s)`)
      } else {
        const err = await res.text()
        console.error(`[session-reminders] Resend error:`, err)
      }
    }
  }

  return new Response(JSON.stringify({ sent: totalSent, reminders: due.length }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
