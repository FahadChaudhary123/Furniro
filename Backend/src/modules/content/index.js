/**
 * Content module — public interface. Owns CONT-01..CONT-04 (docs/REQUIREMENTS.md).
 *
 * The only file others may import from `content`. See docs/MODULES.md#boundary-rules.
 */

export { postsRouter } from './routes.js';
export { getPostBySlug, listPosts, listTags } from './service.js';
