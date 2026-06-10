/**
 * DeepM8 Backend API Server
 * Securely handles OpenAI API calls with token protection
 */

import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';

const app = express();
const PORT = process.env.PORT || 3001;

// 🔒 Secure OpenAI API key - NEVER expose to frontend
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://*.seaverse.com',
    'https://deepm8-frontend.vercel.app',  // ✅ Added Vercel frontend
    'https://*.vercel.app'  // ✅ Allow all Vercel preview deployments
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DeepM8 Backend API',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/chat
 * Secure endpoint for OpenAI chat completions
 *
 * Body:
 * - messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>
 * - model: string (optional, default: 'gpt-4o-mini')
 * - temperature: number (optional, default: 0.7)
 * - maxTokens: number (optional, default: 1000)
 */
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      model = 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 1000
    } = req.body;

    console.log('📥 Request body:', JSON.stringify(req.body, null, 2));

    // Enhanced validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('❌ Validation failed: messages array is invalid');
      return res.status(400).json({
        error: 'Invalid request',
        message: 'messages array is required and must not be empty'
      });
    }

    // Validate each message has required fields
    const invalidMessages = messages.filter((msg, index) => {
      const isValid = msg &&
                      typeof msg === 'object' &&
                      msg.role &&
                      typeof msg.content === 'string' &&
                      msg.content.trim().length > 0;
      if (!isValid) {
        console.error(`❌ Invalid message at index ${index}:`, msg);
      }
      return !isValid;
    });

    if (invalidMessages.length > 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'All messages must have role and content (non-empty string)',
        details: `${invalidMessages.length} invalid message(s) found`
      });
    }

    // Rate limiting check (simple example - implement proper rate limiting in production)
    const messageCount = messages.length;
    if (messageCount > 50) {
      return res.status(429).json({
        error: 'Too many messages',
        message: 'Conversation too long. Please start a new chat.'
      });
    }

    console.log('🤖 Processing chat request:', {
      model,
      messageCount,
      temperature,
      maxTokens,
      timestamp: new Date().toISOString()
    });

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: String(msg.content).trim()
      })),
      temperature,
      max_tokens: maxTokens,
    });

    const response = {
      content: completion.choices[0]?.message?.content || '',
      model: completion.model,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      }
    };

    console.log('✅ OpenAI response generated:', {
      contentLength: response.content.length,
      totalTokens: response.usage.totalTokens,
      timestamp: new Date().toISOString()
    });

    res.json(response);

  } catch (error) {
    console.error('❌ Error calling OpenAI:', error);

    // Handle specific OpenAI errors
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.'
      });
    }

    if (error.status === 401) {
      return res.status(500).json({
        error: 'API configuration error',
        message: 'Invalid API key configuration.'
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        error: 'Invalid request',
        message: error.message || 'Bad request to OpenAI API'
      });
    }

    // Generic error
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process chat request',
      details: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 DeepM8 Backend API Server');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔒 OpenAI API Key: ***${OPENAI_API_KEY.slice(-4)}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /health       - Health check');
  console.log('  POST /api/chat     - Chat completions');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});
