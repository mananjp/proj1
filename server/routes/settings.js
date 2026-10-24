import express from 'express';
import Settings from '../models/Settings.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// GET /api/settings/whitelabel - Get current white-label branding settings
router.get('/whitelabel', async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'whitelabel' });
    if (!settings) {
      settings = await Settings.create({ key: 'whitelabel' });
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('[SETTINGS ERROR] Get White-label:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving branding settings', error: error.message });
  }
});

// POST /api/settings/whitelabel - Update white-label settings (Admin only)
router.post('/whitelabel', adminOnly, async (req, res) => {
  try {
    const { companyName, logoUrl, brandColor, reportTitle, footerText, contactEmail } = req.body;

    const updates = {};
    if (companyName !== undefined) updates.companyName = companyName.trim();
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (brandColor !== undefined) updates.brandColor = brandColor.trim();
    if (reportTitle !== undefined) updates.reportTitle = reportTitle.trim();
    if (footerText !== undefined) updates.footerText = footerText.trim();
    if (contactEmail !== undefined) updates.contactEmail = contactEmail.trim();

    const settings = await Settings.findOneAndUpdate(
      { key: 'whitelabel' },
      updates,
      { new: true, upsert: true, runValidators: true }
    );

    console.log(`[SETTINGS LOG] Updated White-label settings:`, settings.companyName);

    res.json({
      success: true,
      message: 'Branding settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('[SETTINGS ERROR] Update White-label:', error);
    res.status(500).json({ success: false, message: 'Server error updating branding settings', error: error.message });
  }
});

export default router;
