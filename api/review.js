// ============================================================
// DevReview — /api/review.js
// Vercel Serverless Function: Calls OpenRouter (Qwen) API
// Returns AI code review in JSON
// ============================================================

export default async function handler(req, res) {
  // Allow CORS for local dev/testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, language } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: 'Missing code or language in request body.' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not set in environment variables.' });
  }

  // Build AI prompt server-side
  const systemMessage = {
    role: 'system',
    content: `
      You are CodeSentinel AI, an elite code analysis engine.
      ONLY return a valid JSON object with this exact structure:
      {
        "score": <number 0-10 with 1 decimal>,
        "score_reason": "<one sentence>",
        "bugs": [{"line":"<line number or range>","issue":"<description>","severity":"critical|warning|info"}],
        "improvements": ["<suggestion>"],
        "complexity": {"time":"<Big-O>","space":"<Big-O>","explanation":"<brief explanation>"},
        "security": [{"issue":"<vulnerability>","severity":"critical|warning|info","fix":"<how to fix>"}],
        "optimized_code": "<full optimized code as string with \\n>",
        "summary": "<2-3 sentence summary>"
      }
      NO markdown, no explanation outside JSON.
    `
  };

  const userMessage = {
    role: 'user',
    content: `Analyze the following ${language.toUpperCase()} code and return JSON only:\n\`\`\`${language}\n${code}\n\`\`\``
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen/qwen-2.5-coder-32b-instruct',
        messages: [systemMessage, userMessage],
        max_tokens: 4000,
        temperature: 0.2,
        response_format: { type: 'json_object' } // ensures AI returns JSON
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `OpenRouter API error: ${response.status}`;
      console.error('[DevReview] OpenRouter error:', errMsg);
      return res.status(502).json({ error: errMsg });
    }

    const data = await response.json();

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: 'Empty response from AI model.' });
    }

    // ✅ Return in format expected by frontend
    return res.status(200).json({ review: content });

  } catch (err) {
    console.error('[DevReview] Server error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
}
