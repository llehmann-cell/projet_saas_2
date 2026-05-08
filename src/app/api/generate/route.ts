type GeneratedContent = {
  title: string;
  angle: string;
  article: string[];
  linkedinPost: string;
  carousel: string[];
  topics: string[];
};

type MistralResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxSourceCharacters = 9000;
const minimumCarouselLength = 5;
const fallbackArticle = [
  "La source fournit une base utile pour construire un contenu clair, mais elle doit etre transformee en point de vue pour devenir vraiment publiable.",
  "Le bon angle consiste a identifier la tension principale, a expliquer pourquoi elle compte maintenant, puis a montrer ce qu'une equipe peut faire concretement.",
  "Pour renforcer le contenu, ajoutez un exemple, une decision a prendre et une action simple a tester dans les prochains jours.",
];

function readServerEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    return "";
  }

  return value.replace(/^["']|["']$/g, "").trim();
}

function getMistralApiKey() {
  const apiKey = readServerEnv("MISTRAL_API_KEY");

  return apiKey.replace(/^Bearer\s+/i, "").trim();
}

function normalizeUrl(rawUrl: string) {
  const value = rawUrl.trim();

  if (!value) {
    return null;
  }

  try {
    return new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function extractText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxSourceCharacters);
}

async function readSource(url: URL) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ContentFlow/0.1 (+https://localhost)",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return `URL: ${url.toString()}\nLa page a retourne le statut ${response.status}.`;
    }

    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();

    if (contentType.includes("text/html")) {
      return extractText(body);
    }

    return body.replace(/\s+/g, " ").trim().slice(0, maxSourceCharacters);
  } catch {
    return `URL: ${url.toString()}\nImpossible de lire automatiquement la page. Produis un contenu a partir de l'URL et de ses indices.`;
  }
}

function parseMistralContent(content: MistralResponse["choices"]) {
  const rawContent = content?.[0]?.message?.content;

  if (typeof rawContent === "string") {
    return rawContent;
  }

  if (Array.isArray(rawContent)) {
    return rawContent
      .filter((chunk) => chunk.type === "text" && typeof chunk.text === "string")
      .map((chunk) => chunk.text)
      .join("");
  }

  return "";
}

function assertGeneratedContent(value: unknown): GeneratedContent {
  const content = value as Partial<GeneratedContent>;

  if (
    typeof content.title !== "string" ||
    typeof content.angle !== "string" ||
    !Array.isArray(content.article) ||
    !Array.isArray(content.carousel) ||
    !Array.isArray(content.topics) ||
    typeof content.linkedinPost !== "string"
  ) {
    throw new Error("Mistral n'a pas retourne le format attendu.");
  }

  const article = content.article.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  const carousel = content.carousel.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  const topics = content.topics.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );

  while (carousel.length < minimumCarouselLength) {
    carousel.push(
      `Slide ${carousel.length + 1} - Point cle a developper pour rendre le contenu actionnable`,
    );
  }

  return {
    title: content.title,
    angle: content.angle,
    article: article.length > 0 ? article : fallbackArticle,
    linkedinPost: content.linkedinPost,
    carousel,
    topics: topics.length > 0 ? topics : ["strategie contenu", "LinkedIn", "carousel"],
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    url?: unknown;
    instruction?: unknown;
  } | null;
  const url = normalizeUrl(typeof body?.url === "string" ? body.url : "");

  if (!url) {
    return Response.json(
      { message: "Entrez une URL valide pour generer le contenu." },
      { status: 400 },
    );
  }

  const apiKey = getMistralApiKey();

  if (!apiKey) {
    return Response.json(
      { message: "Ajoutez MISTRAL_API_KEY dans .env pour activer Mistral." },
      { status: 500 },
    );
  }

  const sourceText = await readSource(url);
  const instruction =
    typeof body?.instruction === "string" && body.instruction.trim()
      ? body.instruction.trim()
      : "Genere une version claire, professionnelle et actionnable.";

  const mistralResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: readServerEnv("MISTRAL_MODEL") || "mistral-small-latest",
      temperature: 0.55,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant editorial SaaS francophone. Tu transformes une URL source en contenus marketing B2B prets a retravailler. Tous les champs doivent etre remplis. Le carousel est obligatoire a chaque generation. Retourne uniquement un JSON valide avec ces cles: title string court et lisible, angle string, article array de 3 paragraphes, linkedinPost string, carousel array de 5 a 7 slides completes, topics array de 3 a 5 sujets.",
        },
        {
          role: "user",
          content: JSON.stringify({
            url: url.toString(),
            instruction,
            sourceText,
          }),
        },
      ],
    }),
  });

  if (!mistralResponse.ok) {
    const details = await mistralResponse.text();

    return Response.json(
      {
        message: "Mistral n'a pas pu generer le contenu.",
        details: details.slice(0, 500),
      },
      { status: 502 },
    );
  }

  try {
    const payload = (await mistralResponse.json()) as MistralResponse;
    const generated = assertGeneratedContent(
      JSON.parse(parseMistralContent(payload.choices)),
    );

    return Response.json(generated);
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "La reponse Mistral est illisible.",
      },
      { status: 502 },
    );
  }
}
