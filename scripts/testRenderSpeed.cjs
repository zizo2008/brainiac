const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');

async function testRenderSpeed() {
  const data = new Uint8Array(fs.readFileSync('./public/bioal.pdf'));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDocument = await loadingTask.promise;
  
  const numPagesToTest = 10;
  console.log(`PDF loaded. Testing ${numPagesToTest} pages...`);
  
  const startTime = Date.now();
  for (let i = 1; i <= numPagesToTest; i++) {
    const page = await pdfDocument.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    
    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;
    
    // We would crop here...
    // const buffer = canvas.toBuffer('image/png');
  }
  const endTime = Date.now();
  
  console.log(`Time for ${numPagesToTest} renders: ${endTime - startTime}ms`);
  console.log(`Estimated time for 13,000 renders: ${((endTime - startTime) / numPagesToTest * 13000) / 1000 / 60} minutes`);
}

testRenderSpeed().catch(console.error);
