const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.vercel.app'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'CabPool API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes

/**
 * POST /api/register
 * Register user interest in CabPool service
 */
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, phone, pickup_point, drop_point ,message } = req.body;

    // Validation
    if (!name || !email || !phone || !pickup_point || !drop_point) {
      return res.status(400).json({
        success: false,
        error: 'Please fill all the required fields'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    // Check if email already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('registrations')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'This email is already registered'
      });
    }

    // Insert new registration
    const { data, error } = await supabase
      .from('registrations')
      .insert([
        {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone ? phone.trim() : null,
          pickup_point: pickup_point? pickup_point.trim() : null,
          drop_point: drop_point? drop_point.trim() : null,
          message: message ? message.trim() : null
        }
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save registration. Please try again.'
      });
    }

    console.log(`✅ New registration: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful! We\'ll be in touch soon.',
      data: {
        id: data[0].id,
        name: data[0].name,
        email: data[0].email
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    });
  }
});

/**
 * POST /api/feedback
 * Submit user feedback or testimonial
 */
app.post('/api/feedback', async (req, res) => {
  try {
    const { name, comment } = req.body;

    // Validation
    if (!name || !comment) {
      return res.status(400).json({
        success: false,
        error: 'Name and comment are required fields'
      });
    }

    if (comment.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Comment must be at least 10 characters long'
      });
    }

    if (comment.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Comment must be less than 1000 characters'
      });
    }

    // Insert feedback
    const { data, error } = await supabase
      .from('feedback')
      .insert([
        {
          name: name.trim(),
          comment: comment.trim()
        }
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save feedback. Please try again.'
      });
    }

    console.log(`✅ New feedback from: ${name}`);

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback!',
      data: {
        id: data[0].id,
        name: data[0].name
      }
    });

  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    });
  }
});

/**
 * GET /api/feedback
 * Get recent feedback (optional - for displaying testimonials)
 */
app.get('/api/feedback', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const { data, error } = await supabase
      .from('feedback')
      .select('id, name, comment, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch feedback'
      });
    }

    res.status(200).json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/stats
 * Get basic stats (optional - for admin dashboard)
 */
app.get('/api/stats', async (req, res) => {
  try {
    // Get registration count
    const { count: registrationCount, error: regError } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true });

    // Get feedback count
    const { count: feedbackCount, error: feedError } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true });

    if (regError || feedError) {
      console.error('Stats error:', regError || feedError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch stats'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalRegistrations: registrationCount || 0,
        totalFeedback: feedbackCount || 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 404 handler
// app.use('*', (req, res) => {
//   res.status(404).json({
//     success: false,
//     error: 'Route not found',
//     availableRoutes: [
//       'GET /health',
//       'POST /api/register',
//       'POST /api/feedback',
//       'GET /api/feedback',
//       'GET /api/stats'
//     ]
//   });
// });

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Something went wrong. Please try again later.'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CabPool API server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});