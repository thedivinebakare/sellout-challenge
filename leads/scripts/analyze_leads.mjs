import { readFileSync, writeFileSync } from "fs";

const CSV_PATH = new URL("../data/registrations.csv", import.meta.url);
const OUTPUT_CSV = new URL("../data/enriched_leads.csv", import.meta.url);
const OUTPUT_JS = new URL("../data/leads-data.js", import.meta.url);

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ",") { row.push(field.trim()); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field.trim());
        if (row.length >= 2 && row[1] !== "") rows.push(row);
        row = []; field = "";
      } else { field += ch; }
    }
  }
  row.push(field.trim());
  if (row.length >= 2 && row[1] !== "") rows.push(row);
  return rows;
}

function normalizePhone(raw) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10) digits = "234" + digits;
  if (digits.startsWith("234") && digits.length >= 12) return digits;
  return null;
}

function cleanName(raw) {
  if (!raw) return "";
  return raw.replace(/[|]/g, "").replace(/\s+/g, " ").trim();
}

function firstName(fullName) {
  const parts = cleanName(fullName).split(" ");
  return parts[0] || "";
}

const design = ["design", "graphic", "visual", "ui", "motion", "animation", "photography", "video edit", "content creat", "brand", "typography", "illustration", "web design", "landing page", "frames", "arabic calligrapher", "artist", "crochet", "beaded", "jewel"];
const coaching = ["coach", "consult", "course", "digital product", "ebook", "training", "information", "teach", "affiliate"];
const physical = ["fashion", "cloth", "wear", "shoe", "bag", "jewel", "perfume", "fragrance", "skincare", "hair", "beauty", "cosmetic", "makeup", "wristwatch", "gadget", "phone", "electronics", "solar", "bedding", "wrist", "ottoman", "home decor", "book", "stationeries", "journal", "merch", "frame", "soap", "accessories", "wigs", "wig", "footwear", "glasses", "gelee", "gele", "makeup"];
const food = ["food", "pastr", "cake", "snack", "chin", "baking", "chinchin", "kilishi", "kulikuli", "yogurt", "zobo", "liquid soap", "meal", "cook", "confectionery", "pastries"];
const tech = ["web", "dev", "tech", "ai", "smm", "social media", "virtual assist", "affiliate", "seo", "copywriting", "freelanc", "automation", "data", "software", "app", "website", "meta", "video creation", "ugc", "voiceover"];

function classifyNiche(whatSell, who) {
  const raw = (whatSell || "").toLowerCase().trim();
  if (!raw || raw === "no" || raw === "") return "Beginners / Idea Stage";

  if (design.some((k) => raw.includes(k))) return "Design & Creative";
  if (coaching.some((k) => raw.includes(k))) return "Coaching / Courses / Digital Products";
  if (food.some((k) => raw.includes(k))) return "Food & Pastries";
  if (physical.some((k) => raw.includes(k))) return "Physical Products / Fashion / Beauty";
  if (tech.some((k) => raw.includes(k))) return "Tech / Freelance Services";
  return "Other Business";
}

function scoreLead(r) {
  let score = 0;

  // Investment Readiness (40%) - budget lives in data[8]
  const inv = (r[8] || "").toLowerCase();
  if (inv.includes("25,000")) score += 40;
  else if (inv.includes("10,000")) score += 25;
  else if (inv.includes("5,000")) score += 10;

  // Active Offer (30%) - product/skills live in data[6]
  const sell = (r[6] || "").toLowerCase().trim();
  const vagueOffers = ["yes", "my skill", "services", "something", "small business", "products", "designs", "design", "skill", "service", "no"];
  if (sell && !vagueOffers.includes(sell) && sell.length > 10) {
    score += 30;
  } else if (sell && sell !== "no" && sell !== "") {
    score += 15;
  }

  // Pain Point Articulation (20%) - challenge text lives in data[7]
  const challenge = (r[7] || "").toLowerCase();
  const specific = ["client", "pricing", "closing", "convert", "position", "offer", "package", "retention", "repeat", "lead", "scaling", "audience", "target", "marketing", "visibility", "brand", "customers", "sales", "advert", "negotiat"];
  const vagueChallenges = ["clarity", "growth", "nothing", "none", ".", "ok", "no challenge", "ffin", "nada"];
  if (challenge.length > 20 && specific.some((k) => challenge.includes(k))) {
    score += 20;
  } else if (challenge.length > 10 && !vagueChallenges.some((k) => challenge.includes(k))) {
    score += 10;
  } else if (challenge.length > 5) {
    score += 5;
  }

  // Revenue Ambition (10%) - goal lives in data[9]
  const goal = (r[9] || "").toLowerCase();
  const milestones = ["100k", "200k", "300k", "400k", "500k", "1m", "million", "six figure", "7 figure", "8 figure", "500", "$", "50k", "60k", "financial", "independent", "stable", "income", "wealth"];
  if (milestones.some((k) => goal.includes(k))) score += 10;
  else if (goal.length > 10) score += 5;

  let tier;
  if (score >= 85) tier = "Tier 1";
  else if (score >= 70) tier = "Tier 2";
  else if (score >= 40) tier = "Tier 3";
  else tier = "Tier 4";

  return { score, tier };
}

// ------------------------------------------------------------
// Multi-copy angle engine
// Four scope-aligned copy angles, tailored per niche.
// Scope (never drift from this):
//   Day 1-2: finding what actually sells + refining the opportunity
//   Day 3-4: packaging the offer into something valuable (not cheap)
//   Day 5-6: simple sales messaging that explains value without begging
//   Day 7:   a practical sales system positioning for first/next ₦50k-₦200k
// Hard rules:
//   - Divine is a sales funnel strategist + creator. Never a "client
//     acquisition specialist", agency, or lead gen guru.
//   - Natural WhatsApp spacing (\n\n). Conversational. Zero em dashes (—).
// ------------------------------------------------------------

const ANGLE_ORDER = ["story", "future", "casual", "audio"];

function sanitizeText(text) {
  return String(text || "")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function shortFragment(text, max) {
  const cleaned = sanitizeText(text)
    .split(/[\n\r]+/)[0]
    .trim();
  if (!cleaned) return "";
  const cap = cleaned.length > max ? cleaned.slice(0, max - 1).trimEnd() + "\u2026" : cleaned;
  return cap;
}

function productFragment(whatSell, max) {
  if (!whatSell) return "";
  const first = String(whatSell).split(",")[0];
  return shortFragment(first, max);
}

function goalRef(goal) {
  const g = shortFragment(goal, 84);
  if (!g || g.length < 3 || /^[.\s]+$/.test(g)) return "";
  return " You mentioned your goal: " + g + ".";
}

// ---- Angle builders (each returns an array of paragraphs) ----

const storyTemplates = {
  "Design & Creative": ({ name, product }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered with " + product + ". With creatives it is almost never a talent problem. The craft is solid. The struggle is quieter: great work, then crickets. Or someone argues your price down before they even see the value.",
    "",
    "Thing is, people do not buy mostly good work. They buy an offer that makes sense. When the offer is packaged right and the messaging shows it simply, the same work stops being 'just a design' and becomes the result they want.",
    "",
    "Imagine an offer that makes total sense, where people instantly get why they should buy from you instead of someone else. That is what we build during the 7-day live Sell Out Challenge sprint. Offer, positioning, and simple sales messaging, packaged together.",
    "",
    "Are you still stuck on that part, or has it sorted itself out?",
  ].join("\n"),
  "Coaching / Courses / Digital Products": ({ name, product }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered with " + product + ". Funny thing about knowledge businesses: you know a lot, but you have never been shown how to turn it into an offer people actually reach for. So the good stuff stays inside, and the sales stay slow.",
    "",
    "It is not that you do not know it. It is that the offer and the message around it are not clear yet. When they are, what you know finally looks worth buying.",
    "",
    "Imagine an offer that makes total sense, where people instantly get why they should buy from you instead of someone else. We build that live during the 7-day Sell Out Challenge sprint. Offer first, then the positioning, then the simple sales message.",
    "",
    "Are you still figuring that out, or have you cracked it?",
  ].join("\n"),
  "Physical Products / Fashion / Beauty": ({ name, product }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered with " + product + ". Honestly, stocking good products is the easy part. The hard part is people browsing, admiring, then quietly ghosting because your offer and your message never showed them why they should part with their money today.",
    "",
    "It is not the products. It is the offer and messaging around them. Get those clear and buyers stop asking 'how much' and start asking 'when can I get it'.",
    "",
    "Imagine an offer that makes total sense, where people instantly get why they should buy from you instead of the next vendor. We build that live in the 7-day Sell Out Challenge sprint.",
    "",
    "Are you still grinding on this, or is it flowing now?",
  ].join("\n"),
  "Food & Pastries": ({ name, product }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered with " + product + ". There is a pattern with food businesses: the product is great, anyone who tastes it repeats, but orders still come in one or two at a time. Or you are out here discounting and 'helping' people buy instead of letting them buy.",
    "",
    "It is not your food. It is the offer and the way you talk about it. When your message shows the value simply, people order without you having to beg or drop the price.",
    "",
    "Imagine an offer that makes total sense, where people instantly get why they should buy from you instead of the next seller. That is what we build live in the 7-day Sell Out Challenge sprint.",
    "",
    "Are you still doing the discount dance, or have you sorted the offer side?",
  ].join("\n"),
  "Tech / Freelance Services": ({ name, product }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered with " + product + ". The skill is obviously there. The struggle for freelancers is rarely delivery, it is being seen as worth it. Clients do not understand what they get, so they hesitate, or they haggle.",
    "",
    "It is not your skill. It is your offer and how you position it. When clients instantly see the outcome and the price makes sense, they stop shopping around.",
    "",
    "Imagine an offer that makes total sense, where people instantly get why they should hire you instead of anyone else. We build that live in the 7-day Sell Out Challenge sprint. Position, packaging, and message, together.",
    "",
    "Are you still chasing clients, or have you sorted the positioning?",
  ].join("\n"),
  "Beginners / Idea Stage": ({ name }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered and noticed you are still in the figuring-it-out stage. That is actually the best place to be for this. Better to get the offer right before the product exists than to build something nobody wants.",
    "",
    "The first step is finding what actually sells, then packaging it into an offer, then the messaging that makes it easy to say yes. In that order.",
    "",
    "Imagine waking up in 7 days with an offer that makes sense and knowing exactly who to show it to. That is what the Sell Out Challenge sprint does. Live, day by day.",
    "",
    "Are you ready to stop second guessing and just build it?",
  ].join("\n"),
  "Other Business": ({ name, product }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered with " + product + ". Here is what I have seen a thousand times: the business is real, but the offer and the message are not quite there, so sales come in drips instead of a system.",
    "",
    "It is rarely the product that is the problem. It is the offer, the positioning, and the messaging. Fix those and the same business starts looking obvious to the right people.",
    "",
    "Imagine an offer that makes total sense, where people instantly get why they should buy from you instead of the next option out there. We build that live in the 7-day Sell Out Challenge sprint.",
    "",
    "Are you still sorting that out, or is it moving now?",
  ].join("\n"),
};

const futureTemplates = {
  "Design & Creative": ({ name, product, goalNote }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered around " + product + "." + goalNote,
    "",
    "The problem usually is not what you know or how hard you work. It is that you have never been shown how to make people want what you already have. For creatives it shows up as undercharging, or clients who never quite see the value.",
    "",
    "In 7 days during the Sell Out Challenge we build it live: a clear offer, strong positioning, and simple sales messaging, so the work you already do stops being the cheap option and starts being the obvious option.",
    "",
    "Are you still trying to figure out how to package your sales system, or have you sorted that out?",
  ].join("\n"),
  "Coaching / Courses / Digital Products": ({ name, product, goalNote }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered around " + product + "." + goalNote,
    "",
    "The problem usually is not what you know or how hard you work. It is that you have never been shown how to make people want what you already have. For coaches and creators it shows up as knowledge that never quite becomes an offer people pay for.",
    "",
    "In 7 days during the Sell Out Challenge we build it live: a clear offer, strong positioning, and simple sales messaging, so what you know finally becomes something people buy.",
    "",
    "Are you still trying to figure out how to package your sales system, or have you sorted that out?",
  ].join("\n"),
  "Physical Products / Fashion / Beauty": ({ name, product, goalNote }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered around " + product + "." + goalNote,
    "",
    "The problem usually is not what you know or how hard you work. It is that you have never been shown how to make people want what you already have. For product businesses it shows up as admiration without checkout, or buyers bargaining your price down.",
    "",
    "In 7 days during the Sell Out Challenge we build it live: a clear offer, strong positioning, and simple sales messaging, so your products sell without you having to talk anyone into it.",
    "",
    "Are you still trying to figure out how to package your sales system, or have you sorted that out?",
  ].join("\n"),
  "Food & Pastries": ({ name, product, goalNote }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered around " + product + "." + goalNote,
    "",
    "The problem usually is not what you know or how hard you work. It is that you have never been shown how to make people want what you already have. For food businesses it shows up as great reviews but thin sales, because the offer and the message are not pulling the price your food deserves.",
    "",
    "In 7 days during the Sell Out Challenge we build it live: a clear offer, strong positioning, and simple sales messaging, so orders come in without the begging and discounting.",
    "",
    "Are you still trying to figure out how to package your sales system, or have you sorted that out?",
  ].join("\n"),
  "Tech / Freelance Services": ({ name, product, goalNote }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered around " + product + "." + goalNote,
    "",
    "The problem usually is not what you know or how hard you work. It is that you have never been shown how to make people want what you already have. For freelancers it shows up as being one of many, not sure how to stand out so clients say yes fast.",
    "",
    "In 7 days during the Sell Out Challenge we build it live: a clear offer, strong positioning, and simple sales messaging, so you stop being the affordable option and become the option they want.",
    "",
    "Are you still trying to figure out how to package your sales system, or have you sorted that out?",
  ].join("\n"),
  "Beginners / Idea Stage": ({ name, goalNote }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw your registration and that you are still deciding what to sell." + goalNote,
    "",
    "The problem is usually not a lack of skill or how hard you scroll. It is that you have never been shown how to find what people will actually buy, and then make them want it.",
    "",
    "In 7 days during the Sell Out Challenge we build it live: you pick what actually sells, package it into a clear offer, and get strong positioning and simple sales messaging to match.",
    "",
    "Are you still trying to figure out how to package your sales system, or have you sorted that out?",
  ].join("\n"),
  "Other Business": ({ name, product, goalNote }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you registered around " + product + "." + goalNote,
    "",
    "The problem usually is not what you know or how hard you work. It is that you have never been shown how to make people want what you already have. For most small businesses it shows up as sales that come in drips, never as a system you can repeat.",
    "",
    "In 7 days during the Sell Out Challenge we build it live: a clear offer, strong positioning, and simple sales messaging, so the business stops relying on luck and starts relying on a system.",
    "",
    "Are you still trying to figure out how to package your sales system, or have you sorted that out?",
  ].join("\n"),
};

const casualTemplates = {
  "Design & Creative": ({ name, product }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you sell " + product + ". Are you still working on clarifying your offer and messaging, or is everything running smoothly now?",
  ].join("\n"),
  "Coaching / Courses / Digital Products": ({ name, product }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you sell " + product + ". Are you still working on clarifying your offer and messaging, or is everything running smoothly now?",
  ].join("\n"),
  "Physical Products / Fashion / Beauty": ({ name, product }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you sell " + product + ". Are you still working on clarifying your offer and messaging, or is everything running smoothly now?",
  ].join("\n"),
  "Food & Pastries": ({ name, product }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you sell " + product + ". Are you still working on clarifying your offer and messaging, or is everything running smoothly now?",
  ].join("\n"),
  "Tech / Freelance Services": ({ name, product }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you sell " + product + ". Are you still working on clarifying your offer and messaging, or is everything running smoothly now?",
  ].join("\n"),
  "Beginners / Idea Stage": ({ name }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you are still figuring out what to sell. Are you still working on clarifying your offer and messaging, or is everything settled now?",
  ].join("\n"),
  "Other Business": ({ name, product }) => [
    "Hey " + name + "! Divine here from Sell Out 1.0.",
    "",
    "Saw you sell " + product + ". Are you still working on clarifying your offer and messaging, or is everything running smoothly now?",
  ].join("\n"),
};

const audioTemplates = {
  "Design & Creative": ({ name, product, cAudio }) => [
    "Hey " + name + ", Divine here from Sell Out 1.0!",
    "",
    "Saw you registered with " + product + (cAudio ? " and mentioned \u201C" + cAudio + "\u201D." : "."),
    "",
    "Looked at it and thought: the craft is clearly solid. The offer packaging and the messaging is the part that makes people actually buy, and that is the part most creatives never get shown.",
    "",
    "So I am hosting a 7-day live sprint called the Sell Out Challenge. We build your offer and sales message live, day by day.",
    "",
    "Let me know if you want the details!",
  ].join("\n"),
  "Coaching / Courses / Digital Products": ({ name, product, cAudio }) => [
    "Hey " + name + ", Divine here from Sell Out 1.0!",
    "",
    "Saw you registered with " + product + (cAudio ? " and mentioned \u201C" + cAudio + "\u201D." : "."),
    "",
    "Looked at it and thought: you clearly know your stuff. The missing piece is packaging that knowledge into an offer people actually reach for, plus the messaging that sells it. That is what makes people buy.",
    "",
    "So I am hosting a 7-day live sprint called the Sell Out Challenge. We build your offer and sales message live.",
    "",
    "Let me know if you want the details!",
  ].join("\n"),
  "Physical Products / Fashion / Beauty": ({ name, product, cAudio }) => [
    "Hey " + name + ", Divine here from Sell Out 1.0!",
    "",
    "Saw you registered with " + product + (cAudio ? " and mentioned \u201C" + cAudio + "\u201D." : "."),
    "",
    "Looked at it and thought: the products are clearly good. The offer packaging and the messaging is the part that turns admirers into buyers, and that is the part most product sellers never get shown.",
    "",
    "So I am hosting a 7-day live sprint called the Sell Out Challenge. We build your offer and sales message live.",
    "",
    "Let me know if you want the details!",
  ].join("\n"),
  "Food & Pastries": ({ name, product, cAudio }) => [
    "Hey " + name + ", Divine here from Sell Out 1.0!",
    "",
    "Saw you registered with " + product + (cAudio ? " and mentioned \u201C" + cAudio + "\u201D." : "."),
    "",
    "Looked at it and thought: the food is clearly good. The offer packaging and the messaging is what makes orders come in without you having to beg or discount. That is what makes people buy.",
    "",
    "So I am hosting a 7-day live sprint called the Sell Out Challenge. We build your offer and sales message live.",
    "",
    "Let me know if you want the details!",
  ].join("\n"),
  "Tech / Freelance Services": ({ name, product, cAudio }) => [
    "Hey " + name + ", Divine here from Sell Out 1.0!",
    "",
    "Saw you registered with " + product + (cAudio ? " and mentioned \u201C" + cAudio + "\u201D." : "."),
    "",
    "Looked at it and thought: the skill is clearly solid. The offer packaging and the messaging is what makes clients say yes and pay your price. Most freelancers never get shown that part.",
    "",
    "So I am hosting a 7-day live sprint called the Sell Out Challenge. We build your offer and sales message live.",
    "",
    "Let me know if you want the details!",
  ].join("\n"),
  "Beginners / Idea Stage": ({ name, cAudio }) => [
    "Hey " + name + ", Divine here from Sell Out 1.0!",
    "",
    "Saw you registered" + (cAudio ? " and mentioned \u201C" + cAudio + "\u201D." : "."),
    "",
    "Looked at it and thought: for where you are now, the first job is figuring out what actually sells, then packaging it into an offer, then the messaging. In that order. That is what people who are stuck never get shown.",
    "",
    "So I am hosting a 7-day live sprint called the Sell Out Challenge. We figure out what to sell and build your offer and sales message live, day by day.",
    "",
    "Let me know if you want the details!",
  ].join("\n"),
  "Other Business": ({ name, product, cAudio }) => [
    "Hey " + name + ", Divine here from Sell Out 1.0!",
    "",
    "Saw you registered with " + product + (cAudio ? " and mentioned \u201C" + cAudio + "\u201D." : "."),
    "",
    "Looked at it and thought: the business is clearly real. The offer packaging and the messaging is the part that turns browsers into buyers, and that is the part most business owners never get shown.",
    "",
    "So I am hosting a 7-day live sprint called the Sell Out Challenge. We build your offer and sales message live.",
    "",
    "Let me know if you want the details!",
  ].join("\n"),
};

// ------------------------------------------------------------
// Follow-up cadence engine (Touches 2, 3 and 4)
// Sent after first contact:
//   Touch 2 = 24h later: quick value check-in
//   Touch 3 = 48h later: Live Hotseat reminder
//   Touch 4 = Day 6:     Early Bird ₦5,000 seat scarcity countdown
// Same hard rules as the outreach angles: Sell Out 1.0 identity,
// natural WhatsApp spacing, zero em dashes.
// ------------------------------------------------------------
const FOLLOWUP_ORDER = ["touch2", "touch3", "touch4"];

const followUpTemplates = {
  "Design & Creative": ({ name, product }) => ({
    touch2: [
      "Hey " + name + ", Divine here (Sell Out 1.0).",
      "",
      "Quick one while I am reviewing registrations: I saw " + product + " on your form. On Day 1-2 of the challenge we narrow down exactly what sells and who it is for, before we package anything. That alone usually saves people weeks of trial and error.",
      "",
      "Still weighing whether the challenge is for you?",
    ].join("\n"),
    touch3: [
      "Hey " + name + ", Divine again.",
      "",
      "For creative businesses, the order is usually wrong: most people learn more skills before they fix the offer. The challenge flips that. Day 1-2 finds what actually sells, Day 3-4 packages it so you stop being the cheap option, Day 5-6 gives you messaging that sells without begging.",
      "",
      "I keep a few hotseats for people who were still deciding. Want me to hold one for you?",
    ].join("\n"),
    touch4: [
      "Hey " + name + ", final check-in from Sell Out 1.0.",
      "",
      "The Early Bird seats at \u20A65,000 are down to the last few and the countdown closes soon. If growing " + product + " is this quarter's plan, lock the seat now and I will see you on Day 1.",
      "",
      "Reply here and I can send the payment details directly.",
    ].join("\n"),
  }),
  "Coaching / Courses / Digital Products": ({ name, product }) => ({
    touch2: [
      "Hey " + name + ", Divine here (Sell Out 1.0).",
      "",
      "Quick one while I am reviewing registrations: I saw " + product + " on your form. The knowledge is clearly there. On Day 1-2 of the challenge we make that knowledge worth buying by finding the exact offer, before any packaging. That shift alone changes how people respond.",
      "",
      "Still weighing whether the challenge is for you?",
    ].join("\n"),
    touch3: [
      "Hey " + name + ", Divine again.",
      "",
      "Most coaches and creators never get shown how knowledge becomes an offer people reach for. That is the whole challenge. Day 3-4 packages your expertise into something valuable, Day 5-6 gives you the messaging, Day 7 the sales system.",
      "",
      "I keep a few hotseats for people who were still deciding. Want me to hold one for you?",
    ].join("\n"),
    touch4: [
      "Hey " + name + ", final check-in from Sell Out 1.0.",
      "",
      "The Early Bird seats at \u20A65,000 are down to the last few and the countdown closes soon. If " + product + " is the business you plan to build this quarter, lock the seat now and I will see you on Day 1.",
      "",
      "Reply here and I can send the payment details directly.",
    ].join("\n"),
  }),
  "Physical Products / Fashion / Beauty": ({ name, product }) => ({
    touch2: [
      "Hey " + name + ", Divine here (Sell Out 1.0).",
      "",
      "Quick one while I am reviewing registrations: I saw " + product + " on your form. The products are the easy part, the offer is not. On Day 1-2 of the challenge we find who exactly buys and why, before we package anything.",
      "",
      "Still weighing whether the challenge is for you?",
    ].join("\n"),
    touch3: [
      "Hey " + name + ", Divine again.",
      "",
      "For product businesses it is always the same gap: admirers, not buyers. Day 3-4 of the challenge packages your offer so people stop asking 'how much' and start asking 'when can I get it'. Day 5-6 handles the messaging, Day 7 the sales system.",
      "",
      "I keep a few hotseats for people who were still deciding. Want me to hold one for you?",
    ].join("\n"),
    touch4: [
      "Hey " + name + ", final check-in from Sell Out 1.0.",
      "",
      "The Early Bird seats at \u20A65,000 are down to the last few and the countdown closes soon. If " + product + " is the business you want selling without you begging, lock the seat now and I will see you on Day 1.",
      "",
      "Reply here and I can send the payment details directly.",
    ].join("\n"),
  }),
  "Food & Pastries": ({ name, product }) => ({
    touch2: [
      "Hey " + name + ", Divine here (Sell Out 1.0).",
      "",
      "Quick one while I am reviewing registrations: I saw " + product + " on your form. Your kind of business usually has the reverse problem, great taste, thin orders. On Day 1-2 of the challenge we find what really moves and who to put it in front of.",
      "",
      "Still weighing whether the challenge is for you?",
    ].join("\n"),
    touch3: [
      "Hey " + name + ", Divine again.",
      "",
      "Food businesses rarely need the begging-and-discounting route, they need the right offer and message. Day 3-4 of the challenge packages yours, Day 5-6 fixes the messaging so orders come in, Day 7 builds the repeatable sales system.",
      "",
      "I keep a few hotseats for people who were still deciding. Want me to hold one for you?",
    ].join("\n"),
    touch4: [
      "Hey " + name + ", final check-in from Sell Out 1.0.",
      "",
      "The Early Bird seats at \u20A65,000 are down to the last few and the countdown closes soon. If " + product + " is the business you want to grow this quarter, lock the seat now and I will see you on Day 1.",
      "",
      "Reply here and I can send the payment details directly.",
    ].join("\n"),
  }),
  "Tech / Freelance Services": ({ name, product }) => ({
    touch2: [
      "Hey " + name + ", Divine here (Sell Out 1.0).",
      "",
      "Quick one while I am reviewing registrations: I saw " + product + " on your form. The skill is clearly there, the positioning is the gap. On Day 1-2 of the challenge we find the offer that makes clients say yes fast, before the packaging begins.",
      "",
      "Still weighing whether the challenge is for you?",
    ].join("\n"),
    touch3: [
      "Hey " + name + ", Divine again.",
      "",
      "For freelancers the trap is being seen as the affordable option. Day 3-4 of the challenge packages your service so the price makes sense, Day 5-6 fixes the messaging so clients stop shopping around, Day 7 the sales system.",
      "",
      "I keep a few hotseats for people who were still deciding. Want me to hold one for you?",
    ].join("\n"),
    touch4: [
      "Hey " + name + ", final check-in from Sell Out 1.0.",
      "",
      "The Early Bird seats at \u20A65,000 are down to the last few and the countdown closes soon. If " + product + " is the service you want booking without the haggle, lock the seat now and I will see you on Day 1.",
      "",
      "Reply here and I can send the payment details directly.",
    ].join("\n"),
  }),
  "Beginners / Idea Stage": ({ name }) => ({
    touch2: [
      "Hey " + name + ", Divine here (Sell Out 1.0).",
      "",
      "Quick one while I am reviewing registrations: you are at the figuring-it-out stage, which is exactly where this works best. Better to find what sells before building. Day 1-2 of the challenge is devoted to exactly that search.",
      "",
      "Still weighing whether the challenge is for you?",
    ].join("\n"),
    touch3: [
      "Hey " + name + ", Divine again.",
      "",
      "Most people stay stuck because they build before they know what sells. The challenge inverts that: Day 1-2 finds what to sell, Day 3-4 packages the offer, Day 5-6 the messaging, Day 7 the sales system. In that order, live.",
      "",
      "I keep a few hotseats for people who were still deciding. Want me to hold one for you?",
    ].join("\n"),
    touch4: [
      "Hey " + name + ", final check-in from Sell Out 1.0.",
      "",
      "The Early Bird seats at \u20A65,000 are down to the last few and the countdown closes soon. If starting a real business this quarter is the plan, lock the seat now and I will see you on Day 1.",
      "",
      "Reply here and I can send the payment details directly.",
    ].join("\n"),
  }),
  "Other Business": ({ name, product }) => ({
    touch2: [
      "Hey " + name + ", Divine here (Sell Out 1.0).",
      "",
      "Quick one while I am reviewing registrations: I saw " + product + " on your form. On Day 1-2 of the challenge we narrow down exactly what sells and who it is for, before we package anything. That step usually saves weeks of guessing.",
      "",
      "Still weighing whether the challenge is for you?",
    ].join("\n"),
    touch3: [
      "Hey " + name + ", Divine again.",
      "",
      "Most small businesses get sales in drips because the offer and message are not clear. Day 3-4 of the challenge packages your offer, Day 5-6 gives you messaging that sells, Day 7 builds the repeatable sales system.",
      "",
      "I keep a few hotseats for people who were still deciding. Want me to hold one for you?",
    ].join("\n"),
    touch4: [
      "Hey " + name + ", final check-in from Sell Out 1.0.",
      "",
      "The Early Bird seats at \u20A65,000 are down to the last few and the countdown closes soon. If growing " + product + " is this quarter's plan, lock the seat now and I will see you on Day 1.",
      "",
      "Reply here and I can send the payment details directly.",
    ].join("\n"),
  }),
};

function generateFollowUps(firstName, niche, whatSell) {
  const name = firstName || "there";
  const product = productFragment(whatSell, 40);
  const tpl = followUpTemplates[niche] || followUpTemplates["Other Business"];
  return tpl({ name, product });
}

function generateMessages(firstName, niche, challenge, whatSell, goal) {
  const name = firstName || "there";
  const product = productFragment(whatSell, 48);
  const cAudio = shortFragment(challenge, 72);
  const goalNote = goalRef(goal);

  const ctx = { name, product, cAudio, goalNote };
  const story = (storyTemplates[niche] || storyTemplates["Other Business"])(ctx);
  const future = (futureTemplates[niche] || futureTemplates["Other Business"])(ctx);
  const casual = (casualTemplates[niche] || casualTemplates["Other Business"])(ctx);
  const audio = (audioTemplates[niche] || audioTemplates["Other Business"])(ctx);

  return { story, future, casual, audio };
}

function whatsappURL(phone, message) {
  const encoded = encodeURIComponent(message);
  return "https://wa.me/" + phone + "?text=" + encoded;
}

// ------------------------------------------------------------
// Verification guards
// ------------------------------------------------------------
function verifyMessages(enriched) {
  const problems = [];
  const forbidden = [
    "client acquisition specialist",
    "lead generation agency",
    "acquisition agency",
    "lead gen guru",
    "we generate leads for you",
  ];

  const allCopy = (l) => {
    const out = [];
    ["story", "future", "casual", "audio"].forEach((angle) => {
      if (l.messages && l.messages[angle]) out.push([l.name + " (" + angle + ")", l.messages[angle]]);
    });
    (FOLLOWUP_ORDER || []).forEach((touch) => {
      if (l.followUps && l.followUps[touch]) out.push([l.name + " (follow-up " + touch + ")", l.followUps[touch]]);
    });
    return out;
  };

  enriched.forEach((l) => {
    allCopy(l).forEach(([tag, text]) => {
      if (text.includes("\u2014")) {
        problems.push(tag + ": contains em dash");
      }
      forbidden.forEach((term) => {
        if (text.toLowerCase().includes(term)) {
          problems.push(tag + ": contains banned term \u201C" + term + "\u201D");
        }
      });
    });
    ["story", "future", "casual"].forEach((angle) => {
      if (l.whatsappURLs && l.whatsappURLs[angle] && !l.whatsappURLs[angle].includes("https://wa.me/")) {
        problems.push(l.name + " (" + angle + "): malformed WhatsApp URL");
      }
    });
  });

  if (problems.length > 0) {
    console.error("\nCopy verification FAILED:");
    problems.forEach((p) => console.error("  - " + p));
    process.exit(1);
  }
  console.log("\nCopy verification passed: outreach + follow-up copy clean, valid WA URLs.");
}

// ------------------------------------------------------------
// Main pipeline
// ------------------------------------------------------------
const raw = readFileSync(CSV_PATH, "utf8");
const all = parseCSV(raw);
const data = all.slice(1);

// Headers in file: Timestamp,Name,Whatsapp,Email,Who,What_Sell,Challenge,Investment,Goal
// BUT the Google Sheets export has an UNLABELED extra column, so data columns are:
//   [0]=Timestamp [1]=Name [2]=Whatsapp [3]=Email [4]=Who [5]=What_Sell(Yes/No)
//   [6]=PRODUCT (labelled "Challenge") [7]=CHALLENGE text (labelled "Investment")
//   [8]=INVESTMENT/budget (labelled "Goal") [9]=GOAL (extra unlabelled column)
// Helper accessors for this misaligned schema:
const who_     = (r) => r[4] || "";
const sellFlag = (r) => (r[5] || "").toLowerCase().trim();
const product  = (r) => r[6] || "";
const pain     = (r) => r[7] || "";
const budget   = (r) => r[8] || "";
const goal     = (r) => r[9] || "";

// Dedup by phone (keep most recent)
const phoneMap = {};
data.forEach((r) => {
  const phone = normalizePhone(r[2]);
  if (!phone) return;
  if (!phoneMap[phone] || new Date(r[0]) > new Date(phoneMap[phone][0])) {
    phoneMap[phone] = r;
  }
});
const unique = Object.values(phoneMap);
console.log("Raw rows:", data.length);
console.log("Unique by phone:", unique.length);
console.log("Duplicates removed:", data.length - unique.length);

// Score, classify, messages
const enriched = unique.map((r) => {
  const phone = normalizePhone(r[2]);
  // Determine if this lead actively sells: flag is Yes, or a real product is described
  const sells = sellFlag(r) !== "no" && product(r) !== "";
  const niche = classifyNiche(product(r), who_(r));
  const { score, tier } = scoreLead(r);
  const name = cleanName(r[1]);
  const fn = firstName(r[1]);
  const messages = generateMessages(fn, niche, pain(r), product(r), goal(r));
  const followUps = generateFollowUps(fn, niche, product(r));
  const storyURL = phone ? whatsappURL(phone, messages.story) : "";
  const futureURL = phone ? whatsappURL(phone, messages.future) : "";
  const casualURL = phone ? whatsappURL(phone, messages.casual) : "";

  return {
    name, firstName: fn, phone: phone || "",
    email: r[3] || "", role: who_(r), whatSells: product(r) || (sells ? "Yes" : ""),
    challenge: pain(r), investment: budget(r), goal: goal(r),
    sells, niche, leadScore: score, tier, status: "New",
    messages,
    followUps,
    whatsappURLs: { story: storyURL, future: futureURL, casual: casualURL },
    message: messages.story,
    whatsappURL: storyURL,
    timestamp: r[0] || "",
  };
});

// Sort by score descending
enriched.sort((a, b) => b.leadScore - a.leadScore);

verifyMessages(enriched);

// Optional sent-history merge: analyze_leads.mjs --progress=outreach_progress.json
// Re-applies Contacted/In Conversation/Enrolled statuses saved in the dashboard so
// a pipeline re-run never resets who has already been reached out to.
const progressIdx = process.argv.indexOf("--progress");
if (progressIdx !== -1 && process.argv[progressIdx + 1]) {
  const progressPath = process.argv[progressIdx + 1];
  try {
    const progress = JSON.parse(readFileSync(progressPath, "utf8"));
    const map = progress && progress.progress ? progress.progress : progress;
    let applied = 0;
    enriched.forEach((l) => {
      const rec = map && map[l.phone];
      if (rec && rec.status) {
        l.status = rec.status;
        applied++;
      }
    });
    console.log("Sent-history merge: applied status to " + applied + " leads from " + progressPath);
  } catch (err) {
    console.error("Could not read progress file at " + progressPath + ": " + err.message);
  }
}

// Distribution summary
const tierCounts = { "Tier 1": 0, "Tier 2": 0, "Tier 3": 0, "Tier 4": 0 };
const nicheCounts = {};
enriched.forEach((l) => {
  tierCounts[l.tier]++;
  nicheCounts[l.niche] = (nicheCounts[l.niche] || 0) + 1;
});
console.log("\nTier distribution:");
Object.entries(tierCounts).forEach(([k, v]) => console.log("  " + k + ": " + v));
console.log("\nNiche distribution:");
Object.entries(nicheCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log("  " + k + ": " + v));

// Write enriched CSV
const csvHeader = "Name,FirstName,Phone,WhatsAppURL,Email,Role,WhatSells,Challenge,Investment,Goal,Niche,LeadScore,Tier,Message,Status";
const csvRows = enriched.map((r) => {
  return [
    '"' + r.name + '"',
    '"' + r.firstName + '"',
    '"' + r.phone + '"',
    '"' + r.whatsappURL + '"',
    '"' + r.email + '"',
    '"' + r.role + '"',
    '"' + r.whatSells + '"',
    '"' + r.challenge + '"',
    '"' + r.investment + '"',
    '"' + r.goal + '"',
    '"' + r.niche + '"',
    r.leadScore,
    '"' + r.tier + '"',
    '"' + r.message.replace(/"/g, '""') + '"',
    '"' + r.status + '"',
  ].join(",");
});
writeFileSync(OUTPUT_CSV, csvHeader + "\n" + csvRows.join("\n"), "utf8");
console.log("\nWrote enriched_leads.csv:", enriched.length, "leads");

// Write JS module
const jsExport = "// Auto-generated by analyze_leads.mjs - do not edit manually\nwindow.LEADS_DATA = " + JSON.stringify(enriched, null, 2) + ";\n";
writeFileSync(OUTPUT_JS, jsExport, "utf8");
console.log("Wrote leads-data.js:", (jsExport.length / 1024).toFixed(1), "KB");