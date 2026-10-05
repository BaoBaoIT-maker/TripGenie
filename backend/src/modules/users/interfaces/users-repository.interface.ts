import { User, UserIdentity, Prisma } from '@prisma/client';

export interface IUsersRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: Prisma.UserCreateInput): Promise<User>;
  update(id: string, data: Prisma.UserUpdateInput): Promise<User>;
  softDelete(id: string): Promise<User>;
  findIdentity(provider: string, providerUserId: string): Promise<UserIdentity | null>;
  createIdentity(data: Prisma.UserIdentityCreateInput): Promise<UserIdentity>;
}
