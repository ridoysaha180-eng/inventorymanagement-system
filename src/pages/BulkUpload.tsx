import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Upload, FileUp, AlertCircle, CheckCircle } from 'lucide-react';
import { storageService } from '../services/storageService';

export const BulkUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadStatus('idle');
    }
  };

  const handleUpload = () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('idle');

    // Simulate bulk upload logic
    setTimeout(() => {
      // Typically we would parse a CSV or Excel file here.
      // For now, this is a placeholder indicating success.
      setIsUploading(false);
      setUploadStatus('success');
      setFile(null);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bulk Upload</h1>
          <p className="text-slate-500">Upload multiple products at once using a CSV file.</p>
        </div>
      </div>

      <Card>
        <div className="p-6 text-center max-w-xl mx-auto">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
              <Upload className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Upload Products CSV</h2>
          <p className="text-slate-500 mb-8 text-sm">Download the sample template, fill in your product details, and upload the file here.</p>

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 mb-6 relative group hover:border-blue-400 transition-colors">
            <input 
              type="file" 
              accept=".csv"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center gap-3">
              <FileUp className="w-8 h-8 text-slate-400 group-hover:text-blue-500 transition-colors" />
              {file ? (
                <div>
                  <p className="font-medium text-slate-700">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-slate-700"><span className="text-blue-500">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-slate-500 mt-1">CSV (Max 10MB)</p>
                </div>
              )}
            </div>
          </div>

          {uploadStatus === 'success' && (
            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg flex items-center gap-3 mb-6 text-left text-sm font-medium">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              Products uploaded successfully!
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3 mb-6 text-left text-sm font-medium">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              {errorMessage || 'Failed to upload products.'}
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <Button variant="outline" className="px-6 rounded-full border-slate-200" onClick={() => window.alert('Downloading template...')}>
              Download Template
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-full disabled:opacity-50"
              disabled={!file || isUploading}
              onClick={handleUpload}
            >
              {isUploading ? 'Uploading...' : 'Upload Data'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
