// app/api/rehab/[sessionId]/rtp/route.ts
//
// Frozen (B7): RTP criteria checkmarks on the legacy rehab_sessions tracker
// are superseded by rehab_phase_criteria (096), gated through an RTP-type
// phase rather than a flat jsonb list. No new writes — existing sessions
// stay readable for history. Not part of the documented public API
// (app/api/docs), so freezing it breaks no external contract.

import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _request: NextRequest,
  _context: { params: Promise<{ sessionId: string }> }
) {
  return NextResponse.json(
    { error: 'Este fluxo foi descontinuado. Usa os critérios de fase do plano de reabilitação do atleta.' },
    { status: 410 }
  )
}
