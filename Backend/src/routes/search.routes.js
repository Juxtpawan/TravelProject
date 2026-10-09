import express from 'express';
import { d1Query } from '../db/client.js';
import { generateJson } from '../services/gemini.service.js';

const router = express.Router();

/**
 * POST /search
 * Body: { query: "Quiet cafes with wifi near temple" }
 *
 * Phase 10: AI-powered natural language search over the places database.
 * If Gemini is available, uses it to extract search intent.
 * Falls back to a fuzzy SQL LIKE search for testing without AI.
 */
router.post('/', async (req, res) => {
  const { query, destinationSlug } = req.body;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  try {
    let results = [];

    // ── AI intent extraction (when Gemini is available) ──────────────────────
    try {
      const intent = await generateJson({
        env: req.cloudflare?.env,
        systemPrompt: `Extract search intent from a travel query. Return ONLY a JSON object with:
            { "category": "attraction|restaurant|hotel|bar|shop|activity|null", "keywords": ["word1","word2"] }`,
        userPrompt: query,
        maxOutputTokens: 100,
      });

      if (intent && typeof intent === 'object' && !Array.isArray(intent)) {
        const { category, keywords = [] } = intent;

        let sql = `
          SELECT p.*, d.name as destination_name, d.slug as destination_slug
          FROM places p
          JOIN destinations d ON p.destination_id = d.id
          WHERE 1=1
        `;
        const params = [];

        if (destinationSlug) {
          sql += ' AND d.slug = ?';
          params.push(destinationSlug);
        }
        if (category && category !== 'null') {
          sql += ' AND p.category = ?';
          params.push(category);
        }
        if (keywords.length > 0) {
          const kwConditions = keywords.map(() => 'p.name LIKE ?').join(' OR ');
          sql += ` AND (${kwConditions})`;
          keywords.forEach(kw => params.push(`%${kw}%`));
        }
        sql += ' LIMIT 20';
        results = await d1Query(sql, params);
      }
    } catch (_) {
      // Gemini not available — fall back to SQL LIKE
    }

    // ── Fallback: SQL LIKE search ────────────────────────────────────────────
    if (results.length === 0) {
      const terms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const conditions = terms.map(() => 'LOWER(p.name) LIKE ?').join(' OR ');
      const params = terms.map(t => `%${t}%`);

      let sql = `
        SELECT p.*, d.name as destination_name, d.slug as destination_slug
        FROM places p
        JOIN destinations d ON p.destination_id = d.id
        WHERE (${conditions || '1=1'})
      `;
      if (destinationSlug) {
        sql += ' AND d.slug = ?';
        params.push(destinationSlug);
      }
      sql += ' LIMIT 20';

      results = await d1Query(sql, params);
    }

    res.json({
      query,
      total: results.length,
      results,
    });

  } catch (error) {
    console.error('[Search] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
