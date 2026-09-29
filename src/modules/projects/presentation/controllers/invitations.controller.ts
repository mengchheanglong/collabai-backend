// src/modules/projects/presentation/controllers/invitations.controller.ts

import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { GetInvitationQuery } from '../../application/queries/get-invitation.query';
import { AcceptInvitationCommand } from '../../application/commands/accept-invitation.command';

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get(':token')
  @ApiOperation({ summary: 'Get invitation details by token (public)' })
  async getInvitation(@Param('token') token: string) {
    const details = await this.queryBus.execute(new GetInvitationQuery(token));
    return { invitation: details };
  }

  @Post(':token/accept')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Accept project invitation (requires auth)' })
  async acceptInvitation(
    @CurrentUser('id') userId: string,
    @Param('token') token: string,
  ) {
    const result = await this.commandBus.execute(
      new AcceptInvitationCommand(userId, token),
    );
    return result;
  }
}
