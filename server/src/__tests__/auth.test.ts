import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { User } from '../models/User.js';
import { connectDB, disconnectDB } from '../config/database.js';

const TEST_DB_URI = 'mongodb://localhost:27017/collaborative_canvas_test_auth';

describe('Authentication API & Security', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB(TEST_DB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should register a valid user and return safe user data with a token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Teja Vullam',
          email: 'teja@example.com',
          password: 'securePassword123',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe('Teja Vullam');
      expect(res.body.user.email).toBe('teja@example.com');
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('should securely hash password in the database (never store plaintext)', async () => {
      const password = 'mySecretPassword!';
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Security Test',
          email: 'sec@example.com',
          password,
        });

      const userInDb = await User.findOne({ email: 'sec@example.com' }).select('+passwordHash');
      expect(userInDb).not.toBeNull();
      expect(userInDb?.passwordHash).toBeDefined();
      expect(userInDb?.passwordHash).not.toBe(password);
      expect(userInDb?.passwordHash).toMatch(/^\$2[aby]\$\d+\$/);
    });

    it('should reject invalid email formats', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Invalid Email',
          email: 'invalid-email-string',
          password: 'securePassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject passwords shorter than 6 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Password',
          email: 'short@example.com',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject duplicate email registration with 409 Conflict', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'First User',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Second User',
          email: 'duplicate@example.com',
          password: 'anotherPassword456',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already registered/i);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Login User',
          email: 'login@example.com',
          password: 'correctPassword123',
        });
    });

    it('should login successfully with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'correctPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('login@example.com');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('should fail with 401 on wrong password with generic error message', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('should fail with 401 on non-existent email with identical generic message', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anyPassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return authenticated user details when valid Bearer token is provided', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Me User',
          email: 'me@example.com',
          password: 'password123',
        });

      const token = regRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('me@example.com');
      expect(res.body.user.name).toBe('Me User');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('should return 401 Unauthorized when no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 Unauthorized when invalid token is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should respond with 200 OK and success message', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/logged out/i);
    });
  });
});
