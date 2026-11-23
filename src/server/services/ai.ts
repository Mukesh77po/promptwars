import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import type { AllocationResult, EquipmentView, SearchMatch, SearchResponse } from '../../shared/types.ts';

export interface DraftResult {
  projectTitle: string;
  description: string;
  equipmentId: string;
  hoursNeeded: number;
  rationale: string;
  source: 'ai' | 'heuristic';
}

export interface RequestSummaryContext {
  projectTitle: string;
  description: string;
  studentName: string;
  equipmentName: string;
  hoursNeeded: number;
  deadline: string;
  freeHours: number;
  risks: string[];
}

export interface PlanContext {
  result: AllocationResult;
  studentName: string;
  projectTitle: string;
  deadline: string;
  equipmentNames: string[];
}

export interface PlanExplanation {
  summary: string;
  explanations: Map<string, string>;
  source: 'ai' | 'template';
}

const MODEL = 'gemini-2.5-flash';

function getAiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({ apiKey: key });
}

export function aiIsEnabled(): boolean {
  return getAiClient() !== null;
}

const sanitize = (text: string, max = 600): string =>
  text.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function catalogPrompt(catalog: EquipmentView[], userText: string): string {
  const lines = catalog.map((e) => {
    const maint = e.status === 'available' ? '' : ' | MAINTENANCE';
    return `${e.id} | ${e.name} | ${e.category} | ${e.labName} (${e.departmentName}) | ${e.tags.join(', ')}${maint}`;
  });
  return `Catalogue (id | name | category | lab | tags):\n${lines.join('\n')}\n\n<user_input>${userText}</user_input>`;
}

const SearchSchema = z.object({
  matches: z.array(z.object({ equipmentId: z.string(), reason: z.string().max(400) })).max(10),
});

const DraftSchema = z.object({
  projectTitle: z.string().min(3).max(100),
  description: z.string().min(10).max(1000),
  equipmentId: z.string(),
  hoursNeeded: z.number().int().min(1).max(40),
  rationale: z.string().max(400),
});

const SummarySchema = z.object({
  summary: z.string().min(5).max(600),
});

const ExplainSchema = z.object({
  summary: z.string().max(800),
  explanations: z.array(z.object({ requestId: z.string(), text: z.string().max(500) })),
});

function keywordSearch(catalog: EquipmentView[], query: string): SearchMatch[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];

  const scored = catalog
    .map((e) => {
      const hay = `${e.name} ${e.category} ${e.specs} ${e.tags.join(' ')} ${e.labName} ${e.departmentName}`.toLowerCase();
      let hits = 0;
      const matched: string[] = [];
      for (const tok of tokens) {
        if (hay.includes(tok)) {
          hits += e.tags.some((t) => t.includes(tok)) || e.name.toLowerCase().includes(tok) ? 2 : 1;
          matched.push(tok);
        }
      }
      if (e.status === 'available' && hits > 0) hits += 0.5;
      return { equipment: e, hits, matched };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 6);

  return scored.map((s) => ({
    equipment: s.equipment,
    reason: `Matches ${[...new Set(s.matched)].slice(0, 4).join(', ')} in ${s.equipment.labName}.`,
  }));
}

export async function semanticSearch(
  catalog: EquipmentView[],
  query: string,
): Promise<SearchResponse> {
  const clean = sanitize(query, 240);
  const ai = getAiClient();
  if (!ai) {
    return { source: 'keyword', matches: keywordSearch(catalog, clean) };
  }
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: catalogPrompt(catalog, clean),
      config: {
        systemInstruction:
          'You are LabLink, an assistant for a campus lab sharing platform. Recommend up to 6 matching equipment IDs from the catalogue, preferring available units.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  equipmentId: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['equipmentId', 'reason'],
              },
            },
          },
          required: ['matches'],
        },
      },
    });
    const parsed = SearchSchema.parse(JSON.parse(res.text ?? '{}'));
    const byId = new Map(catalog.map((e) => [e.id, e]));
    const matches: SearchMatch[] = parsed.matches
      .map((m) => {
        const eq = byId.get(m.equipmentId);
        return eq ? { equipment: eq, reason: m.reason } : null;
      })
      .filter((x): x is SearchMatch => x !== null);
    if (matches.length > 0) return { source: 'ai', matches };
  } catch {
    // Fall back silently to deterministic keyword matching
  }
  return { source: 'keyword', matches: keywordSearch(catalog, clean) };
}

export async function draftRequest(
  catalog: EquipmentView[],
  idea: string,
): Promise<DraftResult> {
  const clean = sanitize(idea, 500);
  const available = catalog.filter((e) => e.status === 'available');
  const ai = getAiClient();

  if (ai && available.length > 0) {
    try {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: catalogPrompt(available, clean),
        config: {
          systemInstruction:
            'Turn the student project idea into a concise lab access request. Pick the single best available equipmentId and estimate hoursNeeded (1-40).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              projectTitle: { type: Type.STRING },
              description: { type: Type.STRING },
              equipmentId: { type: Type.STRING },
              hoursNeeded: { type: Type.INTEGER },
              rationale: { type: Type.STRING },
            },
            required: ['projectTitle', 'description', 'equipmentId', 'hoursNeeded', 'rationale'],
          },
        },
      });
      const parsed = DraftSchema.parse(JSON.parse(res.text ?? '{}'));
      const chosen = available.find((e) => e.id === parsed.equipmentId) ?? available[0]!;
      return { ...parsed, equipmentId: chosen.id, source: 'ai' };
    } catch {
      // Fallback below
    }
  }

  const matches = keywordSearch(available, clean);
  const chosen = matches[0]?.equipment ?? available[0]!;
  const titleWords = clean.split(' ').slice(0, 6).join(' ');
  const hours = /train|batch|fpga|benchmark|iterate|cnc/i.test(clean) ? 8 : 4;
  return {
    projectTitle: titleWords.charAt(0).toUpperCase() + titleWords.slice(1),
    description: `${clean}. Requesting access to ${chosen.name} in ${chosen.labName} for prototyping and validation.`,
    equipmentId: chosen.id,
    hoursNeeded: hours,
    rationale: `Selected ${chosen.name} (${chosen.category}) based on project keywords.`,
    source: 'heuristic',
  };
}

export async function summarizeRequest(
  ctx: RequestSummaryContext,
): Promise<{ summary: string; source: 'ai' | 'template' }> {
  const ai = getAiClient();
  if (ai) {
    try {
      const prompt =
        `Student: ${ctx.studentName}\nEquipment: ${ctx.equipmentName}\nHours needed: ${ctx.hoursNeeded}\n` +
        `Deadline: ${ctx.deadline}\nFree hours before deadline: ${ctx.freeHours}\n` +
        `Computed risks: ${ctx.risks.join('; ') || 'none'}\n` +
        `<user_input>Title: ${sanitize(ctx.projectTitle, 120)}\nDescription: ${sanitize(ctx.description)}</user_input>`;
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'Write a 2-sentence faculty review summary: what the project requires, capacity feasibility before the deadline, and a clear recommendation.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: { summary: { type: Type.STRING } },
            required: ['summary'],
          },
        },
      });
      const parsed = SummarySchema.parse(JSON.parse(res.text ?? '{}'));
      return { summary: parsed.summary, source: 'ai' };
    } catch {
      // Fallback below
    }
  }

  const feasible = ctx.freeHours >= ctx.hoursNeeded;
  const rec = feasible
    ? `Capacity is available (${ctx.freeHours} h free vs ${ctx.hoursNeeded} h requested); recommended to approve and auto-schedule.`
    : `Only ${ctx.freeHours} h free before ${ctx.deadline} across equivalent units; approve partially or run conflict resolution.`;
  return {
    summary: `${ctx.studentName} requests ${ctx.hoursNeeded} h on ${ctx.equipmentName} for "${ctx.projectTitle}". ${rec}`,
    source: 'template',
  };
}

export async function explainPlan(items: PlanContext[]): Promise<PlanExplanation> {
  const ai = getAiClient();
  if (ai && items.length > 0) {
    try {
      const facts = items
        .map(
          ({ result: r, studentName, deadline, equipmentNames }) =>
            `requestId=${r.requestId}; student=${studentName}; deadline=${deadline}; outcome=${r.outcome}; granted=${r.hoursGranted}/${r.hoursNeeded}h; priority=${r.priority}; units=${equipmentNames.join(', ') || 'none'}; reasons=${r.reasons.join(',')}`,
        )
        .join('\n');
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: facts,
        config: {
          systemInstruction:
            'Explain a deterministic fair allocation (deadline urgency 50%, fairness 30%, feasibility 20%). Return a brief summary and one clear sentence per requestId.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              explanations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { requestId: { type: Type.STRING }, text: { type: Type.STRING } },
                  required: ['requestId', 'text'],
                },
              },
            },
            required: ['summary', 'explanations'],
          },
        },
      });
      const parsed = ExplainSchema.parse(JSON.parse(res.text ?? '{}'));
      const map = new Map<string, string>();
      for (const e of parsed.explanations) map.set(e.requestId, e.text);
      return { summary: parsed.summary, explanations: map, source: 'ai' };
    } catch {
      // Fallback below
    }
  }

  const map = new Map<string, string>();
  for (const item of items) {
    const r = item.result;
    const moved = r.reasons.includes('MOVED_TO_EQUIVALENT');
    const urgent = r.reasons.includes('URGENT_DEADLINE');
    const fair = r.reasons.includes('FAIRNESS_PRIORITY');
    const heavy = r.reasons.includes('HEAVY_RECENT_USAGE');
    const parts: string[] = [];
    if (urgent) parts.push('prioritised for an imminent deadline');
    if (fair) parts.push('boosted for recent waitlist fairness');
    if (heavy) parts.push('weighted down slightly due to high recent weekly usage');
    if (moved) parts.push(`routed overflow to ${item.equipmentNames.join(' & ')}`);
    const detail = parts.length > 0 ? ` (${parts.join('; ')})` : '';
    map.set(
      r.requestId,
      r.hoursGranted > 0
        ? `Granted ${r.hoursGranted} of ${r.hoursNeeded} h before ${item.deadline}${detail}.`
        : `Waitlisted because all equivalent units are fully booked before ${item.deadline}.`,
    );
  }
  const allocated = items.filter((i) => i.result.outcome === 'allocated').length;
  return {
    summary: `Fair schedule computed across ${items.length} competing request(s): ${allocated} fully scheduled, using 50% deadline urgency, 30% fairness, and 20% feasibility.`,
    explanations: map,
    source: 'template',
  };
}
