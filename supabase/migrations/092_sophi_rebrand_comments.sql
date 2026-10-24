-- Rebrand: refresh the stored table comment that still referred to the old product name.
-- Comment-only change; no schema or data impact.

COMMENT ON TABLE org_recommendation_config IS
  'Per-organisation configuration for the Sophi recommendations model. '
  'Managed exclusively by Sophi platform admins. '
  'Absence of a row means the org uses global defaults.';
