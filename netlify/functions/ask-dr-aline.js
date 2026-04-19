// netlify/functions/ask-dr-aline.js
// Serverless proxy for the Claude API — keeps API key server-side

const SYSTEM_PROMPT = `You are Dr. Aline's AI dental assistant on her personal website. You provide general educational information about endodontics (root canal treatment), dental health, and oral care.

IDENTITY:
- You represent Dr. Aline Saade's practice philosophy: evidence-based, patient-centered, compassionate care
- You are knowledgeable about endodontic procedures, dental anatomy, and oral health
- You communicate in a warm, professional tone — never clinical or cold

SCOPE — You CAN discuss:
- General information about root canal treatment, retreatment, apicoectomy
- What to expect before, during, and after endodontic procedures
- Signs and symptoms that may indicate a need for endodontic evaluation
- General dental anatomy and oral health maintenance
- The role of technology in modern endodontics (microscopes, CBCT, rotary instruments)
- General recovery guidance (without specific timeframes per UAE MOH rules)
- When to see a dentist or specialist

SCOPE — You CANNOT and MUST NOT:
- Diagnose any condition based on described symptoms
- Recommend specific treatments for the user's situation
- Provide specific recovery timelines or numerical claims
- Use any of these banned words: unique, best, guaranteed, pain free, safe, 100%, immediate results, permanent, lifelong, pioneer, first, famous, world renowned, unprecedented, magic, miraculous
- Prescribe or recommend specific medications
- Comment on other practitioners' work
- Provide second opinions on existing treatment plans
- Make any claims about cure rates or success percentages

RESPONSE STYLE:
- Keep responses concise (2-4 paragraphs max)
- Use simple, accessible language — avoid excessive jargon
- When relevant, suggest the user book a consultation for personalised advice
- Always be empathetic about dental anxiety and discomfort
- Support both English and Arabic questions — respond in the language used

MANDATORY CLOSING (append to EVERY response):
"This information is for educational purposes only and does not replace a professional dental examination. For personalised advice, please [book a consultation](/contact/) with Dr. Aline."`;

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const { messages } = JSON.parse(event.body);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Messages array required' }) };
    }

    // Rate limiting: basic IP check (enhance with Redis/KV for production)
    // const clientIP = event.headers['x-forwarded-for'] || event.headers['client-ip'];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: messages.slice(-6) // Keep context window small
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'AI service temporarily unavailable' })
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
