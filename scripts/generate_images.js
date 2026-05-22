import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { createCanvas } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const OUT_DIR = path.join(PUBLIC_DIR, 'extracted_images');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const MAX_TIME_MS = 60 * 60 * 1000; 
const startTime = Date.now();

async function generateImages() {
  const jsonFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));

  for (const jsonFile of jsonFiles) {
    const subjectPrefix = jsonFile.replace('.json', ''); // e.g., 'bioal'
    const subjectOutDir = path.join(OUT_DIR, subjectPrefix);
    
    if (!fs.existsSync(subjectOutDir)) {
      fs.mkdirSync(subjectOutDir, { recursive: true });
    }

    const dataPath = path.join(DATA_DIR, jsonFile);
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    if (!data.validQuestions || data.validQuestions.length === 0) continue;

    const pdfPath = path.join(PUBLIC_DIR, `${subjectPrefix}.pdf`);
    if (!fs.existsSync(pdfPath)) {
      console.warn(`PDF not found for ${subjectPrefix}, skipping...`);
      continue;
    }

    console.log(`Processing ${subjectPrefix} (${data.validQuestions.length} questions)...`);
    
    const pdfBytes = new Uint8Array(fs.readFileSync(pdfPath));
    const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;

    for (let i = 0; i < data.validQuestions.length; i++) {
      if (Date.now() - startTime > MAX_TIME_MS) {
        console.warn("Time limit reached. Exiting gracefully to prevent build timeout...");
        return;
      }

      const q = data.validQuestions[i];
      const outPath = path.join(subjectOutDir, `${q.examIndex}_${q.qNumber}.png`);
      if (fs.existsSync(outPath)) {
        continue;
      }

      try {
        const page = await pdfDoc.getPage(q.pageIndex);
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');
        
        await page.render({
          canvasContext: ctx,
          viewport: viewport
        }).promise;

        const cropY = q.startY;
        const cropHeight = q.endY - q.startY;
        
        const croppedCanvas = createCanvas(canvas.width, cropHeight);
        const croppedCtx = croppedCanvas.getContext('2d');
        
        croppedCtx.drawImage(
          canvas,
          0, cropY, canvas.width, cropHeight,
          0, 0, canvas.width, cropHeight
        );

        // Optional trim/transparency logic (skipped here for speed, keeping it simple and white bg is fine)
        // You can port the trim logic if needed, but for now simple crop is perfectly functional.

        const buffer = croppedCanvas.toBuffer('image/png');
        fs.writeFileSync(outPath, buffer);
        
      } catch (err) {
        console.error(`Error rendering ${subjectPrefix} examIndex ${q.examIndex} Q${q.qNumber}:`, err);
      }
    }
  }
  
  console.log("Image generation complete!");
}

generateImages().catch(console.error);
