// WADA International Standard — Prohibited List, 2027 edition (in force from
// 1 January 2027; source: WADA official PDF, "2027list_en_final_clean").
// This is a practical screening aid for flagging medication administrations
// that may need a TUE (Autorização de Uso Terapêutico) — it is NOT a
// certified, exhaustive compliance tool. Many entries are chemical/generic
// names; brand names are matched through a small curated alias list below,
// which only covers the substances most likely to appear in a football
// medical department. Always confirm a flagged case against the official
// WADA list (and ADoP — Autoridade Antidopagem de Portugal, for Portuguese
// clubs) before acting on it. P1 (beta-blockers) is omitted: it only applies
// to precision sports (archery, darts, golf, etc.), not football.

export const WADA_LIST_VERSION = 'Lista WADA 2027, em vigor desde 1 de janeiro de 2027'

export type ProhibitedScope = 'always' | 'in_competition'

interface ProhibitedSubstance {
  name: string
  category: string
  categoryLabel: string
  scope: ProhibitedScope
}

// ── S0 — Non-approved substances (examples only, open-ended category) ──────
const S0: string[] = ['BPC-157', '2,4-Dinitrophenol', 'DNP']

// ── S1 — Anabolic agents ────────────────────────────────────────────────────
const S1: string[] = [
  'Androstenedione', 'Bolasterone', 'Boldenone', 'Boldione', 'Calusterone', 'Clostebol',
  'Danazol', 'Dehydrochlormethyltestosterone', 'Desoxymethyltestosterone', 'Dimethandrolone',
  'Drostanolone', 'Epitestosterone', 'Ethylestrenol', 'Fluoxymesterone', 'Formebolone',
  'Furazabol', 'Gestrinone', 'Mestanolone', 'Mesterolone', 'Metandienone', 'Metenolone',
  'Methandriol', 'Methasterone', 'Methyltestosterone', 'Methyldienolone', 'Metribolone',
  'Mibolerone', 'Nandrolone', 'Norbolethone', 'Norclostebol', 'Norethandrolone', 'Oxabolone',
  'Oxandrolone', 'Oxymesterone', 'Oxymetholone', 'Prasterone', 'DHEA', 'Prostanozol',
  'Quinbolone', 'Stanozolol', 'Stenbolone', 'Testosterone', 'Tetrahydrogestrinone', 'Tibolone',
  'Trenbolone', 'Trestolone',
  // S1.2 other anabolic agents
  'Clenbuterol', 'Osilodrostat', 'Ractopamine', 'Ostarine', 'Enobosarm', 'Ligandrol',
  'LGD-4033', 'RAD140', 'Zeranol', 'Zilpaterol', 'SARMs',
]

// ── S2 — Peptide hormones, growth factors, related substances, mimetics ────
const S2: string[] = [
  'Darbepoetin', 'Erythropoietin', 'EPO', 'CERA', 'Peginesatide', 'Pegmolesatide',
  'Chorionic Gonadotrophin', 'hCG', 'Luteinizing Hormone', 'LH', 'Gonadorelin', 'Buserelin',
  'Deslorelin', 'Goserelin', 'Histrelin', 'Leuprorelin', 'Nafarelin', 'Triptorelin',
  'Growth Hormone', 'hGH', 'Somatropin', 'Lonapegsomatropin', 'Somapacitan', 'Somatrogon',
  'AOD-9604', 'Sermorelin', 'Tesamorelin', 'Ibutamoren', 'MK-677', 'Ipamorelin',
  'Macimorelin', 'Hexarelin', 'GHRP', 'Insulin-like Growth Factor', 'IGF-1', 'Mecasermin',
  'Thymosin beta-4', 'TB-500', 'Follistatin', 'Meldonium', 'Trimetazidine', 'Insulin',
]

// ── S3 — Beta-2 agonists (clenbuterol excluded here — listed under S1) ──────
const S3: string[] = [
  'Arformoterol', 'Fenoterol', 'Formoterol', 'Higenamine', 'Indacaterol', 'Levosalbutamol',
  'Olodaterol', 'Procaterol', 'Reproterol', 'Salbutamol', 'Salmeterol', 'Terbutaline',
  'Tretoquinol', 'Tulobuterol', 'Vilanterol',
]
// Permitted by inhalation under WADA dose thresholds (not flagged if route is "topical"
// and the dose is within licensed inhaled limits — this checker cannot verify dose).
const S3_INHALED_EXCEPTION = new Set(['salbutamol', 'formoterol', 'salmeterol', 'vilanterol'].map((s) => s))

// ── S4 — Hormone and metabolic modulators ───────────────────────────────────
const S4: string[] = [
  'Anastrozole', 'Letrozole', 'Exemestane', 'Formestane', 'Aminoglutethimide', 'Testolactone',
  'Bazedoxifene', 'Clomifene', 'Cyclofenil', 'Fulvestrant', 'Raloxifene', 'Tamoxifen',
  'Toremifene', 'Myostatin', 'Trimetazidine',
]

// ── S5 — Diuretics and masking agents ───────────────────────────────────────
const S5: string[] = [
  'Acetazolamide', 'Amiloride', 'Bumetanide', 'Canrenone', 'Chlortalidone', 'Eplerenone',
  'Etacrynic acid', 'Finerenone', 'Furosemide', 'Indapamide', 'Metolazone', 'Spironolactone',
  'Bendroflumethiazide', 'Chlorothiazide', 'Hydrochlorothiazide', 'Torasemide', 'Triamterene',
  'Xipamide', 'Conivaptan', 'Mozavaptan', 'Tolvaptan', 'Desmopressin', 'Probenecid',
]
// Explicitly NOT prohibited per the List's own exceptions.
const S5_EXCEPTIONS = new Set(['drospirenone', 'pamabrom', 'dorzolamide', 'brinzolamide', 'felypressin'])

// ── S6 — Stimulants (in-competition) ────────────────────────────────────────
const S6: string[] = [
  'Adrafinil', 'Amfepramone', 'Amphetamine', 'Amfetamine', 'Benzylpiperazine', 'Cocaine',
  'Fenetylline', 'Fenfluramine', 'Mesocarb', 'Methamphetamine', 'Modafinil', 'Prenylamine',
  'Ephedrine', 'Pseudoephedrine', 'Methylephedrine', 'Cathine', 'Mephedrone', 'Methedrone',
  'Ethylphenidate', 'Methylphenidate', 'Fenproporex', 'Heptaminol', 'Nikethamide',
  'Octopamine', 'Oxilofrine', 'Phenmetrazine', 'Propylhexedrine', 'Selegiline', 'Sibutramine',
  'Strychnine', 'Tuaminoheptane',
]
// Expressly NOT prohibited (2027 Monitoring Program).
const S6_NOT_PROHIBITED = new Set([
  'bupropion', 'caffeine', 'nicotine', 'phenylephrine', 'phenylpropanolamine', 'pipradrol',
  'synephrine', 'clonidine', 'guanfacine',
])

// ── S7 — Narcotics (in-competition) ──────────────────────────────────────────
const S7: string[] = [
  'Buprenorphine', 'Dextromoramide', 'Diamorphine', 'Heroin', 'Fentanyl', 'Hydromorphone',
  'Methadone', 'Morphine', 'Nicomorphine', 'Oxycodone', 'Oxymorphone', 'Pentazocine',
  'Pethidine', 'Tramadol',
]

// ── S8 — Cannabinoids (in-competition) ───────────────────────────────────────
const S8: string[] = ['THC', 'Tetrahydrocannabinol', 'Hashish', 'Marijuana', 'Cannabis', 'HHC']
const S8_EXCEPTIONS = new Set(['cannabidiol', 'cbd'])

// ── S9 — Glucocorticoids (in-competition, route-dependent) ──────────────────
const S9: string[] = [
  'Beclometasone', 'Betamethasone', 'Budesonide', 'Ciclesonide', 'Cortisone', 'Deflazacort',
  'Dexamethasone', 'Flunisolide', 'Fluocortolone', 'Fluticasone', 'Hydrocortisone',
  'Methylprednisolone', 'Mometasone', 'Prednisolone', 'Prednisone', 'Triamcinolone',
]
// Prohibited only via these routes (oromucosal counts as oral); other routes
// (inhaled, dermal, intranasal, ophthalmic, otic, perianal, vaginal) are not
// prohibited within licensed doses.
const S9_PROHIBITED_ROUTES = new Set(['oral', 'im', 'iv', 'intra-articular'])

const ALL_CATEGORIES: { substances: string[]; category: string; categoryLabel: string; scope: ProhibitedScope }[] = [
  { substances: S0, category: 'S0', categoryLabel: 'Substâncias não aprovadas', scope: 'always' },
  { substances: S1, category: 'S1', categoryLabel: 'Agentes anabolizantes', scope: 'always' },
  { substances: S2, category: 'S2', categoryLabel: 'Hormonas peptídicas e fatores de crescimento', scope: 'always' },
  { substances: S3, category: 'S3', categoryLabel: 'Agonistas beta-2', scope: 'always' },
  { substances: S4, category: 'S4', categoryLabel: 'Moduladores hormonais e metabólicos', scope: 'always' },
  { substances: S5, category: 'S5', categoryLabel: 'Diuréticos e agentes mascarantes', scope: 'always' },
  { substances: S6, category: 'S6', categoryLabel: 'Estimulantes', scope: 'in_competition' },
  { substances: S7, category: 'S7', categoryLabel: 'Narcóticos', scope: 'in_competition' },
  { substances: S8, category: 'S8', categoryLabel: 'Canabinoides', scope: 'in_competition' },
  { substances: S9, category: 'S9', categoryLabel: 'Glucocorticoides', scope: 'in_competition' },
]

const PROHIBITED_SUBSTANCES: ProhibitedSubstance[] = ALL_CATEGORIES.flatMap(({ substances, category, categoryLabel, scope }) =>
  substances.map((name) => ({ name, category, categoryLabel, scope })),
)

// Common Portuguese brand/trade names for the substances most likely to show
// up in a football medical department's administration log. Not exhaustive —
// an unlisted brand name will simply not match.
const BRAND_ALIASES: Record<string, string> = {
  'lasix': 'Furosemide',
  'aldactone': 'Spironolactone',
  'ventolin': 'Salbutamol',
  'bricanyl': 'Terbutaline',
  'serevent': 'Salmeterol',
  'decadron': 'Dexamethasone',
  'meticorten': 'Prednisone',
  'lepicortinolo': 'Prednisolone',
  'depo-medrol': 'Methylprednisolone',
  'depomedrol': 'Methylprednisolone',
  'diprospan': 'Betamethasone',
  'kenacort': 'Triamcinolone',
  'tramal': 'Tramadol',
  'durogesic': 'Fentanyl',
  'oxycontin': 'Oxycodone',
  'deca-durabolin': 'Nandrolone',
  'winstrol': 'Stanozolol',
  'genotropin': 'Growth Hormone',
  'saizen': 'Growth Hormone',
  'eprex': 'Erythropoietin',
  'nebido': 'Testosterone',
  'actifed': 'Pseudoephedrine',
}

function normalize(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// WADA names are English INN; clinicians will often type the Portuguese INN
// instead (furosemida vs furosemide, prednisolona vs prednisolone,
// testosterona vs testosterone — same root, different final vowel/suffix).
// A plain substring check misses these, so once both strings are long enough
// to be a meaningful root, a shared prefix counts as a match too.
const STEM_MIN_LEN = 6
function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b || a.includes(b) || b.includes(a)) return true
  if (a.length >= STEM_MIN_LEN && b.length >= STEM_MIN_LEN) {
    return a.slice(0, STEM_MIN_LEN) === b.slice(0, STEM_MIN_LEN)
  }
  return false
}

export interface ProhibitedCheckResult {
  matched: ProhibitedSubstance
  exempt: boolean
  note: string
}

// Checks a free-text medication name (and, for route-sensitive categories,
// the administration route) against the Prohibited List. Returns the first
// match, or null if nothing matches — this is a best-effort name match, not
// a certified lookup.
export function checkProhibitedSubstance(medicationName: string, route?: string | null): ProhibitedCheckResult | null {
  const raw = normalize(medicationName)
  if (!raw) return null

  const aliasHit = Object.keys(BRAND_ALIASES).find((brand) => raw.includes(brand))
  const needle = aliasHit ? normalize(BRAND_ALIASES[aliasHit]) : raw

  const inExceptionSet = (set: Set<string>) => [...set].some((x) => namesMatch(needle, x))
  if (inExceptionSet(S6_NOT_PROHIBITED) || inExceptionSet(S5_EXCEPTIONS) || inExceptionSet(S8_EXCEPTIONS)) return null

  const matched = PROHIBITED_SUBSTANCES.find((s) => namesMatch(needle, normalize(s.name)))
  if (!matched) return null

  if (matched.category === 'S9') {
    const normalizedRoute = route ? normalize(route) : null
    const prohibited = normalizedRoute ? S9_PROHIBITED_ROUTES.has(normalizedRoute) : true
    if (!prohibited) return null
    return {
      matched,
      exempt: false,
      note: 'Glucocorticoide — proibido em competição por via oral, IM, IV ou intra-articular (permitido por via tópica/inalada/intranasal dentro da dose licenciada).',
    }
  }

  if (matched.category === 'S3' && S3_INHALED_EXCEPTION.has(normalize(matched.name))) {
    return {
      matched,
      exempt: false,
      note: 'Agonista beta-2 — permitido por inalação dentro do limiar da WADA; proibido por outras vias ou acima do limiar.',
    }
  }

  return {
    matched,
    exempt: false,
    note: matched.scope === 'always'
      ? 'Proibido a qualquer momento (dentro e fora de competição).'
      : 'Proibido apenas em competição.',
  }
}
