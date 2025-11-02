import React, { useState, useCallback, useMemo } from 'react';

// Helper component to display formatted code
const CodeDisplay = ({ code, language }) => (
  <pre className="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-auto text-sm shadow-inner font-mono leading-relaxed">
    <code className={`language-${language}`}>
      {code}
    </code>
  </pre>
);

// Helper component to display formatted text with proper styling
const FormattedText = ({ content }) => {
  // Process markdown-style bold text and create beautiful formatting
  const processText = (text) => {
    if (!text) return null;
    
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-indigo-700">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const formatContent = (text) => {
    if (!text) return <p className="text-gray-500 italic">No content provided.</p>;
    
    return text.split('\n').map((line, idx) => {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        return <div key={idx} className="h-3" />;
      }
      
      if (/^\d+\./.test(trimmedLine)) {
        const match = trimmedLine.match(/^(\d+\.)\s*(.+)/);
        if (match) {
          return (
            <div key={idx} className="mb-4 flex items-start gap-3 p-3 rounded-lg hover:bg-indigo-50 transition-colors duration-200">
              <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                {match[1].replace('.', '')}
              </span>
              <p className="text-gray-800 leading-relaxed flex-1 pt-1">
                {processText(match[2])}
              </p>
            </div>
          );
        }
      }
      
      if (/^[-•*]\s/.test(trimmedLine)) {
        const content = trimmedLine.replace(/^[-•*]\s/, '');
        return (
          <div key={idx} className="mb-3 flex items-start gap-3 ml-4 p-2 rounded-lg hover:bg-gray-50 transition-colors duration-200">
            <span className="flex-shrink-0 w-2 h-2 bg-indigo-500 rounded-full mt-2"></span>
            <p className="text-gray-700 leading-relaxed flex-1">
              {processText(content)}
            </p>
          </div>
        );
      }
      
      return (
        <p key={idx} className="text-gray-800 leading-relaxed mb-4 pl-2">
          {processText(trimmedLine)}
        </p>
      );
    });
  };

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-xl shadow-lg border-2 border-indigo-100">
      <div className="space-y-2">
        {formatContent(content)}
      </div>
    </div>
  );
};

const App = () => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('Python');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('errors');

  const languages = ['C', 'C++', 'Python', 'Java', 'JavaScript'];

  const API_URL = 'https://intellicode-backend.onrender.com';

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCode(e.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleReviewCode = useCallback(async () => {
    if (!code.trim() || !language) {
      setError('Please paste code and select a language.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
      setActiveTab('corrected_code'); // Switch to the corrected code tab upon success

    } catch (err) {
      console.error('Code review failed:', err);
      setError(`Code review failed: ${err.message}. Ensure the backend server is running and the GEMINI_API_KEY is set.`);
    } finally {
      setIsLoading(false);
    }
  }, [code, language]);


  const copyToClipboard = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      alert('Code copied to clipboard!');
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('Failed to copy. Please manually select and copy the text.');
    }
    document.body.removeChild(textarea);
  };

  const downloadFile = (content, filename) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const ResultSection = useMemo(() => {
    if (!results) return null;
    
    const contentMap = {
      errors: results.errors,
      explanations: results.explanations,
      recommendations: results.recommendations,
    };
    
    const content = contentMap[activeTab];

    if (activeTab === 'corrected_code') {
      return (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✨</span>
              <h3 className="text-lg font-bold text-gray-800">Your Optimized Code</h3>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => copyToClipboard(results.corrected_code)}
                className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center gap-2"
              >
                📋 Copy Code
              </button>
              <button
                onClick={() => downloadFile(results.corrected_code, `reviewed_code.${language.toLowerCase()}`)}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center gap-2"
              >
                💾 Download
              </button>
            </div>
          </div>
          <CodeDisplay code={results.corrected_code} language={language} />
        </div>
      );
    }

    const sectionInfo = {
      errors: { icon: '🐛', title: 'Issues Found', color: 'from-red-50 to-orange-50' },
      explanations: { icon: '📖', title: 'Detailed Explanations', color: 'from-blue-50 to-cyan-50' },
      recommendations: { icon: '💡', title: 'Best Practices & Tips', color: 'from-purple-50 to-pink-50' }
    };

    const info = sectionInfo[activeTab];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b-2 border-gray-200">
          <span className="text-3xl">{info.icon}</span>
          <h3 className="text-xl font-bold text-gray-800">{info.title}</h3>
        </div>
        <FormattedText content={content} />
      </div>
    );
  }, [results, activeTab, language]);

  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`py-3 px-5 text-sm font-semibold transition-all duration-200 rounded-t-lg border-b-2
        ${activeTab === id
          ? 'bg-white text-indigo-600 border-indigo-600 shadow-md'
          : 'bg-gray-50 text-gray-600 border-transparent hover:bg-gray-100 hover:text-gray-800'
        }`}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight mb-3">
            <span className="text-indigo-600">IntelliCode</span> Reviewer 🧠
          </h1>
          <p className="text-xl text-gray-600">
            AI-powered code analysis, correction, and optimization
          </p>
        </header>

        {/* Code Input & Controls */}
        <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-200 mb-10">
          <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
            {/* Language Dropdown */}
            <div className="flex-grow w-full md:w-auto">
              <label htmlFor="language" className="block text-sm font-semibold text-gray-700 mb-2">
                Select Language
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full border-2 border-gray-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            {/* File Upload Button */}
            <label className="flex-shrink-0 cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-5 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg">
              📁 Upload File
              <input type="file" onChange={handleFileChange} className="hidden" accept=".c,.cpp,.py,.java,.js,.txt" />
            </label>

            {/* Analyze Button */}
            <button
              onClick={handleReviewCode}
              disabled={isLoading}
              className={`flex-shrink-0 w-full md:w-auto py-3 px-8 font-bold rounded-lg shadow-lg transition-all duration-300 ease-in-out
                ${isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-xl transform hover:scale-105'
                }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </span>
              ) : '🚀 Analyze Code'}
            </button>
          </div>

          {/* Code Editor Area */}
          <label htmlFor="code-editor" className="block text-sm font-semibold text-gray-700 mb-2">
            Paste Your Code Here:
          </label>
          <textarea
            id="code-editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={16}
            placeholder={`Paste your ${language} code here...`}
            className="w-full p-5 border-2 border-gray-300 rounded-lg shadow-inner resize-none font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-gray-50"
          ></textarea>

          {/* Error Message */}
          {error && (
            <div className="mt-5 p-4 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-lg" role="alert">
              <p className="font-semibold">❌ Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}
        </div>

        {/* Results Display */}
        {results && (
          <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-2xl shadow-2xl border-2 border-indigo-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Review Results</h2>
                <p className="text-sm text-gray-500 mt-1">AI-powered code analysis complete</p>
              </div>
            </div>
            
            {/* Tabs Navigation */}
            <div className="border-b-2 border-gray-200 mb-8">
              <nav className="-mb-0.5 flex flex-wrap gap-2">
                <TabButton id="corrected_code" label="Corrected Code" icon="✅" />
                <TabButton id="errors" label="Errors & Issues" icon="🐛" />
                <TabButton id="explanations" label="Explanations" icon="📖" />
                <TabButton id="recommendations" label="Best Practices" icon="💡" />
              </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[300px]">
              {ResultSection}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;