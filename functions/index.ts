/**
 * Cloud Function: verifyRecaptchaLogin
 * 
 * Verifies Google reCAPTCHA v3 tokens sent from PsychologistLogin during authentication.
 * Blocks access if reCAPTCHA verification fails or if the security score is below 0.5.
 */

import { onRequest, type Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import * as logger from 'firebase-functions/logger';

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export const verifyRecaptcha = onRequest(
  { cors: true },
  async (req: Request, res: Response) => {
    // Enable CORS for preflight and standard requests
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'Método no permitido. Utiliza POST.' });
      return;
    }

    try {
      const { token, action } = req.body || {};

      if (!token || typeof token !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Token de reCAPTCHA faltante o inválido.',
        });
        return;
      }

      const secretKey = process.env.RECAPTCHA_SECRET_KEY;

      if (!secretKey) {
        logger.warn('RECAPTCHA_SECRET_KEY no está configurada en las variables de entorno. Operando en modo desarrollo seguro.');
        // In local/dev environment without secret key, return safe bypass score
        res.json({
          success: true,
          score: 0.9,
          note: 'Verificación simulada en modo desarrollo (Score: 0.9 >= 0.5)',
        });
        return;
      }

      // Query Google reCAPTCHA v3 API endpoint
      const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(
        secretKey
      )}&response=${encodeURIComponent(token)}`;

      const response = await fetch(verificationUrl, {
        method: 'POST',
      });

      const data = (await response.json()) as RecaptchaResponse;

      logger.info('Resultado de verificación Google reCAPTCHA:', {
        success: data.success,
        score: data.score,
        action: data.action,
      });

      const score = data.score !== undefined ? Number(data.score) : 1.0;
      const SCORE_THRESHOLD = 0.5;

      // Validate success and score threshold
      if (data.success && score >= SCORE_THRESHOLD) {
        res.json({
          success: true,
          score,
          action: data.action,
          message: 'Autenticación reCAPTCHA v3 validada con éxito.',
        });
      } else {
        logger.warn('Acceso bloqueado por reCAPTCHA v3:', {
          score,
          threshold: SCORE_THRESHOLD,
          errors: data['error-codes'],
        });

        res.status(403).json({
          success: false,
          score,
          error: `Acceso denegado: La puntuación de reCAPTCHA v3 (${score}) es inferior al umbral mínimo de seguridad de ${SCORE_THRESHOLD} o se detectó actividad automatizada.`,
          errorCodes: data['error-codes'] || [],
        });
      }
    } catch (error: any) {
      logger.error('Error al procesar verificación de reCAPTCHA:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Error interno del servidor en la Cloud Function de reCAPTCHA.',
      });
    }
  }
);

export const verifyRecaptchaLogin = verifyRecaptcha;
