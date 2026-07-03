// The Dream Book — a fixed glossary of classic dream symbols with anchored
// meanings, so two people who dream of snakes never get contradictory
// readings. The AI must stay faithful to these anchors (prompt.ts injects
// them); they are the app's "house tradition".
//
// SOURCES — none of these meanings are invented here. Each anchor is a
// plain-voice distillation of the consensus across:
//   1. Gustavus Hindman Miller, "10,000 Dreams Interpreted" (1901, public
//      domain) — the classic Western dream dictionary.
//   2. Jungian dream symbolism — dreams as images of the dreamer's inner
//      life (the house as the self, the snake as transformation, water as
//      feeling).
//   3. Cross-cultural folk tradition, including the Ibn Sirin lineage of
//      Middle-Eastern dream interpretation (e.g. death read as change and
//      long life, a deceased relative's visit as a gentle counsel).
//   4. The symbol LIST follows dream-content research (Univ. of Montreal
//      analysis of 10,000+ dream reports; the "typical dreams"
//      questionnaire literature): the same 10–15 themes cover ~65% of
//      recalled dreams — chased, falling, school/exams, teeth, flying,
//      death, snakes, water, being late, being lost.
//
// EDITORIAL RULE (Dawnhalo's reading stance): where traditions disagree,
// the anchor keeps the shared core and reads it as the dreamer's inner
// weather — never a literal forecast, never doom. Death never foretells
// death; illness is never diagnosed.

export interface DreamSymbol {
  id: string;
  /** Display name of the symbol, e.g. "Teeth falling". */
  symbol: string;
  /** Matches the dream telling (tested against lowercased text). */
  pattern: RegExp;
  /** The anchored house meaning the reading must agree with. */
  anchor: string;
}

export const DREAM_BOOK: DreamSymbol[] = [
  {
    id: "teeth",
    symbol: "Teeth falling out",
    pattern: /\b(teeth|tooth)\b.*\b(fall|fell|falling|crumbl|break|broke|loose|losing|lost)|\b(losing|lost)\b.*\b(teeth|tooth)\b/,
    anchor:
      "The old dream of losing hold — of words, of control, of how one is seen. It marks a worry already awake, never a loss to come.",
  },
  {
    id: "chased",
    symbol: "Being chased",
    pattern: /\b(chas(ed|ing)|pursu(ed|ing)|running (away|from)|someone (was )?after me|being followed)\b/,
    anchor:
      "What is avoided has begun to follow. The dream does not name a danger ahead; it asks the dreamer to turn and face what is behind.",
  },
  {
    id: "falling",
    symbol: "Falling",
    pattern: /\b(falling|fell|fall)\b(?!.*\b(teeth|tooth|hair)\b)/,
    anchor:
      "Footing lost somewhere in waking life — a grip asking to be loosened before it is torn. It speaks of holding on, not of harm.",
  },
  {
    id: "flying",
    symbol: "Flying",
    pattern: /\b(flying|i flew|could fly|floating (above|over)|soaring)\b/,
    anchor:
      "The body remembering freedom: a wish to rise past what confines. Often it visits when something in waking life has begun to lift.",
  },
  {
    id: "death",
    symbol: "Death",
    pattern: /\b(died?|dying|death|funeral|coffin|corpse|grave)\b/,
    anchor:
      "In the old books death is change, not death: one chapter ending so another can begin. For a loved one, the bond changing shape. Never a forecast.",
  },
  {
    id: "dead_relative",
    symbol: "A deceased loved one visiting",
    pattern: /\b(dead|late|deceased|passed away)\b.*\b(mother|father|mom|dad|grand(ma|pa|mother|father)|sister|brother|aunt|uncle|friend|husband|wife)|\b(mother|father|grand(ma|pa|mother|father))\b.*\bwho (died|passed)\b/,
    anchor:
      "Every tradition reads this gently: what they carried in you still speaks. A visit of memory keeping counsel — comfort, not omen.",
  },
  {
    id: "snake",
    symbol: "Snake",
    pattern: /\b(snake|serpent|viper|cobra|python)s?\b/,
    anchor:
      "A coiled power not yet trusted. One book calls it an enemy sensed, another calls it healing and change; both agree something potent asks to be watched, not fled.",
  },
  {
    id: "spider",
    symbol: "Spider",
    pattern: /\b(spider|web|tarantula)s?\b/,
    anchor:
      "Patient weaving: slow careful work paying off — or small entanglements quietly tightening. The dream asks which web is being spun.",
  },
  {
    id: "water",
    symbol: "Water",
    pattern: /\b(water|ocean|sea|lake|river|swimming|waves?|rain)\b/,
    anchor:
      "Water is feeling. Clear and calm, the heart at rest; dark or troubled, emotions asking for more room than they have been given.",
  },
  {
    id: "flood",
    symbol: "Flood / drowning",
    pattern: /\b(flood(ing)?|tsunami|drown(ing|ed)?|water rising)\b/,
    anchor:
      "Feeling risen past its banks — more is being carried than the arms can hold. The dream measures the load, not the future.",
  },
  {
    id: "pregnancy",
    symbol: "Pregnancy",
    pattern: /\b(pregnan(t|cy)|expecting a (baby|child))\b/,
    anchor:
      "Something new growing that is not yet ready to be born — a plan, a self, a life. The dream marks the growing, not the date.",
  },
  {
    id: "baby",
    symbol: "A baby",
    pattern: /\b(bab(y|ies)|newborn|infant)\b/,
    anchor: "A fragile beginning placed in your care; tenderness toward what is just starting.",
  },
  {
    id: "birth",
    symbol: "Giving birth",
    pattern: /\b(giving birth|gave birth|in labou?r|delivered a baby)\b/,
    anchor: "Arrival: the labor of a beginning reaching its hour. Something carried long is ready to live outside you.",
  },
  {
    id: "wedding",
    symbol: "A wedding",
    pattern: /\b(wedding|getting married|marri(age|ed)|bride|groom)\b/,
    anchor:
      "A joining weighed in the heart — of two people, or of two parts of one life asking to live together.",
  },
  {
    id: "ex",
    symbol: "An ex",
    pattern: /\b(my ex\b|ex[- ](boyfriend|girlfriend|husband|wife|partner))\b/,
    anchor:
      "Rarely the person; usually what that season held. Something from it is unfinished and asks to be closed — a lesson, not a summons.",
  },
  {
    id: "cheating",
    symbol: "Cheating / betrayal",
    pattern: /\b(cheat(ing|ed)?|affair|unfaithful|betray(ed|al)?)\b/,
    anchor:
      "Not evidence — fear speaking. Dreamed of a partner, it is trust asking a question aloud; dreamed of oneself, a hunger for something missing looking for a door.",
  },
  {
    id: "naked",
    symbol: "Naked in public",
    pattern: /\b(naked|nude|no clothes|undressed)\b/,
    anchor: "Exposure: the fear of being seen as one is, before feeling ready. It visits the honest more than the shameful.",
  },
  {
    id: "exam",
    symbol: "An exam unprepared",
    pattern: /\b(exam|test|school|class(room)?|study(ing)?|homework|graduat)\b/,
    anchor:
      "The old classroom returns when life feels like a test. It speaks the fear of falling short — which is not proof of it.",
  },
  {
    id: "late",
    symbol: "Being late / missing a departure",
    pattern: /\b(being late|i was late|running late|miss(ed|ing) (the |my )?(train|plane|flight|bus|boat))\b/,
    anchor: "The fear that life is leaving without you; a chance held dear that you do not want to lose. Urgency, not verdict.",
  },
  {
    id: "lost",
    symbol: "Being lost",
    pattern: /\b(i was lost|being lost|couldn'?t find (my|the) way|lost in\b|wrong (road|way|turn))\b/,
    anchor: "Between maps: the old way gone, the new one not yet drawn. The dream marks the crossing, not a wrong life.",
  },
  {
    id: "house",
    symbol: "A house / new rooms",
    pattern: /\b(house|home|room|attic|basement|door|hallway)s?\b/,
    anchor:
      "In the old readings the house is the self. A new room is a part of you just discovered; the childhood home is who you were, paying a visit.",
  },
  {
    id: "fire",
    symbol: "Fire",
    pattern: /\b(fire|burning|flames?|house burn)\b/,
    anchor:
      "A consuming force — anger or passion — asking for a hearth instead of a wildfire. What burns wants tending, not fear.",
  },
  {
    id: "money_found",
    symbol: "Finding money",
    pattern: /\b(found|finding) (money|gold|coins|treasure)\b/,
    anchor: "Worth unnoticed until now; value lying where you had not thought to look — often your own.",
  },
  {
    id: "money_lost",
    symbol: "Losing money",
    pattern: /\b(lost|losing|stolen) (money|wallet|purse|gold)|\b(wallet|purse) (was )?(lost|stolen|gone)\b/,
    anchor: "Worry over worth and security walking in costume. What feels spent is asking to be replenished, not mourned.",
  },
  {
    id: "hair",
    symbol: "Hair falling out",
    pattern: /\b(hair)\b.*\b(fall|fell|falling|losing|lost|cut)\b/,
    anchor: "Strength and self-image worried over; the fear of fading. The worry is the message — not the fading.",
  },
  {
    id: "vehicle",
    symbol: "A vehicle out of control",
    pattern: /\b(car|vehicle|bus|train|plane)\b.*\b(crash(ed|ing)?|out of control|no brakes|couldn'?t (stop|steer))|\b(car (accident|crash))\b/,
    anchor:
      "The steering of a life questioned: a course moving faster than the grip on it. It asks for a hand back on the wheel, gently.",
  },
  {
    id: "trapped",
    symbol: "Being trapped",
    pattern: /\b(trapped|locked (in|up)|stuck in|couldn'?t (get out|escape|leave))\b/,
    anchor: "A situation with no visible door; the wish for out grown loud enough to dream. Doors exist that the dream cannot show.",
  },
  {
    id: "paralysis",
    symbol: "Unable to run or scream",
    pattern: /\b(couldn'?t (run|move|scream|shout|speak)|frozen|paraly(z|s)ed|legs (wouldn'?t|would not) (move|work))\b/,
    anchor: "Power stalled: the waking feeling of being unable to act or be heard, given a body. It names the stall, not a fate.",
  },
  {
    id: "storm",
    symbol: "A storm",
    pattern: /\b(storm|thunder|lightning|hurricane|tornado)\b/,
    anchor: "Turmoil passing through — weather, not climate. Storms in the old books clear the air they trouble.",
  },
  {
    id: "earthquake",
    symbol: "An earthquake",
    pattern: /\b(earthquake|ground (shaking|shook)|building collaps)\b/,
    anchor: "The ground of things questioned; foundations shifting so they may settle truer. Not ruin — resettling.",
  },
  {
    id: "attacked",
    symbol: "Being attacked",
    pattern: /\b(attack(ed|ing)?|robbed|robbery|assault(ed)?|someone tried to (hurt|kill) me)\b/,
    anchor: "Defenses raised: somewhere in waking life you feel under threat or taken from. The dream guards; it does not predict.",
  },
  {
    id: "ghost",
    symbol: "A ghost",
    pattern: /\b(ghost|spirit|haunted|phantom)s?\b/,
    anchor: "The past not yet at rest, still walking the halls. It asks for a proper goodbye, not an exorcism.",
  },
  {
    id: "birds",
    symbol: "Birds",
    pattern: /\b(birds?|eagle|dove|owl|crow|raven)\b/,
    anchor: "Messages and lightness; the wish for wings. Dark birds carry news of endings that are also releases.",
  },
  {
    id: "cat",
    symbol: "A cat",
    pattern: /\b(cats?|kitten)\b/,
    anchor: "The untamed familiar: independence and intuition kept close. What purrs in you also scratches when ignored.",
  },
  {
    id: "dog",
    symbol: "A dog",
    pattern: /\b(dogs?|puppy)\b/,
    anchor: "Loyalty and friendship — given, guarded, or questioned. A friendly dog is trust at ease; a hostile one, trust bruised.",
  },
  {
    id: "blood",
    symbol: "Blood",
    pattern: /\b(blood|bleeding)\b/,
    anchor: "Life force being spent; a cost being paid somewhere. The dream tallies the cost so the day can stop paying it.",
  },
  {
    id: "climbing",
    symbol: "Climbing",
    pattern: /\b(climb(ing|ed)?|mountain|steep (hill|stairs)|stairs going up)\b/,
    anchor: "Effort toward a height worth reaching; the long ascent. Tiredness on the climb is not a sign of the wrong mountain.",
  },
  {
    id: "repeat",
    symbol: "Trying again and again",
    pattern: /\b(kept trying|over and over|couldn'?t finish|repeatedly|again and again)\b/,
    anchor: "The loop of an unfinished task: something in waking life has not been allowed to complete. It asks for an ending, any ending.",
  },
  {
    id: "feast",
    symbol: "Delicious food",
    pattern: /\b(feast|delicious|eating|banquet|food)\b/,
    anchor: "Appetite and plenty: a hunger being answered. The old books read it kindly — permission to enjoy what is on the table.",
  },
];

/** Detect up to `max` distinct symbols from the Dream Book in a telling. */
export function detectDreamSymbols(text: string, max = 3): DreamSymbol[] {
  const t = text.toLowerCase();
  const hits: DreamSymbol[] = [];
  for (const s of DREAM_BOOK) {
    if (s.pattern.test(t)) {
      hits.push(s);
      if (hits.length >= max) break;
    }
  }
  return hits;
}

/** Render detected symbols as anchor lines for the model prompt. */
export function dreamAnchors(text: string): string {
  const hits = detectDreamSymbols(text);
  if (!hits.length) return "";
  const lines = hits.map((s) => `- ${s.symbol}: ${s.anchor}`).join("\n");
  return `\n\nSYMBOL ANCHORS from the house Dream Book (your reading must agree with these):\n${lines}`;
}
