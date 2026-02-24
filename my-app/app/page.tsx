'use client'

import { useState, useEffect } from "react";

type ViewerTab = 'pdf' | 'text' | 'summary';

interface SupabaseFile {
  name: string;
  size: number;
  created_at: string;
  publicUrl: string;
}

let pdfjs: any;

export default function Home() {
  const [status, setStatus] = useState("Loading files...");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [supabaseFiles, setSupabaseFiles] = useState<SupabaseFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isPdfReady, setIsPdfReady] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
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
        // pdfjs-dist exports the pdf object directly, not as default
        pdfjs = pdfjsLib.default || pdfjsLib;
        
        // Handle both module formats
        if (!pdfjs || !pdfjs.getDocument) {
          // Try to access the pdf property if it exists
          pdfjs = pdfjsLib.pdf || pdfjsLib;
        }
        
        if (!pdfjs || !pdfjs.GlobalWorkerOptions) {
          throw new Error('PDF.js module structure not recognized');
        }
        
        // Configure worker for text extraction - use local worker from public directory
        // This avoids CDN issues and provides more reliable PDF processing
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        setIsPdfReady(true);
      } catch (error) {
        console.error('Failed to initialize PDF.js for extraction:', error);
        setIsPdfReady(false);
      }
    })();
  }, []);

  // Fetch files from Supabase on mount
  const loadSupabaseFiles = async () => {
    try {
      const response = await fetch('/api/list-files');
      const data = await response.json();
      
      if (data.files) {
        setSupabaseFiles(data.files);
        setStatus(`📁 ${data.files.length + uploadedFiles.length} total files`);
      } else {
        setStatus('No files found in Supabase');
      }
    } catch (error: any) {
      console.error('Failed to fetch files:', error);
      setStatus('Failed to load files from Supabase');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    loadSupabaseFiles();
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
        // Wait for PDF.js to be ready (max 5 seconds)
        let retries = 50; // 50 * 100ms = 5 seconds
        while (!pdfjs && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries--;
        }

        if (!pdfjs) {
          throw new Error('PDF library failed to load. Please refresh the page and try again.');
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
    setStatus(updatedFiles.length === 0 && supabaseFiles.length === 0 ? "No files" : `${updatedFiles.length + supabaseFiles.length} total files`);
  }

  async function deleteSupabaseFile(fileName: string) {
    if (!confirm(`Are you sure you want to delete "${fileName}" from Supabase?`)) {
      return;
    }

    try {
      setStatus(`Deleting ${fileName}...`);
      const response = await fetch('/api/delete-file', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`✅ Deleted: ${fileName}`);
        // Remove from UI
        setSupabaseFiles(supabaseFiles.filter((f) => f.name !== fileName));
        // Clear viewer if deleted file is selected
        if (selectedFileName === fileName) {
          setSelectedPdf(null);
          setSelectedFileName(null);
          setPdfUrl(null);
          setExtractedText(null);
          setSummary(null);
          setPageNumber(1);
          setNumPages(null);
        }
        await loadSupabaseFiles();
      } else {
        setStatus(`❌ Failed to delete: ${data.error}`);
      }
    } catch (error: any) {
      setStatus(`❌ Delete error: ${error.message}`);
    }
  }

  async function selectSupabaseFile(file: SupabaseFile) {
    try {
      setStatus(`Loading: ${file.name}...`);
      
      // Fetch the file from Supabase
      const response = await fetch(file.publicUrl);
      if (!response.ok) throw new Error('Failed to fetch file');
      
      const blob = await response.blob();
      const fileName = file.name;
      
      // Determine MIME type based on file extension
      let mimeType = 'application/octet-stream';
      if (fileName.endsWith('.pdf')) {
        mimeType = 'application/pdf';
      } else if (fileName.endsWith('.txt')) {
        mimeType = 'text/plain';
      }
      
      // Create a File object from the blob
      const fileObj = new File([blob], fileName, { type: mimeType });
      
      setSelectedPdf(fileObj);
      setSelectedFileName(file.name);
      
      if (mimeType === 'application/pdf') {
        // Create object URL for PDF preview
        const url = URL.createObjectURL(fileObj);
        setPdfUrl(url);
        setActiveTab('pdf');
      } else {
        setPdfUrl(null);
        // For TXT files, extract text immediately
        const text = await fileObj.text();
        setExtractedText(text);
        setActiveTab('text');
      }
      
      setPageNumber(1);
      setNumPages(null);
      setStatus(`Viewing: ${fileName}`);
      setSummary(null);
      setExtractError(null);
      setSummaryError(null);
    } catch (error: any) {
      setStatus(`Error loading file: ${error.message}`);
      setExtractError(error.message);
    }
  }

  function selectPdfFile(file: File) {
    if (file.type === 'application/pdf') {
      setSelectedPdf(file);
      setSelectedFileName(file.name);
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
    <div style={{ fontFamily: "system-ui", padding: 24, minHeight: '100vh', backgroundColor: 'white', color: 'black' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1d324b' }}>AI Summary App</h1>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#1d324b' }}>UploadDocument</h1>
      
      <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 200px)' }}>
        {/* Left Panel - Upload and File List */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '1rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'black' }}>
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

            {/* Combined Files Section */}
            {isLoadingFiles ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'black' }}>⏳ Loading files from Supabase...</div>
            ) : supabaseFiles.length > 0 || uploadedFiles.length > 0 ? (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'black', textTransform: 'uppercase' }}>
                  📁 All Files ({supabaseFiles.length + uploadedFiles.length})
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#e3f2fd', color: 'black' }}>File Name</th>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#e3f2fd', color: 'black' }}>Type</th>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#e3f2fd', color: 'black' }}>Size (KB)</th>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#e3f2fd', color: 'black' }}>Location</th>
                      <th style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#e3f2fd', color: 'black' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Supabase Files */}
                    {supabaseFiles.map((file) => (
                      <tr
                        key={`supabase-${file.name}`}
                        onClick={() => selectSupabaseFile(file)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selectedFileName === file.name ? '#bbdefb' : 'white',
                          fontWeight: selectedFileName === file.name ? 'bold' : 'normal',
                          borderLeft: selectedFileName === file.name ? '3px solid #0070f3' : '3px solid transparent',
                          color: 'black',
                        }}
                      >
                        <td style={{ border: '1px solid #ddd', padding: '10px', wordBreak: 'break-word', color: 'black' }}>
                          {file.name.includes('.pdf') ? '📄' : '📝'} {file.name}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '10px', color: 'black' }}>{file.name.includes('.pdf') ? 'PDF' : 'TXT'}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px', color: 'black' }}>{(file.size / 1024).toFixed(2)}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px', color: '#0070f3', fontWeight: 500 }}>☁️ Supabase</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSupabaseFile(file.name);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Local Files */}
                    {uploadedFiles.map((file, index) => (
                      <tr
                        key={`local-${index}`}
                        onClick={() => selectPdfFile(file)}
                        style={{
                          cursor: file.type === 'application/pdf' ? 'pointer' : 'default',
                          backgroundColor: selectedPdf === file ? '#e3f2fd' : 'white',
                          fontWeight: selectedPdf === file ? 'bold' : 'normal',
                          borderLeft: selectedPdf === file ? '3px solid #0070f3' : '3px solid transparent',
                          color: 'black',
                        }}
                      >
                        <td style={{ border: '1px solid #ddd', padding: '10px', wordBreak: 'break-word', color: 'black' }}>
                          {file.type === 'application/pdf' ? '📄' : '📝'} {file.name}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '10px', color: 'black' }}>{file.type === 'text/plain' ? 'TXT' : 'PDF'}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px', color: 'black' }}>{(file.size / 1024).toFixed(2)}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px', color: '#666', fontWeight: 500 }}>📤 Local</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(index);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded text-sm"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'black' }}>No files uploaded yet</div>
            )}
          </div>
          
          <p style={{ marginTop: 12, fontWeight: 500, color: 'black' }}>{status}</p>
        </div>

        {/* Right Panel - Document Viewer with Tabs */}
        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', backgroundColor: 'white', display: 'flex', flexDirection: 'column', color: 'black', height: 'calc(100vh - 200px)', minHeight: 0 }}>
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
                    color: activeTab === 'pdf' ? 'white' : 'black',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: activeTab === 'pdf' ? 'bold' : 'normal',
                  }}
                >
                  📄 PDF
                </button>
                <button
                  onClick={async () => {
                    if (!selectedPdf) {
                      setExtractError("Please select a file first");
                      return;
                    }
                    await extractText();
                  }}
                  disabled={isExtracting || !selectedPdf}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    backgroundColor: activeTab === 'text' ? '#0070f3' : '#e0e0e0',
                    color: activeTab === 'text' ? 'white' : 'black',
                    borderRadius: '4px',
                    cursor: isExtracting || !selectedPdf ? 'not-allowed' : 'pointer',
                    fontWeight: activeTab === 'text' ? 'bold' : 'normal',
                  }}
                >
                  {isExtracting ? '⏳ Extracting...' : '📝 Text'} {extractedText ? '✓' : ''}
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  disabled={!summary}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    backgroundColor: activeTab === 'summary' ? '#0070f3' : (summary ? '#e0e0e0' : '#f0f0f0'),
                    color: activeTab === 'summary' ? 'white' : (summary ? 'black' : '#999'),
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
                  onClick={generateSummary}
                  disabled={isSummarizing || !extractedText}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-1 px-3 rounded text-sm"
                  style={{ cursor: isSummarizing || !extractedText ? 'not-allowed' : 'pointer' }}
                >
                  {isSummarizing ? '⏳ Summarizing...' : '✨ Generate Summary'}
                </button>
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: 'green', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
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
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'orange', fontSize: '0.875rem' }}>
                        No PDF selected
                      </div>
                    )}
                  </div>
                )}
                 {/* Extracted Text Tab */}
                {activeTab === 'text' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
                    {extractError && (
                      <div style={{ padding: '0.75rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        ❌ {extractError}
                      </div>
                    )}
                    <iframe
                      title="Extracted Text"
                      style={{
                        flex: 1,
                        minHeight: 0,
                        height: '100%',
                        width: '100%',
                        border: '1px solid #eee',
                        borderRadius: '4px',
                        background: 'white',
                        marginBottom: 0
                      }}
                      srcDoc={`<html><body style='margin:0;padding:1rem;font-family:sans-serif;white-space:pre-wrap;font-size:14px;background:white;color:black;'>${
                        extractedText
                          ? extractedText.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
                          : (selectedFile && selectedFile.type === 'application/pdf'
                              ? (isExtracting ? 'Extracting text...' : 'No text extracted yet.')
                              : (selectedFile ? 'No text extracted yet.' : 'No file selected.'))
                      }</body></html>`}
                    />
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
                      <div style={{ flex: 1, whiteSpace: 'pre-wrap', wordWrap: 'break-word', lineHeight: '1.6', fontSize: '0.875rem', color: 'black' }}>
                        {summary}
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontSize: '0.875rem' }}>
                        Click "Generate Summary" to view AI-generated summary
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontSize: '0.875rem' }}>
              Click on a PDF file to view it here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}