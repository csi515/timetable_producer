import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { TimetableData } from '../types';

interface PDFExportOptions {
  title?: string;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'a3' | 'letter';
  margin?: number;
  scale?: number;
}

export class PDFExporter {
  private static async captureElement(element: HTMLElement, options: PDFExportOptions = {}) {
    const { scale = 2 } = options;
    
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight
    });
    
    return canvas;
  }

  private static async captureMultipleElements(elements: HTMLElement[], options: PDFExportOptions = {}) {
    const canvases = await Promise.all(
      elements.map(element => this.captureElement(element, options))
    );
    
    return canvases;
  }

  static async exportTimetableAsPDF(
    timetableElement: HTMLElement,
    data: TimetableData,
    options: PDFExportOptions = {}
  ) {
    const {
      title = '시간표',
      orientation = 'landscape',
      format = 'a4',
      margin = 10,
      scale = 1.5
    } = options;

    try {
      // PDF 문서 생성
      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format
      });

      // 제목 페이지 추가
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, pdf.internal.pageSize.width / 2, 30, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`생성일: ${new Date().toLocaleDateString('ko-KR')}`, pdf.internal.pageSize.width / 2, 45, { align: 'center' });
      pdf.text(`총 학급: ${Object.keys(data.schedule).length}개`, pdf.internal.pageSize.width / 2, 55, { align: 'center' });
      pdf.text(`총 교사: ${data.teachers.length}명`, pdf.internal.pageSize.width / 2, 65, { align: 'center' });

      // 시간표 캡처
      const canvas = await this.captureElement(timetableElement, { scale });
      
      // 캔버스를 PDF에 추가
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pdf.internal.pageSize.width - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = margin;

      // 첫 페이지에 이미지 추가
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pdf.internal.pageSize.height - (margin * 2));

      // 추가 페이지가 필요한 경우
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pdf.internal.pageSize.height - (margin * 2));
      }

      // PDF 저장
      const fileName = `timetable_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);

      return { success: true, fileName };
    } catch (error) {
      console.error('PDF 내보내기 실패:', error);
      return { success: false, error: error.message };
    }
  }

  static async exportMultipleTimetablesAsPDF(
    elements: { element: HTMLElement; title: string }[],
    data: TimetableData,
    options: PDFExportOptions = {}
  ) {
    const {
      orientation = 'landscape',
      format = 'a4',
      margin = 10,
      scale = 1.5
    } = options;

    try {
      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format
      });

      // 목차 페이지 추가
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('시간표 목차', pdf.internal.pageSize.width / 2, 30, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      elements.forEach((item, index) => {
        pdf.text(`${index + 1}. ${item.title}`, 20, 50 + (index * 10));
      });

      // 각 시간표를 별도 페이지로 추가
      for (let i = 0; i < elements.length; i++) {
        const { element, title } = elements[i];
        
        if (i > 0) {
          pdf.addPage();
        }

        // 페이지 제목
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, pdf.internal.pageSize.width / 2, 20, { align: 'center' });

        // 시간표 캡처
        const canvas = await this.captureElement(element, { scale });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pdf.internal.pageSize.width - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 30; // 제목 아래 여백

        // 첫 페이지에 이미지 추가
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pdf.internal.pageSize.height - (margin * 2) - 30);

        // 추가 페이지가 필요한 경우
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight + margin;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
          heightLeft -= (pdf.internal.pageSize.height - (margin * 2));
        }
      }

      // PDF 저장
      const fileName = `timetables_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);

      return { success: true, fileName };
    } catch (error) {
      console.error('PDF 내보내기 실패:', error);
      return { success: false, error: error.message };
    }
  }

  static async exportTimetableAsImage(
    timetableElement: HTMLElement,
    options: { format?: 'png' | 'jpeg'; quality?: number; scale?: number } = {}
  ) {
    const { format = 'png', quality = 0.9, scale = 2 } = options;

    try {
      const canvas = await this.captureElement(timetableElement, { scale });
      const dataUrl = canvas.toDataURL(`image/${format}`, quality);
      
      // 이미지 다운로드
      const link = document.createElement('a');
      link.download = `timetable_${new Date().toISOString().slice(0, 10)}.${format}`;
      link.href = dataUrl;
      link.click();

      return { success: true, dataUrl };
    } catch (error) {
      console.error('이미지 내보내기 실패:', error);
      return { success: false, error: error.message };
    }
  }
}

// 편의 함수들
export const exportTeacherTimetablePDF = async (
  element: HTMLElement,
  data: TimetableData
) => {
  return PDFExporter.exportTimetableAsPDF(element, data, {
    title: '교사별 시간표',
    orientation: 'landscape'
  });
};

export const exportClassTimetablePDF = async (
  element: HTMLElement,
  data: TimetableData
) => {
  return PDFExporter.exportTimetableAsPDF(element, data, {
    title: '학급별 시간표',
    orientation: 'landscape'
  });
};

export const exportAllTimetablesPDF = async (
  teacherElement: HTMLElement,
  classElement: HTMLElement,
  data: TimetableData
) => {
  return PDFExporter.exportMultipleTimetablesAsPDF([
    { element: teacherElement, title: '교사별 시간표' },
    { element: classElement, title: '학급별 시간표' }
  ], data);
};