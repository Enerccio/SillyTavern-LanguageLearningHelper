

export const COACH_PROMPT = `### PHASE 0: USER INPUT AUDIT PROTOCOL
Analyze the IMMEDIATELY FOLLOWING user text for Japanese strings.

1. CRITICAL SCOPE: Evaluate only the text bounded between the "USER_START" and "USER_END" tags below. Do not analyze previous chat history.
2. CRITICAL CONDITION: If that text contains zero Japanese strings, completely omit the [LLH_COACH] block. Do not output empty tags or placeholder text.
3. OUTPUT FORMAT: If Japanese is present, write a detailed grammatical critique entirely in {{sourceLanguage}}. Output it at the absolute top of your response, wrapped strictly inside [LLH_COACH] and [/LLH_COACH] tags. You must force exactly two newlines immediately after the opening [LLH_COACH] tag, and exactly two newlines immediately before and after the closing [/LLH_COACH] tag.

[USER_START]
{{userPrompt}}
[USER_END]`;

export const DEFAULT_PROMPT = `### CORE MISSION: NARRATIVE CONTINUATION
Advance the roleplay narrative seamlessly. Generate the next story beat, dialogue, and character actions by reacting directly to the events, choices, and dialogue provided by the user within the [USER_START] and [USER_END] tags above.

### SYSTEM CONDITION PASSTHROUGH GATE
If the execution of the immediate narrative beat does not organically contain native {{language}} strings (e.g., characters are isolated, sleeping, or communicating exclusively in other languages only), this entire processing protocol is completely INACTIVE. You are strictly prohibited from generating superficial, synthetic, or arbitrary {{language}} tokens (such as unnatural self-talk, forced muttering, or unprompted dialogue) merely to trigger this formatting schema. If zero {{language}} tokens are generated organically, do not append the [TRANSLATION_NOTES] block.

### CRITICAL RESTRUCTURING RULE
You must use a two-phase footnote system for all text generated in {{language}}, regardless of whether it is dialogue, narration, or description.

- NEVER include translations or explanations for text inside [USER_START] and [USER_END] in your final appendix.

### PHASE 1: INLINE FOOTNOTE MARKERS
Every time you complete a logical sentence or clause in {{language}} OUTSIDE of [USER_START] and [USER_END], you must immediately append a simple, sequential numeric footnote marker inline (e.g., [LLH_FN_1], [LLH_FN_2]).

CRITICAL SYSTEM OPERATION REGULATION:
The uppercase string "LLH" is a static, hardcoded backend compilation hash prefix (Low-Level Header). It is a system-level formatting tag, NOT a character name acronym, and it has zero narrative or contextual meaning. You must strictly use the exact prefix [LLH_FN_#] globally for ALL generated Japanese text, regardless of which character is active. Do not dynamically alter, adapt, or invent new prefixes under any circumstances.

### PHASE 2: THE END-OF-RESPONSE APPENDIX
At the absolute end of your entire response, after all story text, dialogue, and narration are finished, you must generate a compilation block containing the translation data for every footnote used above.

To ensure formatting safety, you must strictly wrap the entire appendix inside a [TRANSLATION_NOTES] wrapper. You MUST provide the translations entirely in {{sourceLanguage}}, and you MUST provide the grammatical explanations entirely in {{grammarLanguage}}. Nest each individual footnote inside a [BLOCK] layout, matching the inline numbers perfectly:

[TRANSLATION_NOTES]
[BLOCK][FOOTNOTE_NUMBER] [TRANSLATION]Translation of the footnote section into {{sourceLanguage}}[/TRANSLATION] [EXPLANATION]A strict linguistic and grammatical breakdown of the {{language}} vocabulary tokens used above, written entirely in {{grammarLanguage}}. CRITICAL: Do not describe character emotions, plot implications, or story context. Focus strictly on vocabulary definitions, particles, verb conjugations, and structural syntax analysis.[/EXPLANATION] [/BLOCK]
[/TRANSLATION_NOTES]

### ENFORCEMENT MANDATES:
1. The [EXPLANATION] tag must contain ONLY technical grammatical syntax analysis and direct lexical token mappings.
2. You are strictly forbidden from summarizing narrative context, analyzing character motivations, or evaluating internal psychological thoughts inside the [EXPLANATION] tag. Keep the data strictly limited to formal structural linguistics and raw syntactic breakdown mechanics.

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
            isCoachModeEnabled: false,
            targetLanguage: "Japanese",
            sourceLanguage: "English",
            grammarLanguage: "English",
            customPromptOverride: DEFAULT_PROMPT,
            coachPromptOverride: COACH_PROMPT
        }
    },
    characterBinds: {},
    chatBinds: {}
};
