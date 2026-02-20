'use client'

import { useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("Frontend running");

  async function checkBackend() {
    setStatus("Checking backend...");
    const res = await fetch('/api/health');
    const data = await res.json();
    setStatus(`Backend says: ${data.message}`);
  }


  return (
    <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 800 }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1d324b' }}>AI Summary App</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <button 
          onClick={checkBackend}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded mb-4"
        >
          Check backend
        </button>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2' }}>Column 1</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2' }}>Column 2</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2' }}>Column 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Data 1</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Data 2</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Data 3</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Data 4</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Data 5</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Data 6</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div>
        <button 
          onClick={checkBackend}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded mb-4"
        >
          Check backend2
        </button>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2' }}>Column A</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2' }}>Column B</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2' }}>Column C</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Info 1</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Info 2</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Info 3</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Info 4</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Info 5</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Info 6</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <p style={{ marginTop: 12 }}>{status}</p>
    </div>
  );
}