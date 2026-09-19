import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { User } from '../models/User.js';
import { Room } from '../models/Room.js';
import { connectDB, disconnectDB } from '../config/database.js';

const TEST_DB_URI = 'mongodb://localhost:27017/collaborative_canvas_test_sec';

describe('Security Verification Suite', () => {
  let authToken: string;
  let userId: string;

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
    await Room.deleteMany({});

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Security User',
        email: 'security@example.com',
        password: 'password123',
      });
    authToken = res.body.token;
    userId = res.body.user.id;
  });

  it('ensures passwordHash never appears in any user or auth endpoint response', async () => {
    // 1. Register response
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Check Hash',
        email: 'checkhash@example.com',
        password: 'password123',
      });
    expect(JSON.stringify(regRes.body)).not.toContain('passwordHash');

    // 2. Login response
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'checkhash@example.com',
        password: 'password123',
      });
    expect(JSON.stringify(loginRes.body)).not.toContain('passwordHash');

    // 3. /me response
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(JSON.stringify(meRes.body)).not.toContain('passwordHash');
  });

  it('rejects unauthenticated requests to all protected room endpoints', async () => {
    const getRes1 = await request(app).get('/api/rooms');
    expect(getRes1.status).toBe(401);

    const postRes1 = await request(app).post('/api/rooms');
    expect(postRes1.status).toBe(401);

    const getRes2 = await request(app).get('/api/rooms/65f0a1b2c3d4e5f678901234');
    expect(getRes2.status).toBe(401);

    const postRes2 = await request(app).post('/api/rooms/65f0a1b2c3d4e5f678901234/join');
    expect(postRes2.status).toBe(401);

    const postRes3 = await request(app).post('/api/rooms/65f0a1b2c3d4e5f678901234/leave');
    expect(postRes3.status).toBe(401);
  });

  it('prevents spoofing of identity by relying strictly on token payload', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Secure Token Test Room',
        userId: '65f0a1b2c3d4e5f678909999',
        ownerId: '65f0a1b2c3d4e5f678909999',
      });

    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBe(userId);
    expect(res.body.ownerId).not.toBe('65f0a1b2c3d4e5f678909999');
  });
});
