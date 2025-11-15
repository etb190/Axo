import Navbar from './Navbar'
import React, { useState, useEffect } from 'react';
const fs = require('fs').promises;
const path = require('path');

// Hardcoded file path (modify to your desired location)
const DATA_FILE_PATH = 'C:/Users/etb19/Documents/file/data.json';
const Dayplanner = () => {
    const [input, setInput] = useState('');
  const [savedData, setSavedData] = useState(null);
  const [message, setMessage] = useState('');

  // Ensure the directory exists
  const ensureDirectory = async () => {
    const dir = path.dirname(DATA_FILE_PATH);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error('Error creating directory:', error);
      setMessage(`Error creating directory: ${error.message}`);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        await ensureDirectory();
        const data = await fs.readFile(DATA_FILE_PATH, 'utf-8');
        setSavedData(JSON.parse(data));
      } catch (error) {
        if (error.code === 'ENOENT') {
          setSavedData(null); // File doesn't exist
        } else {
          setMessage(`Error fetching data: ${error.message}`);
        }
      }
    };
    fetchData();
  }, []);

  // Handle save button click
  const handleSave = async () => {
    try {
      await ensureDirectory();
      const data = { content: input };
      await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2));
      setSavedData(data);
      setMessage('Data saved successfully!');
    } catch (error) {
      setMessage(`Error saving data: ${error.message}`);
    }
  };
    return(
        <>
        <div>
            <Navbar />
            
        </div>
       <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Data Manager</h1>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter data to save"
        className="border p-2 mb-4 w-full"
      />
      <button
        onClick={handleSave}
        className="bg-blue-500 text-white p-2 rounded"
      >
        Save Data
      </button>
      <div className="mt-4">
        <h2 className="text-xl font-semibold">Saved Data:</h2>
        <pre>{JSON.stringify(savedData, null, 2)}</pre>
      </div>
      {message && <p className="mt-4 text-red-500">{message}</p>}
    </div>
        </>

    )
}
export default Dayplanner