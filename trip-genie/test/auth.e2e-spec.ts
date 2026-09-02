import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/database/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: `e2e_${Date.now()}@example.com`,
    password: 'password123',
    fullName: 'E2E Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    // Cleanup test user
    if (prisma && testUser.email) {
      await prisma.user.deleteMany({
        where: { email: testUser.email.toLowerCase() },
      });
      await prisma.$disconnect();
    }
    await app.close();
  });

  it('/api/v1/auth/register (POST) — nên tạo tài khoản chưa xác thực thành công', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body).toHaveProperty('message');
    expect(response.body.success).toBe(true);
  });

  it('/api/v1/auth/register (POST) — nên báo lỗi 400 nếu email không hợp lệ', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'invalid-email',
        password: '123',
        fullName: 'Test',
      })
      .expect(400);
  });
});
