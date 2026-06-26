// OSIICS-13 simplified list — most common diagnoses in elite football
// Source: OSICS-13 / BJSM coding framework adapted for clinical use
export interface OsiicsEntry {
  code: string
  description: string
  bodyPart: string
  category: 'injury' | 'disease' | 'other'
}

export const OSIICS_FOOTBALL: OsiicsEntry[] = [
  // ── Hamstrings ──────────────────────────────────────────────────────────────
  { code: 'MT2IM', description: 'Lesão muscular isquiotibiais grau I', bodyPart: 'Coxa posterior', category: 'injury' },
  { code: 'MT2II', description: 'Lesão muscular isquiotibiais grau II', bodyPart: 'Coxa posterior', category: 'injury' },
  { code: 'MT2III', description: 'Lesão muscular isquiotibiais grau III (rotura)', bodyPart: 'Coxa posterior', category: 'injury' },
  { code: 'MT2IVA', description: 'Avulsão da tuberosidade isquiática', bodyPart: 'Coxa posterior', category: 'injury' },
  // ── Quadriceps ──────────────────────────────────────────────────────────────
  { code: 'MT1IM', description: 'Lesão muscular quadricípite grau I', bodyPart: 'Coxa anterior', category: 'injury' },
  { code: 'MT1II', description: 'Lesão muscular quadricípite grau II', bodyPart: 'Coxa anterior', category: 'injury' },
  { code: 'MT1III', description: 'Rotura do quadricípite', bodyPart: 'Coxa anterior', category: 'injury' },
  // ── Adductors ───────────────────────────────────────────────────────────────
  { code: 'MG1IM', description: 'Lesão muscular adutores grau I', bodyPart: 'Virilha', category: 'injury' },
  { code: 'MG1II', description: 'Lesão muscular adutores grau II', bodyPart: 'Virilha', category: 'injury' },
  { code: 'MG1III', description: 'Rotura completa dos adutores', bodyPart: 'Virilha', category: 'injury' },
  // ── Calf ────────────────────────────────────────────────────────────────────
  { code: 'ML1IM', description: 'Lesão muscular gastrocnémio grau I', bodyPart: 'Gémeo/Sural', category: 'injury' },
  { code: 'ML1II', description: 'Lesão muscular gastrocnémio grau II', bodyPart: 'Gémeo/Sural', category: 'injury' },
  { code: 'ML1III', description: 'Rotura do gastrocnémio', bodyPart: 'Gémeo/Sural', category: 'injury' },
  { code: 'ML2IM', description: 'Lesão do solear grau I-II', bodyPart: 'Sural', category: 'injury' },
  // ── Ankle ───────────────────────────────────────────────────────────────────
  { code: 'JA1LI', description: 'Entorse lateral do tornozelo grau I', bodyPart: 'Tornozelo', category: 'injury' },
  { code: 'JA1LII', description: 'Entorse lateral do tornozelo grau II', bodyPart: 'Tornozelo', category: 'injury' },
  { code: 'JA1LIII', description: 'Rotura ligamentar lateral do tornozelo', bodyPart: 'Tornozelo', category: 'injury' },
  { code: 'JA1M', description: 'Entorse medial do tornozelo', bodyPart: 'Tornozelo', category: 'injury' },
  { code: 'JA2', description: 'Sindesmose do tornozelo', bodyPart: 'Tornozelo', category: 'injury' },
  { code: 'JA3', description: 'Fractura do tornozelo', bodyPart: 'Tornozelo', category: 'injury' },
  { code: 'JA4', description: 'Tendinopatia de Aquiles', bodyPart: 'Tornozelo/Calcâneo', category: 'injury' },
  { code: 'JA5', description: 'Rotura do tendão de Aquiles', bodyPart: 'Tornozelo/Calcâneo', category: 'injury' },
  // ── Knee ────────────────────────────────────────────────────────────────────
  { code: 'JK1ACL', description: 'Lesão do ligamento cruzado anterior (LCA)', bodyPart: 'Joelho', category: 'injury' },
  { code: 'JK1PCL', description: 'Lesão do ligamento cruzado posterior (LCP)', bodyPart: 'Joelho', category: 'injury' },
  { code: 'JK1MCL', description: 'Lesão do ligamento colateral medial', bodyPart: 'Joelho', category: 'injury' },
  { code: 'JK1LCL', description: 'Lesão do ligamento colateral lateral', bodyPart: 'Joelho', category: 'injury' },
  { code: 'JK2MM', description: 'Lesão do menisco medial', bodyPart: 'Joelho', category: 'injury' },
  { code: 'JK2LM', description: 'Lesão do menisco lateral', bodyPart: 'Joelho', category: 'injury' },
  { code: 'JK3', description: 'Contusão do joelho', bodyPart: 'Joelho', category: 'injury' },
  { code: 'JK4', description: 'Síndrome femoropatelar', bodyPart: 'Joelho/Rótula', category: 'injury' },
  { code: 'JK5', description: 'Tendinopatia patelar (joelho do saltador)', bodyPart: 'Joelho/Patelar', category: 'injury' },
  { code: 'JK6', description: 'Síndrome de Osgood-Schlatter', bodyPart: 'Joelho distal', category: 'injury' },
  // ── Hip / Groin ─────────────────────────────────────────────────────────────
  { code: 'JH1', description: 'Luxação/subluxação da anca', bodyPart: 'Anca', category: 'injury' },
  { code: 'JH2', description: 'Síndrome de impacto femoroacetabular (FAI)', bodyPart: 'Anca', category: 'injury' },
  { code: 'GG1', description: 'Pubalgia / groin pain crónico', bodyPart: 'Virilha/Púbis', category: 'injury' },
  { code: 'GG2', description: 'Osteíte púbica', bodyPart: 'Púbis', category: 'injury' },
  { code: 'GG3', description: 'Hérnia inguinal desportiva', bodyPart: 'Virilha', category: 'injury' },
  // ── Foot ────────────────────────────────────────────────────────────────────
  { code: 'JF1', description: 'Fractura de stress do metatarso (Março)', bodyPart: 'Pé', category: 'injury' },
  { code: 'JF2', description: 'Fractura de Jones (base 5.º metatarso)', bodyPart: 'Pé', category: 'injury' },
  { code: 'JF3', description: 'Entorse do hálux (turf toe)', bodyPart: 'Pé/Hálux', category: 'injury' },
  { code: 'JF4', description: 'Fascite plantar', bodyPart: 'Pé', category: 'injury' },
  { code: 'JF5', description: 'Tendinopatia peronial', bodyPart: 'Pé/Tornozelo lateral', category: 'injury' },
  // ── Spine / Back ────────────────────────────────────────────────────────────
  { code: 'SL1', description: 'Lombalgia aguda / síndrome lombar', bodyPart: 'Coluna lombar', category: 'injury' },
  { code: 'SL2', description: 'Hérnia discal lombar', bodyPart: 'Coluna lombar', category: 'injury' },
  { code: 'SL3', description: 'Ciatalgia / radiculopatia lombar', bodyPart: 'Coluna lombar', category: 'injury' },
  { code: 'SC1', description: 'Cervicalgia / contractura cervical', bodyPart: 'Coluna cervical', category: 'injury' },
  // ── Shoulder ────────────────────────────────────────────────────────────────
  { code: 'JS1', description: 'Lesão do manguito rotador', bodyPart: 'Ombro', category: 'injury' },
  { code: 'JS2', description: 'Luxação/instabilidade do ombro', bodyPart: 'Ombro', category: 'injury' },
  { code: 'JS3', description: 'Separação acromioclavicular', bodyPart: 'Ombro', category: 'injury' },
  // ── Head / Concussion ───────────────────────────────────────────────────────
  { code: 'HH1', description: 'Concussão / traumatismo cranioencefálico', bodyPart: 'Cabeça', category: 'injury' },
  { code: 'HH2', description: 'Laceração craniana / ferida na cabeça', bodyPart: 'Cabeça', category: 'injury' },
  { code: 'HF1', description: 'Traumatismo facial / fractura nasal', bodyPart: 'Face', category: 'injury' },
  // ── Bone fractures ──────────────────────────────────────────────────────────
  { code: 'BT1', description: 'Fractura de stress tibial', bodyPart: 'Tíbia', category: 'injury' },
  { code: 'BT2', description: 'Fractura da tíbia (traumática)', bodyPart: 'Tíbia', category: 'injury' },
  { code: 'BF1', description: 'Fractura da fíbula', bodyPart: 'Fíbula', category: 'injury' },
  // ── Contusions ──────────────────────────────────────────────────────────────
  { code: 'CT1', description: 'Contusão da coxa (hematoma)', bodyPart: 'Coxa', category: 'injury' },
  { code: 'CS1', description: 'Contusão da perna', bodyPart: 'Perna', category: 'injury' },
  { code: 'CR1', description: 'Contusão costal / fractura de costela', bodyPart: 'Tronco', category: 'injury' },
  // ── Laceration / wound ──────────────────────────────────────────────────────
  { code: 'WL1', description: 'Laceração / ferida cutânea', bodyPart: 'Diverso', category: 'injury' },
  // ── Medical / Disease ───────────────────────────────────────────────────────
  { code: 'DI1', description: 'Gastroenterite aguda', bodyPart: 'Sistémico', category: 'disease' },
  { code: 'DI2', description: 'Infeção das vias respiratórias superiores (IVRS)', bodyPart: 'Respiratório', category: 'disease' },
  { code: 'DI3', description: 'Mononucleose infeciosa (Epstein-Barr)', bodyPart: 'Sistémico', category: 'disease' },
  { code: 'DI4', description: 'Tendinopatia / dor crónica sem lesão estrutural', bodyPart: 'Diverso', category: 'disease' },
  { code: 'DC1', description: 'Síndrome de overtraining / fadiga crónica', bodyPart: 'Sistémico', category: 'disease' },
  { code: 'DC2', description: 'Anemia ferropénica', bodyPart: 'Sistémico', category: 'disease' },
  { code: 'DC3', description: 'Défice de vitamina D', bodyPart: 'Sistémico', category: 'disease' },
  { code: 'DS1', description: 'Perturbação do sono', bodyPart: 'Sistémico', category: 'disease' },
  { code: 'DS2', description: 'Ansiedade / perturbação psicológica', bodyPart: 'Mental', category: 'disease' },
  { code: 'DK1', description: 'Doença de pele / dermatite', bodyPart: 'Pele', category: 'disease' },
  { code: 'DO1', description: 'Outra patologia médica', bodyPart: 'Diverso', category: 'disease' },
]

export function searchOsiics(query: string): OsiicsEntry[] {
  if (!query.trim()) return OSIICS_FOOTBALL.slice(0, 20)
  const q = query.toLowerCase()
  return OSIICS_FOOTBALL.filter(
    (e) =>
      e.description.toLowerCase().includes(q) ||
      e.code.toLowerCase().includes(q) ||
      e.bodyPart.toLowerCase().includes(q)
  ).slice(0, 15)
}
