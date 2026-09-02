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

  enriched.forEach((l) => {
    ["story", "future", "casual", "audio"].forEach((angle) => {
      const text = (l.messages && l.messages[angle]) || "";
      if (text.includes("\u2014")) {
        problems.push(l.name + " (" + angle + "): contains em dash");
      }
      forbidden.forEach((term) => {
        if (text.toLowerCase().includes(term)) {
          problems.push(l.name + " (" + angle + "): contains banned term \u201C" + term + "\u201D");
        }
      });
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
  console.log("\nCopy verification passed: zero em dashes, no banned agency terms, valid WA URLs.");
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
  const storyURL = phone ? whatsappURL(phone, messages.story) : "";
  const futureURL = phone ? whatsappURL(phone, messages.future) : "";
  const casualURL = phone ? whatsappURL(phone, messages.casual) : "";

  return {
    name, firstName: fn, phone: phone || "",
    email: r[3] || "", role: who_(r), whatSells: product(r) || (sells ? "Yes" : ""),
    challenge: pain(r), investment: budget(r), goal: goal(r),
    sells, niche, leadScore: score, tier, status: "New",
    messages,
    whatsappURLs: { story: storyURL, future: futureURL, casual: casualURL },
    message: messages.story,
    whatsappURL: storyURL,
    timestamp: r[0] || "",
  };
});

// Sort by score descending
enriched.sort((a, b) => b.leadScore - a.leadScore);

verifyMessages(enriched);

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