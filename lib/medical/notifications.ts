/**
 * Staff Sync Notification utility — Feature 5
 *
 * Inserts real-time clinical events into the `notifications` table so coaching
 * and support staff remain perfectly synced without manual communication.
 *
 * Fails silently if the table doesn't exist yet (schema-cache safe).
 *
 * ── DDL to create the table (run once in Supabase SQL Editor) ──────────────
 *
 * CREATE TABLE IF NOT EXISTS notifications (
 *   id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
 *   type        TEXT         NOT NULL,
 *   message     TEXT         NOT NULL,
 *   athlete_id  UUID         REFERENCES athletes(id) ON DELETE CASCADE,
 *   session_id  UUID         REFERENCES rehab_sessions(id) ON DELETE SET NULL,
 *   metadata    JSONB        DEFAULT '{}',
 *   read_at     TIMESTAMPTZ,
 *   created_at  TIMESTAMPTZ  DEFAULT now()
 * );
 * CREATE INDEX IF NOT EXISTS idx_notif_athlete ON notifications(athlete_id);
 * CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);
 * ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "staff_read"   ON notifications FOR SELECT USING (auth.role() = 'authenticated');
 * CREATE POLICY "staff_insert" ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
 */

import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'phase_advance'
  | 'availability_change'
  | 'injury_registered'
  | 'rtp_cleared'

export interface StaffNotification {
  type: NotificationType
  message: string
  athlete_id: string
  session_id?: string
  metadata?: Record<string, unknown>
}

// ── Builders ───────────────────────────────────────────────────────────────────

export function buildPhaseAdvanceMessage(
  athleteName: string,
  fromPhase: string,
  toPhase: string,
  exercises: string[],
): string {
  const focus = exercises.length
    ? exercises.slice(0, 2).join(', ')
    : 'protocolo standard'
  return `${athleteName} progrediu para ${toPhase} (de ${fromPhase}). Foco: ${focus}.`
}

export function buildAvailabilityMessage(
  athleteName: string,
  newStatus: string,
): string {
  const labels: Record<string, string> = {
    unfit:      'Indisponível',
    modified:   'Treino Modificado',
    monitoring: 'Em Monitorização',
    delayed:    'Adiado',
    recovered:  'Recuperado',
  }
  return `${athleteName}: disponibilidade actualizada para "${labels[newStatus] ?? newStatus}".`
}

export function buildRtpClearedMessage(
  athleteName: string,
  strengthDeficit: number,
  sprintVolume: number,
): string {
  return (
    `${athleteName} aprovado para Retorno ao Jogo — ` +
    `Défice de força: ${strengthDeficit}% · Volume GPS: ${sprintVolume}%.`
  )
}

// ── Sender ─────────────────────────────────────────────────────────────────────

export async function sendStaffNotification(
  notification: StaffNotification,
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('notifications').insert({
    type: notification.type,
    message: notification.message,
    athlete_id: notification.athlete_id,
    session_id: notification.session_id ?? null,
    metadata: notification.metadata ?? {},
  })

  if (error) {
    const isTableMissing =
      error.code === '42P01' ||
      error.code === 'PGRST116' ||
      (error.message ?? '').includes('notifications')

    if (isTableMissing) {
      console.warn(
        '[notifications] Table not found — run the DDL in lib/medical/notifications.ts.\n' +
        'Message that would have been sent:', notification.message,
      )
    } else {
      console.error('[notifications] Unexpected error:', error.message)
    }
  }
}
