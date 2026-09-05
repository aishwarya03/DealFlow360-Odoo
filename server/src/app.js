import path from 'path';
import { fileURLToPath } from 'url';

import cors from 'cors';
import express from 'express';

import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';
import approvalRoutes from './modules/approvals/approval.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import categoryRoutes from './modules/categories/category.routes.js';
import customerRoutes from './modules/customers/customer.routes.js';
import discountRoutes from './modules/discounts/discount.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import productRoutes from './modules/products/product.routes.js';
import publicProductRoutes from './modules/products/product.public.routes.js';
import portalRoutes from './modules/portal/portal.routes.js';
import quotationRoutes from './modules/quotations/quotation.routes.js';
import tierRoutes from './modules/tiers/tier.routes.js';
import warehouseRoutes from './modules/warehouses/warehouse.routes.js';
import healthRoutes from './routes/healthRoutes.js';
import pingRoutes from './routes/pingRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

// Uploaded product images. Served by path, not through an authenticated
// route — the same tradeoff a public CDN would make, and nothing sensitive
// is encoded in an image filename (a random UUID, per uploadProductImage.js).
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use(healthRoutes);
app.use(pingRoutes);

// Two separate route trees, each with its own token audience.
// /api/internal/* -> staff.  /api/portal/* -> customers (added at the negotiation feature).
app.use('/api/internal/auth', authRoutes);
app.use('/api/internal/categories', categoryRoutes);
app.use('/api/internal/products', productRoutes);
app.use('/api/public/products', publicProductRoutes);
app.use('/api/internal/customers', customerRoutes);
app.use('/api/internal/tiers', tierRoutes);
app.use('/api/internal/discounts', discountRoutes);
app.use('/api/internal/warehouses', warehouseRoutes);
app.use('/api/internal/inventory', inventoryRoutes);
app.use('/api/internal/quotations', quotationRoutes);
app.use('/api/internal/approvals', approvalRoutes);
app.use('/api/portal', portalRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
