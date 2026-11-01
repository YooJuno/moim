declare module 'xlsx-populate/browser/xlsx-populate.min.js' {
  interface Cell { rowNumber(): number; columnNumber(): number }
  interface Range { startCell(): Cell; endCell(): Cell; value(): unknown[][] }
  interface Sheet { name(): string; usedRange(): Range | undefined }
  const XlsxPopulate: { fromDataAsync(data: ArrayBuffer, options?: { password?: string }): Promise<{ sheets(): Sheet[] }> };
  export default XlsxPopulate;
}
