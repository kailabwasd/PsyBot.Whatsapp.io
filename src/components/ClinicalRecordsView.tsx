import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  ExternalLink, 
  Copy, 
  Check, 
  User, 
  Phone, 
  Calendar, 
  Activity, 
  ShieldAlert, 
  MessageSquare, 
  Stethoscope, 
  Save, 
  Share2, 
  RefreshCw, 
  Sparkles,
  ChevronRight,
  Database,
  Table,
  Download,
  Printer
} from 'lucide-react';
import type { ClinicalRecord, PatientSession, PsychologistAuthUser } from '../types';
import { SubaTechLogo } from './SubaTechLogo.tsx';
import { Award } from 'lucide-react';
import { 
  getAllClinicalRecordsFromFirestore, 
  saveClinicalRecordToFirestore, 
  syncSessionToFirestoreClinicalRecord,
  subscribeToClinicalRecords,
  generatePsychologistAccessLink
} from '../lib/clinicalRecordsService';
import { exportClinicalRecordToPDF } from '../lib/pdfExportService';
import { 
  googleSignIn, 
  logoutGoogle, 
  getCachedAccessToken, 
  initAuth 
} from '../lib/firebase';
import { exportClinicalRecordsToGoogleSheets } from '../lib/googleSheetsService';
import type { User as FirebaseUser } from 'firebase/auth';

interface ClinicalRecordsViewProps {
  sessions: PatientSession[];
  initialSelectedRecordId?: string | null;
  onSelectRecord?: (recordId: string) => void;
  currentUser?: PsychologistAuthUser | null;
}

export const ClinicalRecordsView: React.FC<ClinicalRecordsViewProps> = ({
  sessions,
  initialSelectedRecordId,
  onSelectRecord,
  currentUser,
}) => {
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ClinicalRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfSuccessNotice, setPdfSuccessNotice] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Google Sheets state
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [exportedSheetUrl, setExportedSheetUrl] = useState<string | null>(null);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  // Editable fields for currently selected record
  const [editAge, setEditAge] = useState<number>(30);
  const [editGender, setEditGender] = useState<string>('');
  const [editEmergency, setEditEmergency] = useState<string>('');
  const [editMedicalHistory, setEditMedicalHistory] = useState<string>('');
  const [editEvolution, setEditEvolution] = useState<string>('');
  const [editImpressions, setEditImpressions] = useState<string>('');

  // 1. Initialize Auth and Google listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Load and synchronize records with Firestore
  useEffect(() => {
    let isMounted = true;

    async function loadAndSync() {
      setIsLoading(true);
      try {
        // Sync any active sessions into Firestore so records are always fresh
        for (const s of sessions) {
          await syncSessionToFirestoreClinicalRecord(s);
        }

        const data = await getAllClinicalRecordsFromFirestore();
        if (isMounted) {
          setRecords(data);
          if (data.length > 0) {
            const matched = initialSelectedRecordId 
              ? data.find(r => r.id === initialSelectedRecordId) 
              : data[0];
            setSelectedRecord(matched || data[0]);
          }
        }
      } catch (err) {
        console.error('Error synchronizing Firestore clinical records:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAndSync();

    // Subscribe to Firestore updates in real-time
    const unsubscribeSnapshot = subscribeToClinicalRecords((liveRecords) => {
      if (isMounted && liveRecords.length > 0) {
        setRecords(liveRecords);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeSnapshot();
    };
  }, [sessions.length]);

  // Keep form in sync when selecting another record
  useEffect(() => {
    if (selectedRecord) {
      setEditAge(selectedRecord.age || 28);
      setEditGender(selectedRecord.gender || 'No especificado');
      setEditEmergency(selectedRecord.emergencyContact || '');
      setEditMedicalHistory(selectedRecord.medicalHistory || '');
      setEditEvolution(selectedRecord.clinicalEvolution || '');
      setEditImpressions((selectedRecord.diagnosticImpressions || []).join(', '));
    }
  }, [selectedRecord?.id]);

  // Handle URL param selection
  useEffect(() => {
    if (initialSelectedRecordId && records.length > 0) {
      const match = records.find(r => r.id === initialSelectedRecordId);
      if (match) setSelectedRecord(match);
    }
  }, [initialSelectedRecordId, records]);

  // Save changes to Firestore
  const handleSaveRecord = async () => {
    if (!selectedRecord) return;
    setIsSaving(true);
    try {
      const updated: ClinicalRecord = {
        ...selectedRecord,
        age: Number(editAge) || 28,
        gender: editGender,
        emergencyContact: editEmergency,
        medicalHistory: editMedicalHistory,
        clinicalEvolution: editEvolution,
        diagnosticImpressions: editImpressions
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        lastUpdated: Date.now(),
      };

      await saveClinicalRecordToFirestore(updated);
      setSelectedRecord(updated);
      setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3000);
    } catch (err) {
      console.error('Error saving clinical record to Firestore:', err);
      alert('Error al guardar en Firebase Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export Selected Record to Official Clinical PDF
  const handleExportPDF = () => {
    if (!selectedRecord) return;
    setIsExportingPDF(true);
    try {
      exportClinicalRecordToPDF(selectedRecord, currentUser);
      setPdfSuccessNotice(true);
      setTimeout(() => setPdfSuccessNotice(false), 3500);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Error al generar el documento PDF de la historia clínica.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Copy psychologist link
  const handleCopyLink = () => {
    if (!selectedRecord) return;
    const link = generatePsychologistAccessLink(selectedRecord.id);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Google Sign-In & Google Sheets Export
  const handleGoogleSheetsExport = async () => {
    setSheetsError(null);
    setIsExportingSheets(true);

    try {
      let token = googleAccessToken || getCachedAccessToken();
      if (!token) {
        const signinRes = await googleSignIn();
        token = signinRes.accessToken;
        setGoogleUser(signinRes.user);
        setGoogleAccessToken(token);
      }

      const res = await exportClinicalRecordsToGoogleSheets(
        token, 
        records, 
        `MindBridge - Historiales Clínicos (${new Date().toLocaleDateString()})`
      );

      setExportedSheetUrl(res.spreadsheetUrl);
    } catch (err: any) {
      console.error('Google Sheets export error:', err);
      setSheetsError(err.message || 'Error al conectar con Google Sheets.');
    } finally {
      setIsExportingSheets(false);
    }
  };

  // Filter records
  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phoneNumber.includes(searchQuery) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRisk = filterRisk === 'ALL' || r.riskLevel === filterRisk;
    return matchesSearch && matchesRisk;
  });

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'CRISIS':
        return <span className="bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] px-2 py-0.5 rounded-full font-bold">🚨 CRISIS INMINENTE</span>;
      case 'ALTO':
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-2 py-0.5 rounded-full font-bold">⚡ RIESGO ALTO</span>;
      case 'MODERADO':
        return <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[10px] px-2 py-0.5 rounded-full font-bold">⚠️ MODERADO</span>;
      default:
        return <span className="bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[10px] px-2 py-0.5 rounded-full font-bold">🌿 BAJO</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: SubaTECH & Firebase Firestore status */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-5 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <SubaTechLogo size="sm" showTagline={false} />
            <div className="border-l border-slate-700 pl-3">
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>Historiales Clínicos & Triage SubaTECH</span>
                <span className="bg-[#2BF267]/20 text-[#2BF267] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#2BF267]/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2BF267] animate-pulse"></span>
                  Firebase Firestore
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentUser ? (
                  <span>
                    Profesional activo: <strong className="text-white">{currentUser.displayName}</strong> • <span className="text-[#00E5FF] font-mono">{currentUser.license}</span>
                  </span>
                ) : (
                  'Expedientes sociodemográficos, anamnesis y transcripción con cifrado seguro.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action: Export to Google Sheets */}
        <div className="flex flex-wrap items-center gap-2">
          {exportedSheetUrl && (
            <a
              href={exportedSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950"
            >
              <Table className="w-4 h-4" />
              <span>Abrir en Google Sheets</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <button
            onClick={handleGoogleSheetsExport}
            disabled={isExportingSheets}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 rounded-xl text-xs font-semibold transition hover:border-teal-500/40"
          >
            {isExportingSheets ? (
              <>
                <RefreshCw className="w-4 h-4 text-teal-400 animate-spin" />
                <span>Sincronizando con Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H6v-2h6v2zm4-4H6v-2h10v2zm0-4H6V7h10v2z"/>
                </svg>
                <span>{googleUser ? 'Actualizar en Google Sheets' : 'Conectar con Google Sheets'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {sheetsError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 flex items-center justify-between">
          <span>{sheetsError}</span>
          <button onClick={() => setSheetsError(null)} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Grid: Left List + Right Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: List of Patients (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl flex flex-col h-[750px]">
          
          {/* Search and filters */}
          <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-850/60">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-750 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              {(['ALL', 'CRISIS', 'ALTO', 'MODERADO', 'BAJO'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRisk(r)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                    filterRisk === r 
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' 
                      : 'text-slate-400 hover:text-white bg-slate-950/60'
                  }`}
                >
                  {r === 'ALL' ? 'Todos' : r}
                </button>
              ))}
            </div>
          </div>

          {/* Records list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {isLoading ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-400 mb-2" />
                Cargando expedientes desde Firestore...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No se encontraron expedientes con los criterios seleccionados.
              </div>
            ) : (
              filteredRecords.map((rec) => {
                const isSelected = selectedRecord?.id === rec.id;
                return (
                  <button
                    key={rec.id}
                    onClick={() => {
                      setSelectedRecord(rec);
                      if (onSelectRecord) onSelectRecord(rec.id);
                    }}
                    className={`w-full text-left p-3.5 transition flex items-start justify-between gap-3 ${
                      isSelected 
                        ? 'bg-teal-500/10 border-l-4 border-l-teal-400' 
                        : 'hover:bg-slate-850/60 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs truncate">
                          {rec.patientName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {rec.age} años
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {rec.phoneNumber}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        {getRiskBadge(rec.riskLevel)}
                      </div>
                    </div>

                    <ChevronRight className={`w-4 h-4 mt-2 transition ${isSelected ? 'text-teal-400 translate-x-0.5' : 'text-slate-600'}`} />
                  </button>
                );
              })
            )}
          </div>

          <div className="p-3 bg-slate-950 border-t border-slate-800 text-center text-[11px] text-slate-400">
            Total en Firestore: <strong className="text-white">{records.length}</strong> expedientes clínicos
          </div>
        </div>

        {/* Right column: Selected Patient Clinical History (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl flex flex-col h-[750px]">
          {selectedRecord ? (
            <div className="flex flex-col h-full overflow-hidden">
              
              {/* Header with psychologist access link and save action */}
              <div className="p-4 border-b border-slate-800 bg-slate-850/80 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-white">
                      {selectedRecord.patientName}
                    </h3>
                    {getRiskBadge(selectedRecord.riskLevel)}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Expediente ID: {selectedRecord.id} • {selectedRecord.phoneNumber}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Export Official PDF Button */}
                  <button
                    onClick={handleExportPDF}
                    disabled={isExportingPDF}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C8102E] hover:bg-[#A00C24] text-white rounded-xl text-xs font-bold transition shadow-md shadow-red-950 cursor-pointer"
                    title="Descargar Historia Clínica oficial en formato PDF (Resolución 1995 de 1999)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExportingPDF ? 'Generando PDF...' : 'Descargar PDF'}</span>
                  </button>

                  {/* Psychologist Direct Access Link Button */}
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-teal-300 border border-slate-700 rounded-xl text-xs font-semibold transition"
                    title="Copiar link directo para compartir con el psicólogo de guardia"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Link Copiado</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Link para Psicólogo</span>
                      </>
                    )}
                  </button>

                  {/* Save button */}
                  <button
                    onClick={handleSaveRecord}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-teal-950"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Guardando...' : 'Guardar Ficha'}</span>
                  </button>
                </div>
              </div>

              {pdfSuccessNotice && (
                <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-xs text-red-300 flex items-center gap-2 animate-in fade-in">
                  <Download className="w-4 h-4 text-[#C8102E]" />
                  <span>Historia clínica PDF generada exitosamente conforme a la Resolución 1995 de 1999.</span>
                </div>
              )}

              {saveSuccessNotice && (
                <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-xs text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Expediente actualizado exitosamente en Firebase Firestore.</span>
                </div>
              )}

              {/* Scrollable Clinical Record Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* 1. Datos Sociodemográficos y Básicos */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4" />
                    1. Datos Básicos y Demográficos
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Edad</label>
                      <input
                        type="number"
                        value={editAge}
                        onChange={(e) => setEditAge(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-750 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Género / Identidad</label>
                      <input
                        type="text"
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value)}
                        placeholder="Ej. Femenino, Masculino..."
                        className="w-full bg-slate-900 border border-slate-750 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Psicólogo a Cargo</label>
                      <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-semibold truncate">
                        {selectedRecord.assignedPsychologist || 'Lic. Sofia Ramos'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Contacto de Emergencia / Red de Apoyo</label>
                    <input
                      type="text"
                      value={editEmergency}
                      onChange={(e) => setEditEmergency(e.target.value)}
                      placeholder="Nombre y teléfono de familiar de contacto"
                      className="w-full bg-slate-900 border border-slate-750 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                {/* 2. Motivo de Ingreso y Triage */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    2. Triage & Estado Afectivo Inicial
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Emoción Primaria:</span>
                      <p className="font-semibold text-white mt-0.5">{selectedRecord.primaryEmotion}</p>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Nivel de Riesgo Evaluado:</span>
                      <div className="mt-1">{getRiskBadge(selectedRecord.riskLevel)}</div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Resumen del Triage Clínico</label>
                    <p className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800 leading-relaxed">
                      {selectedRecord.triageSummary}
                    </p>
                  </div>
                </div>

                {/* 3. Antecedentes Médicos e Hipótesis Diagnósticas */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" />
                    3. Historia Médica & Hipótesis Diagnósticas
                  </h4>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Antecedentes Médicos / Tratamientos Previos
                    </label>
                    <textarea
                      rows={2}
                      value={editMedicalHistory}
                      onChange={(e) => setEditMedicalHistory(e.target.value)}
                      placeholder="Episodios previos, medicación psiquiátrica, alergias o hospitalizaciones..."
                      className="w-full bg-slate-900 border border-slate-750 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Impresiones Diagnósticas DSM-5 (separadas por coma)
                    </label>
                    <input
                      type="text"
                      value={editImpressions}
                      onChange={(e) => setEditImpressions(e.target.value)}
                      placeholder="Ej. Trastorno de Pánico, Ansiedad Generalizada, Duelo Agudo..."
                      className="w-full bg-slate-900 border border-slate-750 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Notas de Evolución Terapéutica y Plan de Acción
                    </label>
                    <textarea
                      rows={3}
                      value={editEvolution}
                      onChange={(e) => setEditEvolution(e.target.value)}
                      placeholder="Objetivos psicoterapéuticos acordados, tareas intersesión y factores de protección..."
                      className="w-full bg-slate-900 border border-slate-750 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                {/* 4. Transcripción y Registro de lo Hablado */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      4. Registro y Transcripción de lo Hablado
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">
                      WhatsApp Live Sync
                    </span>
                  </div>

                  <div className="bg-slate-900 rounded-lg border border-slate-800 p-3 font-mono text-[11px] text-slate-300 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {selectedRecord.conversationTranscript}
                  </div>
                </div>

                {/* 5. Enlace Único de Acceso para el Psicólogo */}
                <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                      <Share2 className="w-4 h-4" />
                      Enlace Directo para Acceso de Psicólogo
                    </span>
                    <button
                      onClick={handleCopyLink}
                      className="text-xs text-teal-400 hover:text-white font-semibold underline flex items-center gap-1"
                    >
                      {copiedLink ? '¡Copiado al portapapeles!' : 'Copiar Enlace'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Este link permite al especialista en turno acceder de forma directa y prioritaria a esta ficha en cualquier momento:
                  </p>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-teal-300 break-all select-all">
                    {selectedRecord.accessLink}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-xs">
              Selecciona un paciente del menú lateral para consultar su historial clínico.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
