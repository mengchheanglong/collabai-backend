// src/modules/comments/domain/services/comment.domain.service.spec.ts
import { CommentDomainService } from './comment.domain.service';

describe('CommentDomainService.extractMentionEmails', () => {
  const svc = new CommentDomainService();

  it('extracts a single @email mention', () => {
    expect(svc.extractMentionEmails('hi @alice@example.com!')).toEqual([
      'alice@example.com',
    ]);
  });

  it('extracts multiple mentions and de-duplicates + lowercases', () => {
    const body = 'cc @Alice@Example.com and @bob@example.com and @alice@example.com';
    expect(svc.extractMentionEmails(body).sort()).toEqual([
      'alice@example.com',
      'bob@example.com',
    ]);
  });

  it('returns empty when there are no mentions', () => {
    expect(svc.extractMentionEmails('no mentions here')).toEqual([]);
  });

  it('ignores a bare email with no leading @', () => {
    expect(svc.extractMentionEmails('email alice@example.com')).toEqual([
      // "alice@example.com" is preceded by a space+word; the "@example" is not a mention,
      // but "alice@example.com" itself has no leading @, so nothing is captured.
    ]);
  });
});
