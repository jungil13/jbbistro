"use client";
import Link from "next/link";
import { useState } from "react";   
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ContactPage() {
  const contactCards = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" width="22" height="22">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      ),
      title: "Address",
      lines: ["123 Elegance Boulevard", "Downtown District", "New York, NY 10001"],
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" width="22" height="22">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
      ),
      title: "Phone",
      lines: ["Main: +1 (555) 123-4567", "Reservations: +1 (555) 123-4568"],
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" width="22" height="22">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
      title: "Email",
      lines: ["info@jbenzbistro.com", "reservations@jbenzbistro.com"],
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {/* Page Header */}
      <div className="bg-burgundy-dark py-16 px-6 text-center">
        <p className="text-xs tracking-[0.18em] uppercase text-gold font-semibold mb-2">
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

            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Your full name"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-white transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-white transition-all"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-white transition-all"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Subject
                </label>
                <select className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-white transition-all appearance-none cursor-pointer">
                  <option value="">Select a subject</option>
                  <option value="reservation">Table Reservation</option>
                  <option value="karaoke">Karaoke Room Booking</option>
                  <option value="billiards">Billiard Table Booking</option>
                  <option value="event">Private Event Inquiry</option>
                  <option value="feedback">Feedback</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="How can we help you?"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 focus:bg-white transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gold text-burgundy-dark font-bold py-3 rounded-lg text-sm tracking-wide hover:bg-gold-light hover:-translate-y-0.5 transition-all shadow-md shadow-gold/20"
              >
                Send Message
              </button>
            </form>
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
        <Footer />
    </div>
  );
}