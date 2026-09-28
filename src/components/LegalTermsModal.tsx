import React, { useState } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  Lock, 
  Scale, 
  HeartPulse, 
  X, 
  Check, 
  Building2, 
  AlertTriangle,
  Download,
  BookOpen
} from 'lucide-react';
import { BogotaCrest } from './BogotaCrest.tsx';

export type LegalTabType = 'PRIVACY' | 'HABEAS_DATA' | 'TERMS' | 'CONSENT';

interface LegalTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTabType;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export const LegalTermsModal: React.FC<LegalTermsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'PRIVACY',
  onAccept,
  showAcceptButton = true,
}) => {
  const [activeTab, setActiveTab] = useState<LegalTabType>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-slate-100">
        
        {/* Header Institucional */}
        <div className="bg-slate-850 border-b border-slate-800 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#00E5FF] shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFC800] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Marco Legal &amp; Sanitario
                </span>
                <span className="text-xs text-slate-400">SubaTECH · Bogotá D.C.</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                Políticas, Tratamiento de Datos y Términos del Servicio
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Controls */}
        <div className="bg-slate-950 border-b border-slate-800 flex overflow-x-auto nav-scrollbar p-1.5 gap-1 text-xs">
          
          <button
            onClick={() => setActiveTab('PRIVACY')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'PRIVACY'
                ? 'bg-[#00E5FF] text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>1. Política de Privacidad</span>
          </button>

          <button
            onClick={() => setActiveTab('HABEAS_DATA')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'HABEAS_DATA'
                ? 'bg-[#00E5FF] text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>2. Tratamiento de Datos (Ley 1581)</span>
          </button>

          <button
            onClick={() => setActiveTab('TERMS')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'TERMS'
                ? 'bg-[#00E5FF] text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>3. Términos y Condiciones</span>
          </button>

          <button
            onClick={() => setActiveTab('CONSENT')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'CONSENT'
                ? 'bg-[#00E5FF] text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" />
            <span>4. Secreto Profesional (Ley 1090)</span>
          </button>

        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans bg-slate-950/40 flex-1">
          
          {/* TAB 1: POLÍTICA DE PRIVACIDAD */}
          {activeTab === 'PRIVACY' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-200 flex items-start gap-3">
                <Lock className="w-5 h-5 text-[#00E5FF] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">Política de Privacidad y Confidencialidad Digital</h4>
                  <p className="text-xs text-slate-300">
                    Última actualización: Septiembre 2026 · Aprobado para la iniciativa SubaTECH Salud Mental / Psybot.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">1. Responsable del Tratamiento de la Información</h5>
                <p>
                  La plataforma <strong>Psybot SubaTECH</strong> opera en el marco de la iniciativa de innovación en salud pública distrital para la Localidad de Suba, en articulación con la <strong>Subred Integrada de Servicios de Salud Norte E.S.E.</strong> y las directrices de la <strong>Secretaría Distrital de Salud de Bogotá D.C.</strong>
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">2. Datos Objeto de Recolección</h5>
                <p>
                  Para la correcta prestación del servicio de triaje emocional y guardia psicológica, se recolectan los siguientes datos:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                  <li><strong>Datos de contacto del usuario:</strong> Número de teléfono de WhatsApp y nombre o seudónimo voluntario.</li>
                  <li><strong>Datos de salud y estado emocional:</strong> Narrativa expresada en el chat, nivel de riesgo clínico determinado por el algoritmo de triaje y notas asistenciales del psicólogo de guardia.</li>
                  <li><strong>Datos del profesional de la salud:</strong> Nombre, tarjeta profesional / registro sanitario oficial, correo institucional y rubrica digital de las atenciones.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">3. Seguridad y Encriptación</h5>
                <p>
                  Todos los mensajes y expedientes clínicos se almacenan en bases de datos con encriptación en reposo y en tránsito (SSL/TLS 256 bits) en <strong>Google Cloud Firestore</strong>, bajo reglas estrictas de control de acceso basadas en roles (RBAC). El acceso a las notas clínicas está restringido exclusivamente a psicólogos autenticados con verificación en dos pasos (A2F).
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">4. No Comercialización</h5>
                <p>
                  Bajo ninguna circunstancia los datos recolectados serán vendidos, cedidos, transferidos a terceros con fines comerciales ni utilizados para entrenamiento público de modelos de lenguaje sin anonimización clínica previa.
                </p>
              </div>

            </div>
          )}

          {/* TAB 2: TRATAMIENTO DE DATOS PERSONALES (HABEAS DATA - LEY 1581 DE 2012) */}
          {activeTab === 'HABEAS_DATA' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">Protección de Datos Personales y Sensibles (Ley Estatutaria 1581 de 2012)</h4>
                  <p className="text-xs text-slate-300">
                    Reglamentada por el Decreto 1377 de 2013 y normatividad de la Superintendencia de Industria y Comercio (SIC).
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">1. Tratamiento Especial de Datos Sensibles en Salud Mental</h5>
                <p>
                  De conformidad con el Artículo 5° de la Ley 1581 de 2012, la información relativa a la salud emocional y psicológica constituye <strong>dato sensible</strong>. El titular no está obligado a autorizar su tratamiento salvo en los casos expresamente exceptuados por la ley, entre ellos: salvaguardar el interés vital del titular y la atención de emergencias médicas o sanitarias.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">2. Finalidades del Tratamiento</h5>
                <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                  <li>Realizar el triage psicológico inicial y primeros auxilios emocionales.</li>
                  <li>Asignar y transferir la conversación en tiempo real a psicólogos humanos titulados.</li>
                  <li>Consignar el resumen asistencial en el historial clínico digital en cumplimiento de la Resolución 1995 de 1999 y Resolución 839 de 2017 del Ministerio de Salud.</li>
                  <li>Coordinar derivaciones de emergencia con las líneas distritales (106, 123, Línea Púrpura) y centros de urgencias de la Subred Norte.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">3. Derechos del Titular (Habeas Data)</h5>
                <p>
                  El usuario titular de los datos tiene derecho a:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                  <li><strong>Conocer, actualizar y rectificar</strong> sus datos personales frente al responsable del tratamiento.</li>
                  <li><strong>Solicitar prueba de la autorización</strong> otorgada para el tratamiento de sus datos.</li>
                  <li><strong>Ser informado</strong> sobre el uso que se ha dado a sus datos personales.</li>
                  <li><strong>Revocar la autorización o solicitar la supresión</strong> del dato cuando no medie un deber legal o contractual de permanencia (como la custodia obligatoria de historias clínicas).</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">4. Canales para Ejercer los Derechos de Habeas Data</h5>
                <p>
                  El titular o sus causahabientes podrán dirigir sus peticiones, consultas o reclamos a través del correo institucional: <code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded border border-cyan-500/30 font-mono">saludmental.subatech@subrednorte.gov.co</code> o en la sede de la Subred Norte E.S.E., Cra 32 #12-81, Bogotá D.C.
                </p>
              </div>

            </div>
          )}

          {/* TAB 3: TÉRMINOS Y CONDICIONES DEL SERVICIO */}
          {activeTab === 'TERMS' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">Términos y Condiciones de Uso del Servicio</h4>
                  <p className="text-xs text-slate-300">
                    Aceptación vinculante para usuarios y profesionales que acceden a la plataforma Psybot SubaTECH.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">1. Naturaleza y Alcance del Servicio</h5>
                <p>
                  Psybot SubaTECH es una plataforma de <strong>orientación psicológica, contención emocional y primeros auxilios psicológicos</strong> mediante canales digitales (WhatsApp y panel clínico web). 
                </p>
                <p className="p-3 bg-slate-900 rounded-xl border border-amber-500/40 text-amber-200 text-xs font-medium">
                  ⚠️ <strong>Aviso Importante de Emergencias:</strong> Este servicio NO sustituye la atención presencial de urgencias médicas ni la hospitalización psiquiátrica inmediata. Si usted o un familiar se encuentra en peligro inminente de muerte o requiere rescate urgente, debe llamar de inmediato a la <strong>Línea 123</strong> o a la <strong>Línea 106</strong> de Bogotá.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">2. Gratuidad del Acceso Ciudadano</h5>
                <p>
                  El acceso a Psybot para los habitantes de la Localidad de Suba y Bogotá es <strong>completamente gratuito</strong> a través del canal oficial de WhatsApp. No se solicitan pagos, datos bancarios ni suscripciones comerciales.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">3. Compromiso de los Profesionales de la Salud</h5>
                <p>
                  Todo psicólogo que preste servicio en la plataforma debe contar con <strong>tarjeta profesional vigente expedida por el Colegio Colombiano de Psicólogos (COLPSIC)</strong> o registro sanitario del Ministerio de Salud y Protección Social, asumiendo la responsabilidad ética y técnico-científica de sus intervenciones.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">4. Uso Adecuado y Prohibiciones</h5>
                <p>
                  Queda estrictamente prohibido el uso de la plataforma para remitir contenido ofensivo, fraudulento, de acoso o que pretenda vulnerar la seguridad informática del sistema distrital de salud.
                </p>
              </div>

            </div>
          )}

          {/* TAB 4: SECRETO PROFESIONAL Y CONSENTIMIENTO INFORMADO (LEY 1090 DE 2006) */}
          {activeTab === 'CONSENT' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 text-purple-200 flex items-start gap-3">
                <HeartPulse className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">Código Deontológico, Bioético y Consentimiento Informado (Ley 1090 de 2006)</h4>
                  <p className="text-xs text-slate-300">
                    Principios éticos que rigen el ejercicio de la psicología clínica en Colombia.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">1. Principio de Confidencialidad y Secreto Profesional</h5>
                <p>
                  En cumplimiento del Artículo 2°, numeral 5° y Artículo 25° de la Ley 1090 de 2006, los psicólogos tienen la obligación de salvaguardar la información obtenida en el ejercicio de su profesión. La información solo podrá ser revelada con el consentimiento expreso del usuario, salvo en las excepciones contempladas por la ley.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">2. Excepciones Legales al Secreto Profesional (Protocolo de Código Rojo)</h5>
                <p>
                  El profesional está facultado y obligado éticamente a revelar información estrictamente necesaria cuando:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                  <li>Exista una situación de <strong>riesgo inminente y grave para la vida o integridad física</strong> del paciente (ideación o intento suicida estructurado).</li>
                  <li>Exista una amenaza real y directa para la vida de terceras personas o menores de edad.</li>
                  <li>Por mandato legal o requerimiento judicial fundado.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-white">3. Consentimiento Informado Digital</h5>
                <p>
                  Al iniciar la interacción con el bot en WhatsApp y responder con el comando <code className="text-emerald-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">#aceptar</code> o continuar el diálogo, el usuario manifiesta de manera libre, previa e informada su consentimiento para recibir orientación psicológica asistida y la custodia segura de su registro de atención.
                </p>
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-850 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Building2 className="w-4 h-4 text-[#FFC800]" />
            <span>Alcaldía Mayor de Bogotá D.C. · Ley 1090 de 2006 · Ley 1581 de 2012</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition"
            >
              Cerrar
            </button>

            {showAcceptButton && (
              <button
                type="button"
                onClick={() => {
                  if (onAccept) onAccept();
                  onClose();
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#00E5FF] hover:bg-[#00D2F4] text-slate-950 flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Aceptar y Confirmar Términos</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
