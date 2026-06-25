export interface OsiicsEntry {
  code: string
  description: string
  category: string
}

export const OSIICS_CODES: OsiicsEntry[] = [
  // Muscle injuries — thigh
  { code: 'MHM', description: 'Distensão do isquiotibial', category: 'Músculo' },
  { code: 'MHT', description: 'Rotura do tendão do isquiotibial', category: 'Músculo' },
  { code: 'MHC', description: 'Contusão do isquiotibial', category: 'Músculo' },
  { code: 'MQM', description: 'Distensão do quadricípede', category: 'Músculo' },
  { code: 'MQT', description: 'Rotura do quadricípede', category: 'Músculo' },
  { code: 'MQC', description: 'Contusão do quadricípede (coxa)', category: 'Músculo' },
  { code: 'MAM', description: 'Distensão dos adutores', category: 'Músculo' },
  { code: 'MAT', description: 'Rotura dos adutores', category: 'Músculo' },
  { code: 'MGM', description: 'Distensão do glúteo', category: 'Músculo' },
  { code: 'MGC', description: 'Contusão do glúteo', category: 'Músculo' },

  // Muscle injuries — leg/calf
  { code: 'MCM', description: 'Distensão do gémeo (gastrocnémio)', category: 'Músculo' },
  { code: 'MCT', description: 'Rotura do gémeo', category: 'Músculo' },
  { code: 'MSM', description: 'Distensão do sóleo', category: 'Músculo' },
  { code: 'MFM', description: 'Distensão do flexor plantar', category: 'Músculo' },
  { code: 'MPM', description: 'Distensão do peroneal', category: 'Músculo' },
  { code: 'MTM', description: 'Distensão do tibial anterior', category: 'Músculo' },
  { code: 'MIM', description: 'Distensão da iliopsoás', category: 'Músculo' },

  // Tendon injuries
  { code: 'TAT', description: 'Tendinopatia do tendão de Aquiles', category: 'Tendão' },
  { code: 'TAR', description: 'Rotura do tendão de Aquiles', category: 'Tendão' },
  { code: 'TPT', description: 'Tendinopatia patelar', category: 'Tendão' },
  { code: 'TGT', description: 'Tendinopatia do glúteo', category: 'Tendão' },
  { code: 'THT', description: 'Tendinopatia dos isquiotibiais', category: 'Tendão' },
  { code: 'TAD', description: 'Tendinopatia dos adutores (pubite)', category: 'Tendão' },
  { code: 'TPE', description: 'Tendinopatia do peroneal', category: 'Tendão' },
  { code: 'TFH', description: 'Tendinopatia do flexor do hálux', category: 'Tendão' },
  { code: 'TRC', description: 'Tendinopatia do manguito rotador (ombro)', category: 'Tendão' },

  // Ligament / joint — knee
  { code: 'LKA', description: 'Entorse do LCA (Ligamento Cruzado Anterior)', category: 'Ligamento' },
  { code: 'LKP', description: 'Entorse do LCP (Ligamento Cruzado Posterior)', category: 'Ligamento' },
  { code: 'LKM', description: 'Entorse do LLI (Ligamento Lateral Interno)', category: 'Ligamento' },
  { code: 'LKL', description: 'Entorse do LLE (Ligamento Lateral Externo)', category: 'Ligamento' },
  { code: 'LKR', description: 'Rotura do LCA', category: 'Ligamento' },
  { code: 'LMM', description: 'Rotura do menisco medial', category: 'Ligamento' },
  { code: 'LML', description: 'Rotura do menisco lateral', category: 'Ligamento' },

  // Ligament / joint — ankle
  { code: 'LAL', description: 'Entorse do tornozelo (ligamento lateral)', category: 'Ligamento' },
  { code: 'LAM', description: 'Entorse do tornozelo (ligamento medial/deltoide)', category: 'Ligamento' },
  { code: 'LAS', description: 'Entorse alta do tornozelo (sindesmose)', category: 'Ligamento' },
  { code: 'LAR', description: 'Rotura ligamentar do tornozelo', category: 'Ligamento' },

  // Joint — hip/groin
  { code: 'JHI', description: 'Impingement femoro-acetabular (IFA)', category: 'Articulação' },
  { code: 'JHL', description: 'Laceração do labrum da anca', category: 'Articulação' },
  { code: 'JHB', description: 'Bursite da anca (trocantérica)', category: 'Articulação' },
  { code: 'JGA', description: 'Pubalgia / Disfunção pélvica', category: 'Articulação' },
  { code: 'JKB', description: 'Bursite pré-patelar', category: 'Articulação' },
  { code: 'JKE', description: 'Derrame articular do joelho', category: 'Articulação' },
  { code: 'JAB', description: 'Bursite retrocalcânea', category: 'Articulação' },

  // Bone / fractures
  { code: 'BFS', description: 'Fratura de stress da tíbia', category: 'Osso' },
  { code: 'BFP', description: 'Fratura de stress do perónio', category: 'Osso' },
  { code: 'BFM', description: 'Fratura de stress metatársica', category: 'Osso' },
  { code: 'BFN', description: 'Fratura do navicular (stress)', category: 'Osso' },
  { code: 'BFF', description: 'Fratura do 5.º metatarso (avulsão / Jones)', category: 'Osso' },
  { code: 'BFA', description: 'Fratura maleolar', category: 'Osso' },
  { code: 'BFK', description: 'Fratura da rótula', category: 'Osso' },
  { code: 'BFC', description: 'Fratura da clavícula', category: 'Osso' },
  { code: 'BFR', description: 'Fratura da costela', category: 'Osso' },

  // Foot / plantar
  { code: 'FPF', description: 'Fasciite plantar', category: 'Pé' },
  { code: 'FHV', description: 'Hálux valgus', category: 'Pé' },
  { code: 'FHR', description: 'Rigidez do hálux (Hallux rigidus)', category: 'Pé' },
  { code: 'FMS', description: 'Síndrome do metatarso', category: 'Pé' },
  { code: 'FAC', description: 'Doença de Sever (apofisíte calcânea)', category: 'Pé' },

  // Knee — overuse
  { code: 'KOS', description: 'Síndrome de Osgood-Schlatter', category: 'Joelho' },
  { code: 'KIB', description: 'Síndrome da banda iliotibial (SBIT)', category: 'Joelho' },
  { code: 'KCF', description: 'Condromalácia patelar', category: 'Joelho' },
  { code: 'KOA', description: 'Osteoartrose do joelho', category: 'Joelho' },
  { code: 'KPS', description: 'Síndrome fémoro-patelar', category: 'Joelho' },

  // Spine / back
  { code: 'SLC', description: 'Lombalgia crónica', category: 'Coluna' },
  { code: 'SLA', description: 'Lombalgia aguda (contractura)', category: 'Coluna' },
  { code: 'SLD', description: 'Hérnia discal lombar', category: 'Coluna' },
  { code: 'SCS', description: 'Cervicalgia / whiplash', category: 'Coluna' },
  { code: 'SSP', description: 'Espondilólise / Espondilolistese', category: 'Coluna' },
  { code: 'SSI', description: 'Disfunção sacroilíaca', category: 'Coluna' },

  // Shoulder / upper extremity
  { code: 'SAC', description: 'Entorse acromioclavicular', category: 'Ombro' },
  { code: 'SDI', description: 'Luxação do ombro', category: 'Ombro' },
  { code: 'SIM', description: 'Lesão do manguito rotador', category: 'Ombro' },
  { code: 'SBR', description: 'Bursite subacromial', category: 'Ombro' },
  { code: 'ELC', description: 'Epicondilite lateral (cotovelo de tenista)', category: 'Cotovelo' },
  { code: 'ELM', description: 'Epicondilite medial (cotovelo de golfe)', category: 'Cotovelo' },
  { code: 'WFS', description: 'Entorse do pulso', category: 'Pulso' },
  { code: 'HFF', description: 'Fratura / luxação do dedo', category: 'Mão' },

  // Head / concussion
  { code: 'HCO', description: 'Concussão cerebral', category: 'Cabeça' },
  { code: 'HLA', description: 'Laceração do couro cabeludo', category: 'Cabeça' },
  { code: 'HFN', description: 'Fratura nasal', category: 'Cabeça' },
  { code: 'HFO', description: 'Fratura orbital', category: 'Cabeça' },

  // Groin / abdominal
  { code: 'GAH', description: 'Hérnia inguinal / sports hernia', category: 'Virilha' },
  { code: 'GAP', description: 'Pubalgia (entesopatia dos adutores)', category: 'Virilha' },
  { code: 'GAO', description: 'Osteíte púbica', category: 'Virilha' },

  // Skin / soft tissue
  { code: 'SKL', description: 'Laceração cutânea', category: 'Pele' },
  { code: 'SKA', description: 'Abrasão cutânea', category: 'Pele' },
  { code: 'SKC', description: 'Contusão (hematoma)', category: 'Pele' },
  { code: 'SKB', description: 'Bolha / vesícula', category: 'Pele' },

  // Medical / illness
  { code: 'ILI', description: 'Gripe / síndrome gripal', category: 'Doença' },
  { code: 'IGA', description: 'Gastroenterite', category: 'Doença' },
  { code: 'IUL', description: 'Infeção urinária', category: 'Doença' },
  { code: 'IUR', description: 'Infeção respiratória superior', category: 'Doença' },
  { code: 'IMO', description: 'Mononucleose infeciosa', category: 'Doença' },
  { code: 'IAN', description: 'Anemia', category: 'Doença' },
  { code: 'IHT', description: 'Golpe de calor / hipertermia', category: 'Doença' },
  { code: 'ICR', description: 'Cãibra por calor', category: 'Doença' },
  { code: 'IHY', description: 'Hipoglicémia', category: 'Doença' },
  { code: 'IAS', description: 'Asma induzida pelo exercício', category: 'Doença' },
  { code: 'IDH', description: 'Desidratação', category: 'Doença' },

  // Cardiac / systemic
  { code: 'CAR', description: 'Arritmia cardíaca', category: 'Cardíaco' },
  { code: 'CMY', description: 'Miocardite', category: 'Cardíaco' },
  { code: 'CHP', description: 'Hipertensão arterial', category: 'Cardíaco' },

  // Overtraining / functional
  { code: 'OTS', description: 'Síndrome de overtraining', category: 'Funcional' },
  { code: 'OTF', description: 'Fadiga por excesso de treino', category: 'Funcional' },
  { code: 'RFP', description: 'Fratura de stress por sobrecarga', category: 'Funcional' },
]

export function searchOsiics(query: string): OsiicsEntry[] {
  if (!query || query.length < 2) return []
  const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return OSIICS_CODES.filter((entry) => {
    const desc = entry.description.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const code = entry.code.toLowerCase()
    const cat  = entry.category.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return desc.includes(q) || code.includes(q) || cat.includes(q)
  }).slice(0, 10)
}
