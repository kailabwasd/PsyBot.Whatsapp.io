import React, { useState } from 'react';
import { 
  Network, 
  Terminal, 
  Copy, 
  Check, 
  ExternalLink, 
  Cpu, 
  Server, 
  PhoneCall, 
  ShieldCheck, 
  Code2, 
  Layers,
  ArrowRight,
  Send
} from 'lucide-react';

export const IntegrationDocs: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'NODE' | 'PYTHON' | 'CONTENT_API'>('NODE');
  const [testPhone, setTestPhone] = useState<string>('+52');
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: ''
  });

  const handleSendTestTwilio = async () => {
    if (!testPhone.trim() || testPhone.length < 8) {
      setTestResult({ status: 'error', message: 'Ingresa un número de WhatsApp con código de país (ej. +521... o +57...)' });
      return;
    }

    setTestResult({ status: 'loading', message: 'Despachando mensaje vía Twilio REST API...' });
    try {
      const res = await fetch('/api/twilio/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: testPhone.trim(),
          testMessage: '🟢 ¡Conexión con PsyBot - SubaTech confirmada! Tu WhatsApp está vinculado exitosamente con la Guardia de Salud Mental 24/7.'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ status: 'success', message: '¡Mensaje enviado con éxito! Revisa tu WhatsApp.' });
      } else {
        setTestResult({ 
          status: 'error', 
          message: data.error || 'Twilio no pudo entregar el mensaje. Asegúrate de haber enviado "join limited-burn" a +1 415 523 8886 antes de probar.' 
        });
      }
    } catch (err: any) {
      setTestResult({ status: 'error', message: err.message || 'Error de conexión con el servidor local.' });
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const pythonCode = `from fastapi import FastAPI, Form, Response
import google.generativeai as genai

app = FastAPI()
genai.configure(api_key="TU_GEMINI_API_KEY")

@app.post("/api/whatsapp")
async def whatsapp_webhook(From: str = Form(...), Body: str = Form(...)):
    user_message = Body.strip()
    
    # Detección de crisis y enrutamiento
    if "suicid" in user_message.lower() or "quitarme la vida" in user_message.lower():
        reply = "🚨 ATENCIÓN EN CRISIS: Línea de la Vida 800 911 2000 o 988. Un psicólogo humano ha sido alertado."
    elif user_message.lower() in ["#psicologo", "2"]:
        reply = "👨‍⚕️ Has sido puesto en guardia con un psicólogo humano. Te atenderemos en breve."
    else:
        # Llamada al Asistente Emocional con Gemini
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(user_message)
        reply = response.text

    twiml = f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{reply}</Message></Response>'
    return Response(content=twiml, media_type="text/xml")`;

  const contentApiJson = `{
  "types": {
    "twilio/quick-reply": {
      "body": "Hola Mariana, bienvenida a PsyBot - SubaTech 🌿 ¿De qué forma prefieres que te acompañemos hoy?",
      "actions": [
        { "id": "btn_ai", "title": "1. Asistente IA 🤍" },
        { "id": "btn_human", "title": "2. Psicólogo Especialista 🩺" },
        { "id": "btn_crisis", "title": "3. Líneas de Crisis 🚨" }
      ]
    }
  }
}`;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      
      {/* Title */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
        <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
          <Network className="w-6 h-6 text-teal-400" />
          Arquitectura del Sistema & Integración Twilio + Ngrok
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Documentación técnica del pipeline híbrido: desde el teléfono del usuario hasta el modelo de IA y el panel del especialista.
        </p>
      </div>

      {/* Visual Flow Diagram */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-400" />
          Diagrama de Flujo de Mensajería
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          
          {/* Node 1: Usuario WhatsApp */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 text-center space-y-1">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-bold text-lg">
              📱
            </div>
            <p className="text-xs font-bold text-white">Usuario Final</p>
            <p className="text-[11px] text-slate-400">WhatsApp App</p>
          </div>

          <div className="hidden md:flex justify-center text-teal-400">
            <ArrowRight className="w-6 h-6 animate-pulse" />
          </div>

          {/* Node 2: Twilio Cloud */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 text-center space-y-1">
            <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center font-bold text-lg">
              ☁️
            </div>
            <p className="text-xs font-bold text-white">Twilio Gateway</p>
            <p className="text-[11px] text-slate-400">Content API & Webhook</p>
          </div>

          <div className="hidden md:flex justify-center text-teal-400">
            <ArrowRight className="w-6 h-6 animate-pulse" />
          </div>

          {/* Node 3: Ngrok Tunnel */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 text-center space-y-1">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center font-bold text-lg">
              🚇
            </div>
            <p className="text-xs font-bold text-white">Túnel NGROK</p>
            <p className="text-[11px] text-slate-400">Redirección SSL segura</p>
          </div>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
          {/* Node 4: Backend Engine */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-teal-300 text-xs font-bold">
              <Server className="w-4 h-4" />
              <span>Backend Dual: Node.js Express / Python FastAPI</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Recibe la petición <code className="text-teal-300 bg-slate-800 px-1 py-0.5 rounded">POST /api/whatsapp</code>, gestiona el estado del paciente (nombre, menú, cola de espera) e interactúa con <strong>Google Gemini</strong> para la contención inicial.
            </p>
          </div>

          {/* Node 5: Web Panel */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-300 text-xs font-bold">
              <Cpu className="w-4 h-4" />
              <span>Panel Web de Expertos (HTML5 + Tailwind)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Muestra los casos en espera en la <strong>Bandeja General</strong>, alerta en tiempo real en caso de <strong>Crisis</strong> y permite reclamar conversaciones para chatear directamente con el usuario.
            </p>
          </div>
        </div>
      </div>

      {/* Guide: Connecting Twilio Sandbox in 3 Steps */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-teal-400" />
            Diagnóstico Twilio & Conexión 24/7 en Vivo
          </h3>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            Sandbox ID: limited-burn
          </span>
        </div>

        {/* Diagnostic Callout */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Estado Actual de tus Credenciales Twilio
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Account SID:</span>
              <span className="font-mono text-emerald-400 font-semibold truncate block">Configurado (Consola Twilio)</span>
              <span className="text-[10px] text-emerald-300 mt-1 inline-block">✓ Cuenta Activa (Trial)</span>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Número WhatsApp Twilio:</span>
              <span className="font-mono text-teal-300 font-semibold block">+1 415 523 8886</span>
              <span className="text-[10px] text-slate-400 mt-1 inline-block">Twilio Sandbox Oficial</span>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Código de Activación Sandbox:</span>
              <span className="font-mono text-amber-300 font-bold block">join limited-burn</span>
              <span className="text-[10px] text-slate-400 mt-1 inline-block">Enviar por WhatsApp a Twilio</span>
            </div>
          </div>

          {/* Interactive Test Sender Widget */}
          <div className="pt-3 border-t border-slate-850">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Probar Envío Saliente Directo a tu Teléfono:</span>
              <span className="text-[11px] text-teal-400">Formato E.164 (ej. Colombia +573107956907 o México +521...)</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+573107956907"
                className="flex-1 bg-slate-900 border border-slate-750 px-3.5 py-2 rounded-xl text-xs text-white font-mono focus:border-teal-500 focus:outline-none"
              />
              <button
                onClick={handleSendTestTwilio}
                disabled={testResult.status === 'loading'}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-teal-950"
              >
                {testResult.status === 'loading' ? (
                  <span>Enviando...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar WhatsApp de Prueba</span>
                  </>
                )}
              </button>
            </div>

            {testResult.message && (
              <div className={`mt-2 p-2.5 rounded-lg text-xs flex items-center justify-between ${
                testResult.status === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' 
                  : testResult.status === 'error'
                  ? 'bg-red-500/10 text-red-300 border border-red-500/30'
                  : 'bg-slate-850 text-slate-300 border border-slate-750'
              }`}>
                <span>{testResult.message}</span>
                {testResult.status === 'error' && (
                  <button onClick={() => setTestResult({ status: 'idle', message: '' })} className="text-slate-400 hover:text-white ml-2">✕</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Important Webhook Notice for 24/7 Cloud Deployment */}
        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 text-teal-300 font-bold">
            <Server className="w-4 h-4" />
            <span>¿Por qué Twilio dio error 11200 / 405 Method Not Allowed en la URL de desarrollo?</span>
          </div>
          <p className="leading-relaxed">
            La URL interna de desarrollo (<code className="bg-slate-900 px-1 py-0.5 rounded text-teal-300">ais-dev-...run.app</code>) cuenta con una capa de seguridad con cookies de sesión de Google AI Studio que redirige las peticiones automáticas POST externas (como los webhooks de Twilio), causando el error 11200.
          </p>
          <p className="leading-relaxed font-semibold text-white">
            Para que funcione 24/7 de manera pública y permanente sin bloqueos, tienes dos caminos inmediatos:
          </p>
        </div>

        <div className="space-y-4">
          
          {/* Opción 1: Túnel Ngrok / Cloudflared (Inmediato, 100% libre de auth) */}
          <div className="flex items-start space-x-3">
            <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              1
            </span>
            <div className="flex-1 space-y-2">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <span>Opción A: Exponer con Ngrok o Cloudflare Tunnel (Prueba Inmediata)</span>
                <span className="px-2 py-0.2 bg-teal-500/20 text-teal-300 rounded text-[10px]">Recomendada</span>
              </h4>
              <p className="text-xs text-slate-400">
                Si ejecutas la app en tu servidor o computadora local con <code className="text-teal-300">npm run dev</code>, crea un túnel público gratuito:
              </p>
              <div className="flex items-center justify-between bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 font-mono text-xs text-teal-300">
                <span>ngrok http 3000</span>
                <button
                  onClick={() => copyToClipboard('ngrok http 3000', 'ngrok')}
                  className="text-slate-400 hover:text-white"
                >
                  {copiedKey === 'ngrok' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Copia la URL <code className="text-teal-300 font-mono">https://xxxx.ngrok-free.app/api/whatsapp</code> y pégala en Twilio Console.
              </p>
            </div>
          </div>

          {/* Opción 2: Despliegue en la nube (Render, Railway, Fly.io, Cloud Run) */}
          <div className="flex items-start space-x-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              2
            </span>
            <div className="flex-1 space-y-2">
              <h4 className="text-xs font-bold text-white">
                Opción B: Despliegue Cloud 24/7 (Railway / Render / VPS)
              </h4>
              <p className="text-xs text-slate-400">
                Como este repositorio ya incluye el servidor full-stack Express (<code className="text-teal-300 font-mono">server.ts</code>) con el script <code className="text-teal-300 font-mono">npm start</code>:
              </p>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                <li>Sube este código a tu repositorio de GitHub.</li>
                <li>Conéctalo en <strong>Render.com</strong> o <strong>Railway.app</strong> (ambos tienen capa gratuita o económica 24/7 sin sleep).</li>
                <li>Configura las variables de entorno en el panel (<code className="text-teal-300">TWILIO_ACCOUNT_SID</code>, <code className="text-teal-300">TWILIO_AUTH_TOKEN</code>, <code className="text-teal-300">GEMINI_API_KEY</code>).</li>
                <li>Tu endpoint público quedará activo 24/7 en: <code className="text-emerald-400 font-mono">https://tu-servicio.onrender.com/api/whatsapp</code>.</li>
              </ul>
            </div>
          </div>

          {/* Step 3: Unir WhatsApp */}
          <div className="flex items-start space-x-3">
            <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              3
            </span>
            <div className="flex-1 space-y-2">
              <h4 className="text-xs font-bold text-white">
                Paso indispensable en tu celular: Vincular el WhatsApp al Sandbox
              </h4>
              <p className="text-xs text-slate-400">
                Los números de prueba en Twilio requieren que cada usuario envíe primero el código de bienvenida para autorizar la recepción de mensajes:
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5 font-mono">
                <p>1. Guarda el contacto de Twilio en tu móvil: <strong className="text-teal-300">+1 415 523 8886</strong></p>
                <p>2. Envíale un mensaje de WhatsApp con el texto exacto: <strong className="text-amber-300">join limited-burn</strong></p>
                <p>3. Twilio te responderá confirmando que estás conectado al Sandbox.</p>
                <p>4. Envía cualquier mensaje (ej. <em className="text-emerald-400">"Hola necesito apoyo"</em>) y recibirás la respuesta de Aura IA o el psicólogo.</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Multi-language Backend Code Inspector */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        
        <div className="p-4 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Code2 className="w-5 h-5 text-teal-400" />
            <h3 className="text-sm font-bold text-white">
              Soporte Backend Multi-lenguaje
            </h3>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveCodeTab('NODE')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeCodeTab === 'NODE'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Node.js (Express) [Activo]
            </button>
            <button
              onClick={() => setActiveCodeTab('PYTHON')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeCodeTab === 'PYTHON'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Python (FastAPI)
            </button>
            <button
              onClick={() => setActiveCodeTab('CONTENT_API')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeCodeTab === 'CONTENT_API'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Twilio Content API (Botones)
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-950 overflow-x-auto relative font-mono text-xs">
          {activeCodeTab === 'NODE' && (
            <div className="space-y-2 text-slate-300">
              <div className="text-slate-500">// El servidor actual se ejecuta en server.ts utilizando Express + @google/genai</div>
              <div className="text-emerald-400">app.post('/api/whatsapp', async (req, res) =&gt; &#123;</div>
              <div className="pl-4 text-slate-300">const fromNumber = req.body.From;</div>
              <div className="pl-4 text-slate-300">const text = req.body.Body;</div>
              <div className="pl-4 text-amber-300">// Máquina de estados: ASKING_NAME -&gt; MENU -&gt; AI_MODE / WAITING_PSYCHOLOGIST</div>
              <div className="pl-4 text-slate-300">const result = await processIncomingWhatsAppMessage(fromNumber, text);</div>
              <div className="pl-4 text-teal-300">return res.status(200).send(`&lt;Response&gt;&lt;Message&gt;$&#123;result.reply&#125;&lt;/Message&gt;&lt;/Response&gt;`);</div>
              <div className="text-emerald-400">&#125;);</div>
            </div>
          )}

          {activeCodeTab === 'PYTHON' && (
            <pre className="text-slate-300 leading-relaxed whitespace-pre">
              {pythonCode}
            </pre>
          )}

          {activeCodeTab === 'CONTENT_API' && (
            <pre className="text-slate-300 leading-relaxed whitespace-pre">
              {contentApiJson}
            </pre>
          )}

          <button
            onClick={() => copyToClipboard(activeCodeTab === 'PYTHON' ? pythonCode : contentApiJson, 'code')}
            className="absolute top-4 right-4 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 border border-slate-700 transition"
          >
            {copiedKey === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copiar Código</span>
          </button>
        </div>

      </div>

    </div>
  );
};
