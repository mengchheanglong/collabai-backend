import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateProfileCommand } from './update-profile.command';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { SafeUser } from '../../domain/entities/safe-user.entity';
import { UserNotFoundError } from '../errors/auth.errors';

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<SafeUser> {
    const user = await this.userRepo.findById(command.userId);
    if (!user) throw new UserNotFoundError();

    user.updateProfile({
      name: command.name,
      avatarUrl: command.avatarUrl,
    });

    await this.userRepo.save(user);
    return user.toSafe();
  }
}
