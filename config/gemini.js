const {
  GoogleGenAI,
} = require("@google/genai");

const apiKey =
  String(
    process.env.GEMINI_API_KEY || ""
  ).trim();

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is missing in the environment variables"
  );
}

const ai =
  new GoogleGenAI({
    apiKey,
  });

module.exports = ai;