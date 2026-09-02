import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: INJECT_TOKENS.USER_REPOSITORY,
      useClass: UsersRepository,
    },
  ],
  exports: [
    UsersService,
    INJECT_TOKENS.USER_REPOSITORY,
  ],
})
export class UsersModule {}
