import React, { useState, useEffect } from 'react';
import { 
  X, 
  RotateCcw, 
  Check, 
  Eye, 
  Type, 
  Moon, 
  Bold,
  Sparkles
} from 'lucide-react';
import { 
  AccessibilitySettings, 
  DEFAULT_ACCESSIBILITY_SETTINGS, 
  getStoredAccessibilitySettings, 
  saveAccessibilitySettings 
} from '../lib/accessibility.ts';

interface AccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccessibilityModal: React.FC<AccessibilityModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => getStoredAccessibilitySettings());

  useEffect(() => {
    if (isOpen) {
      setSettings(getStoredAccessibilitySettings());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateSetting = <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveAccessibilitySettings(updated);
  };

  const handleReset = () => {
    setSettings(DEFAULT_ACCESSIBILITY_SETTINGS);
    saveAccessibilitySettings(DEFAULT_ACCESSIBILITY_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="accessibility-title"
        className="bg-slate-900 border border-slate-750 text-slate-100 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        
        {/* Cabecera del Modal con Icono de Silla de Ruedas */}
        <div className="p-5 border-b border-slate-800 bg-slate-850/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              {/* Símbolo Internacional de Accesibilidad (Silla de Ruedas) */}
              <svg 
                className="w-5 h-5" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="12" cy="4.5" r="2.5"/>
                <path d="M10 9h4l2 5h-3"/>
                <path d="M7.5 13.5a5.5 5.5 0 1 0 7.2 4.7"/>
                <path d="m11 9-1.5 5.5"/>
              </svg>
            </div>
            <div>
              <h2 id="accessibility-title" className="text-base font-bold text-white flex items-center gap-2">
                <span>Ajustes de Accesibilidad</span>
                <span className="text-[10px] font-mono bg-cyan-950 px-2 py-0.5 rounded text-cyan-300 border border-cyan-800">
                  Inclusión 100%
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Modo oscuro, alto contraste, negrita y adaptación visual.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Cerrar modal de accesibilidad"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido de Opciones de Accesibilidad */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          
          {/* Modo Oscuro & Texto en Negrita (Nuevas Opciones Solicitadas) */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FFC800]" />
              <span>Apariencia Principal</span>
            </div>

            {/* Toggle Modo Oscuro */}
            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer">
              <div className="flex items-center gap-3 pr-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Modo Oscuro Profundo</span>
                  <span className="text-[11px] text-slate-400 block">
                    Fondo oscuro de alta comodidad visual para entornos con poca luz.
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => updateSetting('darkMode', e.target.checked)}
                className="w-4 h-4 rounded text-purple-400 focus:ring-purple-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </label>

            {/* Toggle Letras en Negrita (BOLD) */}
            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer">
              <div className="flex items-center gap-3 pr-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Bold className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Letras en Negrita (BOLD)</span>
                  <span className="text-[11px] text-slate-400 block">
                    Engrosa y oscurece todo el texto de la pantalla para máxima legibilidad.
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.boldText}
                onChange={(e) => updateSetting('boldText', e.target.checked)}
                className="w-4 h-4 rounded text-amber-400 focus:ring-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </label>
          </div>

          {/* 1. Tamaño del Texto */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Type className="w-4 h-4 text-cyan-400" />
              <span>Tamaño de Letra</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'normal', label: 'Normal', preview: 'A' },
                { id: 'medium', label: 'Mediano', preview: 'A+' },
                { id: 'large', label: 'Grande', preview: 'A++' },
                { id: 'extralarge', label: 'Máximo', preview: 'A+++' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => updateSetting('fontSize', item.id as any)}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    settings.fontSize === item.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold ring-1 ring-cyan-400/50'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span className="text-sm font-bold font-mono">{item.preview}</span>
                  <span className="text-[10px]">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Tonos y Contraste Mejorado */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Eye className="w-4 h-4 text-amber-400" />
              <span>Contraste Mejorado y Tonos</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'normal', label: 'Neutral', desc: 'Tonos descansados' },
                { id: 'soft', label: 'Modo Suave', desc: 'Menor fatiga visual' },
                { id: 'high', label: 'Alto Contraste Pro', desc: 'Fondo negro y amarillo' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => updateSetting('contrast', item.id as any)}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer ${
                    settings.contrast === item.id
                      ? 'bg-amber-500/15 border-amber-400 text-white font-bold ring-1 ring-amber-400/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold">{item.label}</span>
                    {settings.contrast === item.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <span className="text-[10px] text-slate-400">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Opciones de Lectura y Navegación Adaptada */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Facilidad de Lectura & Movimiento
            </div>

            {/* Tipografía de Alta Legibilidad */}
            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition cursor-pointer">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-white block">Tipografía de Alta Legibilidad</span>
                <span className="text-[11px] text-slate-400 block">
                  Caracteres diferenciados para personas con dislexia o dificultad lectora.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.dyslexiaFont}
                onChange={(e) => updateSetting('dyslexiaFont', e.target.checked)}
                className="w-4 h-4 rounded text-cyan-400 focus:ring-cyan-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </label>

            {/* Espaciado de Línea Amplio */}
            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition cursor-pointer">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-white block">Espaciado Amplio de Texto</span>
                <span className="text-[11px] text-slate-400 block">
                  Aumenta la distancia entre renglones y palabras para facilitar el seguimiento de lectura.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.wideSpacing}
                onChange={(e) => updateSetting('wideSpacing', e.target.checked)}
                className="w-4 h-4 rounded text-cyan-400 focus:ring-cyan-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </label>

            {/* Reducir Animaciones */}
            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition cursor-pointer">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-white block">Reducción de Movimiento</span>
                <span className="text-[11px] text-slate-400 block">
                  Pausa parpadeos y transiciones bruscas para evitar mareos y sobreestimulación visual.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) => updateSetting('reducedMotion', e.target.checked)}
                className="w-4 h-4 rounded text-cyan-400 focus:ring-cyan-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </label>

            {/* Resaltar Enlaces y Botones */}
            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition cursor-pointer">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-white block">Resaltar Elementos Clickeables</span>
                <span className="text-[11px] text-slate-400 block">
                  Subraya enlaces y agrega contorno accesible a los botones de acción.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.highlightLinks}
                onChange={(e) => updateSetting('highlightLinks', e.target.checked)}
                className="w-4 h-4 rounded text-cyan-400 focus:ring-cyan-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </label>

          </div>

        </div>

        {/* Footer del Modal con Restablecer y Aceptar */}
        <div className="p-4 border-t border-slate-800 bg-slate-850/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Valores Predeterminados</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold transition shadow-lg cursor-pointer active:scale-95"
          >
            Guardar y Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
