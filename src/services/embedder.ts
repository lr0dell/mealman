import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

export class Embedder {
  private pipe: FeatureExtractionPipeline | null = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';

  async init(): Promise<void> {
    if (!this.pipe) {
      this.pipe = await pipeline('feature-extraction', this.modelName);
    }
  }

  async embed(text: string): Promise<Float32Array> {
    if (!this.pipe) {
      await this.init();
    }
    const output = await this.pipe!(text, {
      pooling: 'mean',
      normalize: true,
    });
    // The output.data is already a Float32Array for embedding models
    return output.data as Float32Array;
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}
