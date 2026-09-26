import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many login attempts. Please try again later.',
    },
  },
});

authRouter.post('/login', loginLimiter, authController.postLogin);
authRouter.post('/logout', authController.postLogout);
authRouter.get('/me', authController.getMe);
