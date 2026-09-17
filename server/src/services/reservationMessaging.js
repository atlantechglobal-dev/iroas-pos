import { db } from '../db.js'
import { queueEmail, createNotification } from './identityService.js'
import { isSmtpConfigured, sendEmail } from './emailService.js'
import { parseTimeToMinutes } from './reservationAvailability.js'

function parseSettings(restaurant) {
  if (!restaurant?.settings_json) return {}
  try {
    return JSON.parse(restaurant.settings_json)
  } catch {
    return {}
  }
}

function ownerWantsEmail(settings) {
  return settings.emailNotifs !== false
}

function ownerWantsSms(settings) {
  return settings.smsNotifs === true
}

function reminderSendAt(date, time) {
  const minutes = parseTimeToMinutes(time)
  if (minutes == null || !date) return null
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const start = new Date(
    `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
  )
  if (Number.isNaN(start.getTime())) return null
  start.setHours(start.getHours() - 2)
  return start.toISOString().slice(0, 19).replace('T', ' ')
}

function insertJob({
  restaurantId,
  reservationId,
  kind,
  channel,
  toAddress,
  subject,
  body,
  sendAt,
}) {
  const info = db
    .prepare(
      `INSERT INTO message_jobs
        (restaurant_id, reservation_id, kind, channel, to_address, subject, body, send_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), 'queued')`,
    )
    .run(
      restaurantId,
      reservationId || null,
      kind,
      channel,
      toAddress || null,
      subject || null,
      body,
      sendAt || null,
    )
  return info.lastInsertRowid
}

function cancelPendingReminders(reservationId) {
  db.prepare(
    `UPDATE message_jobs
     SET status = 'cancelled'
     WHERE reservation_id = ? AND kind = 'booking_reminder' AND status = 'queued'`,
  ).run(reservationId)
}

function scheduleReminder(restaurant, reservation) {
  cancelPendingReminders(reservation.id)
  const sendAt = reminderSendAt(reservation.date, reservation.time)
  if (!sendAt) return

  const restaurantName = restaurant.name || 'the restaurant'
  const when = `${reservation.date} at ${reservation.time}`
  const body = [
    `Reminder: your table at ${restaurantName} is in about 2 hours.`,
    `When: ${when}`,
    `Party: ${reservation.guests}`,
    reservation.guest_name ? `Name: ${reservation.guest_name}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  if (reservation.guest_email) {
    insertJob({
      restaurantId: restaurant.id,
      reservationId: reservation.id,
      kind: 'booking_reminder',
      channel: 'email',
      toAddress: reservation.guest_email,
      subject: `Reminder: ${restaurantName} tonight`,
      body,
      sendAt,
    })
  }

  if (reservation.phone) {
    insertJob({
      restaurantId: restaurant.id,
      reservationId: reservation.id,
      kind: 'booking_reminder',
      channel: 'sms',
      toAddress: reservation.phone,
      subject: null,
      body: `Reminder: ${restaurantName} ${when} for ${reservation.guests}.`,
      sendAt,
    })
  }
}

function notifyRestaurantOwner(restaurant, title, body) {
  const settings = parseSettings(restaurant)
  createNotification({
    userId: restaurant.owner_id,
    type: 'reservation',
    title,
    body,
    meta: { restaurantId: restaurant.id },
  })

  if (!ownerWantsEmail(settings)) return
  const owner = db
    .prepare('SELECT email, name, phone FROM users WHERE id = ?')
    .get(restaurant.owner_id)
  if (owner?.email) {
    queueEmail({
      to: owner.email,
      subject: title,
      body: [`Hi ${owner.name || 'there'},`, '', body].join('\n'),
    })
  }

  if (ownerWantsSms(settings) && owner?.phone) {
    insertJob({
      restaurantId: restaurant.id,
      kind: 'owner_alert',
      channel: 'sms',
      toAddress: owner.phone,
      body: `${title}: ${body}`,
      sendAt: null,
    })
  }
}

/** Guest public booking created (pending). */
export function onReservationCreated(restaurant, reservation, { source = 'public' } = {}) {
  const name = restaurant.name || 'the restaurant'
  const when = `${reservation.date} at ${reservation.time}`
  const isConfirmed = reservation.status === 'confirmed'

  if (reservation.guest_email) {
    insertJob({
      restaurantId: restaurant.id,
      reservationId: reservation.id,
      kind: isConfirmed ? 'booking_confirmed' : 'booking_received',
      channel: 'email',
      toAddress: reservation.guest_email,
      subject: isConfirmed
        ? `Table confirmed at ${name}`
        : `We received your booking request at ${name}`,
      body: [
        `Hi ${reservation.guest_name || 'there'},`,
        '',
        isConfirmed
          ? `Your table at ${name} is confirmed.`
          : `We received your booking request at ${name}. We'll confirm shortly.`,
        `When: ${when}`,
        `Party: ${reservation.guests}`,
        reservation.notes ? `Notes: ${reservation.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    })
  }

  if (reservation.phone) {
    insertJob({
      restaurantId: restaurant.id,
      reservationId: reservation.id,
      kind: isConfirmed ? 'booking_confirmed' : 'booking_received',
      channel: 'sms',
      toAddress: reservation.phone,
      body: isConfirmed
        ? `Confirmed: ${name} ${when} for ${reservation.guests}.`
        : `Request received: ${name} ${when} for ${reservation.guests}. We'll confirm soon.`,
    })
  }

  notifyRestaurantOwner(
    restaurant,
    source === 'staff' ? 'Walk-in booking added' : 'New reservation request',
    `${reservation.guest_name} · ${when} · ${reservation.guests} guests · ${reservation.status}`,
  )

  if (isConfirmed) {
    scheduleReminder(restaurant, reservation)
  }
}

export function onReservationStatusChange(restaurant, previous, next) {
  if (previous.status === next.status && previous.date === next.date && previous.time === next.time) {
    return
  }

  const name = restaurant.name || 'the restaurant'
  const when = `${next.date} at ${next.time}`

  if (next.status === 'confirmed' && previous.status !== 'confirmed') {
    if (next.guest_email) {
      insertJob({
        restaurantId: restaurant.id,
        reservationId: next.id,
        kind: 'booking_confirmed',
        channel: 'email',
        toAddress: next.guest_email,
        subject: `Table confirmed at ${name}`,
        body: [
          `Hi ${next.guest_name || 'there'},`,
          '',
          `Your table at ${name} is confirmed.`,
          `When: ${when}`,
          `Party: ${next.guests}`,
        ].join('\n'),
      })
    }
    if (next.phone) {
      insertJob({
        restaurantId: restaurant.id,
        reservationId: next.id,
        kind: 'booking_confirmed',
        channel: 'sms',
        toAddress: next.phone,
        body: `Confirmed: ${name} ${when} for ${next.guests}.`,
      })
    }
    scheduleReminder(restaurant, next)
  }

  if (next.status === 'cancelled' && previous.status !== 'cancelled') {
    cancelPendingReminders(next.id)
    if (next.guest_email) {
      insertJob({
        restaurantId: restaurant.id,
        reservationId: next.id,
        kind: 'booking_cancelled',
        channel: 'email',
        toAddress: next.guest_email,
        subject: `Booking cancelled at ${name}`,
        body: `Hi ${next.guest_name || 'there'},\n\nYour booking at ${name} for ${when} was cancelled.`,
      })
    }
    if (next.phone) {
      insertJob({
        restaurantId: restaurant.id,
        reservationId: next.id,
        kind: 'booking_cancelled',
        channel: 'sms',
        toAddress: next.phone,
        body: `Cancelled: ${name} ${when}.`,
      })
    }
  }

  // Reschedule reminder if confirmed booking moves
  if (
    next.status === 'confirmed' &&
    previous.status === 'confirmed' &&
    (previous.date !== next.date || previous.time !== next.time)
  ) {
    scheduleReminder(restaurant, next)
  }
}

/** Drain due message_jobs (SMTP email when configured; SMS still console stub). */
export async function processDueMessageJobs({ limit = 40 } = {}) {
  const due = db
    .prepare(
      `SELECT * FROM message_jobs
       WHERE status = 'queued' AND send_at <= datetime('now')
       ORDER BY send_at ASC
       LIMIT ?`,
    )
    .all(limit)

  for (const job of due) {
    try {
      if (job.channel === 'email' && job.to_address) {
        const subject = job.subject || 'IROAS booking update'
        if (isSmtpConfigured()) {
          await sendEmail({ to: job.to_address, subject, body: job.body })
        } else {
          queueEmail({ to: job.to_address, subject, body: job.body })
        }
      } else if (job.channel === 'sms') {
        console.log(`[sms_stub #${job.id}] To: ${job.to_address} | ${job.body}`)
      } else {
        console.log(`[message_job #${job.id}] ${job.channel} ${job.kind}: ${job.body}`)
      }
      db.prepare(
        `UPDATE message_jobs SET status = 'sent', sent_at = datetime('now') WHERE id = ?`,
      ).run(job.id)
    } catch (err) {
      console.error(`[message_job #${job.id}] failed`, err)
      db.prepare(`UPDATE message_jobs SET status = 'failed' WHERE id = ?`).run(job.id)
    }
  }

  return due.length
}

export function startMessageJobWorker({ intervalMs = 60_000 } = {}) {
  const tick = () => {
    processDueMessageJobs().catch((err) => {
      console.error('[message_jobs] worker error', err)
    })
  }
  tick()
  return setInterval(tick, intervalMs)
}
