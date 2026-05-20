import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const subjects = [
  { subj: 'chemistry', lvl: 'core', file: 'chemcr' },
  { subj: 'chemistry', lvl: 'extended', file: 'chem' },
  { subj: 'chemistry', lvl: 'a_level', file: 'chemal' },
  { subj: 'physics', lvl: 'core', file: 'phycr' },
  { subj: 'physics', lvl: 'extended', file: 'phy' },
  { subj: 'physics', lvl: 'a_level', file: 'phyal' },
  { subj: 'biology', lvl: 'core', file: 'biocr' },
  { subj: 'biology', lvl: 'extended', file: 'bio' },
  { subj: 'biology', lvl: 'a_level', file: 'bioal' },
  { subj: 'economics', lvl: 'extended', file: 'econ' },
  { subj: 'economics', lvl: 'a_level', file: 'econal' },
  { subj: 'accounting', lvl: 'extended', file: 'accol' },
  { subj: 'accounting', lvl: 'a_level', file: 'accal' }
];

const isQuestionValid = (subject, text) => {
  const lowerText = text.toLowerCase();
  
  if (subject === 'physics') {
    if (lowerText.includes('and gate') || lowerText.includes('or gate') || lowerText.includes('not gate') || lowerText.includes('nand') || lowerText.includes('nor') || lowerText.includes('truth table') || lowerText.includes('logic circuit')) {
      return false;
    }
    if (lowerText.includes('mercury barometer') || (lowerText.includes('atmospheric pressure') && lowerText.includes('mercury column'))) {
      return false;
    }
    if (lowerText.includes('u-tube manometer') || lowerText.includes('liquid height difference') || (lowerText.includes('gas pressure') && lowerText.includes('liquid column'))) {
      return false;
    }
    if (lowerText.includes('specific latent heat') || lowerText.includes('latent heat of fusion') || lowerText.includes('latent heat of vaporisation')) {
      return false;
    }
    if ((lowerText.includes('thermal capacity') || lowerText.includes('heat capacity')) && !lowerText.includes('specific heat capacity') && !lowerText.includes('specific thermal capacity')) {
      return false;
    }
    if (lowerText.includes('thermometer') && (lowerText.includes('clinical') || lowerText.includes('mercury-in-glass') || lowerText.includes('sensitivity') || lowerText.includes('linearity'))) {
      if (!lowerText.includes('thermocouple')) {
        return false;
      }
    }
  } else if (subject === 'chemistry') {
    if (lowerText.includes('aluminium') && (lowerText.includes('bauxite') || lowerText.includes('cryolite') || lowerText.includes('hall-heroult') || lowerText.includes('electrolysis of ore'))) {
      return false;
    }
    if (lowerText.includes('zinc blende') || lowerText.includes('calamine') || lowerText.includes('extraction of zinc') || lowerText.includes('roasting zinc ore')) {
      return false;
    }
    if (lowerText.includes('sulfur') || lowerText.includes('sulphur')) {
      if (lowerText.includes('food preservative') || lowerText.includes('wine') || lowerText.includes('sources of sulfur') || lowerText.includes('sources of sulphur')) {
        if (!lowerText.includes('contact process') && !lowerText.includes('sulfuric acid') && !lowerText.includes('sulphuric acid')) {
          return false;
        }
      }
    }
    if ((lowerText.includes('carbohydrates') || lowerText.includes('proteins')) && (lowerText.includes('hydrolysis') || lowerText.includes('natural macromolecules') || lowerText.includes('complex structures'))) {
      if (!lowerText.includes('synthetic polymers')) {
        return false;
      }
    }
    if ((lowerText.includes('limestone') || lowerText.includes('lime') || lowerText.includes('calcium carbonate')) && (lowerText.includes('soil acidity') || lowerText.includes('farming') || lowerText.includes('manufacture of cement'))) {
      return false;
    }
    if (lowerText.includes('silver bromide') || lowerText.includes('silver chloride') || lowerText.includes('light sensitivity in photography')) {
      return false;
    }
    if (lowerText.includes('brownian motion')) {
      return false;
    }
  } else if (subject === 'biology') {
    if (lowerText.includes('kidney') && (lowerText.includes('dialysis') || lowerText.includes('transplant') || lowerText.includes('dialysate'))) {
      if (!lowerText.includes('excretion') && !lowerText.includes('urea') && !lowerText.includes('structure of nephron')) {
        return false;
      }
    }
    if (lowerText.includes('dental decay') || lowerText.includes('enamel') || lowerText.includes('dentine') || lowerText.includes('pulp cavity') || lowerText.includes('structure of human teeth')) {
      return false;
    }
    if (lowerText.includes('scurvy') || lowerText.includes('rickets') || lowerText.includes('kwashiorkor') || lowerText.includes('marasmus') || lowerText.includes('vitamin d deficiency') || lowerText.includes('vitamin c deficiency')) {
      return false;
    }
    if ((lowerText.includes('pregnancy') || lowerText.includes('birth')) && (lowerText.includes('antenatal care') || lowerText.includes('labour') || lowerText.includes('breastfeeding') || lowerText.includes('bottle feeding'))) {
      if (!lowerText.includes('placenta') && !lowerText.includes('amniotic fluid')) {
        return false;
      }
    }
    if (lowerText.includes('acid rain') || lowerText.includes('sewage treatment') || lowerText.includes('nuclear fallout') || lowerText.includes('leaching')) {
      return false;
    }
    if (lowerText.includes('heroin') || lowerText.includes('nicotine') || lowerText.includes('tar') || lowerText.includes('tobacco') || lowerText.includes('drug addiction')) {
      return false;
    }
    if (lowerText.includes('sickle cell anaemia') || lowerText.includes('sickle-cell anaemia') || lowerText.includes('sickle cell anemia')) {
      if (lowerText.includes('malaria')) {
        return false;
      }
    }
  }
  return true;
};

async function parsePdf(filePath, subject) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = new Uint8Array(dataBuffer);
  
  const loadingTask = pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false });
  const pdfDoc = await loadingTask.promise;

  const cache = {
    pageNum: 1,
    currentExamIndex: 0,
    isMarkScheme: false,
    currentQNum: 0,
    markSchemes: {},
    examCodes: {},
    extractedQuestions: [],
    validQuestions: []
  };

  console.log(`Processing ${path.basename(filePath)} (${pdfDoc.numPages} pages)`);

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    if (p % 100 === 0) console.log(`  Page ${p}/${pdfDoc.numPages}`);
    const page = await pdfDoc.getPage(p);
    const textContent = await page.getTextContent();
    const textStr = textContent.items.map(i => i.str).join(' ');
    const textStrLower = textStr.toLowerCase();

    const isCoverPage = textStrLower.includes('multiple choice') && 
                        (textStrLower.includes('45 minutes') || textStrLower.includes('instructions') || textStrLower.includes('forty questions')) && 
                        !textStrLower.includes('mark scheme');
                        
    const isMSPage = textStrLower.includes('mark scheme');
    
    let standardCode = null;
    
    // Legacy format: 0987/11/M/J/20
    const legacyMatch = textStr.match(/\b(\d{4})\/(\d{2})\/(M\/J|O\/N|F\/M)\/(\d{2})\b/);
    if (legacyMatch) {
      const subjCode = legacyMatch[1];
      const variant = legacyMatch[2];
      const monthStr = legacyMatch[3];
      const yearStr = legacyMatch[4];
      const month = monthStr === 'M/J' ? '06' : monthStr === 'O/N' ? '11' : '03';
      const year = '20' + yearStr;
      standardCode = `${subjCode}-${variant}-${month}-${year}`;
    }

    // New format: 06_0987_11_2024_1.1a
    const newCodeMatch = textStr.match(/\b(06|11|03)_(\d{4})_(\d{2})[_ /](?:[A-Za-z]+_)?(\d{4})/);
    if (newCodeMatch) {
      const month = newCodeMatch[1];
      const subjCode = newCodeMatch[2];
      const variant = newCodeMatch[3];
      const year = newCodeMatch[4];
      standardCode = `${subjCode}-${variant}-${month}-${year}`;
    }

    if (!standardCode) {
      const msCodeMatch = textStr.match(/\b(\d{4})\/(\d{2})\b/);
      const msDateMatch = textStr.match(/\b(May\/June|October\/November|February\/March)\s+(\d{4})\b/i);
      if (msCodeMatch && msDateMatch) {
        const subjCode = msCodeMatch[1];
        const variant = msCodeMatch[2];
        const monthStr = msDateMatch[1].toLowerCase();
        const year = msDateMatch[2];
        let month = '06';
        if (monthStr.includes('october')) month = '11';
        if (monthStr.includes('february')) month = '03';
        standardCode = `${subjCode}-${variant}-${month}-${year}`;
      }
    }

    if (isCoverPage) {
      if (standardCode) {
        const existingIndex = Object.entries(cache.examCodes).find(([_, c]) => c === standardCode)?.[0];
        if (!existingIndex) {
          cache.currentExamIndex++;
          cache.currentQNum = 0;
          cache.examCodes[cache.currentExamIndex] = standardCode;
        } else {
          cache.currentExamIndex = Number(existingIndex);
          cache.currentQNum = 0;
        }
      } else {
        if (cache.isMarkScheme || cache.currentExamIndex === 0) {
          cache.currentExamIndex++;
          cache.currentQNum = 0;
        }
      }
      cache.isMarkScheme = false;
    } else if (isMSPage) {
      cache.isMarkScheme = true;
    }

    if (cache.isMarkScheme && standardCode) {
      const matchingIndex = Object.entries(cache.examCodes).find(([_, c]) => c === standardCode)?.[0];
      if (matchingIndex) {
        cache.currentExamIndex = Number(matchingIndex);
      }
    } else if (!cache.isMarkScheme && cache.currentExamIndex > 0 && standardCode) {
      if (!cache.examCodes[cache.currentExamIndex]) {
        cache.examCodes[cache.currentExamIndex] = standardCode;
      }
    }

    const viewport = page.getViewport({ scale: 2.0 });
    const mappedItems = textContent.items.map((item) => {
      const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      return { text: item.str.trim(), x, y, height: item.height };
    });

    if (cache.isMarkScheme && cache.currentExamIndex > 0) {
      const rowMap = {};
      mappedItems.forEach((item) => {
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
            if (!cache.markSchemes[cache.currentExamIndex]) {
              cache.markSchemes[cache.currentExamIndex] = {};
            }
            cache.markSchemes[cache.currentExamIndex][qNum] = ans;
          }
        }
      }

      const regex = /\b(\d{1,2})\s+([A-D])\b/g;
      let match;
      while ((match = regex.exec(textStr)) !== null) {
        const qNum = parseInt(match[1]);
        const ans = match[2];
        if (qNum >= 1 && qNum <= 40) {
          if (!cache.markSchemes[cache.currentExamIndex]) {
            cache.markSchemes[cache.currentExamIndex] = {};
          }
          if (!cache.markSchemes[cache.currentExamIndex][qNum]) {
            cache.markSchemes[cache.currentExamIndex][qNum] = ans;
          }
        }
      }
    } else if (!cache.isMarkScheme && !isCoverPage && cache.currentExamIndex > 0) {
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
              if (num > cache.currentQNum && num <= cache.currentQNum + 3) {
                pageQItems.push(item);
                cache.currentQNum = num;
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
                   item.text.includes('BLANK PAGE') ||
                   item.text.match(/\b\d{4}\/\d{2}\/(M\/J|O\/N|F\/M)\/\d{2}\b/) ||
                   item.text.match(/\b(06|11|03)_\d{4}_\d{2}[_ /](?:[A-Za-z]+_)?(\d{4})/))
                );
                if (footerItems.length > 0) {
                  const minFooterY = Math.min(...footerItems.map(item => item.y));
                  endY = minFooterY - 20;
                } else {
                  endY = viewport.height;
                }
              }
              
              const questionTextItems = validTextItems.filter(item => item.y >= startY && item.y <= endY);
              const questionText = questionTextItems.map(item => item.text).join(' ');
              
              if (subject && !isQuestionValid(subject, questionText)) {
                continue;
              }
              
              cache.extractedQuestions.push({
                examIndex: cache.currentExamIndex,
                qNumber,
                pageIndex: p,
                startY,
                endY,
                examCode: cache.examCodes[cache.currentExamIndex]
              });
            }
          }
        }
      }
    }
  }

  const newlyValid = [];
  const remainingExtracted = [];
  for (const q of cache.extractedQuestions) {
    const ans = cache.markSchemes[q.examIndex]?.[q.qNumber];
    if (ans) {
      q.answer = ans;
      q.examCode = cache.examCodes[q.examIndex] || q.examCode;
      newlyValid.push(q);
    } else {
      remainingExtracted.push(q);
    }
  }
  
  cache.validQuestions.push(...newlyValid);
  cache.extractedQuestions = remainingExtracted;

  return {
    validQuestions: cache.validQuestions,
    markSchemes: cache.markSchemes,
    examCodes: cache.examCodes,
    extractedQuestions: cache.extractedQuestions
  };
}

async function main() {
  for (const { subj, lvl, file } of subjects) {
    const pdfPath = path.join(PUBLIC_DIR, `${file}.pdf`);
    if (!fs.existsSync(pdfPath)) {
      console.warn(`File not found: ${file}.pdf, skipping.`);
      continue;
    }
    const result = await parsePdf(pdfPath, subj);
    const jsonPath = path.join(DATA_DIR, `${file}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(result));
    console.log(`Saved ${result.validQuestions.length} valid questions to ${file}.json`);
  }
}

main().catch(err => {
  console.error("Error during preparsing", err);
});
