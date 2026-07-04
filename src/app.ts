import express from 'express';
import cors from 'cors';
import { dotenvExpand } from 'dotenv';
import * as dotenv from 'dotenv';
import { requestOtp, verifyOtp, refreshSession } from './controllers/auth';
import { createCase, getCases, getCaseById, updateCaseStatus, assignTechnician } from './controllers/cases';
import { getMessages, postMessage, getAiSmartReplies } from './controllers/chat';
import { createQuotation, approveQuotation, rejectQuotation, getInvoices, addPayment } from './controllers/billing';
import { authenticateToken, authorizeRoles } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Public Auth Endpoints
app.post('/api/auth/otp/request', requestOtp);
app.post('/api/auth/otp/verify', verifyOtp);
app.post('/api/auth/refresh', refreshSession);

// Case Management (Authenticated)
app.post('/api/cases', authenticateToken, createCase);
app.get('/api/cases', authenticateToken, getCases);
app.get('/api/cases/:id', authenticateToken, getCaseById);
app.patch('/api/cases/:id/status', authenticateToken, updateCaseStatus);
app.patch('/api/cases/:id/technician', authenticateToken, authorizeRoles('Laboratory Admin', 'Owner'), assignTechnician);

// Chat & AI Smart Reply (Authenticated)
app.get('/api/cases/:id/messages', authenticateToken, getMessages);
app.post('/api/cases/:id/messages', authenticateToken, postMessage);
app.get('/api/cases/:id/ai/replies', authenticateToken, getAiSmartReplies);

// Billing & Quotes (Authenticated)
app.post('/api/cases/:id/quote', authenticateToken, authorizeRoles('Laboratory Admin', 'Owner'), createQuotation);
app.post('/api/cases/:id/quote/approve', authenticateToken, approveQuotation);
app.post('/api/cases/:id/quote/reject', authenticateToken, rejectQuotation);
app.get('/api/invoices', authenticateToken, getInvoices);
app.post('/api/invoices/:id/payments', authenticateToken, addPayment);

// Standard health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  EDL Dental Lab Backend Server running on port ${PORT} `);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`==================================================`);
});

export default app;
