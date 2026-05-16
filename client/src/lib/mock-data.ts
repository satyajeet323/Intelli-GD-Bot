/**
 * mock-data.ts — Local topic pool for offline / fallback topic generation.
 *
 * The mockSessions array has been removed — all session data is now served
 * from the real MongoDB backend via /api/history and /api/reports.
 *
 * This file only retains the topic pool used by useAITopic as a local
 * fallback when the Gemini API is unavailable.
 */

// ── Topic pool ────────────────────────────────────────────────────────────────
// All topics are strictly IT-domain or general knowledge / current affairs,
// suitable for professional and academic group discussions.

export const mockTopics: { category: string; topic: string }[] = [

  // Artificial Intelligence & Machine Learning
  { category: "AI & ML", topic: "Will large language models replace software engineers within the next decade?" },
  { category: "AI & ML", topic: "Should AI-generated content be required to carry a disclosure label?" },
  { category: "AI & ML", topic: "Is artificial general intelligence (AGI) an existential risk or an overhyped concern?" },
  { category: "AI & ML", topic: "Bias in AI algorithms — whose responsibility is it to fix it?" },
  { category: "AI & ML", topic: "Can machine learning models ever be truly explainable?" },
  { category: "AI & ML", topic: "Should autonomous AI systems be granted legal personhood?" },
  { category: "AI & ML", topic: "Generative AI in creative industries — tool or threat?" },
  { category: "AI & ML", topic: "Is the race to build the most powerful AI model dangerous for humanity?" },

  // Cybersecurity
  { category: "Cybersecurity", topic: "Zero-trust architecture — is it the only viable security model for modern enterprises?" },
  { category: "Cybersecurity", topic: "Should ethical hacking be a mandatory subject in computer science curricula?" },
  { category: "Cybersecurity", topic: "Ransomware attacks on critical infrastructure — should paying ransoms be illegal?" },
  { category: "Cybersecurity", topic: "Is end-to-end encryption a right or a threat to national security?" },
  { category: "Cybersecurity", topic: "Quantum computing will make current encryption obsolete — how prepared are we?" },
  { category: "Cybersecurity", topic: "Social engineering remains the biggest cybersecurity threat — do you agree?" },
  { category: "Cybersecurity", topic: "Should companies be legally liable for data breaches caused by negligence?" },

  // Software Engineering & Development
  { category: "Software Engineering", topic: "Is open-source software more secure than proprietary software?" },
  { category: "Software Engineering", topic: "Agile vs Waterfall — which methodology delivers better software in 2026?" },
  { category: "Software Engineering", topic: "Low-code and no-code platforms — democratisation of development or a technical debt trap?" },
  { category: "Software Engineering", topic: "Should software engineers be licensed like civil engineers?" },
  { category: "Software Engineering", topic: "Microservices architecture — is the complexity worth the scalability?" },
  { category: "Software Engineering", topic: "Technical debt: the silent killer of software projects — how should teams manage it?" },
  { category: "Software Engineering", topic: "DevOps culture — has it truly bridged the gap between development and operations?" },
  { category: "Software Engineering", topic: "Is test-driven development (TDD) practical in fast-paced startup environments?" },

  // Cloud & Infrastructure
  { category: "Cloud & Infrastructure", topic: "Cloud computing vs on-premise infrastructure — which is the future for enterprises?" },
  { category: "Cloud & Infrastructure", topic: "Multi-cloud strategy: smart risk management or unnecessary complexity?" },
  { category: "Cloud & Infrastructure", topic: "Edge computing will replace centralised cloud — agree or disagree?" },
  { category: "Cloud & Infrastructure", topic: "Serverless computing — is it ready to power mission-critical applications?" },
  { category: "Cloud & Infrastructure", topic: "Should cloud providers be regulated as public utilities?" },

  // Data Science & Big Data
  { category: "Data Science", topic: "Data privacy vs personalisation — where should the line be drawn?" },
  { category: "Data Science", topic: "Is big data analytics creating an unfair advantage for large corporations?" },
  { category: "Data Science", topic: "Should individuals own and monetise their personal data?" },
  { category: "Data Science", topic: "Real-time data processing vs batch processing — which approach suits modern business needs?" },
  { category: "Data Science", topic: "The role of data science in combating climate change — potential and limitations." },

  // Emerging Technologies
  { category: "Emerging Tech", topic: "Blockchain beyond cryptocurrency — is it solving real-world problems?" },
  { category: "Emerging Tech", topic: "The metaverse — transformative platform or expensive distraction?" },
  { category: "Emerging Tech", topic: "5G and beyond — will ubiquitous connectivity reshape society?" },
  { category: "Emerging Tech", topic: "Augmented reality in the workplace — productivity booster or gimmick?" },
  { category: "Emerging Tech", topic: "Internet of Things (IoT) — are we creating a surveillance infrastructure?" },
  { category: "Emerging Tech", topic: "Digital twins — the next frontier in industrial simulation and optimisation." },
  { category: "Emerging Tech", topic: "Should brain-computer interfaces be regulated before they reach consumers?" },

  // Tech Policy & Ethics
  { category: "Tech Policy", topic: "Should governments regulate artificial intelligence development?" },
  { category: "Tech Policy", topic: "Big Tech monopolies — should companies like Google and Meta be broken up?" },
  { category: "Tech Policy", topic: "Net neutrality — is an open internet still achievable in 2026?" },
  { category: "Tech Policy", topic: "Right to repair legislation — a win for consumers or a threat to innovation?" },
  { category: "Tech Policy", topic: "Digital divide — is universal internet access a human right?" },
  { category: "Tech Policy", topic: "Should social media platforms be held responsible for algorithmic radicalisation?" },
  { category: "Tech Policy", topic: "Tech companies and tax avoidance — is the current international framework adequate?" },

  // General Knowledge & Current Affairs
  { category: "General Knowledge", topic: "Remote work in the tech industry — permanent shift or temporary trend?" },
  { category: "General Knowledge", topic: "STEM education — are we producing enough talent to meet the demand?" },
  { category: "General Knowledge", topic: "The gig economy in tech — flexible opportunity or exploitation?" },
  { category: "General Knowledge", topic: "Should coding be a compulsory subject from primary school?" },
  { category: "General Knowledge", topic: "Green technology — can innovation alone solve the climate crisis?" },
  { category: "General Knowledge", topic: "Digital literacy — the most critical skill for the 21st century workforce?" },
  { category: "General Knowledge", topic: "Space technology investment — national prestige or genuine scientific necessity?" },
  { category: "General Knowledge", topic: "The four-day workweek in tech companies — productivity myth or proven model?" },
  { category: "General Knowledge", topic: "Diversity and inclusion in the tech industry — progress made and miles to go." },
  { category: "General Knowledge", topic: "Should tech companies be required to disclose their carbon footprint?" },
];

/**
 * Returns a random topic string from the pool.
 * Guarantees no two consecutive calls return the same topic.
 */
let _lastTopicIndex = -1;
export function pickRandomTopic(): string {
  let idx: number;
  do {
    idx = Math.floor(Math.random() * mockTopics.length);
  } while (idx === _lastTopicIndex && mockTopics.length > 1);
  _lastTopicIndex = idx;
  return mockTopics[idx].topic;
}

/**
 * Returns a random topic from a specific category.
 */
export function pickTopicByCategory(category: string): string {
  const pool = mockTopics.filter((t) => t.category === category);
  if (!pool.length) return pickRandomTopic();
  return pool[Math.floor(Math.random() * pool.length)].topic;
}

/**
 * Returns all unique category names.
 */
export function getTopicCategories(): string[] {
  return [...new Set(mockTopics.map((t) => t.category))];
}
