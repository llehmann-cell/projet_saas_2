"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./page.module.css";

type GeneratedContent = {
  title: string;
  angle: string;
  article: string[];
  linkedinPost: string;
  carousel: string[];
  topics: string[];
};

const fallbackTopics = [
  "croissance organique",
  "veille marche",
  "strategie contenu",
  "automatisation marketing",
];

const minimumCarouselLength = 5;

type ExpandableSection = "article" | "linkedin" | "carousel";

function normalizeUrl(rawUrl: string) {
  const value = rawUrl.trim();

  if (!value) {
    return "";
  }

  try {
    return new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function ensureList(items: unknown, fallback: string[]) {
  if (!Array.isArray(items)) {
    return fallback;
  }

  const cleanedItems = items.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );

  return cleanedItems.length > 0 ? cleanedItems : fallback;
}

function normalizeGeneratedContent(
  value: Partial<GeneratedContent>,
  fallbackUrl = urlDefault,
): GeneratedContent {
  const fallback = makeContent(fallbackUrl) ?? makeContent(urlDefault);
  const base = fallback as GeneratedContent;
  const article = ensureList(value.article, base.article);
  const topics = ensureList(value.topics, base.topics).slice(0, 5);
  const carousel = ensureList(value.carousel, base.carousel);

  while (carousel.length < minimumCarouselLength) {
    carousel.push(
      `Slide ${carousel.length + 1} - Une idee actionnable sur ${topics[0] ?? "le sujet"}`,
    );
  }

  return {
    title: typeof value.title === "string" && value.title.trim() ? value.title : base.title,
    angle: typeof value.angle === "string" && value.angle.trim() ? value.angle : base.angle,
    article,
    linkedinPost:
      typeof value.linkedinPost === "string" && value.linkedinPost.trim()
        ? value.linkedinPost
        : base.linkedinPost,
    carousel: carousel.slice(0, 7),
    topics,
  };
}

function getSectionText(content: GeneratedContent, section: ExpandableSection) {
  if (section === "article") {
    return content.article.join("\n\n");
  }

  if (section === "carousel") {
    return content.carousel.join("\n");
  }

  return content.linkedinPost;
}

const urlDefault = "https://example.com/blog/strategie-contenu-b2b";

function makeContent(rawUrl: string): GeneratedContent | null {
  const url = normalizeUrl(rawUrl);

  if (!url) {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  const brand = host.split(".")[0]?.replace(/-/g, " ") || "votre source";
  const readableBrand = brand.charAt(0).toUpperCase() + brand.slice(1);
  const pathHints = url.pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.replace(/[-_]/g, " "));
  const topics = pathHints.length > 0 ? pathHints : fallbackTopics;
  const mainTopic = topics[0];

  return {
    title: `Ce que ${readableBrand} revele sur ${mainTopic}`,
    angle:
      "Transformer une page source en contenu expert: resume utile, point de vue clair, puis declinaisons pretes a publier.",
    article: [
      `La page ${host} donne un bon point de depart pour construire un article autour de ${mainTopic}. L'enjeu n'est pas de repeter la source, mais d'en extraire une idee defendable, utile et actionnable.`,
      `Le premier angle consiste a identifier la tension: pourquoi ce sujet compte maintenant, quels choix il impose, et quelle erreur les equipes font souvent quand elles le traitent trop vite.`,
      `Pour rendre l'article plus fort, ajoutez un exemple concret, une checklist de decision et une conclusion qui invite le lecteur a tester une action simple cette semaine.`,
    ],
    linkedinPost: `J'ai analyse ${host} sous l'angle "${mainTopic}".\n\nCe qui ressort: le contenu performant ne se contente pas de resumer une URL. Il transforme une information brute en point de vue.\n\nLa bonne sequence:\n1. extraire l'idee forte\n2. formuler une tension claire\n3. donner un exemple applicable\n4. finir avec une action simple\n\nC'est exactement ce qu'un moteur de contenu devrait automatiser sans retirer la voix de l'auteur.`,
    carousel: [
      `Slide 1 - ${readableBrand}: l'idee a retenir`,
      `Slide 2 - Le probleme: trop de contenus resument, peu prennent position`,
      `Slide 3 - La methode: source, angle, preuve, action`,
      `Slide 4 - Exemple: partir de "${mainTopic}" pour creer un post utile`,
      "Slide 5 - CTA: recevez une veille hebdomadaire transformee en idees de contenu",
    ],
    topics,
  };
}

export default function Home() {
  const [url, setUrl] = useState(urlDefault);
  const [instruction, setInstruction] = useState(
    "Fais ressortir un angle utile pour des dirigeants B2B sur LinkedIn.",
  );
  const [email, setEmail] = useState("");
  const [content, setContent] = useState<GeneratedContent | null>(() =>
    makeContent(urlDefault),
  );
  const [expandedSections, setExpandedSections] = useState<
    Record<ExpandableSection, boolean>
  >({
    article: false,
    linkedin: false,
    carousel: false,
  });
  const [urlError, setUrlError] = useState("");
  const [subscribeStatus, setSubscribeStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const topicLine = useMemo(
    () => (content ? content.topics.join(" / ") : "URL / extraction / idees"),
    [content],
  );

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUrl = normalizeUrl(url);

    if (!normalizedUrl) {
      setUrlError("Entrez une URL valide pour generer le contenu.");
      return;
    }

    setIsGenerating(true);
    setUrlError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, instruction }),
      });
      const payload = (await response.json()) as
        | GeneratedContent
        | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in payload && payload.message
            ? payload.message
            : "Impossible de generer avec Mistral.",
        );
      }

      setContent(normalizeGeneratedContent(payload as GeneratedContent, url));
      setExpandedSections({ article: false, linkedin: false, carousel: false });
    } catch (error) {
      setUrlError(
        error instanceof Error
          ? error.message
          : "Impossible de generer avec Mistral.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSubscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubscribeStatus("");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          topics: content?.topics ?? fallbackTopics,
          sourceUrl: url,
        }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || "Impossible d'inscrire cet email.");
      }

      setSubscribeStatus(payload.message || "Email enregistre pour la newsletter.");
      setEmail("");
    } catch (error) {
      setSubscribeStatus(
        error instanceof Error ? error.message : "Une erreur est survenue.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleSection(section: ExpandableSection) {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function renderToggle(section: ExpandableSection) {
    if (!content || getSectionText(content, section).length < 260) {
      return null;
    }

    const isExpanded = expandedSections[section];

    return (
      <button
        className={styles.readMore}
        type="button"
        onClick={() => toggleSection(section)}
        aria-expanded={isExpanded}
      >
        {isExpanded ? "Voir moins" : "Voir la suite"}
      </button>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.backgroundShapes} aria-hidden="true" />
      <section className={styles.workspace} aria-label="Generateur de contenu">
        <aside className={styles.sidebar}>
          <div>
            <p className={styles.kicker}>SaaS contenu</p>
            <h1>URL vers contenu pret a publier.</h1>
            <p className={styles.subtle}>
              Collez une source et obtenez un article, un post LinkedIn, un
              carousel et une accroche newsletter.
            </p>
          </div>

          <form className={styles.urlForm} onSubmit={handleGenerate}>
            <label htmlFor="source-url">URL source</label>
            <div className={styles.inputRow}>
              <input
                id="source-url"
                inputMode="url"
                placeholder="https://..."
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
              <button type="submit" disabled={isGenerating}>
                {isGenerating ? "Mistral..." : "Generer"}
              </button>
            </div>
            <label htmlFor="mistral-instruction">Consigne pour Mistral</label>
            <textarea
              id="mistral-instruction"
              rows={4}
              placeholder="Ex: cree un angle expert, ton sobre, cible CEO B2B..."
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
            />
            {urlError ? <p className={styles.error}>{urlError}</p> : null}
          </form>

          <div className={styles.pipeline}>
            <span>1. Lecture URL</span>
            <span>2. Chat Mistral</span>
            <span>3. Blog + LinkedIn</span>
            <span>4. Newsletter n8n</span>
          </div>
        </aside>

        <section className={styles.preview}>
          <div className={styles.topbar}>
            <div>
              <p className={styles.kicker}>Brouillon genere</p>
              <h2>{content?.title}</h2>
            </div>
            <span className={styles.badge}>{topicLine}</span>
          </div>

          {content ? (
            <div className={styles.grid}>
              <article className={styles.articlePanel}>
                <p className={styles.sectionLabel}>Article de blog</p>
                <h3>{content.angle}</h3>
                <div
                  className={`${styles.collapsible} ${
                    expandedSections.article ? styles.expanded : ""
                  }`}
                >
                  {content.article.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {renderToggle("article")}
              </article>

              <article className={styles.socialPanel}>
                <p className={styles.sectionLabel}>Post LinkedIn</p>
                <div
                  className={`${styles.collapsible} ${
                    expandedSections.linkedin ? styles.expanded : ""
                  }`}
                >
                  <pre>{content.linkedinPost}</pre>
                </div>
                {renderToggle("linkedin")}
              </article>

              <article className={styles.carouselPanel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Carousel</p>
                    <h3>{content.carousel.length} slides generees</h3>
                  </div>
                  {renderToggle("carousel")}
                </div>
                <div
                  className={`${styles.slides} ${
                    expandedSections.carousel ? styles.expandedSlides : ""
                  }`}
                >
                  {content.carousel.map((slide, index) => (
                    <div className={styles.slide} key={slide}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <p>{slide}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className={styles.newsletterPanel}>
                <p className={styles.sectionLabel}>Call to action</p>
                <h3>Recevoir une veille hebdomadaire prete a transformer.</h3>
                <form onSubmit={handleSubscribe}>
                  <input
                    aria-label="Adresse email"
                    type="email"
                    placeholder="vous@entreprise.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                  <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Envoi..." : "S'inscrire"}
                  </button>
                </form>
                {subscribeStatus ? (
                  <p className={styles.status}>{subscribeStatus}</p>
                ) : (
                  <p className={styles.subtle}>
                    Le backend sauvegarde l&apos;email et peut declencher un webhook
                    n8n via <code>N8N_NEWSLETTER_WEBHOOK_URL</code>.
                  </p>
                )}
              </article>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
