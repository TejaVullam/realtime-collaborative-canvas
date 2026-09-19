import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User } from '../models/User.js';
import type {
  JWTPayload,
  LoginDTO,
  RegisterDTO,
  SafeUser,
} from '../types/auth.js';

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  static verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.jwtSecret) as JWTPayload;
    } catch {
      throw new AuthError('Invalid or expired authentication token', 401);
    }
  }

  static async register(
    data: RegisterDTO,
  ): Promise<{ user: SafeUser; token: string }> {
    const { name, email, password } = data;

    if (!name || name.trim().length === 0) {
      throw new AuthError('Name is required', 400);
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new AuthError('A valid email address is required', 400);
    }

    if (!password || password.length < 6) {
      throw new AuthError('Password must be at least 6 characters long', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new AuthError('Email is already registered', 409);
    }

    const passwordHash = await this.hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    const safeUser = user.toSafeUser();
    const token = this.generateToken({
      userId: safeUser.id,
      email: safeUser.email,
    });

    return { user: safeUser, token };
  }

  static async login(
    data: LoginDTO,
  ): Promise<{ user: SafeUser; token: string }> {
    const { email, password } = data;

    if (!email || !password) {
      throw new AuthError('Email and password are required', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+passwordHash',
    );

    if (!user) {
      // Safe generic message: do not reveal email existence
      throw new AuthError('Invalid email or password', 401);
    }

    const isMatch = await this.comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new AuthError('Invalid email or password', 401);
    }

    const safeUser = user.toSafeUser();
    const token = this.generateToken({
      userId: safeUser.id,
      email: safeUser.email,
    });

    return { user: safeUser, token };
  }

  static async getUserById(id: string): Promise<SafeUser | null> {
    const user = await User.findById(id);
    if (!user) return null;
    return user.toSafeUser();
  }
}
