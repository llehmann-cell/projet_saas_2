import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Subscriber = {
  email: string;
  topics: string[];
  sourceUrl: string;
  createdAt: string;
};

const storagePath = path.join(
  process.cwd(),
  "data",
  "newsletter-subscribers.json",
);

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readSubscribers() {
  try {
    const file = await readFile(storagePath, "utf8");
    return JSON.parse(file) as Subscriber[];
  } catch {
    return [];
  }
}

async function saveSubscriber(subscriber: Subscriber) {
  const subscribers = await readSubscribers();
  const withoutDuplicate = subscribers.filter(
    (item) => item.email.toLowerCase() !== subscriber.email.toLowerCase(),
  );

  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(
    storagePath,
    JSON.stringify([subscriber, ...withoutDuplicate], null, 2),
    "utf8",
  );
}

async function notifyN8n(subscriber: Subscriber) {
  const webhookUrl = process.env.N8N_NEWSLETTER_WEBHOOK_URL;

  if (!webhookUrl) {
    return "not_configured";
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "newsletter_subscription",
      subscriber,
    }),
  });

  if (!response.ok) {
    throw new Error("Le webhook n8n n'a pas accepte la demande.");
  }

  return "sent";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    topics?: unknown;
    sourceUrl?: unknown;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!isValidEmail(email)) {
    return Response.json(
      { message: "Entrez une adresse email valide." },
      { status: 400 },
    );
  }

  const subscriber: Subscriber = {
    email,
    topics: Array.isArray(body?.topics)
      ? body.topics.filter((topic): topic is string => typeof topic === "string")
      : [],
    sourceUrl: typeof body?.sourceUrl === "string" ? body.sourceUrl : "",
    createdAt: new Date().toISOString(),
  };

  try {
    await saveSubscriber(subscriber);
    const n8nStatus = await notifyN8n(subscriber);

    return Response.json({
      message:
        n8nStatus === "sent"
          ? "Email enregistre et automatisation n8n declenchee."
          : "Email enregistre. Ajoutez N8N_NEWSLETTER_WEBHOOK_URL pour activer n8n.",
    });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Impossible d'enregistrer cet email.",
      },
      { status: 500 },
    );
  }
}
