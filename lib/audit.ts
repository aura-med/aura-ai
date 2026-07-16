import { createServiceRoleClient } from '@/lib/supabase/service'

export type AuditAction =
  | 'athlete.list'
  | 'athlete.read'
  | 'athlete.score.calculate'
  | 'medical.consultation.read'
  | 'medical.consultation.create'
  | 'medical.document.read'
  | 'rehab.assessment.update'
  | 'rehab.phase.advance'
  | 'rehab.phase.override'
  | 'auth.token.issue'

export interface AuditEvent {
  userId:       string
  userEmail:    string
  orgId:        string
  action:       AuditAction
  resourceType: string
  resourceId?:  string
  metadata?:    Record<string, unknown>
}

export async function logAudit(event: AuditEvent): Promise<void> {
  try {
    const client = createServiceRoleClient()
    if (!client) return
    await client.from('audit_logs').insert({
      user_id:       event.userId || null,
      user_email:    event.userEmail,
      org_id:        event.orgId   || null,
      action:        event.action,
      resource_type: event.resourceType,
      resource_id:   event.resourceId ?? null,
      metadata:      event.metadata   ?? null,
    })
  } catch {
    // Audit failures must never break the main request flow
  }
}
