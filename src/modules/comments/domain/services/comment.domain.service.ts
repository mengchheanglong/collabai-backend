// src/modules/comments/domain/services/comment.domain.service.ts
//
// Pure comment rules. The main one is mention extraction: an author references a teammate
// with `@their-email` in the body. This returns the unique, lowercased emails mentioned,
// which a handler resolves to project members to notify. No I/O.

import { Injectable } from '@nestjs/common';

// `@` immediately followed by an email address.
const MENTION_EMAIL = /@([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi;

@Injectable()
export class CommentDomainService {
  /** Unique, lowercased emails mentioned as `@email` in the comment body. */
  extractMentionEmails(body: string): string[] {
    const found = new Set<string>();
    for (const match of body.matchAll(MENTION_EMAIL)) {
      found.add(match[1].toLowerCase());
    }
    return [...found];
  }
}
