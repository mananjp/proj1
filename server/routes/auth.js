import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { 
  registerSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema 
} from '../validators/auth.js';
import { sendPasswordResetEmail } from '../services/mailService.js';

const router = express.Router();

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id),
        },
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('[AUTH ERROR] Register:', error);
    res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate a user
// @access  Public
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id),
        },
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('[AUTH ERROR] Login:', error);
    res.status(500).json({ success: false, message: 'Server error during login', error: error.message });
  }
});

// @route   GET /api/auth/users
// @desc    Get all users (for task assignment)
// @access  Protected
router.get('/users', protect, async (req, res) => {
  try {
    const users = await User.find({}).select('name email role');
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('[AUTH ERROR] Get Users:', error);
    res.status(500).json({ success: false, message: 'Server error fetching users', error: error.message });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset email
// @access  Public
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.'
      });
    }

    // Get reset token and save
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Client URL
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;

    const mailResult = await sendPasswordResetEmail({ user, resetUrl });

    if (!mailResult.success && !mailResult.simulated) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again later.'
      });
    }

    res.json({
      success: true,
      message: 'Password reset link sent to your email address.'
    });
  } catch (error) {
    console.error('[AUTH ERROR] Forgot Password:', error);
    res.status(500).json({ success: false, message: 'Server error requesting password reset', error: error.message });
  }
});

// @route   POST /api/auth/reset-password/:token
// @desc    Reset password using valid token
// @access  Public
router.post('/reset-password/:token', validate(resetPasswordSchema), async (req, res) => {
  try {
    // Hash token from param
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset link. Please request a new one.'
      });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful! You can now log in with your new password.'
    });
  } catch (error) {
    console.error('[AUTH ERROR] Reset Password:', error);
    res.status(500).json({ success: false, message: 'Server error resetting password', error: error.message });
  }
});

export default router;
