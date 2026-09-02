import { Injectable } from '@nestjs/common';
import { User, UserIdentity, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { IUsersRepository } from './interfaces/users-repository.interface';

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deletedAt: null,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
      },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  async findIdentity(provider: string, providerUserId: string): Promise<UserIdentity | null> {
    return this.prisma.userIdentity.findFirst({
      where: {
        provider: provider as any,
        providerUserId,
      },
      include: {
        user: true,
      },
    });
  }

  async createIdentity(data: Prisma.UserIdentityCreateInput): Promise<UserIdentity> {
    return this.prisma.userIdentity.create({
      data,
    });
  }
}
