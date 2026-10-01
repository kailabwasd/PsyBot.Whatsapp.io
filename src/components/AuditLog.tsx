import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Clock, 
  UserCheck, 
  Terminal, 
  Shield, 
  RefreshCw, 
  Search, 
  Filter, 
  AlertTriangle, 
  Lock, 
  Sliders, 
  UserCog, 
  Eye, 
  Download,
  Database,
  FileText,
  MessageSquare,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Award,
  LogIn,
  LogOut,
  UserX,
  FileEdit,
  Activity,
  Layers,
  Calendar
} from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc,
  doc
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import type { PsychologistAuthUser } from '../types/index.ts';

export type AuditActionType = 
  | 'LOGIN' 
  | 'LOGOUT'
  | 'CLINICAL_NOTE_UPDATE' 
  | 'SESSION_STATE_CHANGE' 
  | 'SESSION_TRANSFER' 
  | 'SESSION_CLAIM'
  | 'SESSION_CLOSE'
  | 'PSYCHOLOGIST_APPROVAL' 
  | 'PSYCHOLOGIST_REJECTION' 
  | 'PSYCHOLOGIST_SUSPENSION'
  | 'ROLE_UPDATE' 
  | 'SYSTEM_CONFIG' 
  | 'SENSITIVE_ACCESS' 
  | 'RECORD_EXPORT'
  | '2FA_SECURITY' 
  | 'PROFILE_UPDATE' 
  | 'SECURITY_OVERRIDE';

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  adminEmail?: string;
  adminName?: string;
  psychologistEmail?: string;
  psychologistName?: string;
  psychologistLicense?: string;
  psychologistUid?: string;
  action: AuditActionType;
  severity: AuditSeverity;
  category: 'CLÍNICO' | 'ACCESOS' | 'ROLES' | 'SISTEMA' | '2FA' | 'TRANSFERENCIAS';
  details: string;
  patientId?: string;
  patientName?: string;
  sessionId?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

interface AuditLogProps {
  currentUser: PsychologistAuthUser;
}

// Initial fallback seed records if Firestore is completely fresh
const INITIAL_AUDIT_SEED: Omit<AuditLogEntry, 'id'>[] = [
  {
    timestamp: Date.now() - 1000 * 60 * 5,
    adminEmail: 'kailabwasd@gmail.com',
    adminName: 'Super Administrador (SubaTECH)',
    psychologistName: 'Dra. Valentina Ramos',
    psychologistEmail: 'valentina.psicologia@subatech.salud',
    psychologistLicense: 'TP-1092834-COLPSIC',
    action: 'CLINICAL_NOTE_UPDATE',
    severity: 'INFO',
    category: 'CLÍNICO',
    patientName: 'Carlos Gómez',
    sessionId: 'session-77492',
    details: 'Actualización de notas clínicas y plan de contención de crisis (Código Amarillo).',
    ipAddress: '190.157.24.112 (Bogotá, CO)',
  },
  {
    timestamp: Date.now() - 1000 * 60 * 18,
    adminEmail: 'kailabwasd@gmail.com',
    adminName: 'Super Administrador (SubaTECH)',
    psychologistName: 'Dr. Santiago Morales',
    psychologistEmail: 'santiago.morales@subatech.salud',
    psychologistLicense: 'TP-982341-COLPSIC',
    action: 'SESSION_TRANSFER',
    severity: 'WARNING',
    category: 'TRANSFERENCIAS',
    patientName: 'María Fernanda Ruiz',
    sessionId: 'session-88310',
    details: 'Transferencia de caso de guardia a Supervisor Clínico por ideación suicida activa.',
    ipAddress: '186.84.90.15 (Suba, Bogotá)',
  },
  {
    timestamp: Date.now() - 1000 * 60 * 35,
    adminEmail: 'kailabwasd@gmail.com',
    adminName: 'Super Administrador (kailabwasd)',
    action: 'PSYCHOLOGIST_APPROVAL',
    severity: 'CRITICAL',
    category: 'ROLES',
    psychologistName: 'Dra. Andrea Castro',
    psychologistEmail: 'andrea.castro@subatech.salud',
    psychologistLicense: 'TP-445821-COLPSIC',
    details: 'Aprobación manual y habilitación de acceso web otorgada tras verificar Tarjeta Profesional ReTHUS.',
    ipAddress: '190.157.24.112 (Bogotá, CO)',
  },
  {
    timestamp: Date.now() - 1000 * 60 * 60,
    psychologistName: 'Dra. Andrea Castro',
    psychologistEmail: 'andrea.castro@subatech.salud',
    psychologistLicense: 'TP-445821-COLPSIC',
    action: 'LOGIN',
    severity: 'INFO',
    category: 'ACCESOS',
    details: 'Inicio de sesión exitoso en el portal de guardia clínica vía Google OAuth.',
    ipAddress: '190.27.18.99 (Bogotá, CO)',
  },
  {
    timestamp: Date.now() - 1000 * 60 * 120,
    adminEmail: 'kailabwasd@gmail.com',
    adminName: 'Super Administrador (SubaTECH)',
    action: '2FA_SECURITY',
    severity: 'CRITICAL',
    category: '2FA',
    details: 'Activación de Autenticación de Dos Factores (TOTP Speakeasy con secreto cifrado AES-256).',
    ipAddress: '190.157.24.112 (Bogotá, CO)',
  },
];

/**
 * Helper to register a new audit event in Cloud Firestore root collection
 * and corresponding subcollections for complete clinical traceability.
 */
export async function logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp?: number }) {
  const finalTimestamp = entry.timestamp || Date.now();
  const payload = {
    ...entry,
    timestamp: finalTimestamp,
    ipAddress: entry.ipAddress || (typeof window !== 'undefined' ? `Web Client (${navigator.userAgent.slice(0, 40)}...)` : 'Local/Server'),
  };

  try {
    // 1. Write to main /audit_logs collection
    const auditCol = collection(db, 'audit_logs');
    const docRef = await addDoc(auditCol, payload);

    // 2. If psychologistUid provided, write to subcollection /psychologists/{uid}/audit_logs
    if (entry.psychologistUid) {
      try {
        const psychSubCol = collection(db, 'psychologists', entry.psychologistUid, 'audit_logs');
        await addDoc(psychSubCol, { ...payload, parentAuditId: docRef.id });
      } catch (subErr) {
        console.warn('Could not write to psychologist subcollection:', subErr);
      }
    }

    // 3. If patientId/sessionId provided, write to subcollection /clinical_records/{patientId}/audit_logs
    if (entry.patientId) {
      try {
        const recordSubCol = collection(db, 'clinical_records', entry.patientId, 'audit_logs');
        await addDoc(recordSubCol, { ...payload, parentAuditId: docRef.id });
      } catch (subErr) {
        console.warn('Could not write to clinical_records subcollection:', subErr);
      }
    }
  } catch (err) {
    console.warn('Could not push audit event to Firestore, saving locally:', err);
    try {
      const stored = JSON.parse(localStorage.getItem('subatech_audit_logs') || '[]');
      stored.unshift({ ...payload, id: `local-${Date.now()}` });
      localStorage.setItem('subatech_audit_logs', JSON.stringify(stored.slice(0, 100)));
    } catch {}
  }
}

export const AuditLog: React.FC<AuditLogProps> = ({ currentUser }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Subscribe to Cloud Firestore audit_logs collection in real time
  useEffect(() => {
    setLoading(true);
    try {
      const auditCol = collection(db, 'audit_logs');
      const q = query(auditCol, orderBy('timestamp', 'desc'), limit(150));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const fetchedLogs: AuditLogEntry[] = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<AuditLogEntry, 'id'>),
            }));
            setLogs(fetchedLogs);
          } else {
            // Load initial seeds if empty
            const seedWithIds = INITIAL_AUDIT_SEED.map((s, idx) => ({
              id: `seed-${idx + 1}`,
              ...s,
            }));
            setLogs(seedWithIds);
          }
          setLoading(false);
        },
        (error) => {
          console.warn('Firestore real-time audit subscription notice:', error);
          const seedWithIds = INITIAL_AUDIT_SEED.map((s, idx) => ({
            id: `seed-${idx + 1}`,
            ...s,
          }));
          setLogs(seedWithIds);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('Error setting up Firestore listener:', err);
      setLoading(false);
    }
  }, []);

  const isOwnerOrAdmin = currentUser.email === 'kailabwasd@gmail.com' || currentUser.isAdmin;

  // Filter logs based on search query, category, and severity
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesCategory = filterCategory === 'ALL' || log.category === filterCategory || log.action === filterCategory;
      const matchesSeverity = filterSeverity === 'ALL' || log.severity === filterSeverity;
      
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q || 
        (log.adminName && log.adminName.toLowerCase().includes(q)) || 
        (log.adminEmail && log.adminEmail.toLowerCase().includes(q)) || 
        (log.psychologistName && log.psychologistName.toLowerCase().includes(q)) || 
        (log.psychologistEmail && log.psychologistEmail.toLowerCase().includes(q)) || 
        (log.psychologistLicense && log.psychologistLicense.toLowerCase().includes(q)) || 
        (log.patientName && log.patientName.toLowerCase().includes(q)) || 
        (log.sessionId && log.sessionId.toLowerCase().includes(q)) || 
        (log.details && log.details.toLowerCase().includes(q)) || 
        log.action.toLowerCase().includes(q);

      return matchesCategory && matchesSeverity && matchesSearch;
    });
  }, [logs, filterCategory, filterSeverity, searchQuery]);

  // Statistics summaries
  const stats = useMemo(() => {
    return {
      total: logs.length,
      clinical: logs.filter((l) => l.category === 'CLÍNICO' || l.action === 'CLINICAL_NOTE_UPDATE' || l.action === 'SESSION_STATE_CHANGE').length,
      transfers: logs.filter((l) => l.category === 'TRANSFERENCIAS' || l.action === 'SESSION_TRANSFER').length,
      logins: logs.filter((l) => l.action === 'LOGIN' || l.category === 'ACCESOS').length,
      approvals: logs.filter((l) => l.action === 'PSYCHOLOGIST_APPROVAL' || l.action === 'PSYCHOLOGIST_REJECTION' || l.action === 'ROLE_UPDATE').length,
      critical: logs.filter((l) => l.severity === 'CRITICAL').length,
    };
  }, [logs]);

  const handleExportCSV = () => {
    const headers = [
      'ID_Registro',
      'Fecha_Hora_Colombia',
      'Accion',
      'Categoria',
      'Severidad',
      'Psicologo_Nombre',
      'Psicologo_Email',
      'Tarjeta_Profesional_ReTHUS',
      'Paciente',
      'ID_Sesion',
      'Detalles_Clinicos',
      'Direccion_IP_Dispositivo'
    ];

    const rows = filteredLogs.map((l) => [
      l.id,
      new Date(l.timestamp).toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
      l.action,
      l.category,
      l.severity,
      `"${(l.psychologistName || l.adminName || 'N/A').replace(/"/g, '""')}"`,
      l.psychologistEmail || l.adminEmail || 'N/A',
      l.psychologistLicense || 'N/A',
      `"${(l.patientName || 'N/A').replace(/"/g, '""')}"`,
      l.sessionId || 'N/A',
      `"${l.details.replace(/"/g, '""')}"`,
      `"${(l.ipAddress || 'N/A').replace(/"/g, '""')}"`,
    ]);

    const legalDisclaimer = '# Trazabilidad Clinica Oficial SubaTECH - Cumplimiento Ley 1581 de 2012 y Ley 1090 de 2006\n';
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(legalDisclaimer + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n'));
    
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `subatech_auditoria_clinica_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      title: 'Auditoría Forense y Trazabilidad Clínica SubaTECH',
      generatedAt: new Date().toISOString(),
      auditor: currentUser.email,
      totalRecords: filteredLogs.length,
      logs: filteredLogs,
    }, null, 2));

    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `subatech_audit_trail_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOwnerOrAdmin) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-amber-400" />
        <h3 className="text-sm font-bold text-white">Acceso Restringido al Módulo de Auditoría</h3>
        <p className="text-xs text-slate-400 max-w-md">
          El registro de auditoría clínica (AuditLog) requiere privilegios de Administrador Clínico o Propietario del sistema SubaTECH.
        </p>
      </div>
    );
  }

  const getActionBadge = (action: AuditActionType) => {
    switch (action) {
      case 'CLINICAL_NOTE_UPDATE':
        return { label: 'Nota Clínica Modificada', icon: FileEdit, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'SESSION_STATE_CHANGE':
      case 'SESSION_CLAIM':
      case 'SESSION_CLOSE':
        return { label: 'Estado de Triage', icon: Activity, color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
      case 'SESSION_TRANSFER':
        return { label: 'Transferencia de Caso', icon: ArrowRightLeft, color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
      case 'LOGIN':
        return { label: 'Inicio de Sesión', icon: LogIn, color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
      case 'LOGOUT':
        return { label: 'Cierre de Sesión', icon: LogOut, color: 'bg-slate-700/50 text-slate-300 border-slate-600' };
      case 'PSYCHOLOGIST_APPROVAL':
        return { label: 'Acceso Aprobado Manualmente', icon: CheckCircle2, color: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50' };
      case 'PSYCHOLOGIST_REJECTION':
      case 'PSYCHOLOGIST_SUSPENSION':
        return { label: 'Acceso Denegado / Suspendido', icon: XCircle, color: 'bg-red-500/20 text-red-300 border-red-500/40' };
      case 'ROLE_UPDATE':
        return { label: 'Roles y Permisos', icon: UserCog, color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'RECORD_EXPORT':
        return { label: 'Expediente Exportado', icon: Download, color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' };
      case '2FA_SECURITY':
        return { label: 'Seguridad 2FA', icon: Lock, color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'SYSTEM_CONFIG':
      case 'SECURITY_OVERRIDE':
      default:
        return { label: action, icon: Terminal, color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const getSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-300 border-red-500/50 font-black';
      case 'WARNING':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold';
      case 'INFO':
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Header & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Auditoría de Actividades Clínicas y Trazabilidad Forense</span>
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 max-w-2xl">
            Registro inmutable de acciones realizadas por psicólogos y administradores en Firestore (<code className="text-cyan-300 font-mono">/audit_logs</code> y subcolecciones). Ley 1581 de 2012 y Ley 1090 de 2006.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            title="Exportar registros a archivo CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            title="Exportar archivo de auditoría JSON"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Metric Counters Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Eventos</span>
          <span className="text-base font-bold text-white font-mono">{stats.total}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Notas & Triage</span>
          <span className="text-base font-bold text-emerald-300 font-mono">{stats.clinical}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-purple-400 uppercase font-semibold block">Transferencias</span>
          <span className="text-base font-bold text-purple-300 font-mono">{stats.transfers}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-cyan-400 uppercase font-semibold block">Inicios de Sesión</span>
          <span className="text-base font-bold text-cyan-300 font-mono">{stats.logins}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-amber-400 uppercase font-semibold block">Autorizaciones</span>
          <span className="text-base font-bold text-amber-300 font-mono">{stats.approvals}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-2 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por psicólogo, correo, Tarjeta Profesional (ReTHUS), paciente o acción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-750 focus:border-cyan-400 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-slate-900 border border-slate-750 focus:border-cyan-400 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">Toda Severidad</option>
              <option value="INFO">Info</option>
              <option value="WARNING">Advertencias</option>
              <option value="CRITICAL">Críticos</option>
            </select>
          </div>
        </div>

        {/* Quick Category Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
          <span className="text-slate-500 text-[10px] uppercase font-bold mr-1">Filtrar:</span>
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'CLÍNICO', label: '🩺 Notas & Triage' },
            { id: 'TRANSFERENCIAS', label: '🔀 Transferencias' },
            { id: 'ACCESOS', label: '🔑 Inicios de Sesión' },
            { id: 'ROLES', label: '👑 Autorizaciones Admin' },
            { id: '2FA', label: '🔒 Seguridad 2FA' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilterCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer border ${
                filterCategory === cat.id
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Logs List View */}
      <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 nav-scrollbar">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Consultando registros de auditoría en Firestore...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800 space-y-1">
            <Terminal className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-300">No se encontraron eventos con los filtros seleccionados</p>
            <p className="text-[10px] text-slate-500">Prueba ajustando los criterios de búsqueda.</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const badge = getActionBadge(log.action);
            const BadgeIcon = badge.icon;
            const formattedDate = new Date(log.timestamp).toLocaleString('es-CO', {
              timeZone: 'America/Bogota',
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                className={`p-3 rounded-2xl bg-slate-950/80 border transition hover:border-slate-700 cursor-pointer space-y-2 ${
                  log.severity === 'CRITICAL'
                    ? 'border-red-500/30 hover:border-red-500/50'
                    : log.severity === 'WARNING'
                    ? 'border-amber-500/30 hover:border-amber-500/50'
                    : 'border-slate-800'
                }`}
              >
                {/* Top row: Badges, Actor, Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${badge.color}`}>
                      <BadgeIcon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>

                    <span className={`px-1.5 py-0.5 rounded-md border text-[9px] ${getSeverityBadge(log.severity)}`}>
                      {log.severity}
                    </span>

                    <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                      {log.category}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{formattedDate}</span>
                  </span>
                </div>

                {/* Actor (Psychologist or Admin) & Patient Details */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <div className="flex items-center gap-1 font-semibold text-white">
                    <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>{log.psychologistName || log.adminName || 'Especialista / Admin'}</span>
                  </div>

                  {(log.psychologistEmail || log.adminEmail) && (
                    <span className="text-[10px] font-mono text-slate-400">
                      ({log.psychologistEmail || log.adminEmail})
                    </span>
                  )}

                  {log.psychologistLicense && (
                    <span className="text-[10px] font-mono font-bold text-amber-300 flex items-center gap-0.5 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-500/30">
                      <Award className="w-3 h-3 text-amber-400" />
                      <span>{log.psychologistLicense}</span>
                    </span>
                  )}

                  {log.patientName && (
                    <span className="text-[10px] text-emerald-300 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-500/30 font-medium">
                      Paciente: {log.patientName}
                    </span>
                  )}

                  {log.sessionId && (
                    <span className="text-[9px] font-mono text-slate-500">
                      Sesión: {log.sessionId}
                    </span>
                  )}
                </div>

                {/* Details paragraph */}
                <p className="text-xs text-slate-200 leading-relaxed pl-1 border-l-2 border-slate-800">
                  {log.details}
                </p>

                {/* Expanded metadata drawer */}
                {selectedLog?.id === log.id && (
                  <div className="pt-2 border-t border-slate-850 text-[10px] font-mono text-slate-400 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-900/60 p-2 rounded-xl animate-in fade-in">
                    <div>
                      <span className="text-slate-500 block">ID Firestore:</span>
                      <span className="text-cyan-300 select-all">{log.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Dispositivo / IP:</span>
                      <span className="text-slate-300">{log.ipAddress || 'Cliente Web Seguro'}</span>
                    </div>
                    {log.psychologistUid && (
                      <div>
                        <span className="text-slate-500 block">UID Especialista:</span>
                        <span className="text-slate-300 select-all">{log.psychologistUid}</span>
                      </div>
                    )}
                    {log.patientId && (
                      <div>
                        <span className="text-slate-500 block">ID Paciente:</span>
                        <span className="text-slate-300 select-all">{log.patientId}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
