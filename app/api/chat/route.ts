import { NextResponse } from "next/server";

const SYSTEM_INSTRUCTION = `You are "BistroBot", the warm, professional, and knowledgeable AI Concierge for Jbenz Bistro.
Your goal is to assist guests and customers with menu recommendations, karaoke room and billiard inquiries, operating hours, reservations, and location details.

About Jbenz Bistro:
- Location: Beside Poblacion Barangay Hall, Suba, Poblacion, Liloan, Cebu, Philippines, 6003.
- Contact: Phone 09935343043 | Email: jbenzbistro@gmail.com
- Operating Hours:
  * Monday – Thursday: 11:00 AM – 11:00 PM
  * Friday – Saturday: 11:00 AM – 2:00 AM (Late night VIP karaoke & drinks)
  * Sunday: 12:00 PM – 10:00 PM
- Core Experiences:
  1. Fine & Casual Dining: Seasonal dishes, Filipino favorites, signature pulutan platters, and handcrafted beverages.
  2. Premium Karaoke Suites: Private acoustic-treated rooms, 50,000+ song library, mood lighting, accommodating 4 to 20+ guests.
  3. Tournament-grade Billiards: High-end billiard tables with cocktail & pulutan service right at the table.
- Website Shortcuts:
  * Online Booking / Reservations: Guests can book tables or karaoke suites at the Reservations page (/reserve).
  * Food & Drinks Menu: Browse dishes and drinks at the Menu page (/menu).
  * Customer Inquiries / Concerns: Submit custom messages at the Contact page (/contact).

Tone & Guidelines:
- Warm, polite, hospitable (infused with Filipino warmth e.g., "Mabuhay!", "Welcome to Jbenz Bistro!").
- Keep responses concise, structured, and easy to scan on mobile devices (use bullet points when appropriate).
- If asked about booking or prices, warmly invite them to visit /reserve or contact 09935343043 for real-time room availability.
- Do not invent non-existent services. Always remain helpful, courteous, and enthusiastic.`;

// Candidate models in priority order for high speed and zero downtime
const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
];

function generateLocalFallbackReply(message: string): string {
  const q = message.toLowerCase();

  if (q.includes("karaoke") || q.includes("ktv") || q.includes("room") || q.includes("sing") || q.includes("rate") && q.includes("room")) {
    return "Mabuhay! 🎤 Our **VIP Karaoke Suites** offer private acoustic treatment, premium sound systems, dynamic mood lighting, and over 50,000 songs!\n\n* **Capacities:** Intimate suites (4–6 guests) up to Grand VIP suites (20+ guests).\n* **Service:** Full food and beverage service delivered directly inside your suite.\n* **Bookings:** Reserve your suite online at [/reserve](/reserve) or call **09935343043** for instant availability!";
  }

  if (q.includes("billiard") || q.includes("pool") || q.includes("table")) {
    return "Mabuhay! 🎱 Jbenz Bistro features **tournament-grade billiard tables** in an upscale, air-conditioned lounge.\n\n* Enjoy cocktail, cold beverage, and signature pulutan service right at your table.\n* Available for walk-ins or reservations via [/reserve](/reserve).\n* Located beside the Poblacion Barangay Hall in Liloan!";
  }

  if (q.includes("menu") || q.includes("food") || q.includes("drink") || q.includes("eat") || q.includes("pulutan") || q.includes("dish") || q.includes("price") || q.includes("special")) {
    return "Mabuhay! 🍷 Our kitchen serves delicious Filipino specialties, sizzling pulutan platters, and handcrafted beverages:\n\n* **Bestsellers:** Crispy Pork Belly, Sizzling Sisig, and our Signature Pulutan Fiesta Platters.\n* **Drinks:** Ice-cold beers, signature cocktails, and non-alcoholic refreshments.\n* Browse our complete menu with prices and photos at [/menu](/menu)!";
  }

  if (q.includes("hour") || q.includes("time") || q.includes("open") || q.includes("close") || q.includes("sched")) {
    return "Mabuhay! 🕒 Here are our **Operating Hours**:\n\n* **Monday – Thursday:** 11:00 AM – 11:00 PM\n* **Friday – Saturday:** 11:00 AM – 2:00 AM *(Late-night VIP karaoke & party hours!)*\n* **Sunday:** 12:00 PM – 10:00 PM\n\nWe look forward to welcoming you!";
  }

  if (q.includes("locat") || q.includes("where") || q.includes("address") || q.includes("map") || q.includes("find")) {
    return "Mabuhay! 📍 We are located at:\n\n**Beside Poblacion Barangay Hall, Suba, Poblacion, Liloan, Cebu, Philippines (6003)**.\n\nFor directions or parking guidance, please call **09935343043**!";
  }

  if (q.includes("reserve") || q.includes("book") || q.includes("schedul")) {
    return "Mabuhay! 📅 Booking a dining table, billiard session, or VIP karaoke suite is quick and easy:\n\n* Visit our [Online Reservation Page](/reserve) to pick your preferred date and time.\n* For urgent inquiries or private VIP reservations, call us at **09935343043**.";
  }

  if (q.includes("contact") || q.includes("phone") || q.includes("call") || q.includes("email") || q.includes("number")) {
    return "Mabuhay! 📞 You can reach Jbenz Bistro through:\n\n* **Phone / GCash:** 09935343043\n* **Email:** jbenzbistro@gmail.com\n* **Inquiry Form:** [/contact](/contact)\n\nWe are always happy to assist you!";
  }

  return "Mabuhay! 🍷 Welcome to **Jbenz Bistro**! I'm your AI Concierge. How can I assist you today? Feel free to ask about our **menu dishes**, **VIP karaoke rooms**, **billiard tables**, **operating hours**, or making an online **reservation** at [/reserve](/reserve)!";
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured." },
        { status: 500 }
      );
    }

    const { message, history } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "A message string is required." },
        { status: 400 }
      );
    }

    // Prepare contents array for Gemini multi-turn chat
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    // Append prior history if provided (limiting last 6 turns for speed & context)
    if (Array.isArray(history)) {
      const recent = history.slice(-6);
      for (const item of recent) {
        if (item.role === "user" || item.role === "assistant" || item.role === "model") {
          contents.push({
            role: item.role === "assistant" ? "model" : (item.role as "user" | "model"),
            parts: [{ text: String(item.content || item.text || "") }],
          });
        }
      }
    }

    // Append current user message
    contents.push({
      role: "user",
      parts: [{ text: message.trim() }],
    });

    const requestBody = JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    let lastError: string | null = null;

    // Try models in cascade to prevent high-demand 503 / 429 failures
    for (const model of CANDIDATE_MODELS) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: requestBody,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errMsg = errorData?.error?.message || response.statusText;
          lastError = errMsg;
          console.warn(`[Gemini API] Model ${model} returned ${response.status}: ${errMsg}. Attempting next model...`);
          // Continue loop to try next model in cascade
          continue;
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];

        // Find text parts
        let replyText = "";
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text && !part.thought) {
              replyText += part.text;
            }
          }
          if (!replyText && candidate.content.parts[0]?.text) {
            replyText = candidate.content.parts[0].text;
          }
        }

        if (replyText) {
          return NextResponse.json({ reply: replyText, model });
        }
      } catch (err: any) {
        console.warn(`[Gemini API] Error calling model ${model}:`, err?.message);
        lastError = err?.message || "Model request failed";
      }
    }

    // If all models encounter high demand or quota limits, return the smart concierge fallback
    console.info("[Gemini API] All external models busy/rate-limited. Serving intelligent concierge fallback.");
    const fallbackText = generateLocalFallbackReply(message);
    return NextResponse.json({
      reply: fallbackText,
      model: "bistro-concierge-fallback",
      notice: "Serving via Bistro Concierge backup",
    });
  } catch (err: any) {
    console.error("Chat API route error:", err);
    // Graceful fallback even on unexpected top-level exception
    return NextResponse.json({
      reply: "Mabuhay! 🍷 Welcome to Jbenz Bistro. How can I assist you with our menu, karaoke rooms, or reservations today? You can also reach us directly at 09935343043.",
      model: "fallback",
    });
  }
}
