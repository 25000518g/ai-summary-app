'use client'

import { useState, useEffect } from "react";

type ViewerTab = 'pdf' | 'text' | 'summary';

let pdfjs: any;

export default function Home() {
  const [status, setStatus] = useState("No file uploaded");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewerTab>('pdf');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Initialize pdfjs for text extraction only
  useEffect(() => {
    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjs = pdfjsLib.default;
        // Configure worker for text extraction
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
      } catch (error) {
        console.error('Failed to initialize PDF.js for extraction:', error);
      }
    })();
  }, []);

  // Cleanup Blob URL when component unmounts or PDF changes
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  async function extractText() {
    if (!selectedPdf) {
      setExtractError("Please select a file first");
      return;
    }

    setIsExtracting(true);
    setExtractError(null);

    try {
      if (selectedPdf.type === 'application/pdf') {
        // Client-side PDF text extraction using pdfjs-dist
        if (!pdfjs) {
          throw new Error('PDF library not loaded yet, please wait');
        }

        const buffer = await selectedPdf.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buffer }).promise;
        let extractedTextContent = '';

        // Extract text from each page
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          extractedTextContent += `\n--- Page ${pageNum} ---\n${pageText}`;
        }

        setExtractedText(extractedTextContent.trim());
        setStatus(`Text extracted: ${pdf.numPages} pages`);
        setActiveTab('text');
      } else if (selectedPdf.type === 'text/plain') {
        // Simple text file extraction
        const text = await selectedPdf.text();
        setExtractedText(text);
        setStatus(`Text extracted from ${selectedPdf.name}`);
        setActiveTab('text');
      } else {
        throw new Error('Unsupported file type');
      }
    } catch (error: any) {
      setExtractError(error.message);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsExtracting(false);
    }
  }

  async function generateSummary() {
    if (!extractedText) {
      setSummaryError("Please extract text first");
      return;
    }

    setIsSummarizing(true);
    setSummaryError(null);

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: extractedText,
          fileName: selectedPdf?.name,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate summary');
      }

      const data = await response.json();
      setSummary(data.summary);
      setStatus("Summary generated");
      setActiveTab('summary');
    } catch (error: any) {
      setSummaryError(error.message);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsSummarizing(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) {
      setStatus("No file selected");
      return;
    }

    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = file.type;
      const fileName = file.name;

      // Validate file type
      if (fileType === 'text/plain' || fileType === 'application/pdf') {
        newFiles.push(file);
        
        // Upload to Supabase
        try {
          const formData = new FormData();
          formData.append('file', file);
          
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();

          if (response.ok) {
            setStatus(`✅ Uploaded: ${fileName} to Supabase`);
          } else if (response.status === 511) {
            // Supabase not configured - file is stored locally only
            setStatus(`⚠️ Uploaded locally: ${fileName} (Supabase not configured)`);
            console.log('Supabase message:', data.message);
          } else {
            setStatus(`❌ Failed to upload ${fileName}: ${data.error}`);
          }
        } catch (error: any) {
          setStatus(`❌ Upload error: ${error.message}`);
        }
      } else {
        setStatus(`Invalid file type: ${fileName}. Please upload .txt or .pdf files only.`);
      }
    }

    if (newFiles.length > 0) {
      setUploadedFiles([...uploadedFiles, ...newFiles]);
    }
  }

  function removeFile(index: number) {
    const updatedFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updatedFiles);
    if (selectedPdf === uploadedFiles[index]) {
      setSelectedPdf(null);
      setPdfUrl(null);
      setPageNumber(1);
      setNumPages(null);
    }
    setStatus(updatedFiles.length === 0 ? "No files uploaded" : `${updatedFiles.length} file(s) uploaded`);
  }

  function selectPdfFile(file: File) {
    if (file.type === 'application/pdf') {
      setSelectedPdf(file);
      // Create a Blob URL from the File object
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setPageNumber(1);
      setNumPages(null);
      setStatus(`Viewing: ${file.name}`);
      // Clear previous extractions when selecting a new file
      setExtractedText(null);
      setSummary(null);
      setExtractError(null);
      setSummaryError(null);
      setActiveTab('pdf');
    } else {
      setStatus("Please select a PDF file to view");
    }
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 24, minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1d324b' }}>AI Summary App</h1>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#1d324b' }}>UploadDocument</h1>
      
      <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 200px)' }}>
        {/* Left Panel - Upload and File List */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '1rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Upload Files (TXT or PDF):
              </label>
              <input
                type="file"
                multiple
                accept=".txt,.pdf"
                onChange={handleFileUpload}
                style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
              />
            </div>

            {uploadedFiles.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f2f2f2' }}>File Name</th>
                    <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f2f2f2' }}>File Type</th>
                    <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f2f2f2' }}>Size (KB)</th>
                    <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f2f2f2' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedFiles.map((file, index) => (
                    <tr key={index}>
                      <td 
                        style={{ 
                          border: '1px solid #ddd', 
                          padding: '10px',
                          cursor: file.type === 'application/pdf' ? 'pointer' : 'default',
                          backgroundColor: selectedPdf === file ? '#e3f2fd' : 'white',
                          fontWeight: selectedPdf === file ? 'bold' : 'normal'
                        }}
                        onClick={() => selectPdfFile(file)}
                      >
                        {file.name}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '10px' }}>{file.type === 'text/plain' ? 'TXT' : 'PDF'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '10px' }}>{(file.size / 1024).toFixed(2)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '10px' }}>
                        <button
                          onClick={() => removeFile(index)}
                          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded text-sm"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <p style={{ marginTop: 12, fontWeight: 500 }}>{status}</p>
        </div>

        {/* Right Panel - Document Viewer with Tabs */}
        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', backgroundColor: '#f9f9f9', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1d324b' }}>Document Viewer</h2>
          
          {selectedPdf ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem' }}>
                <button
                  onClick={() => setActiveTab('pdf')}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    backgroundColor: activeTab === 'pdf' ? '#0070f3' : '#e0e0e0',
                    color: activeTab === 'pdf' ? 'white' : '#333',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: activeTab === 'pdf' ? 'bold' : 'normal',
                  }}
                >
                  📄 PDF
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  disabled={!extractedText}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    backgroundColor: activeTab === 'text' ? '#0070f3' : (extractedText ? '#e0e0e0' : '#f0f0f0'),
                    color: activeTab === 'text' ? 'white' : (extractedText ? '#333' : '#999'),
                    borderRadius: '4px',
                    cursor: extractedText ? 'pointer' : 'not-allowed',
                    fontWeight: activeTab === 'text' ? 'bold' : 'normal',
                  }}
                >
                  📝 Text {extractedText ? '✓' : ''}
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  disabled={!summary}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    backgroundColor: activeTab === 'summary' ? '#0070f3' : (summary ? '#e0e0e0' : '#f0f0f0'),
                    color: activeTab === 'summary' ? 'white' : (summary ? '#333' : '#999'),
                    borderRadius: '4px',
                    cursor: summary ? 'pointer' : 'not-allowed',
                    fontWeight: activeTab === 'summary' ? 'bold' : 'normal',
                  }}
                >
                  ✨ Summary {summary ? '✓' : ''}
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button
                  onClick={extractText}
                  disabled={isExtracting || !selectedPdf}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-1 px-3 rounded text-sm"
                  style={{ cursor: isExtracting || !selectedPdf ? 'not-allowed' : 'pointer' }}
                >
                  {isExtracting ? '⏳ Extracting...' : '📤 Extract Text'}
                </button>
                <button
                  onClick={generateSummary}
                  disabled={isSummarizing || !extractedText}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-1 px-3 rounded text-sm"
                  style={{ cursor: isSummarizing || !extractedText ? 'not-allowed' : 'pointer' }}
                >
                  {isSummarizing ? '⏳ Summarizing...' : '✨ Generate Summary'}
                </button>
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: 'white', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                {/* PDF Viewer Tab */}
                {activeTab === 'pdf' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {pdfUrl ? (
                      <iframe
                        src={pdfUrl}
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          borderRadius: '4px',
                        }}
                        title="PDF Viewer"
                      />
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.875rem' }}>
                        No PDF selected
                      </div>
                    )}
                  </div>
                )}

                {/* Extracted Text Tab */}
                {activeTab === 'text' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {extractError && (
                      <div style={{ padding: '0.75rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        ❌ {extractError}
                      </div>
                    )}
                    {extractedText ? (
                      <div style={{ flex: 1, whiteSpace: 'pre-wrap', wordWrap: 'break-word', lineHeight: '1.6', fontSize: '0.875rem', color: '#333' }}>
                        {extractedText}
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.875rem' }}>
                        Click "Extract Text" to view extracted content
                      </div>
                    )}
                  </div>
                )}

                {/* Summary Tab */}
                {activeTab === 'summary' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {summaryError && (
                      <div style={{ padding: '0.75rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        ❌ {summaryError}
                      </div>
                    )}
                    {summary ? (
                      <div style={{ flex: 1, whiteSpace: 'pre-wrap', wordWrap: 'break-word', lineHeight: '1.6', fontSize: '0.875rem', color: '#333' }}>
                        {summary}
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.875rem' }}>
                        Click "Generate Summary" to view AI-generated summary
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.875rem' }}>
              Click on a PDF file to view it here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}