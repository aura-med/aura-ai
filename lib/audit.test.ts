import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(),
}))

import { logAudit } from './audit'
import { createServiceRoleClient } from '@/lib/supabase/service'

describe('logAudit', () => {
  const mockInsert = vi.fn()
  const mockFrom   = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })
    vi.mocked(createServiceRoleClient).mockReturnValue({ from: mockFrom } as ReturnType<typeof createServiceRoleClient>)
  })

  it('inserts one audit row with the correct shape', async () => {
    await logAudit({
      userId:       'user-123',
      userEmail:    'doctor@club.com',
      orgId:        'org-456',
      action:       'athlete.read',
      resourceType: 'athlete',
      resourceId:   'athlete-789',
    })

    expect(mockFrom).toHaveBeenCalledWith('audit_logs')
    expect(mockInsert).toHaveBeenCalledOnce()
    expect(mockInsert).toHaveBeenCalledWith({
      user_id:       'user-123',
      user_email:    'doctor@club.com',
      org_id:        'org-456',
      action:        'athlete.read',
      resource_type: 'athlete',
      resource_id:   'athlete-789',
      metadata:      null,
    })
  })

  it('includes metadata when provided', async () => {
    await logAudit({
      userId:       'user-123',
      userEmail:    'doctor@club.com',
      orgId:        'org-456',
      action:       'athlete.list',
      resourceType: 'athlete',
      metadata:     { role: 'doctor', count: 5 },
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { role: 'doctor', count: 5 } })
    )
  })

  it('omits resource_id when not provided (null)', async () => {
    await logAudit({
      userId:       'user-123',
      userEmail:    'admin@club.com',
      orgId:        'org-456',
      action:       'athlete.list',
      resourceType: 'athlete',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ resource_id: null })
    )
  })

  it('does not throw when the service role client is unavailable', async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(null)

    await expect(
      logAudit({
        userId:       'user-123',
        userEmail:    'doctor@club.com',
        orgId:        'org-456',
        action:       'athlete.read',
        resourceType: 'athlete',
      })
    ).resolves.toBeUndefined()

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('does not throw when the insert rejects', async () => {
    mockInsert.mockRejectedValue(new Error('network timeout'))

    await expect(
      logAudit({
        userId:       'user-123',
        userEmail:    'doctor@club.com',
        orgId:        'org-456',
        action:       'athlete.read',
        resourceType: 'athlete',
      })
    ).resolves.toBeUndefined()
  })
})
