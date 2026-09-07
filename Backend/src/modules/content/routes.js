/**
 * URL to controller binding.
 *
 * `/recent` and `/tags` are declared before `/:slug`, or Express matches them as slugs.
 */

import { Router } from 'express';
import * as controller from './controller.js';

export const postsRouter = Router();

postsRouter.get('/', controller.listPosts);
postsRouter.get('/recent', controller.listRecent);
postsRouter.get('/tags', controller.listTags);
postsRouter.get('/:slug', controller.getPost);
