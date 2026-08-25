// Shared error sentinels for the rehab plan actions — kept in a plain module
// (no 'use server') because a 'use server' file may only export async
// functions; a string constant exported there breaks every export in it.
export const REHAB_DAY_OCCUPIED_ERROR = 'REHAB_DAY_OCCUPIED'
