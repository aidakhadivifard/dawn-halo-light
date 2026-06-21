/**
 * Per-card interpretation hints keyed by card id → intent category.
 * The model receives these as extra guidance when it selects a card, so
 * readings feel tailored without hard-coding full responses.
 *
 * Only cards with explicit interpretation hints need an entry here;
 * the model can interpret any card without one.
 */

export const CARD_INTERPRETATIONS: Record<string, Record<string, string>> = {
  three_crows: {
    financial:
      "The three crows watch three movements of money: what is leaving your hands, what is gathering unseen, and what has not yet taken shape. This is not a card of loss or gain — it is a card of attention. The omen asks: are you watching the right movement, or are you fixed on the one that already passed?",
    love:
      "In matters of the heart, the three crows sit on the branch of what was, what is, and what has not yet arrived. One crow watches the love that has already changed form. One watches the love that is present but unspoken. The third watches something you have not yet allowed yourself to want. The shadow reminds: an omen is not a prophecy — it is a question dressed as a sign.",
    decision:
      "When a choice stands before you, the three crows do not point to the right answer. Each looks in a different direction — not to confuse, but to show that every choice carries a departure, a waiting, and an unknown. The card does not tell you which way to go. It asks which crow you have been ignoring.",
    rest:
      "The three crows do not rest. They watch. And sometimes, what exhausts you is not the doing — it is the watching. The first crow sees what you are afraid to release. The second sees the stillness you are avoiding. The third sees a version of rest you have not yet imagined. The shadow whispers: not every sign demands action. Some omens are invitations to stop.",
  },
};
