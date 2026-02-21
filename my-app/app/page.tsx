'use client'

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamically import react-pdf components only on client side
const Document = dynamic(
  () => import('react-pdf').then(mod => mod.Document),
  { ssr: false, loading: () => <div>Loading PDF...</div> }
);

const Page = dynamic(
  () => import('react-pdf').then(mod => mod.Page),
  { ssr: false }
);

let pdfjs: any;

export default function Home() {
  const [status, setStatus] = useState("No file uploaded");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  // Initialize pdfjs worker on client side
  useEffect(() => {
    (async () => {
      const pdfModule = await import('react-pdf');
      pdfjs = pdfModule.pdfjs;
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfModule.pdfjs.version}/pdf.worker.min.js`;
    })();
  }, []);

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
        setStatus(`Uploaded: ${fileName}`);
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
      setPageNumber(1);
      setNumPages(null);
    }
    setStatus(updatedFiles.length === 0 ? "No files uploaded" : `${updatedFiles.length} file(s) uploaded`);
  }

  function selectPdfFile(file: File) {
    if (file.type === 'application/pdf') {
      setSelectedPdf(file);
      setPageNumber(1);
      setNumPages(null);
      setStatus(`Viewing: ${file.name}`);
    } else {
      setStatus("Please select a PDF file to view");
    }
  }

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
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

        {/* Right Panel - PDF Viewer */}
        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', backgroundColor: '#f9f9f9', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1d324b' }}>PDF Viewer</h2>
          
          {selectedPdf ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
                <p style={{ margin: '0.5rem 0', fontSize: '0.875rem' }}>
                  <strong>File:</strong> {selectedPdf.name}
                </p>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: 'white', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Document 
                  file={selectedPdf} 
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={<div style={{ padding: '1rem' }}>Loading PDF...</div>}
                  error={<div style={{ padding: '1rem', color: 'red' }}>Error loading PDF</div>}
                >
                  <Page pageNumber={pageNumber} width={300} />
                </Document>
              </div>

              {numPages && (
                <div style={{ marginTop: '1rem', padding: '1rem', borderTop: '1px solid #ddd', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                  <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', textAlign: 'center' }}>
                    Page {pageNumber} of {numPages}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button
                      onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                      disabled={pageNumber <= 1}
                      className="bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 text-white font-semibold py-1 px-3 rounded text-sm"
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                      disabled={pageNumber >= numPages}
                      className="bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 text-white font-semibold py-1 px-3 rounded text-sm"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
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