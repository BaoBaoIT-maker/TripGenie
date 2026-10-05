/**
 * IEmbeddingService — Contract for vector embedding providers.
 * Adheres to Dependency Inversion Principle (DIP).
 * Can be implemented by Gemini, OpenAI, or local HuggingFace/ONNX.
 */
export interface IEmbeddingService {
  /**
   * Generates a vector embedding from a text string.
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Returns the name of the model currently configured.
   */
  getModelName(): string;
}
