import { describe, it, expect } from "vitest";
import { classifyInput } from "../src/lib/classify";

describe("classifyInput — dreams", () => {
  const dreams = [
    "I had a dream: my teeth were falling out",
    "I dreamed about my ex last night",
    "in my dream I was flying over the sea",
    "why did I dream that I was falling?",
    "I dreamt of a white horse",
    "I had a nightmare about being chased",
  ];
  for (const d of dreams) {
    it(`dream: ${JSON.stringify(d)}`, () => {
      expect(classifyInput(d)).toBe("dream");
    });
  }
  it("a mere wish is not a dream telling", () => {
    expect(classifyInput("my dream is to open a bakery")).not.toBe("dream");
  });
});

describe("classifyInput — questions", () => {
  const questions = [
    "Should I take the job offer?",
    "Will I ever find someone?",
    "Can I trust my gut on this?",
    "Do I tell her how I feel?",
    "Is it time to move on?",
    "What should I do about my career?",
    "How do I start over?",
    "should i quit my job",
    "Help me decide between two apartments",
  ];
  for (const q of questions) {
    it(`question: ${JSON.stringify(q)}`, () => {
      expect(classifyInput(q)).toBe("question");
    });
  }
});

describe("classifyInput — feelings", () => {
  const feelings = [
    "I'm exhausted",
    "I feel so overwhelmed lately",
    "no one notices me",
    "I feel invisible",
    "I'm so lonely tonight",
    "everyone seems to have it figured out except me",
    "I had a fight with my partner",
    "I feel ugly today",
    "why do I feel so empty?", // feeling phrased as a question
    "how come I'm always so anxious?",
    "I've been really down",
  ];
  for (const f of feelings) {
    it(`feeling: ${JSON.stringify(f)}`, () => {
      expect(classifyInput(f)).toBe("feeling");
    });
  }
});

describe("classifyInput — decision questions that mention a feeling", () => {
  it("routes 'should I quit? I'm miserable' to question", () => {
    expect(classifyInput("Should I quit my job? I'm miserable")).toBe("question");
  });
});

describe("classifyInput — general", () => {
  it("empty -> general", () => {
    expect(classifyInput("")).toBe("general");
  });
  it("neutral statement -> general", () => {
    expect(classifyInput("tell me something")).toBe("general");
  });
});
