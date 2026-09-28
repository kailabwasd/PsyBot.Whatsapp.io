import React, { useState } from 'react';
import { User, Phone, Calendar, HeartPulse, Check, AlertCircle, X } from 'lucide-react';

interface PatientRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: { name: string; age: number; gender: string; phone: string }) => Promise<void>;
}

export const PatientRegistrationModal: React.FC<PatientRegistrationModalProps> = ({
  isOpen,
  onClose,
  onRegister,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState('Femenino');
  const [phone, setPhone] = useState('+57 ');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Real-time validation checks
  const trimmedName = name.trim();
  const numericAge = parseInt(age, 10);
  const isAgeValid = !isNaN(numericAge) && numericAge > 0 && numericAge <= 120;
  const isNameValid = trimmedName.length >= 3;
  
  // Phone regex: must start with '+' followed by 1-3 digits country code and at least 7 digits subscriber number
  const phoneRegex = /^\+\d{1,3}\s?\d{7,14}$/;
  const isPhoneValid = phoneRegex.test(phone.trim());

  const isFormValid = isNameValid && isAgeValid && isPhoneValid && gender;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isFormValid) {
      setError('Por favor, completa todos los campos correctamente según las reglas de validación.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onRegister({
        name: trimmedName,
        age: numericAge,
        gender,
        phone: phone.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al registrar el paciente en el sistema.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-modal-title"
        className="bg-slate-900 border border-slate-750 text-slate-100 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-850/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h3 id="reg-modal-title" className="text-base font-bold text-white">
                Registro Obligatorio de Paciente
              </h3>
              <p className="text-xs text-slate-400">
                Captura sociodemográfica inicial (SubaTECH Triage)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Nombre Completo */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-400" />
              <span>Nombre Completo *</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Camila Sofía Ríos"
              required
              className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:border-teal-400 transition"
            />
            {name.length > 0 && !isNameValid && (
              <span className="text-[10px] text-amber-400 block">El nombre debe tener al menos 3 caracteres.</span>
            )}
          </div>

          {/* Edad y Género */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Edad (Años) *</span>
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Ej. 28"
                required
                className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:border-teal-400 transition"
              />
              {age.length > 0 && !isAgeValid && (
                <span className="text-[10px] text-red-400 block">Ingresa una edad válida (1 - 120).</span>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <span>Género / Identidad *</span>
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3 py-2.5 text-white font-bold focus:outline-none focus:border-teal-400 transition"
              >
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="No binario">No binario</option>
                <option value="Prefiero no decir">Prefiero no decir</option>
              </select>
            </div>
          </div>

          {/* Número de Teléfono con Prefijo Internacional */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Número de Teléfono (con Prefijo Internacional) *</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+57 3001234567 o +52 5512345678"
              required
              className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold focus:outline-none focus:border-teal-400 transition"
            />
            <span className="text-[10px] text-slate-400 block">
              Debe comenzar con <code className="text-emerald-400 font-mono font-bold">+</code> seguido del código de país y número (ej. +57310...).
            </span>
            {phone.length > 3 && !isPhoneValid && (
              <span className="text-[10px] text-red-400 block">Formato internacional requerido (ej. +57 3001234567).</span>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg cursor-pointer ${
                isFormValid && !isSubmitting
                  ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando expediente...' : 'Iniciar Sesión y Triage'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
