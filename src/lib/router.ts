export type AppRoute = 
  | 'inicio'
  | 'login'
  | 'registro'
  | 'psicologos'
  | 'triage'
  | 'chat'
  | 'expedientes'
  | 'supervisor'
  | 'auditoria';

export interface RouteMeta {
  route: AppRoute;
  label: string;
  subdomain: string;
  isProtected: boolean;
  requiresAdmin?: boolean;
  description: string;
  iconName: string;
}

export const ROUTE_REGISTRY: Record<AppRoute, RouteMeta> = {
  inicio: {
    route: 'inicio',
    label: 'Inicio',
    subdomain: 'inicio.subatech.saludcapital.gov.co',
    isProtected: false,
    description: 'Portal Institucional de Salud Mental SubaTECH y Guardia Distrital',
    iconName: 'Home',
  },
  login: {
    route: 'login',
    label: 'Iniciar Sesión',
    subdomain: 'auth.subatech.saludcapital.gov.co/login',
    isProtected: false,
    description: 'Acceso Seguro y Cifrado para Especialistas Clínicos',
    iconName: 'LogIn',
  },
  registro: {
    route: 'registro',
    label: 'Registro Especialista',
    subdomain: 'auth.subatech.saludcapital.gov.co/registro',
    isProtected: false,
    description: 'Alta de Psicólogos con Registro Sanitario ReTHUS',
    iconName: 'UserPlus',
  },
  psicologos: {
    route: 'psicologos',
    label: 'Directorio de Psicólogos',
    subdomain: 'psicologos.subatech.saludcapital.gov.co',
    isProtected: true,
    description: 'Equipo Clínico, Guardias Activas, Roles y Permisos Específicos',
    iconName: 'Users',
  },
  triage: {
    route: 'triage',
    label: 'Guardia y Triage',
    subdomain: 'triage.subatech.saludcapital.gov.co',
    isProtected: true,
    description: 'Bandeja de Triage de Pacientes en Espera por WhatsApp',
    iconName: 'Inbox',
  },
  chat: {
    route: 'chat',
    label: 'Chat de Atención',
    subdomain: 'atencion.subatech.saludcapital.gov.co/chat',
    isProtected: true,
    description: 'Consulta Psicológica en Tiempo Real vía WhatsApp',
    iconName: 'MessageSquare',
  },
  expedientes: {
    route: 'expedientes',
    label: 'Expedientes Clínicos',
    subdomain: 'expedientes.subatech.saludcapital.gov.co',
    isProtected: true,
    description: 'Historias Clínicas Oficiales y Archivo Forense',
    iconName: 'FileText',
  },
  supervisor: {
    route: 'supervisor',
    label: 'Supervisor IA',
    subdomain: 'supervisor-ia.subatech.saludcapital.gov.co',
    isProtected: true,
    description: 'Monitoreo Gemini y Detección de Riesgos en Tiempo Real',
    iconName: 'Bot',
  },
  auditoria: {
    route: 'auditoria',
    label: 'Auditoría Forense',
    subdomain: 'seguridad.subatech.saludcapital.gov.co/auditoria',
    isProtected: true,
    requiresAdmin: true,
    description: 'Registro Inmutable de Seguridad y Control de Accesos',
    iconName: 'ShieldCheck',
  },
};

/**
 * Normalizes any string or URL fragment into a valid AppRoute
 */
export function normalizeRoute(raw?: string | null): AppRoute {
  if (!raw) return 'inicio';
  const clean = raw.toLowerCase().replace(/^[#/]+/, '').split('?')[0].trim();

  if (clean === '' || clean === 'inicio' || clean === 'home' || clean === 'index') {
    return 'inicio';
  }
  if (clean === 'login' || clean === 'ingreso' || clean === 'acceso' || clean === 'signin') {
    return 'login';
  }
  if (clean === 'registro' || clean === 'register' || clean === 'sing-in' || clean === 'singin' || clean === 'sign-in') {
    return 'registro';
  }
  if (clean === 'psicologos' || clean === 'psicologo' || clean === 'equipo' || clean === 'especialistas') {
    return 'psicologos';
  }
  if (clean === 'triage' || clean === 'guardia' || clean === 'queue' || clean === 'bandeja') {
    return 'triage';
  }
  if (clean === 'chat' || clean === 'active' || clean === 'consulta' || clean === 'atencion') {
    return 'chat';
  }
  if (clean === 'expedientes' || clean === 'historial' || clean === 'records' || clean === 'historias') {
    return 'expedientes';
  }
  if (clean === 'supervisor' || clean === 'ia' || clean === 'gemini') {
    return 'supervisor';
  }
  if (clean === 'auditoria' || clean === 'audit' || clean === 'seguridad' || clean === 'logs') {
    return 'auditoria';
  }

  return 'inicio';
}

/**
 * Parses the current route from window.location (hash or pathname)
 */
export function parseCurrentRoute(): AppRoute {
  if (typeof window === 'undefined') return 'inicio';
  
  // 1. Prefer hash e.g. #/login or #psicologos
  if (window.location.hash) {
    return normalizeRoute(window.location.hash);
  }

  // 2. Query param ?tab= or ?route=
  try {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') || params.get('route');
    if (tabParam) {
      return normalizeRoute(tabParam);
    }
  } catch (e) {
    // Ignore query param errors
  }

  // 3. Fallback to pathname e.g. /psicologos
  const path = window.location.pathname.replace(/^\/+/, '');
  if (path && path !== 'index.html') {
    return normalizeRoute(path);
  }

  return 'inicio';
}

/**
 * Navigates to an AppRoute and updates window.history to support the back/forward buttons
 */
export function navigateTo(route: AppRoute, replace = false): void {
  if (typeof window === 'undefined') return;

  const targetHash = `#/${route}`;
  const currentState = window.history.state || {};

  if (replace) {
    window.history.replaceState({ ...currentState, appRoute: route }, '', targetHash);
  } else {
    window.history.pushState({ ...currentState, appRoute: route }, '', targetHash);
  }

  // Dispatch custom event to notify listeners immediately in same turn
  window.dispatchEvent(new CustomEvent('applet:routechange', { detail: { route } }));
}
