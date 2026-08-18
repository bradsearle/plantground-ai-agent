import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";

async function runTest() {
  console.log("1. Checking Environment Variables...");
  if (!process.env.GEMINI_API_KEY || !process.env.SPREADSHEET_ID) {
    throw new Error(
      "Missing GEMINI_API_KEY or SPREADSHEET_ID in your .env file!",
    );
  }

  console.log("2. Testing Gemini API...");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const aiResponse = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: 'Say "Gemini Connection Successful!" in 5 words or less.',
  });
  console.log("   Gemini Response:", aiResponse.text.trim());

  console.log("3. Testing Google Sheets Write Access...");
  const auth = new google.auth.GoogleAuth({
    keyFile: "service_account.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "A1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          "Test Common Name",
          "Test Scientific Name",
          "Full Sun",
          "Low",
          "Porous",
          "Test Description",
        ],
      ],
    },
  });

  console.log(
    "\n SUCCESS: Gemini responded AND a test row was added to your Google Sheet!",
  );
}

runTest().catch((error) => {
  console.error("\n TEST FAILED:");
  console.error(error.message);
});
