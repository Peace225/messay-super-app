import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { registerSchema, loginSchema, verifyOTPSchema } from '../validators/auth.validator';

const authService = new AuthService();

/**
 * Contrôleur d'authentification
 */
export class AuthController {
  /**
   * POST /api/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = registerSchema.parse(req.body);
      const result = await authService.register(validatedData);
      
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await authService.login(validatedData);
      
      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  /**
   * POST /api/auth/verify-otp
   */
  async verifyOTP(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = verifyOTPSchema.parse(req.body);
      const result = await authService.verifyOTP(
        validatedData.telephone,
        validatedData.otpCode
      );
      
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/auth/me
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({ user: req.user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
