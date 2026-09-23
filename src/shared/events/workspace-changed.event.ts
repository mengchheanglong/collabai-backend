/** Published only after a successful content write; transport listeners are optional. */
export class WorkspaceChangedEvent {
 static readonly eventName = 'workspace.changed';
 constructor(public readonly name: string, public readonly projectId: string,
  public readonly actorId: string, public readonly data: Record<string, unknown>,
  public readonly userId?: string) {}
}
