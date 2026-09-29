/**
 * Base de datos clínica de palabras clave de alerta de crisis para SubaTECH Salud Mental
 * Detecta ideación suicida, violencia, crímenes, autolesión y peligro inminente.
 */

export interface CrisisKeywordEntry {
  category: 'SUICIDIO' | 'CRIMEN_VIOLENCIA' | 'AUTOLESION' | 'AMENAZA_INMINENTE';
  displayName: string;
  severity: 'CRITICA' | 'ALTA';
  clinicalAdvice: string;
  keywords: string[];
}

export const CRISIS_KEYWORDS_DATABASE: CrisisKeywordEntry[] = [
  {
    category: 'SUICIDIO',
    displayName: 'Ideación y Riesgo Suicida',
    severity: 'CRITICA',
    clinicalAdvice: 'Activar protocolo urgente de contención suicida, enlace a Línea 106/192 y atención prioritaria en guardia.',
    keywords: [
      'suicidio',
      'suicidarme',
      'suicida',
      'suicidios',
      'suicid',
      'quitarme la vida',
      'quitarme mi vida',
      'quitar la vida',
      'no quiero vivir',
      'no deseo vivir',
      'no vale la pena vivir',
      'para que vivir',
      'no tiene sentido vivir',
      'ya no quiero seguir viviendo',
      'no soporto vivir',
      'acabar con todo',
      'terminar con todo',
      'acabar con mi vida',
      'poner fin a mi vida',
      'ponerle fin a mi vida',
      'terminar con mi sufrimiento',
      'desearia estar muerto',
      'desearía estar muerto',
      'desearia morir',
      'desearía morir',
      'morirme ya',
      'quiero morirme',
      'ojala me muriera',
      'ojalá me muriera',
      'mejor estar muerto',
      'estaria mejor muerto',
      'no tengo motivos para seguir',
      'nadie me extrañaria',
      'nadie me extrañaría',
      'estarian mejor sin mi',
      'estarían mejor sin mí',
      'ahorcarme',
      'colgarme',
      'tirarme al tren',
      'tirarme del puente',
      'tirarme por la ventana',
      'lanzarme de un puente',
      'lanzarme al vacio',
      'tirarme al vacio',
      'tomarme todas las pastillas',
      'sobredosis',
      'empastillarme',
      'intoxicarme con pastillas',
      'ingerir veneno',
      'carta de despedida',
      'despedirme de todos',
      'mi última noche',
      'mi ultima noche',
      'adios para siempre',
      'adiós para siempre',
    ],
  },
  {
    category: 'CRIMEN_VIOLENCIA',
    displayName: 'Crimen y Violencia hacia Terceros',
    severity: 'CRITICA',
    clinicalAdvice: 'Alerta de riesgo de agresión física o acto delictivo: desescalamiento verbal y reporte preventivo.',
    keywords: [
      'matar',
      'matarme',
      'matarlo',
      'matarla',
      'matarlos',
      'matar a alguien',
      'quiero matar',
      'voy a matar',
      'tengo ganas de matar',
      'asesinar',
      'asesinato',
      'asesinarlo',
      'asesinarla',
      'cometer un crimen',
      'crimen',
      'crimenes',
      'crímenes',
      'delito grave',
      'acuchillar',
      'apuñalar',
      'disparar',
      'pegarle un tiro',
      'pegar un tiro',
      'darle un tiro',
      'arma de fuego',
      'comprar un arma',
      'hacerle daño a alguien',
      'hacer daño a los demas',
      'masacre',
      'atentar contra',
      'poner una bomba',
      'hacer explotar',
      'venganza sangrienta',
      'cobrar venganza',
      'hacer justicia por mano propia',
      'envenenar a',
      'homicidio',
    ],
  },
  {
    category: 'AUTOLESION',
    displayName: 'Conducta Autolesiva',
    severity: 'ALTA',
    clinicalAdvice: 'Intervención en primeros auxilios psicológicos y regulación emocional ante daño físico activo.',
    keywords: [
      'autolesion',
      'autolesión',
      'autolesiones',
      'autolesionarme',
      'cortarme',
      'cortarme las venas',
      'cortes en los brazos',
      'cortarme las piernas',
      'usar una navaja',
      'lastimarme',
      'hacerme daño',
      'hacerme heridas',
      'quemarme la piel',
      'quemarme a proposito',
      'quemarme a propósito',
      'golpearme la cabeza',
      'desangrarme',
      'mutilarme',
      'clavarme',
      'herirme',
    ],
  },
  {
    category: 'AMENAZA_INMINENTE',
    displayName: 'Amenaza de Muerte o Abuso en Curso',
    severity: 'CRITICA',
    clinicalAdvice: 'Riesgo inminente para la vida: activar enlace con líneas de emergencia 123 y cuadrante policial.',
    keywords: [
      'me van a matar',
      'me quieren matar',
      'amenaza de muerte',
      'amenazaron de muerte',
      'me estan golpeando',
      'me están golpeando',
      'me estan pegando',
      'me están pegando',
      'violacion',
      'violación',
      'abuso sexual',
      'abuso en casa',
      'violencia domestica',
      'violencia intrafamiliar',
      'secuestro',
      'me tienen encerrada',
      'me tienen encerrado',
      'peligro inminente',
      'socorro me pegan',
      'temo por mi vida',
    ],
  },
];

/**
 * Normaliza el texto removiendo tildes, signos diacríticos y caracteres de puntuación
 */
export function normalizeClinicalText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export interface CrisisMatchResult {
  matched: boolean;
  category?: 'SUICIDIO' | 'CRIMEN_VIOLENCIA' | 'AUTOLESION' | 'AMENAZA_INMINENTE';
  categoryDisplay?: string;
  keyword?: string;
  severity?: 'CRITICA' | 'ALTA';
  clinicalAdvice?: string;
}

/**
 * Evalúa si el texto del paciente coincide con alguna de las palabras clave de crisis
 */
export function matchCrisisKeyword(text: string): CrisisMatchResult {
  if (!text || typeof text !== 'string') return { matched: false };
  const normalized = normalizeClinicalText(text);

  for (const entry of CRISIS_KEYWORDS_DATABASE) {
    for (const kw of entry.keywords) {
      const normalizedKw = normalizeClinicalText(kw);
      if (!normalizedKw) continue;

      // Coincidencia exacta de frase o límites de palabra
      if (normalized.includes(normalizedKw)) {
        return {
          matched: true,
          category: entry.category,
          categoryDisplay: entry.displayName,
          keyword: kw,
          severity: entry.severity,
          clinicalAdvice: entry.clinicalAdvice,
        };
      }
    }
  }

  return { matched: false };
}
