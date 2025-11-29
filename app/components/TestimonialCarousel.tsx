"use client";

import { useState, useEffect } from "react";

const testimonials = [
  {
    quote:
      "Honestly, working with Corsfix has been incredible, the level of support is top-notch.",
    author: "Kyle Conrad",
    role: "Lead Product Designer at Taco Bell",
  },
  {
    quote:
      "I was quite surprised at how easy it was to use Corsfix and how well it's documented.",
    author: "Prem Daryanani",
    role: "Web Developer",
  },
  {
    quote:
      "I've loved the way you're really trying to satisfy users' requests to make Corsfix an outstanding product.",
    author: "Emanuele Luchetti",
    role: "Co-founder and CTO at tuOtempO",
  },
  {
    quote:
      "Great service and great customer support. They always figure out what the fix is for a problem I am having!",
    author: "Cathy",
    role: "Web Enthusiast",
  },
];

export function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
        setIsTransitioning(false);
      }, 300);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const testimonial = testimonials[currentIndex];

  return (
    <blockquote className="space-y-2 drop-shadow-lg">
      <p
        className={`text-lg transition-opacity duration-300 ${
          isTransitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        &ldquo;{testimonial.quote}&rdquo;
      </p>
      <footer
        className={`text-sm transition-opacity duration-300 ${
          isTransitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        {testimonial.author} - {testimonial.role}
      </footer>
    </blockquote>
  );
}
