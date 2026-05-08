// src/components/fastReading/QuizWindow.jsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import CloseIcon from '../assets/icons/close.svg';

const { readdir } = window.require('fs').promises;
const path = window.require('path');

const READING_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\Books\\Reading';
const NOTES_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\books\\Notes';

const QuizWindow = ({ text, preGenerated, onClose }) => {
  const [questions, setQuestions] = useState(preGenerated || null);
  const [loading, setLoading] = useState(!preGenerated);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // New states for summary feature
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [readingBooks, setReadingBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [userSummary, setUserSummary] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [summarySaved, setSummarySaved] = useState(false);

  const API_KEY = 'AIzaSyBIIE8PpdwIMsUPp9PfMLcUV83SqiVsPa4';
  const MODEL = 'gemini-2.5-flash'; // Changed from gemini-2.5-flash-latest

  // Load "Currently Reading" books
  useEffect(() => {
    const loadReadingBooks = async () => {
      try {
        const files = await readdir(READING_FOLDER);
        const pdfs = files
          .filter(f => path.extname(f).toLowerCase() === '.pdf')
          .map(f => ({ name: path.basename(f, '.pdf'), fullPath: path.join(READING_FOLDER, f) }));
        setReadingBooks(pdfs);
        if (pdfs.length > 0) setSelectedBook(pdfs[0]);
      } catch (err) {
        console.error('Failed to load reading books:', err);
      }
    };
    loadReadingBooks();
  }, []);

  // Disable body overflow when quiz is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Existing quiz generation logic (unchanged until summary part)
  useEffect(() => {
    if (!preGenerated) {
      const generateQuestions = async () => {
        const prompt = `Generate exactly 5 multiple-choice questions based on the following text. Each question should have 4 options labeled A, B, C, D, and one correct answer.

Output only a JSON array of objects, nothing else. Each object should have:
- "question": the question text
- "options": array of 4 strings like "A. Option text"
- "correct": the correct letter like "A"

Text: ${text.trim()}`;

        try {
          setLoading(true);
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          });

          if (!response.ok) throw new Error(`API error ${response.status}`);

          const data = await response.json();
          if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Invalid response');

          let outputText = data.candidates[0].content.parts[0].text.trim();
          outputText = outputText.replace(/^```json\n?|\n?```$/g, '').trim();

          const parsed = JSON.parse(outputText);
          if (!Array.isArray(parsed) || parsed.length !== 5) throw new Error('Invalid format');

          setQuestions(parsed);
        } catch (err) {
          console.error(err);
          setError('Failed to generate quiz questions. Please try again.');
        } finally {
          setLoading(false);
        }
      };

      generateQuestions();
    }
  }, [preGenerated, text]);

  const handleAnswer = (index, value) => {
    setAnswers(prev => ({ ...prev, [index]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const calculateScore = () => {
    if (!questions) return 0;
    return questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0);
  };

  const getOptionText = (q, letter) => {
    return q.options.find(opt => opt.startsWith(`${letter}.`)) || `${letter}. (Not found)`;
  };

  // Summary verification and save
  const verifyAndSaveSummary = async () => {
    if (!userSummary.trim() || !selectedBook) return;

    setVerifying(true);
    setVerificationMessage('');

    const prompt = `Here is a text the user just read:

"${text.trim()}"

And here is the user's summary:

"${userSummary.trim()}"

Respond with ONLY a short message (max 2 sentences):
- If the summary is accurate and captures the main ideas → start with "✓ Accurate"
- If it's partially correct or missing key points → start with "⚠ Partially accurate"
- If it's wrong or misleading → start with "✗ Inaccurate"

Then briefly explain in 1 short sentence.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      const data = await response.json();
      const feedback = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'No response';

      setVerificationMessage(feedback);

      // Auto-save as a note after verification
      const notesFile = path.join(NOTES_FOLDER, `${selectedBook.name}.json`);
      let existingNotes = [];

      if (window.require('fs').existsSync(notesFile)) {
        try {
          const raw = window.require('fs').readFileSync(notesFile, 'utf8');
          existingNotes = JSON.parse(raw);
        } catch (e) { /* ignore */ }
      }

      const newNote = {
        id: Date.now().toString(),
        content: `Summary: ${userSummary.trim()}\n\n(Quiz session - ${new Date().toLocaleDateString()})`,
        timestamp: new Date().toISOString(),
      };

      const updated = [newNote, ...existingNotes];
      window.require('fs').writeFileSync(notesFile, JSON.stringify(updated, null, 2));

      setSummarySaved(true);
    } catch (err) {
      setVerificationMessage('Failed to verify summary.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return createPortal(
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full m-4 text-center text-slate-300">
          <p className="text-base animate-pulse">Generating quiz questions...</p>
        </div>
      </div>,
      document.body
    );
  }

  if (error) {
    return createPortal(
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full m-4 text-center">
          <p className="text-base text-red-400 mb-3">{error}</p>
          <button onClick={onClose} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white transition text-sm">
            Close
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-y-auto p-4">
        <div className="bg-gray-900 rounded-lg p-5 max-w-xl w-full my-4 border border-slate-700/50 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-100">Comprehension Quiz</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-100 flex items-center justify-center p-1 cursor-pointer">
              <img src={CloseIcon} className="w-3 h-3 opacity-50 invert" />
            </button>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit}>
              {questions.map((q, i) => (
                <div key={i} className="mb-5">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">{q.question}</h3>
                  <div className="space-y-2">
                    {q.options.map((opt, j) => {
                      const letter = opt[0];
                      return (
                        <label key={j} className="flex items-center text-slate-300 cursor-pointer text-sm">
                          <input
                            type="radio"
                            name={`question-${i}`}
                            value={letter}
                            checked={answers[i] === letter}
                            onChange={() => handleAnswer(i, letter)}
                            className="mr-2 w-4 h-4 text-cyan-500 bg-slate-700 border-slate-600 focus:ring-cyan-500"
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex justify-end mt-4">
                <button
                  type="submit"
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium transition disabled:opacity-50 cursor-pointer"
                  disabled={Object.keys(answers).length < 5}
                >
                  Submit Answers
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div className="mb-5 text-center">
                <h3 className="text-xl font-bold text-slate-100">Score: {calculateScore()} / 5</h3>
              </div>

              {questions.map((q, i) => {
                const userAns = answers[i];
                const isCorrect = userAns === q.correct;
                return (
                  <div key={i} className="mb-4 p-3 bg-slate-800/50 rounded border border-slate-700/50">
                    <h3 className="text-sm font-semibold text-slate-200 mb-2">{q.question}</h3>
                    <p className="text-xs text-slate-400 mb-1">
                      Your answer: {userAns ? getOptionText(q, userAns) : 'No answer selected'}
                    </p>
                    <p className="text-xs text-slate-400 mb-1">
                      Correct answer: {getOptionText(q, q.correct)}
                    </p>
                    {!isCorrect && <p className="text-xs text-red-400 font-medium">Incorrect</p>}
                  </div>
                );
              })}

              <div className="flex justify-between items-center mt-5 gap-2">
                <button
                  onClick={() => setShowSummaryModal(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm font-medium transition cursor-pointer"
                >
                  Summarize
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-5 max-w-lg w-full border border-slate-700/50">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Write a Summary</h2>

            {readingBooks.length === 0 ? (
              <p className="text-yellow-400 text-sm">No books in "Currently Reading" folder.</p>
            ) : (
              <>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Add to book:</label>
                  <select
                    value={selectedBook?.name || ''}
                    onChange={(e) => setSelectedBook(readingBooks.find(b => b.name === e.target.value))}
                    className="w-full bg-slate-800 text-white text-sm rounded px-3 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {readingBooks.map(book => (
                      <option key={book.name} value={book.name}>{book.name}</option>
                    ))}
                  </select>
                </div>

                <textarea
                  value={userSummary}
                  onChange={(e) => setUserSummary(e.target.value)}
                  placeholder="Write a short summary of what you just read..."
                  className="w-full h-28 bg-slate-800 text-white text-sm rounded px-3 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />

                <div className="mt-3 flex justify-between items-center gap-2">
                  <button
                    onClick={() => {
                      setShowSummaryModal(false);
                      setVerificationMessage('');
                      setSummarySaved(false);
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={verifyAndSaveSummary}
                    disabled={verifying || !userSummary.trim() || summarySaved}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-white text-sm font-medium transition cursor-pointer"
                  >
                    {verifying ? 'Verifying...' : summarySaved ? 'Saved!' : 'Verify & Save'}
                  </button>
                </div>

                {verificationMessage && (
                  <div className="mt-3 p-3 bg-slate-800 rounded border border-slate-700 text-slate-300 text-xs">
                    {verificationMessage}
                  </div>
                )}

                {summarySaved && (
                  <p className="mt-3 text-green-400 text-center text-sm font-medium">
                    Summary added to notes of "{selectedBook?.name}"
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

export default QuizWindow;