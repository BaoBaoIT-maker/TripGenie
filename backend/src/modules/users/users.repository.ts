import { Injectable } from '@nestjs/common';
import { User, UserIdentity, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { IUsersRepository } from './interfaces/users-repository.interface';

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    return this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
      },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    return this.prisma.user.findFirst({
      where: {
        username: username.toLowerCase().trim(),
        deletedAt: null,
      },
    });
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    if (clean.includes('@')) {
      return this.findByEmail(clean);
    }
    return this.findByUsername(clean);
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  async findUserWithIdentities(id: string): Promise<(User & { identities: UserIdentity[] }) | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        identities: true,
      },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        email: data.email ? data.email.toLowerCase().trim() : null,
        username: data.username ? data.username.toLowerCase().trim() : null,
      },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    const updatedData = { ...data };
    if (typeof updatedData.email === 'string') {
      updatedData.email = updatedData.email.toLowerCase().trim();
    }
    if (typeof updatedData.username === 'string') {
      updatedData.username = updatedData.username.toLowerCase().trim();
    }
    return this.prisma.user.update({
      where: { id },
      data: updatedData,
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
