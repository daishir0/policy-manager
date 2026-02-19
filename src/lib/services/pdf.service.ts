// PDFテキスト抽出サービス
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export class PdfService {
  /**
   * PDFバッファからテキストを抽出する
   */
  async extractText(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text.trim();
    } catch (error) {
      console.error("PDF text extraction failed:", error);
      throw new Error("PDFからのテキスト抽出に失敗しました。ファイルが破損していないか確認してください。");
    }
  }

  /**
   * PDFテキストからタイトルを推測する（最初の非空行を使用）
   */
  extractTitle(text: string): string {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return "";
    // 最初の行をタイトルとして返す（最大50文字）
    return lines[0].substring(0, 50);
  }
}

export const pdfService = new PdfService();
