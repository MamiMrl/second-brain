import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { VoyageAIClient } from "voyageai";

// PRD Q9: voyage-4-lite, via the official Voyage SDK directly — @langchain/community's
// wrapper is deprecated (https://github.com/langchain-ai/langchainjs-community/issues/61)
// and no first-party @langchain/voyage package exists yet.
export class VoyageEmbeddings extends Embeddings {
  private client: VoyageAIClient;
  private model: string;

  constructor(params: EmbeddingsParams & { apiKey: string; model: string }) {
    super(params);
    this.client = new VoyageAIClient({ apiKey: params.apiKey });
    this.model = params.model;
  }

  private async embed(input: string[], inputType: "document" | "query"): Promise<number[][]> {
    const response = await this.client.embed({ input, model: this.model, inputType });
    return (response.data ?? []).map((item) => item.embedding ?? []);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return this.embed(documents, "document");
  }

  async embedQuery(document: string): Promise<number[]> {
    const [vector] = await this.embed([document], "query");
    return vector;
  }
}
