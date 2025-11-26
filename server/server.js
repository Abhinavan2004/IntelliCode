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
        version: '1.0.0',
        endpoints: {
            health: '/health',
            review: '/api/review (POST)'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        apiKeyConfigured: !!GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

app.post('/api/review', async (req, res) => {
    const { code, language } = req.body;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not set. Please configure environment variables.' });
    }

    if (!code || !language) {
        return res.status(400).json({ error: 'Code and language are required.' });
    }

    console.log(`Received review request for ${language} code at ${new Date().toISOString()}`);

    const systemPrompt = `You are a world-class code reviewer and expert software engineer. Analyze the provided ${language} code and provide a comprehensive review.

CRITICAL FORMATTING REQUIREMENTS:

1. For "errors": Format as a clean numbered list. Each error should be on its own line following this pattern:
   1. Line X: [Clear description of the error]
   2. Line Y: [Clear description of the error]
   
2. For "explanations": Format as numbered points with clear structure. Use **bold** for important terms (using double asterisks). Example:
   1. **Error Type:** Explanation of what was wrong
   2. **Fix Applied:** Explanation of the correction
   Keep it clear, concise, and well-structured.

3. For "recommendations": Format as numbered best practices with **bold** headers. Example:
   1. **Input Validation:** Implement robust validation...
   2. **Error Handling:** Use proper exception handling...
   Each recommendation should be detailed but easy to scan.

4. For "corrected_code": Return the COMPLETE corrected code exactly as it should be written with proper indentation, line breaks, and formatting. This is the actual working code, not a description.

IMPORTANT: Use **double asterisks** around important terms to make them bold. Keep explanations clear, scannable, and professional.`;

    const userQuery = `Review the following ${language} code and provide detailed analysis with proper formatting:\n\n\`\`\`${language}\n${code}\n\`\`\``;

    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        console.log("🔥 Using model: gemini-1.5-flash");
    console.log("🔥 API URL:", apiUrl);
    console.log("Loaded GEMINI_API_KEY:", GEMINI_API_KEY);


    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "errors": { 
                        "type": "STRING", 
                        "description": "List of detected issues as a numbered list with line references." 
                    },
                    "corrected_code": { 
                        "type": "STRING", 
                        "description": "The complete corrected code with proper indentation and formatting." 
                    },
                    "explanations": { 
                        "type": "STRING", 
                        "description": "Detailed explanations formatted with paragraphs and proper spacing." 
                    },
                    "recommendations": { 
                        "type": "STRING", 
                        "description": "Best practices and optimization suggestions as a formatted list." 
                    }
                },
                "propertyOrdering": ["errors", "corrected_code", "explanations", "recommendations"]
            }
        }
    };

    try {
        const response = await retryFetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!jsonText) {
            console.error('Gemini API Response Error:', result);
            return res.status(500).json({ 
                error: 'AI processing failed or returned invalid content structure.', 
                rawResponse: result 
            });
        }
        
        const cleanJsonText = jsonText.replace(/^```json\s*|^\s*```|```\s*$/g, '');
        const parsedResponse = JSON.parse(cleanJsonText);

        console.log('Successfully processed review request');
        res.json(parsedResponse);

    } catch (error) {
        console.error('API Call Error:', error.message);
        res.status(500).json({ error: `Server error during AI analysis: ${error.message}` });
    }
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`IntelliCode Reviewer backend listening at http://0.0.0.0:${port}`);
    console.log(`API Key Status: ${GEMINI_API_KEY ? 'Loaded ✓' : 'MISSING ✗ (Check environment variables)'}`);
    console.log(`Node version: ${process.version}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});