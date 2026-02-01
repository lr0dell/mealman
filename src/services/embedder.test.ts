import { describe, it, expect, beforeAll } from 'vitest';
import { Embedder } from './embedder.js';

describe('Embedder', () => {
  let embedder: Embedder;

  beforeAll(async () => {
    embedder = new Embedder();
    await embedder.init();
  });

  it('generates embedding with correct dimensions', async () => {
    const embedding = await embedder.embed('chicken breast');
    expect(embedding).toBeInstanceOf(Float32Array);
    expect(embedding.length).toBe(384);
  });

  it('generates similar embeddings for similar texts', async () => {
    const fish1 = await embedder.embed('fish');
    const fish2 = await embedder.embed('raw fish fillet');
    const chicken = await embedder.embed('chicken breast');

    const fishSimilarity = cosineSimilarity(fish1, fish2);
    const crossSimilarity = cosineSimilarity(fish1, chicken);

    expect(fishSimilarity).toBeGreaterThan(crossSimilarity);
  });
});

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
