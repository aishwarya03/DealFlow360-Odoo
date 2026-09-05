import express from 'express';
import cors from 'cors';

import healthRoutes from './routes/healthRoutes.js';
import pingRoutes from './routes/pingRoutes.js';

import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';


const app = express();

// Built-in Middleware
app.use(cors());
app.use(express.json());

// Routes will go here later
app.use(healthRoutes);
app.use(pingRoutes);

// 404 Handler
app.use(notFound);

// Global Error Handler
app.use(errorHandler);

export default app;