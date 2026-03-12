// app/lib/api.ts
import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000";

export type AnalyzeRequest = {
  starting_address: string;
  ending_address: string;
  photo_urls: string[];
};

export type AnalyzeResponse = {
  estimate: number;
  description: string;
  items: {
    name: string;
    quantity: number;
    note?: string;
  }[];
  totalVolumeM3: number;
  totalAreaM2: number;
};

export async function analyzeMove(
  data: AnalyzeRequest
): Promise<AnalyzeResponse> {
  const response = await axios.post(
    `${API_BASE_URL}/analyze`,
    data,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

