"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { submitContactMessageAction } from "@/app/actions/contact";

type FormState = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

export default function ContactPage() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const contactCards = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" width="22" height="22">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      ),
      title: "Address",
      lines: ["Beside Poblacion Barangay Hall", "Suba, Poblacion, Liloan, Philippines, 6003"],
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" width="22" height="22">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
      ),
      title: "Phone",
      lines: ["09935343043"],
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" width="22" height="22">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
      title: "Email",
      lines: ["jbenzbistro@gmail.com"],
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" width="22" height="22">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      title: "Operating Hours",
      hours: [
        { day: "Monday – Thursday:", time: "11:00 AM – 11:00 PM" },
        { day: "Friday – Saturday:", time: "11:00 AM – 2:00 AM" },
        { day: "Sunday:", time: "12:00 PM – 10:00 PM" },
      ],
    },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    setError("");
    const result = await submitContactMessageAction(form);
    setSubmitting(false);
    if (result.success) {
      setSubmitted(true);
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } else {
      setError(result.error || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {/* Page Header */}
      <div className="bg-burgundy-dark py-16 px-6 text-center">
        <p className="mt-8 text-xs tracking-[0.18em] uppercase text-gold font-semibold mb-2">
          Get In Touch
        </p>
        <h1 className="font-playfair text-4xl md:text-5xl font-bold text-white">
          Contact Us
        </h1>
        <p className="text-white/60 mt-3 max-w-md mx-auto text-sm leading-relaxed">
          We'd love to hear from you. Send us a message or reach us through any of the channels below.
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

          {/* ── Left: Contact Form ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="font-playfair text-2xl font-bold text-burgundy-dark mb-6">
              Send Us a Message
            </h2>

            {/* Success State */}
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" width="32" height="32">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-playfair text-xl font-bold text-gray-800 mb-1">Message Sent!</h3>
                  <p className="text-sm text-gray-500 max-w-xs">
                    Thank you for reaching out. We'll get back to you as soon as possible.
                  </p>
                </div>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-2 text-sm font-semibold text-gold hover:text-gold-light transition-colors underline underline-offset-2"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-white transition-all"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="your.email@example.com"
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-white transition-all"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="09XX XXX XXXX"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-white transition-all"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Subject
                  </label>
                  <select
                    id="contact-subject"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select a subject</option>
                    <option value="Table Reservation">Table Reservation</option>
                    <option value="Karaoke Room Booking">Karaoke Room Booking</option>
                    <option value="Billiard Table Booking">Billiard Table Booking</option>
                    <option value="Private Event Inquiry">Private Event Inquiry</option>
                    <option value="Feedback">Feedback</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={4}
                    placeholder="How can we help you?"
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-white transition-all resize-none"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-500 font-medium">{error}</p>
                )}

                <button
                  id="contact-submit"
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gold text-burgundy-dark font-bold py-3 rounded-lg text-sm tracking-wide hover:bg-gold-light hover:-translate-y-0.5 transition-all shadow-md shadow-gold/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:translate-y-0"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-burgundy-dark/30 border-t-burgundy-dark rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send Message"
                  )}
                </button>
              </form>
            )}
          </div>

          {/* ── Right: Contact Info Cards ── */}
          <div className="space-y-4">
            {contactCards.map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-start gap-5 hover:shadow-md hover:border-gold/20 transition-all"
              >
                {/* Icon circle */}
                <div className="w-12 h-12 rounded-full bg-burgundy-dark flex items-center justify-center flex-shrink-0 shadow-md shadow-burgundy-dark/20">
                  {card.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-playfair text-lg font-bold text-burgundy-dark mb-1.5">
                    {card.title}
                  </h3>

                  {/* Regular lines */}
                  {card.lines?.map((line) => (
                    <p key={line} className="text-sm text-gray-500 leading-relaxed">
                      {line}
                    </p>
                  ))}

                  {/* Hours table */}
                  {card.hours && (
                    <div className="space-y-1 mt-1">
                      {card.hours.map((h) => (
                        <div key={h.day} className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">{h.day}</span>
                          <span className="text-burgundy font-semibold">{h.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Map Section ── */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="text-center mb-6">
          <p className="text-xs tracking-[0.18em] uppercase text-gold font-semibold mb-1">
            Find Us
          </p>
          <h2 className="font-playfair text-2xl font-bold text-burgundy-dark">
            Our Location
          </h2>
        </div>
        <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3924.2997393433097!2d123.99826357503657!3d10.397751189728945!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a9bdd6333f7849%3A0xabde058509d1a5ea!2sJ%20Benz%20Bistro!5e0!3m2!1sen!2sph!4v1792023596761!5m2!1sen!2sph"
            width="100%"
            height="420"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="JBenz Bistro Location"
          />
        </div>
        <div className="mt-4 text-center">
          <a
            href="https://maps.app.goo.gl/kUhdnCXeCSz7DmuKA"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gold hover:text-gold-light transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Open in Google Maps
          </a>
        </div>
      </div>

        <Footer />
    </div>
  );
}