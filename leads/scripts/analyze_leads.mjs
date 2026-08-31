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

function generateMessage(firstName, niche, challenge, whatSell, tier) {
  const name = firstName || "there";
  const challengeShort = (challenge || "").split(/[.\n]/)[0].trim();
  const product = (whatSell || "").split(",")[0].trim();
  const cName = '"' + challengeShort + '"';

  const templates = {
    "Design & Creative": "Hi " + name + "! I saw your registration for the Sell Out Challenge and noticed you're a designer whose challenge is: " + cName + ". I specialize in helping creatives like you stop undercharging and land clients who pay what you're worth. The challenge starts soon. Are you ready to join?",
    "Coaching / Courses / Digital Products": "Hi " + name + "! I saw you registered for the Sell Out Challenge. You mentioned: " + cName + ". I help coaches and course creators turn their knowledge into offers that actually convert. The Sell Out Challenge walks you through exactly that. Interested?",
    "Physical Products / Fashion / Beauty": "Hi " + name + "! I noticed you sell " + (product || "your products") + " and your main challenge is: " + cName + ". I help product businesses build simple sales systems that bring in consistent customers. The Sell Out Challenge covers this step by step. Want in?",
    "Food & Pastries": "Hi " + name + "! I saw your registration. You mentioned: " + cName + ". I help food businesses get consistent orders without begging for sales. The Sell Out Challenge gives you a simple system to make that happen. Want to join?",
    "Tech / Freelance Services": "Hi " + name + "! I saw you registered for the Sell Out Challenge. You said: " + cName + ". I help freelancers and tech service providers land clients consistently. This challenge gives you the exact framework. Are you joining?",
    "Other Business": "Hi " + name + "! I saw your registration for the Sell Out Challenge. You mentioned: " + cName + ". This challenge is built to help you figure out exactly how to sell what you have. Want me to walk you through it?",
    "Beginners / Idea Stage": "Hi " + name + "! I saw your registration and that you're still figuring things out. That's exactly who the Sell Out Challenge is for. You'll leave knowing exactly what to sell, who to sell to, and how. Ready to start?",
  };

  return templates[niche] || templates["Beginners / Idea Stage"];
}

function whatsappURL(phone, message) {
  const encoded = encodeURIComponent(message);
  return "https://wa.me/" + phone + "?text=" + encoded;
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

// Score, classify, message
const enriched = unique.map((r) => {
  const phone = normalizePhone(r[2]);
  // Determine if this lead actively sells: flag is Yes, or a real product is described
  const sells = sellFlag(r) !== "no" && product(r) !== "";
  const niche = classifyNiche(product(r), who_(r));
  const { score, tier } = scoreLead(r);
  const name = cleanName(r[1]);
  const fn = firstName(r[1]);
  const msg = generateMessage(fn, niche, pain(r), product(r), tier);
  const url = phone ? whatsappURL(phone, msg) : "";

  return {
    name, firstName: fn, phone: phone || "", whatsappURL: url,
    email: r[3] || "", role: who_(r), whatSells: product(r) || (sells ? "Yes" : ""),
    challenge: pain(r), investment: budget(r), goal: goal(r),
    sells, niche, leadScore: score, tier, message: msg, status: "New",
    timestamp: r[0] || "",
  };
});

// Sort by score descending
enriched.sort((a, b) => b.leadScore - a.leadScore);

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
const jsExport = "// Auto-generated by analyze_leads.mjs \u2014 do not edit manually\nwindow.LEADS_DATA = " + JSON.stringify(enriched, null, 2) + ";\n";
writeFileSync(OUTPUT_JS, jsExport, "utf8");
console.log("Wrote leads-data.js:", (jsExport.length / 1024).toFixed(1), "KB");
