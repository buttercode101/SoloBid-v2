import { createApp } from "../server";

// Vercel serverless function handler
export default async (req: any, res: any) => {
  const app = await createApp();
  return app(req, res);
};
