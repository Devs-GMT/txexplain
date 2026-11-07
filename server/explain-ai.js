import { CHAIN_NAMES } from "./chains.js";

const SYSTEM = `You explain one BOT Chain transaction to a developer.
Use only the facts in the JSON the user sends. Copy every number, address and name exactly as written there.
If something is not in the facts, say you don't know. Never guess amounts, names or causes.
Write 2 to 4 short plain sentences in English. Do not use markdown.
Shorten addresses to the first 6 and last 4 characters with an ellipsis, like 0xA288…8C4C. Do not repeat the transaction hash.
Say what was called and what happened. Give the cost as costBot in BOT. Do not mention gas price, wei or raw amounts.
Use token amounts as formatted (amount and symbol), never the raw integer.
If status is "failed", also give up to 4 short fixes, each one grounded in the revert or fixes fields.
Reply as JSON: {"summary": string, "fixes": string[]}. Use an empty fixes array when status is not "failed".`;

/// Drops raw log bytes; the model needs decoded fields, not topics.
export function promptFacts(facts) {
  const { events, ...rest } = facts;
  return {
    ...rest,
    network: CHAIN_NAMES[facts.chainId] ?? `chain ${facts.chainId}`,
    events: (events ?? []).map((e) => (e.name ? { name: e.name, fields: e.fields } : { unknownEventFrom: e.address })),
  };
}

/// `retry` is { previous, reason }: the rejected answer and why, so the model can fix that one thing.
export async function askGroq(facts, { apiKey, model, signal }, retry) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      reasoning_effort: "low",
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(promptFacts(facts)) },
        ...(retry
          ? [
              { role: "assistant", content: JSON.stringify(retry.previous) },
              { role: "user", content: `That answer was rejected: ${retry.reason}. Write it again using only values copied exactly from the facts.` },
            ]
          : []),
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq responded ${res.status}`);
  const body = await res.json();
  return JSON.parse(body.choices[0].message.content);
}
