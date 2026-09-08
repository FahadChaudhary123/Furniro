import { describe, it, expect } from 'vitest';
import { listPosts, getRecentPosts, getPostBySlug, listTags, tagExists } from './service.js';

describe('post listing', () => {
  it('defaults to three per page', () => {
    const { data, meta } = listPosts();
    expect(data).toHaveLength(3);
    expect(meta.limit).toBe(3);
  });

  it('orders newest first by a real date', () => {
    const dates = listPosts({ limit: 50 }).data.map((p) => +new Date(p.published_at));
    expect(dates.every((d) => !Number.isNaN(d))).toBe(true);
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('filters by tag, case-insensitively', () => {
    const { data } = listPosts({ tag: 'WOOD', limit: 50 });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((p) => p.tag.toLowerCase() === 'wood')).toBe(true);
  });

  it('reports at least one page for a tag that matches nothing', () => {
    const { data, meta } = listPosts({ tag: 'nonexistent', limit: 50 });
    expect(data).toEqual([]);
    expect(meta.total_pages).toBe(1);
  });
});

describe('recent posts', () => {
  it('omits the body, which is the bulk of a post', () => {
    // The sidebar needs titles and dates, not article text.
    for (const post of getRecentPosts()) {
      expect(post).not.toHaveProperty('body');
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('slug');
    }
  });

  it('honours the limit', () => {
    expect(getRecentPosts(2)).toHaveLength(2);
  });
});

describe('tags', () => {
  it('derives counts that sum to the number of posts', () => {
    // These were once hard-coded as Crafts 2, Design 8, Handmade 7, Wood 6 — against three
    // real posts. Deriving them means they cannot be wrong.
    const total = listPosts({ limit: 50 }).meta.total;
    expect(listTags().reduce((n, t) => n + t.count, 0)).toBe(total);
  });

  it('gives every tag a slug', () => {
    for (const tag of listTags()) {
      expect(tag.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('recognises only tags that exist', () => {
    expect(tagExists(listTags()[0].slug)).toBe(true);
    expect(tagExists('nope')).toBe(false);
  });
});

describe('single post', () => {
  it('returns a post with a body', () => {
    const slug = listPosts().data[0].slug;
    expect(getPostBySlug(slug).body).toBeTruthy();
  });

  it('returns null for an unknown slug', () => {
    expect(getPostBySlug('no-such-post')).toBeNull();
  });
});
