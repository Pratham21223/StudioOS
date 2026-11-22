import type {
  ContentStatus,
  ContentType,
  NotificationType,
  Prisma,
  ReviewDecision,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { env } from "../src/config/env.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import { hashPassword } from "../src/shared/password.js";

/**
 * Figuring Out Media & Education seed.
 *
 * Date strategy: active production deadlines and task dates are relative to
 * the UTC day the seed runs. Re-running on a later date shifts the workload
 * forward. Historical episode dates are fixed public publication dates.
 *
 * Internal people, client contacts, projects, content, tasks, reviews, and
 * approvals are fictional seed records. Public episode records
 * and partner references are clearly separated and attributed to their source.
 */

const ORG = {
  name: "Figuring Out Media & Education",
  slug: "figuring-out-media",
};

const SEED_VERSION = 1;
const SNAPSHOT_DATE = "2026-11-22";
const PARTNERS_SOURCE = "https://figuringout.com/partners";

const INTERNAL_USERS = [
  { key: "admin", name: "Aarav Mehta", email: "admin@figuringout.test", role: "ADMIN" as const },
  {
    key: "manager",
    name: "Priya Nair",
    email: "manager@figuringout.test",
    role: "PROJECT_MANAGER" as const,
  },
  {
    key: "producer",
    name: "Rohan Desai",
    email: "producer@figuringout.test",
    role: "PRODUCER" as const,
  },
  { key: "editor", name: "Ananya Iyer", email: "editor@figuringout.test", role: "EDITOR" as const },
] as const;

const CLIENT_USER = {
  key: "client",
  name: "Maya Kapoor",
  email: "client@figuringout.test",
};

const CLIENT_NAME = "Figuring Out Originals";
const INTERNAL_CLIENT_NAME = "Figuring Out Podcast — Internal Production";

const ORGANIZATION_PROFILE = {
  industry: "Media Production",
  location: "Mumbai, Maharashtra, India",
  timezone: "Asia/Kolkata",
  website: "https://figuringout.com/",
  description:
    "Figuring Out Media & Education is the media company behind Figuring Out with Raj Shamani. It produces long-form conversations with founders, entrepreneurs, scientists, athletes, investors, public figures, and thought leaders. Its content operation extends beyond podcast production into short-form video distribution, written content, brand partnerships, audience research, experimentation, and international distribution.",
  audienceMission:
    "Making valuable knowledge accessible to ambitious people who want to understand how extraordinary individuals think, make decisions, and build their lives.",
  brandMotto: "Ambition. Discipline. Hunger. Courage. Obsession.",
  brandPositioning:
    "The world's most extraordinary people, their ideas, their experiences, and the lessons worth learning from them.",
  primaryHost: "Raj Shamani",
  launched: "December 2020",
  headquarters: "Mumbai, India",
  companySize: "51–200 employees (public LinkedIn listing snapshot)",
  mainFormat: "Long-form conversations",
  publishingCadence:
    "Three episodes per week according to the public website; exact weekdays intentionally not fixed because public sections have shown inconsistent scheduling.",
};

const SOCIAL_CHANNELS = [
  {
    platform: "YouTube",
    account: "Raj Shamani",
    url: "https://youtube.com/@rajshamani",
    audienceSnapshot: "22.9M subscribers",
    snapshotDate: SNAPSHOT_DATE,
  },
  {
    platform: "YouTube",
    account: "Raj Shamani Clips",
    url: "https://youtube.com/@rajshamaniclips",
    audienceSnapshot: "1.88M subscribers",
    snapshotDate: SNAPSHOT_DATE,
  },
  {
    platform: "YouTube",
    account: "Raj Shamani Shorts",
    url: "https://youtube.com/@RajShamani.Shorts",
    audienceSnapshot: "1.84M subscribers",
    snapshotDate: SNAPSHOT_DATE,
  },
  {
    platform: "Instagram",
    account: "Raj Shamani",
    url: "https://instagram.com/rajshamani",
    audienceSnapshot: "12.2M followers",
    snapshotDate: SNAPSHOT_DATE,
  },
  {
    platform: "Instagram",
    account: "Figuring Out",
    url: "https://instagram.com/figuringout.co",
    audienceSnapshot: "2.4M followers",
    snapshotDate: SNAPSHOT_DATE,
  },
  {
    platform: "Instagram",
    account: "Life at Figuring Out",
    url: "https://instagram.com/lifeatfiguringout",
    audienceSnapshot: "20K followers",
    snapshotDate: SNAPSHOT_DATE,
  },
  {
    platform: "X",
    account: "@rajshamani",
    url: "https://x.com/rajshamani",
    audienceSnapshot: "Approximately 508K followers",
    snapshotDate: SNAPSHOT_DATE,
  },
  {
    platform: "LinkedIn",
    account: "Raj Shamani",
    url: "https://www.linkedin.com/in/rajshamani/",
    audienceSnapshot: "Approximately 2.06M followers",
    snapshotDate: SNAPSHOT_DATE,
  },
  {
    platform: "LinkedIn",
    account: "Figuring Out Media",
    url: "https://www.linkedin.com/company/figuringoutmedia/",
    audienceSnapshot: "Approximately 24.3K followers",
    snapshotDate: SNAPSHOT_DATE,
  },
  {
    platform: "Substack",
    account: "Raj Shamani",
    url: "https://substack.com/@rajshamani",
    audienceSnapshot: "Approximately 197K subscribers",
    snapshotDate: SNAPSHOT_DATE,
  },
];

const PARTNERSHIP_FOOTPRINT = {
  combinedFollowers: "Approximately 44M across channels",
  totalViews: "Approximately 2.65B total views",
  sourceUrl: PARTNERS_SOURCE,
  snapshotDate: SNAPSHOT_DATE,
  note: "Public partnership-page snapshot only. Not live analytics and not evidence of an active campaign.",
};

const AUDIENCE_SNAPSHOT = {
  youtubeCombined: "Approximately 26.6M subscribers",
  instagramCombined: "Approximately 14.6M followers",
  linkedinRajShamani: "Approximately 2.06M followers",
  linkedinFiguringOut: "Approximately 24.3K followers",
  xRajShamani: "Approximately 508K followers",
  substackRajShamani: "Approximately 197K subscribers",
  totalAcrossChannels: "Approximately 44M followers",
  totalViews: "Approximately 2.65B",
  snapshotDate: SNAPSHOT_DATE,
  note: "Historical public snapshot from official/public profiles. Never displayed as live or auto-updated analytics.",
};

const CONTENT_CATEGORIES = [
  "Business",
  "Money",
  "Mind",
  "Health",
  "Tech",
  "Sport",
  "World",
  "Career",
];

const PRODUCTION_FORMATS = [
  "Full-length podcast episode",
  "YouTube clip",
  "YouTube Short",
  "Instagram Reel",
  "Podcast audio",
  "LinkedIn post",
  "X post",
  "Substack article",
  "Multilingual audio/video adaptation",
  "Brand collaboration content",
];

const PRODUCTION_FORMAT_MAPPING: Record<string, ContentType> = {
  "Full-length podcast episode": "PODCAST",
  "YouTube clip": "VIDEO",
  "YouTube Short": "SOCIAL_POST",
  "Instagram Reel": "SOCIAL_POST",
  "Podcast audio": "PODCAST",
  "LinkedIn post": "ARTICLE",
  "X post": "SOCIAL_POST",
  "Substack article": "ARTICLE",
  "Multilingual audio/video adaptation": "VIDEO",
  "Brand collaboration content": "VIDEO",
};

const PARTNER_REFERENCES = [
  { brand: "ASUS", category: "Tech / Associate Partners" },
  { brand: "Porter", category: "Delivery / Title Partners" },
  { brand: "Levi's", category: "Clothing / Styling Partners" },
  { brand: "Urban Platter", category: "Food / Health Partners" },
  { brand: "Amazon", category: "Tech Collaboration" },
  { brand: "ChatGPT", category: "AI Collaboration" },
  { brand: "Wispr Flow", category: "AI Collaboration" },
  { brand: "Renault", category: "Automobile Collaboration" },
  { brand: "Goibibo", category: "Travel Partners" },
  { brand: "Samsung", category: "Tech Collaboration" },
  { brand: "Emergent", category: "AI Collaboration" },
  { brand: "ICC World Cup", category: "Sports Collaboration" },
  { brand: "Higgsfield", category: "AI Collaboration" },
  { brand: "Samsonite", category: "Travel Collaboration" },
  { brand: "Cetaphil", category: "Beauty / Episode Partners" },
  { brand: "Mobius Foundation", category: "NGO / Episode Partners" },
  { brand: "Birla Estates", category: "Real Estate / Episode Partners" },
  { brand: "Flipkart", category: "Tech & Delivery Collaboration" },
].map((partner) => ({
  ...partner,
  status: "REFERENCE_ONLY",
  sourceUrl: PARTNERS_SOURCE,
  note: "Publicly listed on the official partnership page. Relationship status and dates are not inferred.",
}));

const ARCHIVE_EPISODES = [
  {
    episodeId: "FO591",
    guest: "Mariana Van Zeller",
    category: "World",
    title: "How Black Markets Secretly Run A Third Of The World",
    published: "2026-11-21",
    location: "Mumbai, India",
    description:
      "A conversation with the investigative journalist behind National Geographic's Trafficked and the podcast The Hidden Third. Topics include investigative journalism, global black markets, criminal networks, scams, and the personal cost of reporting.",
    sourceUrl: "https://figuringout.com/episodes/fo591-mariana-van-zeller",
  },
  {
    episodeId: "FO590",
    guest: "Dr. Daniel Amen",
    category: "Health",
    title: "Top Psychiatrist: What 1000+ Brain Scans Reveal About The Killers",
    published: "2026-11-19",
    location: "Mumbai, India",
    description:
      "A conversation with psychiatrist Dr. Daniel Amen about brain health, psychiatry, brain scans, mental health, behaviour, and the relationship between brain health and everyday decisions.",
    sourceUrl: "https://figuringout.com/episodes/fo590-daniel-amen",
  },
  {
    episodeId: "FO589",
    guest: "Sachin Puri",
    category: "Tech",
    title: "Why AI Will Replace These Jobs: The Skills You Need Next",
    published: "2026-11-17",
    location: "Mumbai, India",
    description:
      "A conversation with the CEO of Newfold Digital covering AI, agentic commerce, small businesses, digital transformation, websites, customer acquisition, and future career opportunities.",
    sourceUrl: "https://figuringout.com/episodes/fo589-sachin-puri",
  },
  {
    episodeId: "FO588",
    guest: "Vinh Giang",
    category: "Mind",
    title: "Why Your Communication Makes People Ignore You & How To Fix It",
    published: "2026-11-14",
    location: "Mumbai, India",
    description:
      "A conversation with communication skills coach and keynote speaker Vinh Giang about confidence, storytelling, body language, public speaking, communication, and emotional intelligence.",
    sourceUrl: "https://figuringout.com/episodes/fo588-vinh-giang",
  },
  {
    episodeId: "FO587",
    guest: "Kent Yoshimura",
    category: "Business",
    title: "Build A $100M Brand Using Influencers & Viral Marketing",
    published: "2026-11-12",
    location: "Mumbai, India",
    description:
      "A conversation with the co-founder and CEO of Neuro about building a consumer brand, influencer marketing, D2C growth, affiliate marketing, brand positioning, and international expansion.",
    sourceUrl: "https://figuringout.com/episodes/fo587-kent-yoshimura",
  },
  {
    episodeId: "FO586",
    guest: "Joe Hudson",
    category: "World",
    title: "Psychology Of Billionaires, Extreme Ambition & Secrets Of Success",
    published: "2026-11-10",
    location: "Mumbai, India",
    description:
      "A conversation with the founder of The Art of Accomplishment about high performance, ambition, emotional intelligence, self-awareness, fear of failure, and personal growth.",
    sourceUrl: "https://figuringout.com/episodes/fo586-joe-hudson",
  },
] as const;

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  VIDEO: "Video",
  PODCAST: "Podcast",
  SOCIAL_POST: "Social post",
  ARTICLE: "Article",
  DESIGN: "Design",
  OTHER: "Other",
};

const STATUS_ORDER: ContentStatus[] = [
  "BRIEF",
  "SCRIPT",
  "SHOOT",
  "EDITING",
  "INTERNAL_REVIEW",
  "CLIENT_APPROVAL",
  "READY_TO_PUBLISH",
];

const STANDARD_PATHS: Record<ContentStatus, ContentStatus[]> = {
  BRIEF: [],
  SCRIPT: ["SCRIPT"],
  SHOOT: ["SCRIPT", "SHOOT"],
  EDITING: ["SCRIPT", "SHOOT", "EDITING"],
  INTERNAL_REVIEW: ["SCRIPT", "SHOOT", "EDITING", "INTERNAL_REVIEW"],
  CLIENT_APPROVAL: ["SCRIPT", "SHOOT", "EDITING", "INTERNAL_REVIEW", "CLIENT_APPROVAL"],
  READY_TO_PUBLISH: [
    "SCRIPT",
    "SHOOT",
    "EDITING",
    "INTERNAL_REVIEW",
    "CLIENT_APPROVAL",
    "READY_TO_PUBLISH",
  ],
};

const PENDING_REVISION_PATH: ContentStatus[] = [
  "SCRIPT",
  "SHOOT",
  "EDITING",
  "INTERNAL_REVIEW",
  "CLIENT_APPROVAL",
  "EDITING",
  "INTERNAL_REVIEW",
  "CLIENT_APPROVAL",
];

const APPROVED_REVISION_PATH: ContentStatus[] = [...PENDING_REVISION_PATH, "READY_TO_PUBLISH"];

type ContentSeed = {
  title: string;
  category: string;
  type: ContentType;
  status: ContentStatus;
  assigneeKey: "producer" | "editor" | "manager";
  dueOffset: number;
  pitch: string;
  history?: "standard" | "pending-revision" | "approved-revision";
};

const WEEKLY_CONTENT: ContentSeed[] = [
  {
    title: "What Makes a Business Survive Its First Ten Years?",
    category: "Business",
    type: "PODCAST",
    status: "BRIEF",
    assigneeKey: "producer",
    dueOffset: 12,
    pitch:
      "An editorial exploration of the operating habits, cash discipline, and decision-making that help businesses survive their first decade.",
  },
  {
    title: "How AI Is Changing the Future of Work in India",
    category: "Tech",
    type: "PODCAST",
    status: "SCRIPT",
    assigneeKey: "producer",
    dueOffset: 10,
    pitch:
      "A script exploring AI adoption, entry-level roles, new skill adjacencies, and what Indian professionals should learn next.",
  },
  {
    title: "How Consumer Brands Build Customer Trust",
    category: "Business",
    type: "PODCAST",
    status: "SHOOT",
    assigneeKey: "producer",
    dueOffset: 8,
    pitch:
      "A production about repeat purchase, transparency, community, and the difference between attention and trust.",
  },
  {
    title: "The Art of Clear Communication",
    category: "Mind",
    type: "PODCAST",
    status: "EDITING",
    assigneeKey: "editor",
    dueOffset: 6,
    pitch:
      "An episode on framing, listening, storytelling, body language, and making complex ideas easy to act on.",
  },
  {
    title: "What High Performers Understand About Failure",
    category: "Mind",
    type: "PODCAST",
    status: "INTERNAL_REVIEW",
    assigneeKey: "editor",
    dueOffset: 4,
    pitch:
      "A conversation about feedback loops, identity, recovery, and turning setbacks into better decisions.",
  },
  {
    title: "Building an Audience Through Better Storytelling",
    category: "Business",
    type: "PODCAST",
    status: "CLIENT_APPROVAL",
    assigneeKey: "producer",
    dueOffset: 2,
    pitch:
      "A client-review episode about narrative structure, repeatable formats, audience memory, and distribution.",
    history: "pending-revision",
  },
  {
    title: "The Discipline Behind Long-Term Success",
    category: "Mind",
    type: "PODCAST",
    status: "READY_TO_PUBLISH",
    assigneeKey: "producer",
    dueOffset: 1,
    pitch:
      "A final-cut episode about consistency, recovery, measurement, and the quiet systems behind visible outcomes.",
    history: "approved-revision",
  },
];

const DISTRIBUTION_CONTENT: ContentSeed[] = [
  {
    title: "Episode 101 — YouTube Full Episode Package",
    category: "Business",
    type: "VIDEO",
    status: "EDITING",
    assigneeKey: "editor",
    dueOffset: 5,
    pitch: "YouTube package for the long-form conversation.",
  },
  {
    title: "Episode 101 — YouTube Shorts Set",
    category: "Mind",
    type: "SOCIAL_POST",
    status: "SCRIPT",
    assigneeKey: "editor",
    dueOffset: 6,
    pitch: "Short-form hooks and captions derived from the source episode.",
  },
  {
    title: "Episode 101 — Instagram Reels Set",
    category: "Mind",
    type: "SOCIAL_POST",
    status: "SHOOT",
    assigneeKey: "producer",
    dueOffset: 7,
    pitch: "Vertical-video cutdowns for Instagram Reels.",
  },
  {
    title: "Episode 101 — Podcast Audio Package",
    category: "Business",
    type: "PODCAST",
    status: "READY_TO_PUBLISH",
    assigneeKey: "producer",
    dueOffset: 1,
    pitch: "Audio master and show notes package for podcast distribution.",
  },
  {
    title: "Episode 101 — LinkedIn Summary",
    category: "Career",
    type: "ARTICLE",
    status: "INTERNAL_REVIEW",
    assigneeKey: "manager",
    dueOffset: 3,
    pitch: "Written summary adapted for a professional audience.",
  },
  {
    title: "Episode 101 — X Thread",
    category: "Tech",
    type: "SOCIAL_POST",
    status: "BRIEF",
    assigneeKey: "producer",
    dueOffset: 8,
    pitch: "Thread outline built around the episode's central questions.",
  },
  {
    title: "Episode 101 — Substack Episode Notes",
    category: "Money",
    type: "ARTICLE",
    status: "SCRIPT",
    assigneeKey: "editor",
    dueOffset: 9,
    pitch: "Long-form newsletter notes and references for the episode.",
  },
  {
    title: "Episode 101 — Hindi & Spanish Adaptations",
    category: "World",
    type: "VIDEO",
    status: "EDITING",
    assigneeKey: "editor",
    dueOffset: 10,
    pitch: "Multilingual adaptation package in Hindi and Spanish.",
  },
  {
    title: "Episode 101 — Brand Collaboration Cutdowns",
    category: "Business",
    type: "VIDEO",
    status: "BRIEF",
    assigneeKey: "producer",
    dueOffset: 12,
    pitch: "Collaboration-format cutdowns prepared for an approved brand partnership package.",
  },
];

type TaskTemplate = {
  title: string;
  description: string;
  role: "manager" | "producer" | "editor" | "admin";
  priority: TaskPriority;
  startedAt: ContentStatus;
  doneAt: ContentStatus;
  dueOffset: number;
  blockedUntil?: ContentStatus;
};

const WEEKLY_TASK_TEMPLATES: TaskTemplate[] = [
  {
    title: "Review audience conversations and emerging topics",
    description:
      "Review audience questions across Reddit, X, LinkedIn, Instagram, YouTube, news, and first-party audience notes. Capture three questions worth exploring.",
    role: "producer",
    priority: "HIGH",
    startedAt: "BRIEF",
    doneAt: "SCRIPT",
    dueOffset: -12,
  },
  {
    title: "Prepare sourced guest research brief",
    description:
      "Build a sourced brief with an original angle, previous interview coverage, claims to verify, and open questions.",
    role: "producer",
    priority: "HIGH",
    startedAt: "SCRIPT",
    doneAt: "SHOOT",
    dueOffset: -9,
  },
  {
    title: "Prepare interview question bank",
    description:
      "Draft questions that have not already been answered in public interviews, grouped by narrative arc.",
    role: "producer",
    priority: "URGENT",
    startedAt: "SCRIPT",
    doneAt: "INTERNAL_REVIEW",
    dueOffset: -7,
  },
  {
    title: "Confirm guest availability",
    description: "Confirm the guest holds the recording window and update the production calendar.",
    role: "producer",
    priority: "URGENT",
    startedAt: "BRIEF",
    doneAt: "SHOOT",
    dueOffset: -5,
    blockedUntil: "SHOOT",
  },
  {
    title: "Prepare production schedule and A/V checks",
    description:
      "Confirm studio, lighting, audio, camera, backup recording, and run-of-show timing.",
    role: "producer",
    priority: "HIGH",
    startedAt: "SHOOT",
    doneAt: "EDITING",
    dueOffset: -3,
  },
  {
    title: "Edit long-form master",
    description: "Assemble the master, remove dead air, strengthen the opening, and balance audio.",
    role: "editor",
    priority: "URGENT",
    startedAt: "EDITING",
    doneAt: "CLIENT_APPROVAL",
    dueOffset: -1,
  },
  {
    title: "Review audio quality and prepare captions",
    description: "Check loudness, noise, pronunciation, subtitle timing, and caption accuracy.",
    role: "editor",
    priority: "HIGH",
    startedAt: "EDITING",
    doneAt: "INTERNAL_REVIEW",
    dueOffset: 0,
  },
  {
    title: "Create thumbnail and title variants",
    description:
      "Create two thumbnail directions and three title concepts. Compare clarity and audience relevance; do not invent performance results.",
    role: "editor",
    priority: "MEDIUM",
    startedAt: "INTERNAL_REVIEW",
    doneAt: "READY_TO_PUBLISH",
    dueOffset: 1,
  },
];

const DISTRIBUTION_TASK_TEMPLATES: TaskTemplate[] = [
  {
    title: "Prepare YouTube full-episode package",
    description:
      "Assemble title, description, chapters, end screen, and publish checklist for the long-form episode.",
    role: "producer",
    priority: "HIGH",
    startedAt: "CLIENT_APPROVAL",
    doneAt: "READY_TO_PUBLISH",
    dueOffset: 3,
  },
  {
    title: "Prepare YouTube Shorts and Instagram Reels",
    description:
      "Select short-form highlights, compare hooks, and prepare vertical captions for each cut.",
    role: "editor",
    priority: "MEDIUM",
    startedAt: "CLIENT_APPROVAL",
    doneAt: "READY_TO_PUBLISH",
    dueOffset: 4,
  },
  {
    title: "Prepare Spotify audio and multilingual deliverables",
    description:
      "Check the audio package and adaptation readiness for Hindi, English, and Spanish.",
    role: "manager",
    priority: "HIGH",
    startedAt: "CLIENT_APPROVAL",
    doneAt: "READY_TO_PUBLISH",
    dueOffset: 4,
  },
  {
    title: "Prepare LinkedIn summary, X post, and Substack notes",
    description:
      "Adapt the episode into written distribution formats with source links and episode references.",
    role: "manager",
    priority: "MEDIUM",
    startedAt: "CLIENT_APPROVAL",
    doneAt: "READY_TO_PUBLISH",
    dueOffset: 5,
  },
];

const EXPERIMENT_TASK_TEMPLATES: TaskTemplate[] = [
  {
    title: "Compare thumbnail concepts for clarity",
    description:
      "Document the intended hypothesis and review the two thumbnail directions. Do not record fabricated results.",
    role: "manager",
    priority: "MEDIUM",
    startedAt: "INTERNAL_REVIEW",
    doneAt: "READY_TO_PUBLISH",
    dueOffset: 2,
  },
  {
    title: "Review title and episode-opening retention plan",
    description:
      "Evaluate the opening promise, first 30 seconds, and title clarity before publication.",
    role: "manager",
    priority: "HIGH",
    startedAt: "INTERNAL_REVIEW",
    doneAt: "READY_TO_PUBLISH",
    dueOffset: 3,
  },
  {
    title: "Evaluate CTA placement and short-form hooks",
    description:
      "Compare call-to-action placement and short-form hook options; this is a planning task, not a historical experiment result.",
    role: "producer",
    priority: "LOW",
    startedAt: "CLIENT_APPROVAL",
    doneAt: "READY_TO_PUBLISH",
    dueOffset: 5,
  },
];

type SeedContext = {
  organizationId: string;
  userIds: Record<string, string>;
  contentByTitle: Map<string, string>;
  taskByKey: Map<string, string>;
  projects: Map<string, string>;
};

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function dayOffset(days: number): Date {
  const date = startOfTodayUtc();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function statusIndex(status: ContentStatus): number {
  return STATUS_ORDER.indexOf(status);
}

function taskStatusFor(current: ContentStatus, template: TaskTemplate): TaskStatus {
  const currentIndex = statusIndex(current);
  if (currentIndex >= statusIndex(template.doneAt)) return "DONE";
  if (template.blockedUntil && currentIndex < statusIndex(template.blockedUntil)) {
    return "BLOCKED";
  }
  if (currentIndex >= statusIndex(template.startedAt)) return "IN_PROGRESS";
  return "TODO";
}

function archiveDescription(episode: (typeof ARCHIVE_EPISODES)[number]): string {
  return [
    "[HISTORICAL PUBLIC EPISODE — IMPORTED ARCHIVE RECORD]",
    `Episode ID: ${episode.episodeId}`,
    `Guest: ${episode.guest}`,
    `Category: ${episode.category}`,
    `Published: ${episode.published}`,
    `Location: ${episode.location}`,
    `Official source: ${episode.sourceUrl}`,
    "",
    episode.description,
    "",
    "Historical public-release archive record; the final status reflects publication.",
  ].join("\n");
}

function contentDescription(item: ContentSeed, projectNote: string): string {
  return [
    `Category: ${item.category}`,
    `Guest: To be confirmed`,
    `Content type: ${CONTENT_TYPE_LABELS[item.type]}`,
    `Production format: ${item.type === "PODCAST" ? "Full-length podcast / audio" : "Distribution asset"}`,
    "",
    item.pitch,
    "",
    projectNote,
  ].join("\n");
}

function actorForTransition(
  kind: "archive" | "active",
  fromStatus: ContentStatus,
  toStatus: ContentStatus,
  userIds: Record<string, string>,
): string {
  if (kind === "archive") return userIds.manager!;
  if (fromStatus === "CLIENT_APPROVAL") return userIds.client!;
  if (toStatus === "CLIENT_APPROVAL") return userIds.manager!;
  if (toStatus === "READY_TO_PUBLISH") return userIds.client!;
  if (toStatus === "INTERNAL_REVIEW") return userIds.editor!;
  return userIds.producer!;
}

async function upsertClient(
  tx: Prisma.TransactionClient,
  organizationId: string,
  name: string,
  data: {
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    notes?: string | null;
    brandGuidelines?: string | null;
    status?: "ACTIVE" | "ARCHIVED";
  },
) {
  const existing = await tx.client.findFirst({
    where: { organizationId, name },
  });
  if (existing) {
    return tx.client.update({
      where: { id: existing.id },
      data: {
        name,
        contactName: data.contactName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        website: data.website ?? null,
        notes: data.notes ?? null,
        brandGuidelines: data.brandGuidelines ?? null,
        status: data.status ?? "ACTIVE",
      },
    });
  }
  return tx.client.create({
    data: {
      organizationId,
      name,
      contactName: data.contactName ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      website: data.website ?? null,
      notes: data.notes ?? null,
      brandGuidelines: data.brandGuidelines ?? null,
      status: data.status ?? "ACTIVE",
    },
  });
}

async function upsertProject(
  tx: Prisma.TransactionClient,
  organizationId: string,
  name: string,
  data: {
    clientId: string;
    description: string;
    status: "ACTIVE" | "PAUSED" | "COMPLETED";
    startDate: Date | null;
    deadline: Date | null;
  },
) {
  const existing = await tx.project.findFirst({
    where: { organizationId, name },
  });
  if (existing) {
    return tx.project.update({
      where: { id: existing.id },
      data: {
        name,
        clientId: data.clientId,
        description: data.description,
        status: data.status,
        startDate: data.startDate,
        deadline: data.deadline,
      },
    });
  }
  return tx.project.create({
    data: {
      organizationId,
      name,
      clientId: data.clientId,
      description: data.description,
      status: data.status,
      startDate: data.startDate,
      deadline: data.deadline,
    },
  });
}

async function upsertAudit(
  tx: Prisma.TransactionClient,
  organizationId: string,
  input: {
    actorId: string | null;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata: Prisma.InputJsonValue;
    createdAt?: Date;
  },
) {
  const existing = await tx.auditLog.findFirst({
    where: {
      organizationId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    },
  });
  if (existing) {
    return tx.auditLog.update({
      where: { id: existing.id },
      data: {
        actorId: input.actorId,
        metadata: input.metadata,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      },
    });
  }
  return tx.auditLog.create({
    data: {
      organizationId,
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}

async function ensureContent(
  tx: Prisma.TransactionClient,
  context: SeedContext,
  input: {
    projectId: string;
    title: string;
    description: string;
    type: ContentType;
    status: ContentStatus;
    deadline: Date;
    assigneeId: string;
    createdAt: Date;
    kind: "archive" | "active";
    path: ContentStatus[];
  },
) {
  const existing = await tx.contentItem.findFirst({
    where: {
      organizationId: context.organizationId,
      projectId: input.projectId,
      title: input.title,
    },
  });

  const version = input.path.length + 1;
  const data = {
    title: input.title,
    description: input.description,
    type: input.type,
    status: input.status,
    deadline: input.deadline,
    assigneeId: input.assigneeId,
    version,
    createdAt: input.createdAt,
  };

  const content = existing
    ? await tx.contentItem.update({ where: { id: existing.id }, data })
    : await tx.contentItem.create({
        data: {
          organizationId: context.organizationId,
          projectId: input.projectId,
          ...data,
        },
      });

  await tx.workflowEvent.deleteMany({
    where: { organizationId: context.organizationId, contentItemId: content.id },
  });
  await tx.review.deleteMany({
    where: { organizationId: context.organizationId, contentItemId: content.id },
  });
  await tx.auditLog.deleteMany({
    where: {
      organizationId: context.organizationId,
      resourceId: content.id,
      action: {
        in: [
          "content.created",
          "content.transitioned",
          "review.internal_feedback",
          "content.client_revision_requested",
          "content.client_approved",
        ],
      },
    },
  });

  await upsertAudit(tx, context.organizationId, {
    actorId: input.assigneeId,
    action: "content.created",
    resourceType: "content_item",
    resourceId: content.id,
    createdAt: input.createdAt,
    metadata: {
      title: content.title,
      type: content.type,
      status: "BRIEF",
      fictionalAccount: input.kind === "active",
      historicalArchive: input.kind === "archive",
      seedVersion: SEED_VERSION,
    },
  });

  let fromStatus: ContentStatus = "BRIEF";
  const events: Array<{
    actorId: string;
    fromStatus: ContentStatus;
    toStatus: ContentStatus;
    note: string;
    createdAt: Date;
  }> = [];

  for (const [index, toStatus] of input.path.entries()) {
    const actorId = actorForTransition(input.kind, fromStatus, toStatus, context.userIds);
    const createdAt = addHours(input.createdAt, (index + 1) * 6);
    const note =
      input.kind === "archive"
        ? "Historical public-release archive import. Not a live workflow action or client decision."
        : fromStatus === "CLIENT_APPROVAL" && toStatus === "EDITING"
          ? "Revision requested: sharpen the opening and add a clearer takeaway."
          : fromStatus === "CLIENT_APPROVAL" && toStatus === "READY_TO_PUBLISH"
            ? "Approved for publishing."
            : "Workflow transition.";
    events.push({ actorId, fromStatus, toStatus, note, createdAt });
    fromStatus = toStatus;
  }

  if (events.length > 0) {
    await tx.workflowEvent.createMany({
      data: events.map((event) => ({
        organizationId: context.organizationId,
        contentItemId: content.id,
        actorId: event.actorId,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        createdAt: event.createdAt,
      })),
    });

    for (const [index, event] of events.entries()) {
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorId: event.actorId,
          action: "content.transitioned",
          resourceType: "content_item",
          resourceId: content.id,
          createdAt: event.createdAt,
          metadata: {
            fromStatus: event.fromStatus,
            toStatus: event.toStatus,
            version: index + 2,
            fictionalAccount: input.kind === "active",
            historicalArchive: input.kind === "archive",
            seedVersion: SEED_VERSION,
          },
        },
      });
    }
  }

  const reviewSeeds: Array<{
    decision: ReviewDecision;
    reviewerId: string;
    contentVersion: number;
    feedback: string;
    createdAt: Date;
  }> = [];

  if (input.kind === "active" && input.status === "INTERNAL_REVIEW") {
    reviewSeeds.push({
      decision: "INTERNAL_FEEDBACK",
      reviewerId: context.userIds.manager!,
      contentVersion: version,
      feedback:
        "Clarify the promise in the opening and verify the key claims before client review.",
      createdAt: addHours(input.createdAt, (input.path.length + 1) * 6),
    });
  }

  if (input.kind === "active" && input.path.includes("CLIENT_APPROVAL")) {
    if (input.path.filter((status) => status === "CLIENT_APPROVAL").length > 1) {
      reviewSeeds.push({
        decision: "CLIENT_REVISION_REQUESTED",
        reviewerId: context.userIds.client!,
        contentVersion: 6,
        feedback:
          "Please sharpen the opening and add one clearer practical takeaway for the audience.",
        createdAt: addHours(input.createdAt, 6 * 6 + 1),
      });
    }
    reviewSeeds.push({
      decision: "INTERNAL_FEEDBACK",
      reviewerId: context.userIds.manager!,
      contentVersion:
        input.path.filter((status) => status === "INTERNAL_REVIEW").length > 1 ? 8 : version - 2,
      feedback:
        "Title and opening are clear. Confirm source links and distribution notes before release.",
      createdAt: addHours(input.createdAt, 7 * 6 + 1),
    });
  }

  if (input.kind === "active" && input.status === "READY_TO_PUBLISH") {
    reviewSeeds.push({
      decision: "CLIENT_APPROVED",
      reviewerId: context.userIds.client!,
      contentVersion: version - 1,
      feedback:
        input.path.filter((status) => status === "CLIENT_APPROVAL").length > 1
          ? "Approved for publishing after revision."
          : "Approved for publishing.",
      createdAt: addHours(input.createdAt, 8 * 6 + 1),
    });
  }

  if (reviewSeeds.length > 0) {
    await tx.review.createMany({
      data: reviewSeeds.map((review) => ({
        organizationId: context.organizationId,
        contentItemId: content.id,
        reviewerId: review.reviewerId,
        decision: review.decision,
        contentVersion: review.contentVersion,
        feedback: review.feedback,
        createdAt: review.createdAt,
      })),
    });

    for (const review of reviewSeeds) {
      const action =
        review.decision === "CLIENT_APPROVED"
          ? "content.client_approved"
          : review.decision === "CLIENT_REVISION_REQUESTED"
            ? "content.client_revision_requested"
            : "review.internal_feedback";
      await upsertAudit(tx, context.organizationId, {
        actorId: review.reviewerId,
        action,
        resourceType: "content_item",
        resourceId: content.id,
        createdAt: review.createdAt,
        metadata: {
          decision: review.decision,
          contentVersion: review.contentVersion,
          feedback: review.feedback,
          fictionalAccount: true,
          seedVersion: SEED_VERSION,
        },
      });
    }
  }

  context.contentByTitle.set(input.title, content.id);
  return content;
}

async function ensureTask(
  tx: Prisma.TransactionClient,
  context: SeedContext,
  input: {
    projectId: string;
    contentItemId: string | null;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeId: string;
    createdById: string;
    dueDate: Date;
    createdAt: Date;
    key: string;
  },
) {
  const existing = await tx.task.findFirst({
    where: {
      organizationId: context.organizationId,
      projectId: input.projectId,
      contentItemId: input.contentItemId,
      title: input.title,
    },
  });
  const data = {
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    assigneeId: input.assigneeId,
    createdById: input.createdById,
    dueDate: input.dueDate,
    createdAt: input.createdAt,
  };
  const task = existing
    ? await tx.task.update({ where: { id: existing.id }, data })
    : await tx.task.create({
        data: {
          organizationId: context.organizationId,
          projectId: input.projectId,
          contentItemId: input.contentItemId,
          ...data,
        },
      });

  await tx.auditLog.deleteMany({
    where: {
      organizationId: context.organizationId,
      resourceId: task.id,
      action: { in: ["task.created", "task.status_changed"] },
    },
  });
  await upsertAudit(tx, context.organizationId, {
    actorId: input.createdById,
    action: "task.created",
    resourceType: "task",
    resourceId: task.id,
    createdAt: input.createdAt,
    metadata: {
      title: task.title,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      contentItemId: task.contentItemId,
      fictionalAccount: true,
      seedVersion: SEED_VERSION,
    },
  });
  if (task.status !== "TODO") {
    await upsertAudit(tx, context.organizationId, {
      actorId: task.assigneeId ?? input.createdById,
      action: "task.status_changed",
      resourceType: "task",
      resourceId: task.id,
      createdAt: addHours(input.createdAt, 12),
      metadata: {
        fromStatus: "TODO",
        toStatus: task.status,
        fictionalAccount: true,
        seedVersion: SEED_VERSION,
      },
    });
  }

  context.taskByKey.set(input.key, task.id);
  return task;
}

async function ensureNotification(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    dedupeKey: string;
    payload: Prisma.InputJsonValue;
    readAt?: Date | null;
    createdAt: Date;
  },
) {
  const data = {
    organizationId: input.organizationId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    dedupeKey: input.dedupeKey,
    payload: input.payload,
    readAt: input.readAt ?? null,
    createdAt: input.createdAt,
  };
  return tx.notification.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: data,
    create: data,
  });
}

async function main(): Promise<void> {
  if (env.isProduction) {
    throw new Error("Refusing to seed development data in production.");
  }
  if (!env.SEED_PASSWORD || env.SEED_PASSWORD.length < 12) {
    throw new Error(
      "Set SEED_PASSWORD to a development-only password of at least 12 characters before seeding.",
    );
  }

  const passwordHash = await hashPassword(env.SEED_PASSWORD);

  const summary = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.upsert({
      where: { slug: ORG.slug },
      update: { name: ORG.name, status: "ACTIVE" },
      create: { name: ORG.name, slug: ORG.slug, status: "ACTIVE" },
    });

    const userIds: Record<string, string> = {};
    for (const user of INTERNAL_USERS) {
      const record = await tx.user.upsert({
        where: { email: user.email },
        update: { name: user.name, passwordHash, status: "ACTIVE" },
        create: {
          name: user.name,
          email: user.email,
          passwordHash,
          status: "ACTIVE",
        },
      });
      userIds[user.key] = record.id;
      await tx.organizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: record.id,
          },
        },
        update: { role: user.role, status: "ACTIVE" },
        create: {
          organizationId: organization.id,
          userId: record.id,
          role: user.role,
          status: "ACTIVE",
        },
      });
    }

    const clientUser = await tx.user.upsert({
      where: { email: CLIENT_USER.email },
      update: { name: CLIENT_USER.name, passwordHash, status: "ACTIVE" },
      create: {
        name: CLIENT_USER.name,
        email: CLIENT_USER.email,
        passwordHash,
        status: "ACTIVE",
      },
    });
    userIds[CLIENT_USER.key] = clientUser.id;

    const internalClient = await upsertClient(tx, organization.id, INTERNAL_CLIENT_NAME, {
      contactName: null,
      email: null,
      website: "https://figuringout.com/",
      notes: [
        "INTERNAL PRODUCTION ACCOUNT — not a client partner and not an active commercial relationship.",
        `Organization: ${ORG.name}. Location: ${ORGANIZATION_PROFILE.location}. Timezone: ${ORGANIZATION_PROFILE.timezone}.`,
        `Website: ${ORGANIZATION_PROFILE.website}`,
        "",
        ORGANIZATION_PROFILE.description,
        "",
        `Brand motto: ${ORGANIZATION_PROFILE.brandMotto}`,
        `Positioning: ${ORGANIZATION_PROFILE.brandPositioning}`,
        `Primary host: ${ORGANIZATION_PROFILE.primaryHost}`,
      ].join("\n"),
      brandGuidelines: [
        "Official public identity: Figuring Out with Raj Shamani.",
        "Use a clean text-based logo treatment; no copyrighted logo asset is bundled in this seed.",
        "Public social/audience snapshots are stored in the organization seed metadata with a snapshot date.",
      ].join("\n"),
      status: "ACTIVE",
    });

    const clientRecord = await upsertClient(tx, organization.id, CLIENT_NAME, {
      contactName: "Maya Kapoor",
      email: null,
      website: null,
      notes:
        "Brand review account for Figuring Out Originals. Reviews original content, revisions, and approvals before publishing.",
      brandGuidelines: "Brand review notes for original content and campaign approvals.",
      status: "ACTIVE",
    });

    await tx.clientMembership.upsert({
      where: {
        clientId_userId: { clientId: clientRecord.id, userId: clientUser.id },
      },
      update: { organizationId: organization.id, status: "ACTIVE" },
      create: {
        organizationId: organization.id,
        clientId: clientRecord.id,
        userId: clientUser.id,
        status: "ACTIVE",
      },
    });

    const archiveProject = await upsertProject(
      tx,
      organization.id,
      "Flagship Podcast: Public Episode Archive",
      {
        clientId: internalClient.id,
        status: "COMPLETED",
        startDate: new Date("2020-12-01T00:00:00.000Z"),
        deadline: new Date("2026-11-21T00:00:00.000Z"),
        description: [
          "A reference archive containing selected publicly released episodes from Figuring Out with Raj Shamani.",
          "Imported records are historical archive references, not active production work.",
          "Episodes FO586–FO591 are public titles with official source URLs; final status reflects the original publication.",
        ].join(" "),
      },
    );

    const weeklyProject = await upsertProject(
      tx,
      organization.id,
      "Weekly Podcast Production Board",
      {
        clientId: clientRecord.id,
        status: "ACTIVE",
        startDate: dayOffset(-21),
        deadline: dayOffset(30),
        description: [
          "Editorial and production workspace for the weekly long-form conversation: ideas, scripts, recordings, editing, internal review, client approvals, and distribution.",
          "Guest names are confirmed only after booking; the board tracks research, production, review, and distribution readiness.",
        ].join(" "),
      },
    );

    const distributionProject = await upsertProject(
      tx,
      organization.id,
      "Cross-platform Content Distribution",
      {
        clientId: clientRecord.id,
        status: "ACTIVE",
        startDate: dayOffset(-14),
        deadline: dayOffset(21),
        description: [
          "Distribution workspace that turns each long-form conversation into short-form video, YouTube Shorts, Instagram Reels, podcast audio, LinkedIn posts, X posts, and written summaries.",
          "Packaging, localisation, scheduling, and publishing checks are tracked per channel.",
        ].join(" "),
      },
    );

    for (const project of [archiveProject, weeklyProject, distributionProject]) {
      for (const user of INTERNAL_USERS) {
        await tx.projectMembership.upsert({
          where: {
            projectId_userId: {
              projectId: project.id,
              userId: userIds[user.key]!,
            },
          },
          update: { organizationId: organization.id },
          create: {
            organizationId: organization.id,
            projectId: project.id,
            userId: userIds[user.key]!,
          },
        });
      }
    }

    const referenceMetadata = {
      seedVersion: SEED_VERSION,
      fictionalAccounts: {
        client: CLIENT_NAME,
        note: "All internal users, client contacts, projects, content, tasks, reviews, and approvals are fictional seed records; public episode and partner references retain their source URLs.",
      },
      organizationProfile: ORGANIZATION_PROFILE,
      socialChannels: SOCIAL_CHANNELS,
      audienceSnapshot: AUDIENCE_SNAPSHOT,
      partnershipFootprint: PARTNERSHIP_FOOTPRINT,
      contentCategories: CONTENT_CATEGORIES,
      productionFormats: PRODUCTION_FORMATS,
      productionFormatMapping: PRODUCTION_FORMAT_MAPPING,
      partnerReferences: PARTNER_REFERENCES,
      logoNote:
        "No copyrighted logo asset was downloaded. The application uses its own text/shape mark.",
      sourceAttribution: {
        website: "https://figuringout.com/",
        partners: PARTNERS_SOURCE,
        snapshotDate: SNAPSHOT_DATE,
      },
    };

    const existingReference = await tx.auditLog.findFirst({
      where: {
        organizationId: organization.id,
        action: "seed.reference_data",
        resourceType: "organization_profile",
      },
    });
    if (existingReference) {
      await tx.auditLog.update({
        where: { id: existingReference.id },
        data: {
          actorId: userIds.admin,
          resourceId: organization.id,
          metadata: referenceMetadata,
          createdAt: dayOffset(-21),
        },
      });
    } else {
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorId: userIds.admin,
          action: "seed.reference_data",
          resourceType: "organization_profile",
          resourceId: organization.id,
          metadata: referenceMetadata,
          createdAt: dayOffset(-21),
        },
      });
    }

    const context: SeedContext = {
      organizationId: organization.id,
      userIds,
      contentByTitle: new Map(),
      taskByKey: new Map(),
      projects: new Map([
        ["archive", archiveProject.id],
        ["weekly", weeklyProject.id],
        ["distribution", distributionProject.id],
      ]),
    };

    for (const project of [archiveProject, weeklyProject, distributionProject]) {
      await upsertAudit(tx, organization.id, {
        actorId: userIds.manager!,
        action: "project.created",
        resourceType: "project",
        resourceId: project.id,
        createdAt: project.createdAt,
        metadata: {
          name: project.name,
          status: project.status,
          seedVersion: SEED_VERSION,
          fictionalAccount: project.id !== archiveProject.id,
          historicalArchive: project.id === archiveProject.id,
        },
      });
    }

    for (const episode of ARCHIVE_EPISODES) {
      const published = new Date(`${episode.published}T00:00:00.000Z`);
      await ensureContent(tx, context, {
        projectId: archiveProject.id,
        title: `${episode.title} — ${episode.guest}`,
        description: archiveDescription(episode),
        type: "PODCAST",
        status: "READY_TO_PUBLISH",
        deadline: published,
        assigneeId: userIds.producer!,
        createdAt: addDays(published, -10),
        kind: "archive",
        path: STANDARD_PATHS.READY_TO_PUBLISH,
      });
    }

    for (const item of WEEKLY_CONTENT) {
      const deadline = dayOffset(item.dueOffset);
      await ensureContent(tx, context, {
        projectId: weeklyProject.id,
        title: item.title,
        description: contentDescription(item, weeklyProject.description ?? ""),
        type: item.type,
        status: item.status,
        deadline,
        assigneeId: userIds[item.assigneeKey]!,
        createdAt: dayOffset(-6),
        kind: "active",
        path:
          item.history === "pending-revision"
            ? PENDING_REVISION_PATH
            : item.history === "approved-revision"
              ? APPROVED_REVISION_PATH
              : STANDARD_PATHS[item.status],
      });
    }

    for (const item of DISTRIBUTION_CONTENT) {
      const deadline = dayOffset(item.dueOffset);
      const content = await ensureContent(tx, context, {
        projectId: distributionProject.id,
        title: item.title,
        description: contentDescription(item, distributionProject.description ?? ""),
        type: item.type,
        status: item.status,
        deadline,
        assigneeId: userIds[item.assigneeKey]!,
        createdAt: dayOffset(-4),
        kind: "active",
        path: STANDARD_PATHS[item.status],
      });

      const taskTemplates: Array<{
        title: string;
        description: string;
        role: "manager" | "producer" | "editor";
        priority: TaskPriority;
        status: TaskStatus;
        dueOffset: number;
      }> = [
        {
          title: "Prepare and quality-check this distribution package",
          description:
            "Package the deliverable, verify naming, captions, links, and channel requirements.",
          role: "producer",
          priority: "HIGH",
          status:
            item.status === "READY_TO_PUBLISH"
              ? "DONE"
              : item.status === "BRIEF" || item.status === "SCRIPT"
                ? "TODO"
                : "IN_PROGRESS",
          dueOffset: -1,
        },
        {
          title: "Localize and schedule the distribution assets",
          description:
            "Check Hindi, English, and Spanish adaptations where relevant, then prepare the publishing schedule.",
          role: "manager",
          priority: "MEDIUM",
          status:
            item.status === "READY_TO_PUBLISH"
              ? "DONE"
              : statusIndex(item.status) >= statusIndex("INTERNAL_REVIEW")
                ? "IN_PROGRESS"
                : "TODO",
          dueOffset: 0,
        },
      ];

      for (const template of taskTemplates) {
        await ensureTask(tx, context, {
          projectId: distributionProject.id,
          contentItemId: content.id,
          title: template.title,
          description: template.description,
          status: template.status,
          priority: template.priority,
          assigneeId: userIds[template.role]!,
          createdById: userIds.manager!,
          dueDate: addDays(deadline, template.dueOffset),
          createdAt: addDays(dayOffset(-4), 1),
          key: `${content.id}:${template.title}`,
        });
      }
    }

    for (const item of WEEKLY_CONTENT) {
      const contentId = context.contentByTitle.get(item.title)!;
      const deadline = dayOffset(item.dueOffset);
      const templates = [
        ...WEEKLY_TASK_TEMPLATES,
        ...(statusIndex(item.status) >= statusIndex("CLIENT_APPROVAL")
          ? DISTRIBUTION_TASK_TEMPLATES
          : []),
        ...(statusIndex(item.status) >= statusIndex("INTERNAL_REVIEW")
          ? EXPERIMENT_TASK_TEMPLATES
          : []),
      ];

      for (const template of templates) {
        const status = taskStatusFor(item.status, template);
        await ensureTask(tx, context, {
          projectId: weeklyProject.id,
          contentItemId: contentId,
          title: template.title,
          description: template.description,
          status,
          priority: template.priority,
          assigneeId: userIds[template.role]!,
          createdById: userIds.manager!,
          dueDate: addDays(deadline, template.dueOffset),
          createdAt: addDays(dayOffset(-6), 1),
          key: `${contentId}:${template.title}`,
        });
      }
    }

    const projectTasks = [
      {
        projectId: weeklyProject.id,
        contentItemId: null,
        title: "Review last week's audience conversations",
        description:
          "Pull recurring questions from audience comments and internal notes for the next editorial slate.",
        status: "IN_PROGRESS" as const,
        priority: "HIGH" as const,
        assigneeId: userIds.manager!,
        dueDate: dayOffset(-2),
        key: "weekly:audience-review",
      },
      {
        projectId: weeklyProject.id,
        contentItemId: null,
        title: "Compare thumbnail concepts across this week's slate",
        description:
          "Prepare an experiment brief for thumbnail clarity and title performance. Do not invent results.",
        status: "TODO" as const,
        priority: "MEDIUM" as const,
        assigneeId: userIds.manager!,
        dueDate: dayOffset(2),
        key: "weekly:thumbnail-experiment",
      },
      {
        projectId: distributionProject.id,
        contentItemId: null,
        title: "Maintain public partnership reference list",
        description:
          "Review the official partnership-page snapshot stored in seed metadata. Do not treat reference brands as active clients or campaigns.",
        status: "BLOCKED" as const,
        priority: "LOW" as const,
        assigneeId: userIds.manager!,
        dueDate: dayOffset(-1),
        key: "distribution:partner-reference",
      },
      {
        projectId: distributionProject.id,
        contentItemId: null,
        title: "Review short-form hook experiment brief",
        description:
          "Compare hook hypotheses for the next distribution slate. Results are intentionally not fabricated.",
        status: "TODO" as const,
        priority: "MEDIUM" as const,
        assigneeId: userIds.producer!,
        dueDate: dayOffset(3),
        key: "distribution:hook-experiment",
      },
      {
        projectId: archiveProject.id,
        contentItemId: null,
        title: "Validate FO586–FO591 archive metadata",
        description:
          "[HISTORICAL ARCHIVE] Verify episode IDs, guest names, categories, publication dates, and official source URLs for the imported public archive.",
        status: "DONE" as const,
        priority: "MEDIUM" as const,
        assigneeId: userIds.admin!,
        dueDate: new Date("2026-11-22T00:00:00.000Z"),
        key: "archive:metadata",
      },
    ];

    for (const task of projectTasks) {
      await ensureTask(tx, context, {
        ...task,
        createdById: userIds.admin!,
        createdAt: addDays(task.dueDate, -3),
      });
    }

    const pendingClientContent = context.contentByTitle.get(
      "Building an Audience Through Better Storytelling",
    )!;
    const readyContent = context.contentByTitle.get("The Discipline Behind Long-Term Success")!;
    const internalReviewContent = context.contentByTitle.get(
      "What High Performers Understand About Failure",
    )!;
    const scriptContent = context.contentByTitle.get(
      "How AI Is Changing the Future of Work in India",
    )!;
    const editorTask = context.taskByKey.get(
      `${internalReviewContent}:Review audio quality and prepare captions`,
    )!;
    const producerTask = context.taskByKey.get(`${scriptContent}:Edit long-form master`)!;
    const dueSoonTask = context.taskByKey.get(
      `${scriptContent}:Prepare sourced guest research brief`,
    )!;
    const overdueTask = context.taskByKey.get("weekly:audience-review")!;

    const notifications = [
      {
        userId: userIds.client!,
        type: "CONTENT_SUBMITTED" as const,
        title: "New cut ready for client review: Building an Audience Through Better Storytelling",
        body: "The Figuring Out Originals portal has a deliverable awaiting approval.",
        dedupeKey: "seed:notification:client-submission",
        payload: {
          contentItemId: pendingClientContent,
          projectId: weeklyProject.id,
          fictionalAccount: true,
        },
        readAt: null,
      },
      {
        userId: userIds.producer!,
        type: "REVIEW_FEEDBACK" as const,
        title: "New review feedback on What High Performers Understand About Failure",
        body: "Priya Nair left internal feedback on the current cut.",
        dedupeKey: "seed:notification:review-feedback",
        payload: {
          contentItemId: internalReviewContent,
          projectId: weeklyProject.id,
          fictionalAccount: true,
        },
        readAt: null,
      },
      {
        userId: userIds.producer!,
        type: "REVISION_REQUESTED" as const,
        title: "Revision requested on The Discipline Behind Long-Term Success",
        body: "Feedback asked for a sharper opening and a clearer takeaway.",
        dedupeKey: "seed:notification:revision-requested",
        payload: {
          contentItemId: readyContent,
          projectId: weeklyProject.id,
          fictionalAccount: true,
        },
        readAt: addDays(dayOffset(-1), 0),
      },
      {
        userId: userIds.manager!,
        type: "CONTENT_APPROVED" as const,
        title: "Client approved The Discipline Behind Long-Term Success",
        body: "Approval recorded for the revised version.",
        dedupeKey: "seed:notification:content-approved",
        payload: {
          contentItemId: readyContent,
          projectId: weeklyProject.id,
          fictionalAccount: true,
        },
        readAt: null,
      },
      {
        userId: userIds.editor!,
        type: "TASK_ASSIGNED" as const,
        title: "Task assigned: Review audio quality and prepare captions",
        body: "Task on What High Performers Understand About Failure.",
        dedupeKey: "seed:notification:task-editor",
        payload: {
          taskId: editorTask,
          contentItemId: internalReviewContent,
          projectId: weeklyProject.id,
          fictionalAccount: true,
        },
        readAt: null,
      },
      {
        userId: userIds.producer!,
        type: "TASK_ASSIGNED" as const,
        title: "Task assigned: Edit long-form master",
        body: "Task on How AI Is Changing the Future of Work in India.",
        dedupeKey: "seed:notification:task-producer",
        payload: {
          taskId: producerTask,
          contentItemId: scriptContent,
          projectId: weeklyProject.id,
          fictionalAccount: true,
        },
        readAt: addDays(dayOffset(-1), 0),
      },
      {
        userId: userIds.manager!,
        type: "DEADLINE_REMINDER" as const,
        title: "Overdue task: Review last week's audience conversations",
        body: "This task is overdue. Update it or mark it done.",
        dedupeKey: "seed:notification:deadline-manager",
        payload: {
          taskId: overdueTask,
          projectId: weeklyProject.id,
          fictionalAccount: true,
        },
        readAt: null,
      },
      {
        userId: userIds.admin!,
        type: "CONTENT_SUBMITTED" as const,
        title: "Weekly slate submitted for client review",
        body: "One deliverable is awaiting Figuring Out Originals approval.",
        dedupeKey: "seed:notification:admin-submission",
        payload: {
          contentItemId: pendingClientContent,
          projectId: weeklyProject.id,
          fictionalAccount: true,
        },
        readAt: addDays(dayOffset(-2), 0),
      },
      {
        userId: userIds.manager!,
        type: "CONTENT_SUBMITTED" as const,
        title: "Internal review submitted: What High Performers Understand About Failure",
        body: "The editorial review queue has a cut awaiting internal feedback.",
        dedupeKey: "seed:notification:internal-review-submission",
        payload: {
          contentItemId: internalReviewContent,
          projectId: weeklyProject.id,
          fictionalAccount: true,
        },
        readAt: null,
      },
      {
        userId: userIds.producer!,
        type: "DEADLINE_REMINDER" as const,
        title: "Task due soon: Prepare sourced guest research brief",
        body: "This task is due tomorrow. Review the brief and question bank.",
        dedupeKey: "seed:notification:deadline-producer",
        payload: {
          taskId: dueSoonTask,
          contentItemId: scriptContent,
          projectId: weeklyProject.id,
          fictionalAccount: true,
        },
        readAt: null,
      },
    ];

    for (const notification of notifications) {
      await ensureNotification(tx, {
        organizationId: organization.id,
        ...notification,
        createdAt: addDays(dayOffset(-3), notification.readAt ? 0 : 2),
      });
    }

    const [
      clientCount,
      projectCount,
      contentCount,
      taskCount,
      reviewCount,
      notificationCount,
      workflowEventCount,
    ] = await Promise.all([
      tx.client.count({ where: { organizationId: organization.id } }),
      tx.project.count({ where: { organizationId: organization.id } }),
      tx.contentItem.count({ where: { organizationId: organization.id } }),
      tx.task.count({ where: { organizationId: organization.id } }),
      tx.review.count({ where: { organizationId: organization.id } }),
      tx.notification.count({
        where: { organizationId: organization.id, dedupeKey: { startsWith: "seed:notification:" } },
      }),
      tx.workflowEvent.count({ where: { organizationId: organization.id } }),
    ]);

    return {
      organizationId: organization.id,
      clients: clientCount,
      projects: projectCount,
      content: contentCount,
      tasks: taskCount,
      reviews: reviewCount,
      notifications: notificationCount,
      workflowEvents: workflowEventCount,
      users: INTERNAL_USERS.length + 1,
      partnerReferences: PARTNER_REFERENCES.length,
    };
  });

  console.log("Figuring Out seed complete.");
  console.log(`Workspace: ${ORG.name} (${ORG.slug})`);
  console.log(`Internal users: ${INTERNAL_USERS.length}`);
  for (const user of INTERNAL_USERS) {
    console.log(`  ${user.role}: ${user.email}`);
  }
  console.log(`  CLIENT: ${CLIENT_USER.email} -> ${CLIENT_NAME}`);
  console.log("Password: read from SEED_PASSWORD. Development use only.");
  console.log(
    `Counts: ${summary.users} users, ${summary.clients} clients, ${summary.projects} projects, ${summary.content} content items, ${summary.tasks} tasks, ${summary.reviews} reviews, ${summary.notifications} notifications, ${summary.workflowEvents} workflow events, ${summary.partnerReferences} partnership references.`,
  );
  console.log("Archive: FO586–FO591 are public episode records with official source URLs.");
  console.log("Assets: none seeded; uploads require configured object storage.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
