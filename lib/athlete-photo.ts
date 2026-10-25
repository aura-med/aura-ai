import type { SupabaseClient } from '@supabase/supabase-js'

export const ATHLETE_PHOTO_BUCKET = 'athlete-photos'

// Uploads the photo to the private bucket, stores a 1-year signed URL on the
// athlete row and returns it. Throws on upload/update failure.
export async function uploadAthletePhoto(
  supabase: SupabaseClient,
  athleteId: string,
  file: File,
): Promise<string | null> {
  const ext  = file.name.split('.').pop()
  const path = `${athleteId}/profile.${ext}`

  const { error: upErr } = await supabase.storage
    .from(ATHLETE_PHOTO_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true })
  if (upErr) throw upErr

  const { data: signed } = await supabase.storage
    .from(ATHLETE_PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 year
  const url = signed?.signedUrl ?? null

  const { error: updErr } = await supabase
    .from('athletes')
    .update({ photo_url: url })
    .eq('id', athleteId)
  if (updErr) throw updErr

  return url
}
