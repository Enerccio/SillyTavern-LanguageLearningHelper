
export const DEFAULT_PROMPT = `### CRITICAL RESTRUCTURING RULE
You must use a two-phase footnote system for all text generated in {{language}}, regardless of whether it is dialogue, narration, or description.

- NEVER include translations or explanations for text inside curly brackets in your final appendix.
- Treat curly brackets as an absolute "no-footnote" zone.

### PHASE 1: INLINE FOOTNOTE MARKERS
Every time you complete a logical sentence or clause in {{language}} OUTSIDE of curly brackets, you must immediately append a simple, sequential numeric footnote marker inline (e.g., [LLH_FN_1], [LLH_FN_2]). Do not put any tags here.

### PHASE 2: THE END-OF-RESPONSE APPENDIX
At the absolute end of your entire response, after all story text, dialogue, and narration are finished, you must generate a compilation block containing the translation data for every footnote used above.

To ensure formatting safety, you must strictly wrap the entire appendix inside a [TRANSLATION_NOTES] wrapper. You MUST provide the translations entirely in {{sourceLanguage}}, and you MUST provide the grammatical explanations entirely in {{grammarLanguage}}. Nest each individual footnote inside a [BLOCK] layout, matching the inline numbers perfectly:

[TRANSLATION_NOTES]
[BLOCK][FOOTNOTE_NUMBER] [TRANSLATION]Translation of the footnote section into {{sourceLanguage}}[/TRANSLATION] [EXPLANATION]A strict linguistic and grammatical breakdown of the {{language}} vocabulary tokens used above, written entirely in {{grammarLanguage}}. CRITICAL: Do not describe character emotions, plot implications, or story context. Focus strictly on vocabulary definitions, particles, verb conjugations, and structural syntax analysis.[/EXPLANATION] [/BLOCK]
[/TRANSLATION_NOTES]

### ENFORCEMENT MANDATES:
1. The [EXPLANATION] tag must contain ONLY technical grammatical syntax analysis and vocabulary token translations.
2. You are strictly forbidden from summarizing the story meaning, analyzing character motivations, or evaluating inner thoughts inside the [EXPLANATION] tag. Keep it strictly focused on language learning mechanics.

### ENFORCEMENT MANDATES:
1. Do not mix the phases. Never output a [TRANSLATION_NOTES] structure inline mid-story. Wait until the absolute end.
2. Every inline marker must have a corresponding, fully closed block inside the appendix.

### STRICT COMPLIANCE MANDATES
1. FORMAT ACCURACY: Every single opening marker like [TRANSLATION_NOTES], [BLOCK], [TRANSLATION], and [EXPLANATION] must have an identical, explicit closing marker prefixed with a slash (e.g., [/TRANSLATION_NOTES], [/BLOCK], [/TRANSLATION], [/EXPLANATION]).
2. CHARACTER ESCAPING: If your translation or explanation text contains raw comparison symbols (like "<" or ">") or ampersands ("&"), you MUST escape them using standard entities (e.g., use "&lt;" for "<", "&gt;" for ">", and "&amp;" for "&").
3. NO CODE BLOCKS: Do not wrap these markers inside markdown code block wrappers (do not use triple backticks \`\`\`). Output the raw text blocks directly into the text stream.
`;

export const DEFAULT_SETTINGS = {
    activeGlobalProfile: "Default",
    showContextToasts: true,
    profiles: {
        "Default": {
            isProfileEnabled: true,
            isBlurDisabled: false,
            targetLanguage: "Japanese",
            sourceLanguage: "English",
            grammarLanguage: "English",
            customPromptOverride: DEFAULT_PROMPT
        }
    },
    characterBinds: {},
    chatBinds: {}
};
