import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ProjectsController } from './projects.controller';
import { GetAllProjectsQuery } from '../../application/queries/get-all-projects.query';
import { GetProjectQuery } from '../../application/queries/get-project.query';
import { ListMembersQuery } from '../../application/queries/list-members.query';
import { CreateProjectCommand } from '../../application/commands/create-project.command';
import { UpdateProjectCommand } from '../../application/commands/update-project.command';
import { DeleteProjectCommand } from '../../application/commands/delete-project.command';
import { InviteMemberCommand } from '../../application/commands/invite-member.command';
import { UpdateMemberRoleCommand } from '../../application/commands/update-member-role.command';
import { RemoveMemberCommand } from '../../application/commands/remove-member.command';
import { ProjectView } from '../../domain/repositories/project.repository.interface';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  const mockProjectView: ProjectView = {
    id: '11111111-1111-4111-a111-111111111111',
    ownerId: '22222222-2222-4222-a222-222222222222',
    name: 'CollabAI Core',
    description: 'Engineering workspace',
    icon: '??',
    color: '#6750A4',
    isArchived: false,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-01T11:00:00.000Z'),
    members: [
      {
        userId: '22222222-2222-4222-a222-222222222222',
        role: 'owner',
        name: 'Alice',
        email: 'alice@example.com',
        avatarUrl: null,
        joinedAt: new Date('2026-09-01T10:00:00.000Z'),
      },
    ],
  };

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as any;
    queryBus = { execute: jest.fn() } as any;
    controller = new ProjectsController(commandBus, queryBus);
  });

  describe('list', () => {
    it('executes GetAllProjectsQuery with clamped pagination parameters', async () => {
      queryBus.execute.mockResolvedValueOnce({
        items: [mockProjectView],
        page: 1,
        limit: 20,
        total: 1,
      });

      const res = await controller.list('user-1', '-5', '9999999', 'search');

      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetAllProjectsQuery('user-1', 1, 100, 'search'),
      );
      expect(res.items).toHaveLength(1);
      expect(res.meta.page).toBe(1);
      expect(res.meta.limit).toBe(20);
    });
  });

  describe('create', () => {
    it('executes CreateProjectCommand and returns project', async () => {
      commandBus.execute.mockResolvedValueOnce(mockProjectView);

      const res = await controller.create('user-1', {
        name: 'CollabAI Core',
        description: 'Engineering workspace',
        color: '#6750A4',
        icon: '??',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(CreateProjectCommand),
      );
      expect(res.project.id).toBe(mockProjectView.id);
    });
  });

  describe('get', () => {
    it('executes GetProjectQuery and returns project', async () => {
      queryBus.execute.mockResolvedValueOnce(mockProjectView);

      const res = await controller.get('user-1', mockProjectView.id);
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetProjectQuery),
      );
      expect(res.project.id).toBe(mockProjectView.id);
    });
  });

  describe('update', () => {
    it('executes UpdateProjectCommand and returns project', async () => {
      commandBus.execute.mockResolvedValueOnce(mockProjectView);

      const res = await controller.update('user-1', mockProjectView.id, {
        name: 'Updated Name',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(UpdateProjectCommand),
      );
      expect(res.project).toBeDefined();
    });
  });

  describe('remove', () => {
    it('executes DeleteProjectCommand and returns success message', async () => {
      commandBus.execute.mockResolvedValueOnce(undefined);

      const res = await controller.remove('user-1', mockProjectView.id);
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(DeleteProjectCommand),
      );
      expect(res.success).toBe(true);
    });
  });

  describe('members', () => {
    it('lists members', async () => {
      queryBus.execute.mockResolvedValueOnce(mockProjectView.members);

      const res = await controller.listMembers('user-1', mockProjectView.id);
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(ListMembersQuery),
      );
      expect(res.members).toHaveLength(1);
    });

    it('adds member', async () => {
      commandBus.execute.mockResolvedValueOnce(mockProjectView);

      const res = await controller.addMember('user-1', mockProjectView.id, {
        email: 'bob@example.com',
        role: 'member',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(InviteMemberCommand),
      );
      expect(res.message).toBe('Member added');
    });

    it('updates member role', async () => {
      commandBus.execute.mockResolvedValueOnce(mockProjectView);

      const res = await controller.updateMemberRole(
        'user-1',
        mockProjectView.id,
        '33333333-3333-4333-a333-333333333333',
        { role: 'admin' },
      );

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(UpdateMemberRoleCommand),
      );
      expect(res.project).toBeDefined();
    });

    it('removes member', async () => {
      commandBus.execute.mockResolvedValueOnce(mockProjectView);

      const res = await controller.removeMember(
        'user-1',
        mockProjectView.id,
        '33333333-3333-4333-a333-333333333333',
      );

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(RemoveMemberCommand),
      );
      expect(res.message).toBe('Member removed');
    });
  });
});
