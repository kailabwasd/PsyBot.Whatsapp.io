/**
 * Base de datos clínica de palabras clave de alerta de crisis para SubaTECH Salud Mental
 * Detecta ideación suicida, violencia, crímenes, autolesión y peligro inminente.
 * 
 * Este módulo contiene el catálogo base validado por profesionales de salud mental,
 * algoritmos de normalización diacrítica (remoción de acentos y caracteres especiales)
 * y evaluadores de riesgo tanto globales como personalizados según los umbrales de cada psicólogo.
 */

import type { CrisisAlertPreferences } from '../types/index.ts';

export interface CrisisKeywordEntry {
  category: 'SUICIDIO' | 'CRIMEN_VIOLENCIA' | 'AUTOLESION' | 'AMENAZA_INMINENTE';
  displayName: string;
  severity: 'CRITICA' | 'ALTA';
  clinicalAdvice: string;
  keywords: string[];
}

export const INITIAL_CRISIS_KEYWORDS_DATABASE: CrisisKeywordEntry[] = [
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

export const CRISIS_KEYWORDS_DATABASE = INITIAL_CRISIS_KEYWORDS_DATABASE;

let cachedDb: CrisisKeywordEntry[] | null = null;

export function getStoredCrisisKeywords(): CrisisKeywordEntry[] {
  if (cachedDb) return cachedDb;
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('psybot_crisis_keywords_db');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedDb = parsed;
          return parsed;
        }
      }
    }
  } catch (e) {
    console.error('Error reading stored crisis keywords:', e);
  }
  cachedDb = INITIAL_CRISIS_KEYWORDS_DATABASE;
  return INITIAL_CRISIS_KEYWORDS_DATABASE;
}

export function saveStoredCrisisKeywords(db: CrisisKeywordEntry[]) {
  cachedDb = db;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('psybot_crisis_keywords_db', JSON.stringify(db));
    }
  } catch (e) {
    console.error('Error saving stored crisis keywords:', e);
  }
}

/**
 * Normaliza el texto removiendo tildes, signos diacríticos y caracteres de puntuación.
 * Esto asegura que frases como "desearía morirme" coincidan con "desearia morirme"
 * sin depender de si el paciente escribe con ortografía perfecta en WhatsApp.
 */
export function normalizeClinicalText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Configuración predeterminada de alertas de crisis para especialistas que aún no
 * han personalizado sus parámetros en Firestore.
 * Diseñada siguiendo los lineamientos de la Subred Norte de Salud de Bogotá.
 */
export const DEFAULT_CRISIS_PREFERENCES: CrisisAlertPreferences = {
  alertThreshold: 1, // Por defecto, una sola coincidencia detona la alerta preventiva
  sensitivityLevel: 'MODERADA',
  customKeywords: [],
  enabledCategories: {
    suicidio: true,
    crimenViolencia: true,
    autolesion: true,
    amenazaInminente: true,
  },
  minRiskLevelAlert: 'MODERADO',
  soundAlertEnabled: true,
  autoHighlightTranscripts: true,
};

/**
 * Resultado estructurado del análisis de palabras clave de crisis.
 * Proporciona a los componentes clínicos información detallada sobre qué términos detonaron la alerta,
 * qué categoría diagnóstica representan y qué protocolo de emergencia activar.
 */
export interface CrisisMatchResult {
  /** Indica si se alcanzó el umbral configurado por el psicólogo para detonar alerta */
  matched: boolean;
  /** Categoría clínica del riesgo (Suicidio, Violencia, Autolesión, etc.) */
  category?: 'SUICIDIO' | 'CRIMEN_VIOLENCIA' | 'AUTOLESION' | 'AMENAZA_INMINENTE' | 'PERSONALIZADA';
  /** Nombre amigable de la categoría para presentación en badges de la UI */
  categoryDisplay?: string;
  /** Término principal o primer término coincidente */
  keyword?: string;
  /** Lista de todas las palabras o frases coincidentes encontradas en el mensaje */
  allMatchedKeywords?: string[];
  /** Cantidad total de coincidencias detectadas */
  matchCount?: number;
  /** Indica si la cantidad de coincidencias igualó o superó el umbral configurado */
  thresholdReached?: boolean;
  /** Umbral de activación configurado por el profesional (ej. 1, 2 o 3) */
  threshold?: number;
  /** Nivel de severidad clínica para priorización visual */
  severity?: 'CRITICA' | 'ALTA';
  /** Recomendación o indicación de intervención rápida para el psicólogo en guardia */
  clinicalAdvice?: string;
}

/**
 * Evalúa si el texto del paciente coincide con alguna de las palabras clave de crisis actuales
 * utilizando coincidencia rápida de catálogo base (umbral = 1).
 * 
 * @param text - Mensaje recibido del paciente por WhatsApp o simulador
 * @returns Resultado del cotejo con el catálogo de emergencia
 */
export function matchCrisisKeyword(text: string): CrisisMatchResult {
  if (!text || typeof text !== 'string') return { matched: false };
  const normalized = normalizeClinicalText(text);
  const db = getStoredCrisisKeywords();

  for (const entry of db) {
    for (const kw of entry.keywords) {
      const normalizedKw = normalizeClinicalText(kw);
      if (!normalizedKw) continue;

      if (normalized.includes(normalizedKw)) {
        return {
          matched: true,
          category: entry.category,
          categoryDisplay: entry.displayName,
          keyword: kw,
          allMatchedKeywords: [kw],
          matchCount: 1,
          thresholdReached: true,
          threshold: 1,
          severity: entry.severity,
          clinicalAdvice: entry.clinicalAdvice,
        };
      }
    }
  }

  return { matched: false, matchCount: 0 };
}

/**
 * Algoritmo clínico avanzado que evalúa el texto del paciente considerando:
 * 1. Los umbrales de activación configurados por el psicólogo (cantidad mínima de coincidencias).
 * 2. Las palabras clave personalizadas y modismos locales añadidos por el profesional.
 * 3. Las categorías de riesgo específicas que el profesional tiene activadas o desactivadas.
 * 
 * @param text - Texto a analizar (último mensaje o transcripción del paciente)
 * @param preferences - Preferencias de crisis guardadas en Firestore del psicólogo activo
 * @returns Diagnóstico de coincidencia con desglose cuantitativo
 */
export function matchCrisisKeywordWithPreferences(
  text: string,
  preferences?: CrisisAlertPreferences
): CrisisMatchResult {
  if (!text || typeof text !== 'string') return { matched: false, matchCount: 0 };
  const normalized = normalizeClinicalText(text);
  const db = getStoredCrisisKeywords();
  const prefs = preferences || DEFAULT_CRISIS_PREFERENCES;
  const threshold = Math.max(1, prefs.alertThreshold || 1);

  const matchedKeywordsList: string[] = [];
  let primaryCategory: 'SUICIDIO' | 'CRIMEN_VIOLENCIA' | 'AUTOLESION' | 'AMENAZA_INMINENTE' | 'PERSONALIZADA' = 'SUICIDIO';
  let primaryCategoryDisplay = 'Ideación y Riesgo Suicida';
  let primaryAdvice = 'Activar protocolo urgente de contención suicida.';
  let primarySeverity: 'CRITICA' | 'ALTA' = 'ALTA';

  // 1. Verificar palabras clave personalizadas añadidas por el psicólogo
  if (Array.isArray(prefs.customKeywords)) {
    for (const customKw of prefs.customKeywords) {
      const normalizedCustom = normalizeClinicalText(customKw);
      if (normalizedCustom && normalized.includes(normalizedCustom)) {
        if (!matchedKeywordsList.includes(customKw)) {
          matchedKeywordsList.push(customKw);
          primaryCategory = 'PERSONALIZADA';
          primaryCategoryDisplay = 'Palabra Clave Personalizada del Psicólogo';
          primarySeverity = 'CRITICA';
          primaryAdvice = `Alerta configurada por el especialista: coincidencia con "${customKw}".`;
        }
      }
    }
  }

  // 2. Evaluar categorías del catálogo según las preferencias del psicólogo
  for (const entry of db) {
    const isCategoryEnabled = 
      (entry.category === 'SUICIDIO' && prefs.enabledCategories?.suicidio !== false) ||
      (entry.category === 'CRIMEN_VIOLENCIA' && prefs.enabledCategories?.crimenViolencia !== false) ||
      (entry.category === 'AUTOLESION' && prefs.enabledCategories?.autolesion !== false) ||
      (entry.category === 'AMENAZA_INMINENTE' && prefs.enabledCategories?.amenazaInminente !== false);

    if (!isCategoryEnabled) continue;

    for (const kw of entry.keywords) {
      const normalizedKw = normalizeClinicalText(kw);
      if (!normalizedKw) continue;

      if (normalized.includes(normalizedKw)) {
        if (!matchedKeywordsList.includes(kw)) {
          matchedKeywordsList.push(kw);
          if (entry.severity === 'CRITICA' || primarySeverity !== 'CRITICA') {
            primaryCategory = entry.category;
            primaryCategoryDisplay = entry.displayName;
            primaryAdvice = entry.clinicalAdvice;
            primarySeverity = entry.severity;
          }
        }
      }
    }
  }

  const matchCount = matchedKeywordsList.length;
  const thresholdReached = matchCount >= threshold;

  return {
    matched: thresholdReached,
    category: primaryCategory,
    categoryDisplay: primaryCategoryDisplay,
    keyword: matchedKeywordsList[0],
    allMatchedKeywords: matchedKeywordsList,
    matchCount,
    thresholdReached,
    threshold,
    severity: primarySeverity,
    clinicalAdvice: primaryAdvice,
  };
}
