import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as invoiceController from './invoice.controller.js';
import { listInvoicesSchema } from './invoice.validator.js';

// Mounted at /api/internal/invoices by app.js. Reads open to any staff role
// that already sees quotations (a rep may want to check whether their own
// deal got paid); recording a payment is Finance + Admin only, per the
// access matrix (§6, "Record payments / credit notes").
const router = Router();

router.use(authenticateInternal);

router.get('/', validateQuery(listInvoicesSchema), invoiceController.list);
router.get('/:id', parseId(), invoiceController.getOne);

router.post('/:id/pay', authorize('FINANCE', 'ADMIN'), parseId(), invoiceController.pay);

export default router;
