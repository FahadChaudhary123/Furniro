/**
 * URL to controller binding. No logic here — that is the point of a routes file.
 *
 * Ordering matters: `/featured` must be declared before `/:slug`, or Express matches
 * "featured" as a slug and every request to it 404s.
 */

import { Router } from 'express';
import * as controller from './controller.js';

export const productsRouter = Router();

productsRouter.get('/', controller.listProducts);
productsRouter.get('/featured', controller.listFeatured);
productsRouter.get('/:slug', controller.getProduct);

export const categoriesRouter = Router();

categoriesRouter.get('/', controller.listCategories);
