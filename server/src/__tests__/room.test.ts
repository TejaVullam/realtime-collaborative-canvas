import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { User } from '../models/User.js';
import { Room } from '../models/Room.js';
import { Canvas } from '../models/Canvas.js';
import { connectDB, disconnectDB } from '../config/database.js';

const TEST_DB_URI = 'mongodb://localhost:27017/collaborative_canvas_test_room';

describe('Room Management & Authorization API', () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;

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
    await Canvas.deleteMany({});

    // Create User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User A',
        email: 'userA@example.com',
        password: 'passwordA123',
      });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    // Create User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User B',
        email: 'userB@example.com',
        password: 'passwordB123',
      });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;
  });

  describe('POST /api/rooms', () => {
    it('should allow authenticated user to create a room and an associated canvas', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Architecture Review' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Architecture Review');
      expect(res.body.ownerId).toBe(userAId);
      expect(res.body.canvasId).toBeDefined();

      // Verify owner is added as first member
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].userId).toBe(userAId);
      expect(res.body.members[0].role).toBe('owner');

      // Verify canvas exists in database with roomId reference
      const canvasInDb = await Canvas.findById(res.body.canvasId);
      expect(canvasInDb).not.toBeNull();
      expect(canvasInDb?.roomId.toString()).toBe(res.body.id);
      expect(canvasInDb?.metadata.name).toBe('Architecture Review');
    });

    it('should reject unauthenticated room creation with 401', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ name: 'Unauthorized Room' });

      expect(res.status).toBe(401);
    });

    it('should reject room creation with empty name', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });
  });

  describe('GET /api/rooms', () => {
    it('should list only rooms where the authenticated user is a member', async () => {
      // User A creates Room 1
      await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: "User A's Room" });

      // User B creates Room 2
      await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ name: "User B's Room" });

      // User A lists rooms
      const resA = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(resA.status).toBe(200);
      expect(resA.body.rooms).toHaveLength(1);
      expect(resA.body.rooms[0].name).toBe("User A's Room");

      // User B lists rooms
      const resB = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(resB.status).toBe(200);
      expect(resB.body.rooms).toHaveLength(1);
      expect(resB.body.rooms[0].name).toBe("User B's Room");
    });
  });

  describe('GET /api/rooms/:roomId', () => {
    it('should allow room members to access room details', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Member Access Room' });

      const roomId = createRes.body.id;

      const res = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(roomId);
    });

    it('should reject non-member access with 403 Forbidden', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Private Room' });

      const roomId = createRes.body.id;

      // User B tries to access User A's private room
      const res = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/access/i);
    });
  });

  describe('POST /api/rooms/:roomId/join and leave', () => {
    it('should allow a user to join a room and prevent duplicate membership', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Collaborative Project' });

      const roomId = createRes.body.id;

      // User B joins room
      const joinRes = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.members).toHaveLength(2);
      expect(
        joinRes.body.members.some((m: { userId: string }) => m.userId === userBId),
      ).toBe(true);

      // User B joins again - duplicate join should be idempotent
      const joinAgainRes = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(joinAgainRes.status).toBe(200);
      expect(joinAgainRes.body.members).toHaveLength(2);
    });

    it('should allow a non-owner member to leave a room', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Temp Room' });

      const roomId = createRes.body.id;

      // User B joins
      await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${userBToken}`);

      // User B leaves
      const leaveRes = await request(app)
        .post(`/api/rooms/${roomId}/leave`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(leaveRes.status).toBe(200);
      expect(leaveRes.body.message).toMatch(/left/i);

      // Verify User B is no longer in members
      const roomInDb = await Room.findById(roomId);
      expect(
        roomInDb?.members.some((m) => m.userId.toString() === userBId),
      ).toBe(false);
    });

    it('should restrict the owner from accidentally leaving and orphaning the room', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Owner Room' });

      const roomId = createRes.body.id;

      // User A (owner) tries to leave
      const leaveRes = await request(app)
        .post(`/api/rooms/${roomId}/leave`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(leaveRes.status).toBe(400);
      expect(leaveRes.body.error).toMatch(/cannot leave/i);
    });
  });

  describe('Security & Identity Verification', () => {
    it('should not allow client to spoof identity by supplying a custom userId in body', async () => {
      // User B creates a room pretending to be User A in the body
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          name: 'Spoofed Room',
          userId: userAId,
          ownerId: userAId,
        });

      expect(res.status).toBe(201);
      // Owner must still be User B derived from token!
      expect(res.body.ownerId).toBe(userBId);
      expect(res.body.members[0].userId).toBe(userBId);
    });
  });
});
