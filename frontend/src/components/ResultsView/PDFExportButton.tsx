import { useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PDFExportButtonProps {
  elementId: string;
  filename: string;
  className?: string;
}

export function PDFExportButton({ elementId, filename, className }: PDFExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const element = document.getElementById(elementId);
      if (!element) throw new Error('Target element not found');

      // Add a class temporarily for PDF styling if needed
      element.classList.add('pdf-export-mode');

      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality
        useCORS: true,
        backgroundColor: '#0a0d12', // Sybil background color
        windowWidth: 1200, // Force a good width
      });

      element.classList.remove('pdf-export-mode');

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      // Calculate PDF dimensions (A4 size)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let position = 0;
      let remainingHeight = pdfHeight;
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Add first page
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      remainingHeight -= pageHeight;

      // Add subsequent pages if content overflows
      while (remainingHeight > 0) {
        position = position - pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        remainingHeight -= pageHeight;
      }

      pdf.save(filename);
    } catch (error) {
      console.error('PDF Export failed:', error);
      alert('Failed to generate PDF report.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className={`btn-secondary text-sm flex items-center gap-2 ${className || ''}`}
    >
      {isExporting ? (
        <>
          <div className="w-4 h-4 border-2 border-sybil-accent/20 border-t-sybil-accent rounded-full animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <span>↓</span> Export PDF
        </>
      )}
    </button>
  );
}
