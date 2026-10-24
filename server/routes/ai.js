import express from 'express';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { insightsSchema } from '../validators/ai.js';
import { generateTaskInsights } from '../services/aiService.js';

const router = express.Router();

router.use(protect);

/**
 * POST /api/ai/insights — AI task insights (Groq on the backend, with
 * graceful rule-based fallback). The API key never reaches the browser.
 */
router.post('/insights', validate(insightsSchema), async (req, res) => {
  try {
    const { title, description } = req.body;
    const insights = await generateTaskInsights({ title, description });

    console.log(`[AI] Insights generated for "${title.slice(0, 60)}" (source: ${insights.source})`);

    res.json({ success: true, data: insights });
  } catch (error) {
    console.error('[AI] Error generating insights:', error);
    res.status(500).json({ success: false, message: 'Failed to generate AI insights' });
  }
});

export default router;
