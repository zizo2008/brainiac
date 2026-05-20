import type * as pdfjsLib from 'pdfjs-dist';
import { Question } from '../types';

export interface ParserState {
  pageNum: number;
  currentExamIndex: number;
  isMarkScheme: boolean;
  currentQNum: number;
  markSchemes: Record<number, Record<number, string>>;
  examCodes: Record<number, string>;
  extractedQuestions: Question[];
  validQuestions: Question[];
  isParsing: boolean;
  isFinished: boolean;
}

export const createInitialParserState = (): ParserState => ({
  pageNum: 1,
  currentExamIndex: 0,
  isMarkScheme: false,
  currentQNum: 0,
  markSchemes: {},
  examCodes: {},
  extractedQuestions: [],
  validQuestions: [],
  isParsing: false,
  isFinished: false
});

export const parseMorePages = async (
  pdfDoc: pdfjsLib.PDFDocumentProxy, 
  parserState: ParserState, 
  targetNewQuestions: number, 
  timeoutMs?: number
): Promise<{ newValidCount: number, state: ParserState }> => {
  if (parserState.isParsing || parserState.isFinished) return { newValidCount: 0, state: parserState };
  parserState.isParsing = true;

  let newValidCount = 0;
  const startTime = Date.now();

  while (parserState.pageNum <= pdfDoc.numPages && newValidCount < targetNewQuestions) {
    if (timeoutMs && Date.now() - startTime > timeoutMs && parserState.validQuestions.length > 0) {
      break;
    }
    
    const batchSize = 3;
    const pagesToFetch = [];
    for (let i = 0; i < batchSize && parserState.pageNum + i <= pdfDoc.numPages; i++) {
      pagesToFetch.push(parserState.pageNum + i);
    }
    
    const pages = await Promise.all(pagesToFetch.map(p => pdfDoc.getPage(p)));
    const textContents = await Promise.all(pages.map(p => p.getTextContent()));

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageNum = pagesToFetch[pageIdx];
      const page = pages[pageIdx];
      const textContent = textContents[pageIdx];
      const textStr = textContent.items.map((i: any) => i.str).join(' ');

      const isCoverPage = textStr.includes('Multiple Choice') && 
                          (textStr.includes('45 minutes') || textStr.includes('INSTRUCTIONS') || textStr.includes('forty questions')) && 
                          !textStr.includes('MARK SCHEME') && 
                          !textStr.includes('Mark Scheme');
                          
      const isMSPage = textStr.includes('MARK SCHEME') || textStr.includes('Mark Scheme');

      if (isCoverPage) {
        if (parserState.isMarkScheme || parserState.currentExamIndex === 0) {
          parserState.currentExamIndex++;
          parserState.currentQNum = 0;
        }
        parserState.isMarkScheme = false;
      } else if (isMSPage) {
        parserState.isMarkScheme = true;
      }

      if (parserState.currentExamIndex > 0) {
        const examCodeMatch = textStr.match(/\b\d{4}\/\d{2}\/[A-Z]\/[A-Z]\/\d{2}\b/);
        if (examCodeMatch) {
          parserState.examCodes[parserState.currentExamIndex] = examCodeMatch[0];
        }
      }

      const viewport = page.getViewport({ scale: 2.0 });
      const mappedItems = textContent.items.map((item: any) => {
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        return { text: item.str.trim(), x, y, height: item.height };
      });

      if (parserState.isMarkScheme && parserState.currentExamIndex > 0) {
        const rowMap: Record<number, any[]> = {};
        mappedItems.forEach((item: any) => {
          if (item.text.length === 0) return;
          const y = Math.round(item.y / 10) * 10;
          if (!rowMap[y]) rowMap[y] = [];
          rowMap[y].push(item);
        });

        const sortedY = Object.keys(rowMap).map(Number).sort((a, b) => a - b);
        for (const y of sortedY) {
          const rowItems = rowMap[y].sort((a, b) => a.x - b.x);
          const rowText = rowItems.map(i => i.text);
          
          for (let i = 0; i < rowText.length - 1; i++) {
            const qNum = parseInt(rowText[i]);
            const ans = rowText[i+1];
            if (!isNaN(qNum) && qNum >= 1 && qNum <= 40 && qNum.toString() === rowText[i] && ['A', 'B', 'C', 'D'].includes(ans)) {
              if (!parserState.markSchemes[parserState.currentExamIndex]) {
                parserState.markSchemes[parserState.currentExamIndex] = {};
              }
              parserState.markSchemes[parserState.currentExamIndex][qNum] = ans;
            }
          }
        }

        const regex = /\b(\d{1,2})\s+([A-D])\b/g;
        let match;
        while ((match = regex.exec(textStr)) !== null) {
          const qNum = parseInt(match[1]);
          const ans = match[2];
          if (qNum >= 1 && qNum <= 40) {
            if (!parserState.markSchemes[parserState.currentExamIndex]) {
              parserState.markSchemes[parserState.currentExamIndex] = {};
            }
            if (!parserState.markSchemes[parserState.currentExamIndex][qNum]) {
              parserState.markSchemes[parserState.currentExamIndex][qNum] = ans;
            }
          }
        }
      } else if (!parserState.isMarkScheme && !isCoverPage && parserState.currentExamIndex > 0) {
        const validTextItems = mappedItems.filter(i => i.text.length > 0);
        if (validTextItems.length > 0) {
          const possibleQItems = validTextItems.filter(i => {
            const num = parseInt(i.text);
            return num >= 1 && num <= 40 && i.text === num.toString();
          });

          if (possibleQItems.length > 0) {
            const leftAlignedItems = possibleQItems.filter(i => i.x < 150);
            if (leftAlignedItems.length > 0) {
              const minX = Math.min(...leftAlignedItems.map(i => i.x));
              const qItems = leftAlignedItems.filter(i => i.x <= minX + 20);

              qItems.sort((a, b) => a.y - b.y);

              const uniqueQItems = [];
              for (const item of qItems) {
                if (uniqueQItems.length === 0 || item.y - uniqueQItems[uniqueQItems.length - 1].y > 20) {
                  uniqueQItems.push(item);
                }
              }

              const pageQItems = [];
              for (const item of uniqueQItems) {
                const num = parseInt(item.text);
                if (num > parserState.currentQNum && num <= parserState.currentQNum + 3) {
                  pageQItems.push(item);
                  parserState.currentQNum = num;
                }
              }

              for (let i = 0; i < pageQItems.length; i++) {
                const qItem = pageQItems[i];
                const qNumber = parseInt(qItem.text);
                const startY = Math.max(0, qItem.y - 20);
                
                let endY;
                if (i < pageQItems.length - 1) {
                  endY = pageQItems[i+1].y - 20;
                } else {
                  const footerItems = validTextItems.filter(item => 
                    item.y > qItem.y && 
                    (item.text.includes('UCLES') || 
                     item.text.includes('Cambridge') || 
                     item.text.toLowerCase().includes('turn over') ||
                     item.text.includes('BLANK PAGE'))
                  );
                  if (footerItems.length > 0) {
                    const minFooterY = Math.min(...footerItems.map(item => item.y));
                    endY = minFooterY - 20;
                  } else {
                    endY = viewport.height;
                  }
                }
                
                parserState.extractedQuestions.push({
                  examIndex: parserState.currentExamIndex,
                  examCode: parserState.examCodes[parserState.currentExamIndex],
                  qNumber,
                  pageIndex: pageNum,
                  startY,
                  endY
                });
              }
            }
          }
        }
      }

      const newlyValid: Question[] = [];
      const remainingExtracted: Question[] = [];
      for (const q of parserState.extractedQuestions) {
        const ans = parserState.markSchemes[q.examIndex]?.[q.qNumber];
        if (ans) {
          q.answer = ans;
          newlyValid.push(q);
        } else {
          remainingExtracted.push(q);
        }
      }
      
      parserState.extractedQuestions = remainingExtracted;
      
      if (newlyValid.length > 0) {
        parserState.validQuestions.push(...newlyValid);
        newValidCount += newlyValid.length;
      }
    }
    
    parserState.pageNum += batchSize;
    
    // Yield to main thread
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  if (parserState.pageNum > pdfDoc.numPages) {
    parserState.isFinished = true;
  }
  
  parserState.isParsing = false;
  return { newValidCount, state: parserState };
};

export const renderQuestionImage = async (pdfDoc: pdfjsLib.PDFDocumentProxy, q: Question): Promise<string | null> => {
  try {
    const page = await pdfDoc.getPage(q.pageIndex);
    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    const cropY = q.startY;
    const cropHeight = q.endY - q.startY;
    
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');
    if (!croppedCtx) return null;

    croppedCanvas.width = canvas.width;
    croppedCanvas.height = cropHeight;

    croppedCtx.drawImage(
      canvas,
      0, cropY, canvas.width, cropHeight,
      0, 0, canvas.width, cropHeight
    );

    // Trim whitespace and make white pixels transparent
    const imgData = croppedCtx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);
    const data = imgData.data;
    
    let topTrim = 0;
    let bottomTrim = croppedCanvas.height - 1;
    let leftTrim = 0;
    let rightTrim = croppedCanvas.width - 1;
    
    // Find top
    for (let y = 0; y < croppedCanvas.height; y++) {
      let isRowBlank = true;
      for (let x = 0; x < croppedCanvas.width; x++) {
        const index = (y * croppedCanvas.width + x) * 4;
        if (data[index + 3] > 0 && (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250)) {
          isRowBlank = false;
        } else {
          // Make white pixels transparent
          data[index + 3] = 0;
        }
      }
      if (!isRowBlank && topTrim === 0) {
        topTrim = y;
      }
    }
    
    // Find bottom
    for (let y = croppedCanvas.height - 1; y >= 0; y--) {
      let isRowBlank = true;
      for (let x = 0; x < croppedCanvas.width; x++) {
        const index = (y * croppedCanvas.width + x) * 4;
        if (data[index + 3] > 0 && (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250)) {
          isRowBlank = false;
          break;
        }
      }
      if (!isRowBlank) {
        bottomTrim = y;
        break;
      }
    }
    
    // Find left
    for (let x = 0; x < croppedCanvas.width; x++) {
      let isColBlank = true;
      for (let y = topTrim; y <= bottomTrim; y++) {
        const index = (y * croppedCanvas.width + x) * 4;
        if (data[index + 3] > 0 && (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250)) {
          isColBlank = false;
          break;
        }
      }
      if (!isColBlank) {
        leftTrim = x;
        break;
      }
    }
    
    // Find right
    for (let x = croppedCanvas.width - 1; x >= 0; x--) {
      let isColBlank = true;
      for (let y = topTrim; y <= bottomTrim; y++) {
        const index = (y * croppedCanvas.width + x) * 4;
        if (data[index + 3] > 0 && (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250)) {
          isColBlank = false;
          break;
        }
      }
      if (!isColBlank) {
        rightTrim = x;
        break;
      }
    }

    // Apply transparency to the rest of the image
    for (let y = topTrim; y <= bottomTrim; y++) {
      for (let x = leftTrim; x <= rightTrim; x++) {
        const index = (y * croppedCanvas.width + x) * 4;
        if (data[index] >= 250 && data[index + 1] >= 250 && data[index + 2] >= 250) {
          data[index + 3] = 0;
        }
      }
    }

    croppedCtx.putImageData(imgData, 0, 0);
    
    // Add a little padding
    const padding = 20;
    topTrim = Math.max(0, topTrim - padding);
    bottomTrim = Math.min(croppedCanvas.height - 1, bottomTrim + padding);
    leftTrim = Math.max(0, leftTrim - padding);
    rightTrim = Math.min(croppedCanvas.width - 1, rightTrim + padding);
    
    const trimWidth = rightTrim - leftTrim + 1;
    const trimHeight = bottomTrim - topTrim + 1;
    
    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) return null;
    
    finalCanvas.width = trimWidth;
    finalCanvas.height = trimHeight;
    // Do not fill with white to keep it transparent
    finalCtx.drawImage(
      croppedCanvas, 
      leftTrim, topTrim, trimWidth, trimHeight,
      0, 0, trimWidth, trimHeight
    );
    
    return finalCanvas.toDataURL('image/png'); // Use PNG for transparency
  } catch (err) {
    console.error('Error rendering question image:', err);
    return null;
  }
};
