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

    // Append prior history if provided (limiting last 8 turns for speed & context)
    if (Array.isArray(history)) {
      const recent = history.slice(-8);
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

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Gemini API error:", errorData || response.statusText);
      return NextResponse.json(
        { error: errorData?.error?.message || "Failed to generate AI response." },
        { status: response.status }
      );
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    
    // Find first text part (skipping any internal thought parts)
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

    if (!replyText) {
      replyText = "I'm here to help! Feel free to ask about our menu, karaoke rooms, billiards, or reservations.";
    }

    return NextResponse.json({ reply: replyText });
  } catch (err: any) {
    console.error("Chat API route error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
