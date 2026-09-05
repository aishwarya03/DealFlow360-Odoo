import cors from 'cors';
import express from 'express';

import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';
import authRoutes from './modules/auth/auth.routes.js';
import customerRoutes from './modules/customers/customer.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import productRoutes from './modules/products/product.routes.js';
import warehouseRoutes from './modules/warehouses/warehouse.routes.js';
import healthRoutes from './routes/healthRoutes.js';
import pingRoutes from './routes/pingRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use(healthRoutes);
app.use(pingRoutes);

// Two separate route trees, each with its own token audience.
// /api/internal/* -> staff.  /api/portal/* -> customers (added at the negotiation feature).
app.use('/api/internal/auth', authRoutes);
app.use('/api/internal/products', productRoutes);
app.use('/api/internal/customers', customerRoutes);
app.use('/api/internal/warehouses', warehouseRoutes);
app.use('/api/internal/inventory', inventoryRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
