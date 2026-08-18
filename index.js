import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";

// 1. Get Plant Name from Command Line Argument
const plantNameInput = process.argv[2];

if (!plantNameInput) {
  console.log("❌ Please provide a plant name. Example:");
  console.log('   node --env-file=.env index.js "Ariocarpus fissuratus"');
  process.exit(1);
}

// 2. Initialize Clients
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const auth = new google.auth.GoogleAuth({
  keyFile: "service_account.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// Helper to handle transient API capacity spikes
async function generateWithRetry(prompt, retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(
        `⚠️ Model busy. Retrying in ${delayMs / 1000}s (Attempt ${attempt}/${retries})...`,
      );
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

// 3. Research Function
async function researchAndSavePlant(plantName) {
  console.log(`\n🌱 Synthesizing data & product copy for: ${plantName}...`);

  const prompt = `
  You are an expert botanical database assistant and professional copywriter for a high-end rare plant e-commerce shop specializing in cacti and succulents.
  Provide precise care specs AND an original product description for "${plantName}".

  Return ONLY a valid JSON object matching these exact keys:
  {
    "commonName": "Primary common name",
    "scientificName": "Full botanical name with authority",
    "family": "Botanical family name",
    "nativeHabitat": "Country/region of origin and habitat details",
    "sunlight": "Specific sun requirements (e.g., Full Sun, 30% Shade Cloth)",
    "minTemp": "Minimum cold tolerance in Fahrenheit (e.g., 25°F)",
    "watering": "Active growing season watering guidelines",
    "dormancy": "Winter dormancy and dry period instructions",
    "soilMix": "Specific mineral soil composition recommendations (prefer perlite-free, pumice, Turface)",
    "rootType": "Root system structure (e.g., Tuberous/Taproot, Shallow Fibrous)",
    "growthRate": "Slow, Moderate, or Fast",
    "careLevel": "Beginner, Intermediate, or Advanced",
    "shippingNotes": "Key considerations for bare-root packaging and shipping resilience",
    "description": "An original, engaging e-commerce product description (150-200 words). Highlight visual appearance, growth habits, rarity/appeal for collectors, and why it makes a great addition to a collection. Do not copy text verbatim from external sites; write fresh, original copy suitable for online sales."
  }
  `;

  try {
    const response = await generateWithRetry(prompt);
    const data = JSON.parse(response.text);

    console.log("\n✨ Synthesized Data & Product Copy:");
    console.dir(data, { depth: null });

    // Reordered array mapping to Google Sheet columns:
    const rowValues = [
      data.commonName, // Column A (Basic Plant Name First)
      data.scientificName, // Column B
      data.family, // Column C
      data.nativeHabitat, // Column D
      data.sunlight, // Column E
      data.minTemp, // Column F
      data.watering, // Column G
      data.dormancy, // Column H
      data.soilMix, // Column I
      data.rootType, // Column J
      data.growthRate, // Column K
      data.careLevel, // Column L
      data.shippingNotes, // Column M
      data.description, // Column N (E-Commerce Description)
      new Date().toISOString().split("T")[0], // Column O (Date Added)
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Sheet1!A:O",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });

    console.log(
      `\n✅ Saved "${data.commonName}" (${data.scientificName}) to Google Sheet!`,
    );
  } catch (error) {
    console.error("❌ Pipeline Error:", error.message);
  }
}

researchAndSavePlant(plantNameInput);
