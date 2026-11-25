// app/api/rehab/[sessionId]/progress/route.ts
//
// Frozen (B7): the legacy protocol-based rehab tracker (rehab_sessions,
// this route included) is superseded by the phase/criteria-based /rehab
// plans (096), whose advance_rehab_plan_phase RPC replaces phase
// advancement. No new writes — existing sessions stay readable for history.

import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _request: NextRequest,
  _context: { params: Promise<{ sessionId: string }> }
) {
  return NextResponse.json(
    { error: 'Este fluxo foi descontinuado. Usa o plano de reabilitação do atleta.' },
    { status: 410 }
  )
}
