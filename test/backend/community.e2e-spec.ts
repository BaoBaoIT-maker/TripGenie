import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded, static as expressStatic } from 'express';
import { join, basename } from 'node:path';
import { unlink } from 'node:fs/promises';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/database/prisma.service';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '@/common/exceptions/all-exceptions.filter';

describe('CommunityController & Clone Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  let creatorId: string;
  let creatorUsername: string;
  let creatorToken: string;

  let viewerId: string;
  let viewerToken: string;

  let sourceItineraryId: string;
  let clonedItineraryId: string;
  let createdPostId: string;
  let createdCommentId: string;
  let editedAtAfterEdit: string;
  const uploadedUrlsToClean: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.use(json({ limit: '20mb' }));
    app.use(urlencoded({ extended: true, limit: '20mb' }));
    app.setGlobalPrefix('api/v1');
    app.use('/api/v1/uploads', expressStatic(join(process.cwd(), 'uploads')));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);

    await app.init();

    const ts = Date.now();
    creatorUsername = `creator_e2e_${ts}`;

    const creator = await prisma.user.create({
      data: {
        email: `creator_${ts}@tripgenie.test`,
        username: creatorUsername,
        fullName: 'Khánh Linh E2E',
        bio: 'Travel Blogger • Đã đi 15 tỉnh thành',
        isVerified: true,
        isActive: true,
      },
    });
    creatorId = creator.id;

    const viewer = await prisma.user.create({
      data: {
        email: `viewer_${ts}@tripgenie.test`,
        username: `viewer_e2e_${ts}`,
        fullName: 'Minh Quân E2E',
        isVerified: true,
        isActive: true,
      },
    });
    viewerId = viewer.id;

    const secret = configService.get<string>(
      'JWT_SECRET',
      'your_super_secret_jwt_key_min_32_characters',
    );
    creatorToken = jwtService.sign(
      {
        sub: creator.id,
        email: creator.email,
        role: creator.role,
        authVersion: creator.authVersion,
      },
      { secret },
    );

    viewerToken = jwtService.sign(
      {
        sub: viewer.id,
        email: viewer.email,
        role: viewer.role,
        authVersion: viewer.authVersion,
      },
      { secret },
    );

    const itinerary = await prisma.itinerary.create({
      data: {
        creatorId: creator.id,
        title: 'Đà Lạt 3N2Đ Săn Mây Cầu Đất',
        destination: 'Đà Lạt',
        isPublic: false,
        totalPlaces: 5,
        estimatedCost: 3200000,
      },
    });
    sourceItineraryId = itinerary.id;
  });

  afterAll(async () => {
    for (const url of uploadedUrlsToClean) {
      const fileName = basename(url);
      if (fileName) {
        try {
          await unlink(join(process.cwd(), 'uploads', 'community', fileName));
        } catch {
          // ignore
        }
      }
    }

    if (prisma) {
      if (clonedItineraryId) {
        await prisma.itinerary.deleteMany({ where: { id: clonedItineraryId } });
      }
      if (sourceItineraryId) {
        await prisma.itinerary.deleteMany({ where: { id: sourceItineraryId } });
      }
      if (creatorId || viewerId) {
        await prisma.user.deleteMany({
          where: { id: { in: [creatorId, viewerId].filter(Boolean) } },
        });
      }
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  it('1. POST /api/v1/community/media/upload — should upload image & video from disk and serve static files', async () => {
    const fakePng = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
      'hex',
    );
    const fakeMp4 = Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex');

    const res = await request(app.getHttpServer())
      .post('/api/v1/community/media/upload')
      .set('Authorization', `Bearer ${creatorToken}`)
      .attach('files', fakePng, { filename: 'dalat.png', contentType: 'image/png' })
      .attach('files', fakeMp4, { filename: 'review.mp4', contentType: 'video/mp4' })
      .expect(201);

    const data = res.body.data;
    expect(data.mediaUrls).toHaveLength(2);
    expect(data.mediaUrls[0]).toMatch(/^\/api\/v1\/uploads\/community\/.+\.png$/);
    expect(data.mediaUrls[1]).toMatch(/^\/api\/v1\/uploads\/community\/.+\.mp4$/);

    uploadedUrlsToClean.push(...data.mediaUrls);

    // Verify static file serving works
    await request(app.getHttpServer()).get(data.mediaUrls[0]).expect(200);
  });

  it('2. POST /api/v1/community/media/upload — should reject unsupported file MIME types (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/community/media/upload')
      .set('Authorization', `Bearer ${creatorToken}`)
      .attach('files', Buffer.from('MZ-fake-exe'), {
        filename: 'malware.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(400);
  });

  it('3. POST /api/v1/community/posts — should forbid attaching another user itinerary (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/community/posts')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        title: 'Cố tình gắn lịch trình của người khác',
        itineraryId: sourceItineraryId,
      })
      .expect(403);
  });

  it('4. POST /api/v1/community/posts — should publish post with mediaUrls & mark linked itinerary public', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/community/posts')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        title: 'Review Đà Lạt 3N2Đ săn mây Cầu Đất cực đẹp',
        caption: 'Lịch trình chi tiết kèm video thực tế cho mọi người tham khảo.',
        mediaUrls: uploadedUrlsToClean,
        tags: ['DaLat', '#SanMay'],
        itineraryId: sourceItineraryId,
      })
      .expect(201);

    const post = res.body.data.post;
    expect(post.id).toBeDefined();
    expect(post.mediaUrls).toEqual(uploadedUrlsToClean);
    expect(post.tags).toEqual(['#DaLat', '#SanMay']);
    expect(post.itinerary.id).toBe(sourceItineraryId);
    createdPostId = post.id;
    expect(post.editedAt).toBeNull();

    // Verify source itinerary was automatically switched to public
    const dbItin = await prisma.itinerary.findUnique({
      where: { id: sourceItineraryId },
    });
    expect(dbItin?.isPublic).toBe(true);
  });

  it('4b. PATCH /api/v1/community/posts/:id — should allow owner to edit text & tags, locking media and itinerary', async () => {
    // Stranger tries to edit -> 403 Forbidden
    await request(app.getHttpServer())
      .patch(`/api/v1/community/posts/${createdPostId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ title: 'Cố tình sửa bài của người khác' })
      .expect(403);

    // Owner edits title, caption, tags
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/community/posts/${createdPostId}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        title: 'Review Đà Lạt 3N2Đ săn mây Cầu Đất (Đã cập nhật)',
        caption: 'Bổ sung thêm thời gian xe buýt chạy buổi sáng.',
        tags: ['DaLat', 'SanMay', 'KinhNghiem'],
      })
      .expect(200);

    const updated = res.body.data.post;
    expect(updated.title).toBe('Review Đà Lạt 3N2Đ săn mây Cầu Đất (Đã cập nhật)');
    expect(updated.caption).toBe('Bổ sung thêm thời gian xe buýt chạy buổi sáng.');
    expect(updated.tags).toEqual(['#DaLat', '#SanMay', '#KinhNghiem']);
    // Verify mediaUrls and itinerary are strictly preserved
    expect(updated.mediaUrls).toEqual(uploadedUrlsToClean);
    expect(updated.itinerary.id).toBe(sourceItineraryId);
    expect(new Date(updated.editedAt).getTime()).not.toBeNaN();
    editedAtAfterEdit = updated.editedAt;
  });

  it('5. POST /api/v1/community/posts/:id/like — should toggle like atomically without counter drift', async () => {
    // 1st click: Like
    const likeRes1 = await request(app.getHttpServer())
      .post(`/api/v1/community/posts/${createdPostId}/like`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(likeRes1.body.data).toEqual(
      expect.objectContaining({
        postId: createdPostId,
        isLiked: true,
        likeCount: 1,
      }),
    );

    // 2nd click: Unlike
    const likeRes2 = await request(app.getHttpServer())
      .post(`/api/v1/community/posts/${createdPostId}/like`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(likeRes2.body.data).toEqual(
      expect.objectContaining({
        postId: createdPostId,
        isLiked: false,
        likeCount: 0,
      }),
    );

    // 3rd click: Re-like
    const likeRes3 = await request(app.getHttpServer())
      .post(`/api/v1/community/posts/${createdPostId}/like`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(likeRes3.body.data).toEqual(
      expect.objectContaining({
        postId: createdPostId,
        isLiked: true,
        likeCount: 1,
      }),
    );
  });

  it('6. POST & DELETE comments — should support 1-level replies (Option B flatten) and cascade delete', async () => {
    // Root comment (Level 1)
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/community/posts/${createdPostId}/comments`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ content: 'Lịch trình chi tiết quá, cảm ơn bạn!' })
      .expect(201);

    expect(createRes.body.data.commentCount).toBe(1);
    createdCommentId = createRes.body.data.comment.id;
    expect(createRes.body.data.comment.parentId).toBeNull();

    // Reply to root comment (Level 2)
    const reply1Res = await request(app.getHttpServer())
      .post(`/api/v1/community/posts/${createdPostId}/comments`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        content: 'Cảm ơn Minh Quân nhiều nhé!',
        parentId: createdCommentId,
      })
      .expect(201);

    const reply1 = reply1Res.body.data.comment;
    expect(reply1.parentId).toBe(createdCommentId);
    expect(reply1.replyToName).toBe('Minh Quân E2E');
    expect(reply1Res.body.data.commentCount).toBe(2);

    // Reply to Level-2 reply -> automatically flattened to root comment ID
    const reply2Res = await request(app.getHttpServer())
      .post(`/api/v1/community/posts/${createdPostId}/comments`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        content: 'Cho mình hỏi thêm giờ xe chạy nhé!',
        parentId: reply1.id,
      })
      .expect(201);

    const reply2 = reply2Res.body.data.comment;
    expect(reply2.parentId).toBe(createdCommentId);
    expect(reply2.replyToName).toBe('Khánh Linh E2E');
    expect(reply2Res.body.data.commentCount).toBe(3);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/community/posts/${createdPostId}/comments`)
      .expect(200);
    expect(listRes.body.data.comments).toHaveLength(3);

    // Delete root comment -> cascade soft-deletes replies and resets commentCount to 0
    const delRes = await request(app.getHttpServer())
      .delete(`/api/v1/community/comments/${createdCommentId}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(200);
    expect(delRes.body.data.commentCount).toBe(0);
  });

  it('6b. GET /api/v1/community/posts?search=... — should support Unified Search (author, @username, #hashtag) and return matchedCreators', async () => {
    // Search by @username
    const byUsernameRes = await request(app.getHttpServer())
      .get(`/api/v1/community/posts?search=@${creatorUsername}`)
      .expect(200);
    expect(
      byUsernameRes.body.data.items.some((p: { id: string }) => p.id === createdPostId),
    ).toBe(true);
    expect(
      byUsernameRes.body.data.matchedCreators.some(
        (c: { id: string }) => c.id === creatorId,
      ),
    ).toBe(true);

    // Search by case-insensitive hashtag without '#'
    const byTagSearchRes = await request(app.getHttpServer())
      .get('/api/v1/community/posts?search=sanmay')
      .expect(200);
    expect(
      byTagSearchRes.body.data.items.some((p: { id: string }) => p.id === createdPostId),
    ).toBe(true);
  });

  it('7. POST /api/v1/itineraries/:id/clone — should create an independent itinerary ID, strip tourBriefing PII, and increment post cloneCount', async () => {
    // Owner saves tour briefing info before sharing/cloning
    const briefingRes = await request(app.getHttpServer())
      .patch(`/api/v1/itineraries/${sourceItineraryId}/tour-briefing`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        leaderName: 'Khánh Linh HDV',
        leaderPhone: '0905123456',
        meetingPoint: '06:00 tại Sân bay Liên Khương',
        notes: 'Mang theo áo khoác ấm và CCCD',
      })
      .expect(200);

    expect(briefingRes.body.data.tourBriefing).toEqual({
      leaderName: 'Khánh Linh HDV',
      leaderPhone: '0905123456',
      meetingPoint: '06:00 tại Sân bay Liên Khương',
      notes: 'Mang theo áo khoác ấm và CCCD',
    });

    // Non-owner cannot overwrite owner's tourBriefing -> 403 Forbidden
    await request(app.getHttpServer())
      .patch(`/api/v1/itineraries/${sourceItineraryId}/tour-briefing`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ leaderName: 'Hacker' })
      .expect(403);

    const cloneRes = await request(app.getHttpServer())
      .post(`/api/v1/itineraries/${sourceItineraryId}/clone`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(201);

    const cloned = cloneRes.body.data;
    expect(cloned.id).toBeDefined();
    expect(cloned.id).not.toBe(sourceItineraryId);
    // Cloned itinerary for another user must strip original leader's PII
    expect(cloned.tourBriefing).toBeNull();
    clonedItineraryId = cloned.id;

    // Verify post cloneCount incremented to 1
    const postRes = await request(app.getHttpServer())
      .get(`/api/v1/community/posts/${createdPostId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(postRes.body.data.post.cloneCount).toBe(1);
    // Regression: like / comment / clone counter writes must NOT touch editedAt
    expect(postRes.body.data.post.editedAt).toBe(editedAtAfterEdit);
    expect(postRes.body.data.post.isLiked).toBe(true);
  });

  it('8. GET /api/v1/community/creators/:identifier — should return TikTok-style creator profile by @username and UUID', async () => {
    const profileRes = await request(app.getHttpServer())
      .get(`/api/v1/community/creators/@${creatorUsername}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    const profile = profileRes.body.data.profile;
    expect(profile.user.id).toBe(creatorId);
    expect(profile.user.bio).toBe('Travel Blogger • Đã đi 15 tỉnh thành');
    expect(profile.stats).toEqual({
      postCount: 1,
      totalLikesReceived: 1,
      totalClonesReceived: 1,
      publicItineraryCount: 1,
    });
    expect(profile.posts).toHaveLength(1);
    expect(profile.publicItineraries).toHaveLength(1);
  });

  it('9. Ownership & Privacy Isolation — GET /api/v1/itineraries only returns caller trips, and non-owners cannot delete or edit another user trip', async () => {
    // Guest without token gets empty list
    const guestListRes = await request(app.getHttpServer())
      .get('/api/v1/itineraries')
      .expect(200);
    expect(guestListRes.body.data).toEqual([]);

    // Viewer ONLY sees their own cloned itinerary, NOT creator's sourceItineraryId
    const viewerListRes = await request(app.getHttpServer())
      .get('/api/v1/itineraries')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    const viewerIds = viewerListRes.body.data.map((i: { id: string }) => i.id);
    expect(viewerIds).toContain(clonedItineraryId);
    expect(viewerIds).not.toContain(sourceItineraryId);

    // Viewer can read public sourceItineraryId, with isOwner = false and saved tourBriefing visible
    const viewPublicRes = await request(app.getHttpServer())
      .get(`/api/v1/itineraries/${sourceItineraryId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(viewPublicRes.body.data.isOwner).toBe(false);
    // Non-members of the trip see name + meeting point, but NOT phone / notes
    expect(viewPublicRes.body.data.tourBriefing).toEqual({
      leaderName: 'Khánh Linh HDV',
      leaderPhone: null,
      meetingPoint: '06:00 tại Sân bay Liên Khương',
      notes: null,
    });

    // Guest (no token) gets the same redacted view
    const guestViewRes = await request(app.getHttpServer())
      .get(`/api/v1/itineraries/${sourceItineraryId}`)
      .expect(200);
    expect(guestViewRes.body.data.tourBriefing.leaderPhone).toBeNull();
    expect(guestViewRes.body.data.tourBriefing.notes).toBeNull();

    // Once the viewer joins the trip group they can read the private fields
    await prisma.tripGroup.create({
      data: {
        itineraryId: sourceItineraryId,
        name: 'E2E Group',
        inviteCode: `E2E${Date.now().toString(36)}`.slice(0, 20),
        members: { create: [{ userId: viewerId, role: 'VIEWER' }] },
      },
    });
    const memberViewRes = await request(app.getHttpServer())
      .get(`/api/v1/itineraries/${sourceItineraryId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(memberViewRes.body.data.tourBriefing.leaderPhone).toBe('0905123456');
    expect(memberViewRes.body.data.tourBriefing.notes).toBe('Mang theo áo khoác ấm và CCCD');

    // Viewer cannot delete creator's sourceItineraryId -> 403 Forbidden
    await request(app.getHttpServer())
      .delete(`/api/v1/itineraries/${sourceItineraryId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });
});
