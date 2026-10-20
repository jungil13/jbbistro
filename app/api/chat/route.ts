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

Project Q&A Knowledge:
Q: How can I make a reservation?
A: Sign in to your customer account, then use the online reservation page at /reserve to select an available service, date, time, and guest count. Reservations must be made at least one day in advance; same-day bookings are not accepted. For availability questions, call 09935343043.

Q: How can I pay for a reservation?
A: The reservation checkout offers online payment through PayMongo (payment options shown at checkout) or Pay on Arrival. Pay-on-arrival reservations may need manager confirmation. Refer to the checkout page for the payment options currently available.

Q: Is my reservation confirmed immediately?
A: Confirmation depends on the selected payment method and the reservation status shown on your account. Pay-on-arrival reservations may be subject to manager confirmation. Check My Profile or your confirmation email for the latest status.

Q: How do I request a refund?
A: Sign in and open My Profile, find the eligible reservation payment, and submit a refund request with a reason. The bistro reviews requests; submitting a request does not mean it has been approved or processed. Only eligible verified or paid PayMongo online payments can be requested through the current refund flow. For help, contact the bistro at 09935343043 or jbenzbistro@gmail.com.

Q: How long does a refund take?
A: After a refund is approved and processed, it usually takes 3 to 5 working days to appear, depending on the payment method. The actual timing can vary by payment provider or bank.

Q: What do refund statuses mean?
A: Pending review means the bistro has not decided yet. Approved means the request is approved but the refund has not yet been sent to PayMongo. Processing or Awaiting PayMongo means the payment provider is handling or confirming it. Completed means the refund was confirmed as processed. Rejected or Failed means it was not approved or the provider could not complete it. Contact the bistro if a status needs explanation.

Q: Where can I see my reservation or refund status?
A: Sign in and visit My Profile to review your reservations, payments, notifications, and refund requests. Check your email for reservation or refund updates as well.

Q: Where can I see menu items and prices?
A: Visit /menu for the current menu. Do not guess item availability or prices; direct customers to the menu or ask them to contact the bistro.

Q: How can I contact Jbenz Bistro?
A: Call 09935343043 or email jbenzbistro@gmail.com. For a written inquiry, use /contact.

Q: Can the chatbot make or change a booking, approve a refund, or check a customer's private account?
A: No. The chatbot can explain how to use the website, but customers must sign in to manage their reservations and refund requests. Never claim to have changed a booking, checked a private account, approved a request, or processed a payment.

Tone & Guidelines:
- Warm, polite, hospitable (infused with Filipino warmth e.g., "Mabuhay!", "Welcome to Jbenz Bistro!").
- Keep responses concise, structured, and easy to scan on mobile devices (use bullet points when appropriate).
- If asked about booking or prices, warmly invite them to visit /reserve or contact 09935343043 for real-time room availability.
- Treat the Project Q&A Knowledge as the source of truth for website processes. Do not invent policies, prices, menu items, availability, or account information. If information is not listed, direct customers to the menu, reservation page, or contact details above.
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

  if (q.includes("refund") || q.includes("money back") || q.includes("moneyback")) {
    if (q.includes("how long") || q.includes("when") || q.includes("days") || q.includes("time")) {
      return "Mabuhay! If your refund is approved and processed, it usually takes **3 to 5 working days** to appear, depending on your payment method. Timing may vary by provider or bank. You can check your refund status in your signed-in account under **My Profile**.";
    }

    if (q.includes("status") || q.includes("approved") || q.includes("pending") || q.includes("rejected")) {
      return "You can check your refund status under **My Profile** after signing in. **Pending review** means the bistro is reviewing your request; **Approved** means it has not yet been processed through PayMongo; **Processing/Awaiting PayMongo** means the provider is handling it; and **Completed** means the refund was confirmed as processed. For help, call **09935343043** or email **jbenzbistro@gmail.com**.";
    }

    return "To request a refund, sign in and open **My Profile**, find the eligible reservation payment, and submit a request with a reason. Requests are reviewed by the bistro; submitting one does not mean it is approved or processed. The current online refund flow is for eligible verified or paid PayMongo payments. If approved and processed, refunds usually take **3 to 5 working days**, depending on the payment method. For help, call **09935343043**.";
  }

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
    return "Mabuhay! 📅 Sign in to your customer account, then visit our [Online Reservation Page](/reserve) to choose a service, date, time, and guest count. Reservations must be made at least **one day in advance**; same-day bookings are not accepted. Pay-on-arrival reservations may need manager confirmation. For availability, call **09935343043**.";
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
