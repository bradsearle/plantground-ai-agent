import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";

// 1. Read Plant Name and Pot Size from terminal arguments
// Usage: node --env-file=.env index.js "Ariocarpus fissuratus" "2-inch pot"
const plantNameInput = process.argv[2];
const potSizeInput = process.argv[3] || "2-inch pot"; // Default to 2-inch pot if omitted

if (!plantNameInput) {
  console.log("❌ Please provide a plant name. Example:");
  console.log(
    '   node --env-file=.env index.js "Ariocarpus fissuratus" "2-inch pot"',
  );
  process.exit(1);
}

// 2. Initialize Clients
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const auth = new google.auth.GoogleAuth({
  keyFile: "service_account.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// Helper function that handles 429 search quota limits gracefully
async function generateWithFallback(prompt) {
  try {
    // Attempt 1: Try with live Google Search enabled for live pricing
    return await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
      },
    });
  } catch (error) {
    if (
      error.message.includes("429") ||
      error.message.includes("RESOURCE_EXHAUSTED")
    ) {
      console.log(
        "⚠️ Google Search quota limited (429). Falling back to standard AI generation...",
      );

      // Attempt 2: Fall back to standard AI generation without Search tool
      return await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
    }
    throw error;
  }
}

// 3. Main Research Function
async function researchAndSavePlant(plantName, potSize) {
  console.log(
    `\n🌱 Synthesizing data & market research for: ${plantName} (${potSize})...`,
  );

  const prompt = `
  You are an expert botanical database assistant and e-commerce copywriter for a high-end rare plant nursery (cacti and succulents).
  Perform market research and synthesize care specs for "${plantName}" specifically in a "${potSize}".

  Search online specialty plant nurseries and collector platforms for current market pricing.

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
    "soilMix": "Specific mineral soil composition recommendations (prefer perlite-free, pumice, Turface MVP)",
    "rootType": "Root system structure (e.g., Tuberous/Taproot, Shallow Fibrous)",
    "growthRate": "Slow, Moderate, or Fast",
    "careLevel": "Beginner, Intermediate, or Advanced",
    "shippingNotes": "Key considerations for bare-root packaging and shipping resilience",
    "potSize": "${potSize}",
    "observedPriceRange": "Observed market price range for this size (e.g., $35 - $50)",
    "suggestedRegularPrice": "Suggested baseline retail price as a number without currency symbol (e.g., 45.00)",
    "suggestedSalePrice": "Suggested promo/sale price as a number without currency symbol (e.g., 39.00)",
    "description": "An original, engaging e-commerce product description (150-200 words). Highlight visual appearance, growth habits, rarity/appeal for collectors, and why it makes a great addition to a collection. Do not copy text verbatim from external sites."
  }
  `;

  try {
    const response = await generateWithFallback(prompt);
    const data = JSON.parse(response.text);

    console.log("\n✨ Synthesized Data & Pricing:");
    console.dir(data, { depth: null });

    // Map JSON data directly to Google Sheet columns
    const rowValues = [
      data.commonName, // Col A
      data.scientificName, // Col B
      data.family, // Col C
      data.nativeHabitat, // Col D
      data.sunlight, // Col E
      data.minTemp, // Col F
      data.watering, // Col G
      data.dormancy, // Col H
      data.soilMix, // Col I
      data.rootType, // Col J
      data.growthRate, // Col K
      data.careLevel, // Col L
      data.shippingNotes, // Col M
      data.potSize, // Col N
      data.observedPriceRange, // Col O
      data.suggestedRegularPrice, // Col P
      data.suggestedSalePrice, // Col Q
      data.description, // Col R
      new Date().toISOString().split("T")[0], // Col S (Date Added)
    ];

    // Append row to Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Sheet1!A:S", // 19 Columns
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

researchAndSavePlant(plantNameInput, potSizeInput);
