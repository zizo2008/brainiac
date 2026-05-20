import type * as pdfjsLibType from 'pdfjs-dist';

let pdfjsLibInstance: typeof pdfjsLibType | null = null;

export async function getPdfJs(): Promise<typeof pdfjsLibType> {
  if (!pdfjsLibInstance) {
    const lib = await import('pdfjs-dist');
    // @ts-ignore
    const worker = await import('pdfjs-dist/build/pdf.worker.min.js?url');
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    pdfjsLibInstance = lib;
  }
  return pdfjsLibInstance;
}
