require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// CORS Configuration for production
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(bodyParser.json({ limit: '5mb' }));

const retryFetch = async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);

            if (response.status === 429 && i < retries - 1) {
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                console.warn(`Rate limit hit. Retrying in ${Math.round(delay / 1000)}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
            }

            return response;

        } catch (error) {
            if (i === retries - 1) {
                throw new Error(`Failed to fetch from Gemini API after ${retries} attempts: ${error.message}`);
            }
            console.error(`Attempt ${i + 1} failed: ${error.message}`);
        }
    }
};

app.get('/', (req, res) => {
    res.json({
        message: 'IntelliCode Reviewer API',
        status: 'running',
        version: '1.0.0'
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        apiKeyConfigured: !!GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// Main Review Route
app.post('/api/review', async (req, res) => {
    const { code, language } = req.body;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not set. Please configure environment variables.' });
    }

    if (!code || !language) {
        return res.status(400).json({ error: 'Code and language are required.' });
    }

    console.log(`Received review request for ${language} code at ${new Date().toISOString()}`);

    const systemPrompt = `
You are a world-class code reviewer and expert software engineer. Analyze the provided ${language} code and provide a comprehensive review.

CRITICAL FORMATTING REQUIREMENTS:

1. For "errors": Format as a clean numbered list. Each error should be on its own line following this pattern:
   1. Line X: [Clear description of the error]
   2. Line Y: [Clear description of the error]

2. For "explanations": Format as numbered points with clear structure. Use **bold** for important terms (using double asterisks). Example:
   1. **Error Type:** Explanation of what was wrong
   2. **Fix Applied:** Explanation of the correction

3. For "recommendations": Format as numbered best practices with **bold** headers.

4. For "corrected_code": Return the COMPLETE corrected code exactly as it should be written with proper indentation.

IMPORTANT: Use **double asterisks** around important terms. Keep explanations clear, scannable, and professional.

Respond ONLY in valid JSON with these fields:
{
 "errors": "",
 "corrected_code": "",
 "explanations": "",
 "recommendations": ""
}
`;

    const userPrompt = `Review the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``;

const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${GEMINI_API_KEY}`;
    console.log("🔥 Using model: gemini-pro (FREE TIER)");
    console.log("🔥 API URL:", apiUrl);
    console.log("Loaded GEMINI_API_KEY:", GEMINI_API_KEY);

    const payload = {
        contents: [
            {
                parts: [
                    { text: systemPrompt + "\n\n" + userPrompt }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.3,
maxOutputTokens: 8192
        }
    };

    try {
        const response = await retryFetch(apiUrl, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return res.status(500).json({ error: "Invalid response from Gemini", raw: data });
        }

        const clean = text.replace(/```json|```/g, "").trim();

        let parsed;
        try {
            parsed = JSON.parse(clean);
        } catch (err) {
            return res.status(500).json({
                error: "Failed to parse AI JSON response",
                rawResponse: clean
            });
        }

        console.log("Successfully processed review");
        res.json(parsed);

    } catch (error) {
        console.error("API Call Error:", error.message);
        res.status(500).json({ error: `Server error: ${error.message}` });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`IntelliCode Reviewer backend listening at http://0.0.0.0:${port}`);
    console.log(`API Key Status: ${GEMINI_API_KEY ? 'Loaded ✓' : 'MISSING ✗'}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
