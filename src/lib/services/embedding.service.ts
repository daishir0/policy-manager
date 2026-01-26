import { prisma } from "@/lib/prisma";

const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || "http://localhost:11434/api/embeddings";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "multilingual-e5-large";
const CHUNK_SIZE = 500; // 文字数
const CHUNK_OVERLAP = 50; // オーバーラップ文字数

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

export class EmbeddingService {
  // テキストを埋め込みベクトルに変換
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(EMBEDDING_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      console.error("Failed to generate embedding:", error);
      throw new Error("埋め込みの生成に失敗しました");
    }
  }

  // テキストをチャンクに分割
  splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];

    // 段落で分割を試みる
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = "";

    for (const paragraph of paragraphs) {
      // 段落が大きすぎる場合は文で分割
      if (paragraph.length > CHUNK_SIZE) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }

        // 文で分割
        const sentences = paragraph.split(/(?<=[。．.!?！？])/);
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > CHUNK_SIZE) {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
          } else {
            currentChunk += sentence;
          }
        }
      } else {
        if (currentChunk.length + paragraph.length + 2 > CHUNK_SIZE) {
          chunks.push(currentChunk.trim());
          currentChunk = paragraph;
        } else {
          currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // オーバーラップを追加
    return chunks.map((chunk, i) => {
      if (i > 0 && chunks[i - 1]) {
        const overlap = chunks[i - 1].slice(-CHUNK_OVERLAP);
        return overlap + chunk;
      }
      return chunk;
    });
  }

  // 文書の埋め込みを生成して保存
  async indexDocument(documentId: string, content: string): Promise<void> {
    // 既存の埋め込みを削除
    await prisma.documentEmbedding.deleteMany({
      where: { documentId },
    });

    // チャンクに分割
    const chunks = this.splitIntoChunks(content);

    // 各チャンクの埋め込みを生成して保存
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.generateEmbedding(chunk);

      // pgvectorに保存（raw SQLを使用）
      await prisma.$executeRaw`
        INSERT INTO document_embeddings (id, document_id, chunk_index, chunk_text, embedding, created_at)
        VALUES (
          gen_random_uuid(),
          ${documentId}::text,
          ${i},
          ${chunk},
          ${JSON.stringify(embedding)}::vector,
          NOW()
        )
      `;
    }
  }

  // 類似文書を検索
  async searchSimilar(
    query: string,
    limit = 5,
    threshold = 0.7
  ): Promise<Array<{
    documentId: string;
    chunkText: string;
    similarity: number;
  }>> {
    const queryEmbedding = await this.generateEmbedding(query);

    // コサイン類似度で検索
    const results = await prisma.$queryRaw<
      Array<{
        document_id: string;
        chunk_text: string;
        similarity: number;
      }>
    >`
      SELECT
        document_id,
        chunk_text,
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM document_embeddings
      WHERE 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > ${threshold}
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      documentId: r.document_id,
      chunkText: r.chunk_text,
      similarity: r.similarity,
    }));
  }

  // 文書の埋め込みを削除
  async removeDocumentEmbeddings(documentId: string): Promise<void> {
    await prisma.documentEmbedding.deleteMany({
      where: { documentId },
    });
  }
}

export const embeddingService = new EmbeddingService();
