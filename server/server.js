// --- IntelliCode Reviewer Backend (server/server.js) ---

// 1. IMPORT DOTENV AND LOAD VARIABLES (Crucial for API Key)
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Node.js 18+ has built-in fetch - no import needed!
// If you're on Node < 18, install: npm install node-fetch@2

const app = express();
const port = 3001;

// Load environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""; 

// Middleware
app.use(cors()); 
app.use(bodyParser.json({ limit: '5mb' })); 

// --- Utility Functions for Gemini API ---

// Function to implement exponential backoff for API retries
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

// --- Route: /api/review ---

app.post('/api/review', async (req, res) => {
    const { code, language } = req.body;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not set. Please check your .env file.' });
    }

    if (!code || !language) {
        return res.status(400).json({ error: 'Code and language are required.' });
    }

    console.log(`Received review request for ${language} code.`);

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

    // Use API Key from environment variable
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

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
                        "description": "List of detected issues as a numbered list with line references. Each error on a new line with proper spacing." 
                    },
                    "corrected_code": { 
                        "type": "STRING", 
                        "description": "The complete corrected code with proper indentation, line breaks, and formatting preserved." 
                    },
                    "explanations": { 
                        "type": "STRING", 
                        "description": "Detailed explanations formatted with paragraphs, bullet points, and proper spacing for readability." 
                    },
                    "recommendations": { 
                        "type": "STRING", 
                        "description": "Best practices and optimization suggestions as a formatted list with proper spacing between items." 
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

        // Extract the raw JSON string from the Gemini response
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!jsonText) {
            console.error('Gemini API Response Error:', result);
            return res.status(500).json({ 
                error: 'AI processing failed or returned invalid content structure.', 
                rawResponse: result 
            });
        }
        
        // Use a robust method to parse the JSON, handling any potential markdown wrapper
        const cleanJsonText = jsonText.replace(/^```json\s*|^\s*```|```\s*$/g, '');
        const parsedResponse = JSON.parse(cleanJsonText);

        res.json(parsedResponse);

    } catch (error) {
        console.error('API Call Error:', error.message);
        res.status(500).json({ error: `Server error during AI analysis: ${error.message}` });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        apiKeyConfigured: !!GEMINI_API_KEY 
    });
});

// Start server
app.listen(port, () => {
    console.log(`IntelliCode Reviewer backend listening at http://localhost:${port}`);
    console.log(`API Key Status: ${GEMINI_API_KEY ? 'Loaded ✓' : 'MISSING ✗ (Check .env file)'}`);
    console.log(`Node version: ${process.version}`);
});